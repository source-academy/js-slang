import { generate } from 'astring';
import type es from 'estree';
import { type RawSourceMap, SourceMapGenerator } from 'source-map';
import type { Context, NativeStorage, Node } from '../types';
import type * as operators from '../utils/operators';
import * as create from '../utils/ast/astCreator';
import { NATIVE_STORAGE_ID, UNKNOWN_LOCATION } from '../constants';
import { Chapter, Variant } from '../langs';
import assert from '../utils/assert';
import {
  extractDeclarations,
  filterImportDeclarations,
  getImportedName,
} from '../utils/ast/helpers';
import {
  isDeclaration,
  isNamespaceSpecifier,
  isVariableDeclaration,
} from '../utils/ast/typeGuards';
import {
  getFunctionDeclarationNamesInProgram,
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getUniqueId,
} from '../utils/uniqueIds';
import { checkForUndefinedVariables } from '../validator/validator';

interface TranspilationContext {
  nativeIds: NativeIds;
  chapter: Chapter;
  isPrelude: boolean;
  usedIdentifiers: Set<string>;
}

const nativeIdKeys = [
  'native',
  'callIfFuncAndRightArgs',
  'boolOrErr',
  'wrap',
  'unaryOp',
  'binaryOp',
  'throwIfTimeout',
  'setProp',
  'getProp',
  // 'builtins',
] satisfies (keyof typeof operators | 'native')[];

type NativeIds = Record<(typeof nativeIdKeys)[number], es.Identifier>;

function getNodeLoc({ loc }: Node) {
  const { line, column } = (loc ?? UNKNOWN_LOCATION).start;
  const source = loc?.source ?? null;

  return { line, column, source };
}

/**
 * Assign each nativeId a unique identifier. Updates the
 * set of used identifiers.
 */
function getNativeIds(usedIdentifiers: Set<string>): NativeIds {
  return nativeIdKeys.reduce(
    (res, identifier) => ({
      ...res,
      [identifier]: create.identifier(getUniqueId(usedIdentifiers, identifier)),
    }),
    {} as NativeIds,
  );
}

/**
 * Returns all the names of variables declared within the set of statements. Will not
 * do it recursively.
 */
export function getDeclaredIdentifiers(statements: es.Statement[]): string[] {
  return statements.flatMap(decl => {
    if (isVariableDeclaration(decl)) {
      return extractDeclarations(decl).map(({ name }) => name);
    }
    return [];
  });
}

/**
 * Appends a variable declaration declaring the given builtin. Each builtin can be found inside the `builtins` map
 * on the `nativeStorage` object, so it would look like this:
 * - `const math_PI = nativeStorage.builtins.get('math_PI');`
 */
export function getBuiltins(nativeStorage: NativeStorage) {
  const builtinDeclarations: es.Statement[] = [];

  for (const builtin of nativeStorage.builtins.keys()) {
    builtinDeclarations.push(
      create.constantDeclaration(
        builtin,
        create.callExpression(
          // These are always at the top level of the program, so the 'native' alternate identifier
          // is not in scope
          create.memberExpression(
            create.memberExpression(create.identifier(NATIVE_STORAGE_ID), 'builtins'),
            'get',
          ),
          [create.literal(builtin)],
        ),
      ),
    );
  }

  return builtinDeclarations;
}

/**
 * The evaller function is used to evaluate new code within the current evaluation context. This function
 * returns the ast representation of the "evaller", which looks like this
 * in code: `native.evaller = program0 => eval(program0)`.
 */
export function getEvallerReplacer(
  nativeStorageId: NativeIds['native'],
  usedIdentifiers: Set<string>,
): es.ExpressionStatement {
  const arg = create.identifier(getUniqueId(usedIdentifiers, 'program'));
  return create.expressionStatement(
    create.assignmentExpression(
      create.memberExpression(nativeStorageId, 'evaller'),
      create.arrowFunctionExpression(
        [arg],
        create.callExpression(create.identifier('eval'), [arg]),
      ),
    ),
  );
}

/**
 * Separates out all the import declarations within the given program.
 *
 * Loaded modules are stored into a variable that's accessible within the program,
 * so they can simply be declared at the top level of the program as VariableDeclarations.
 * Each specifier is given its own declaration.
 *
 * ```js
 * import { repeat as r } from 'repeat';
 * // becomes
 * const r = nativeStorage.loadedModules.repeat.repeat;
 * ```
 */
export function transformImportDeclarations(
  program: es.Program,
  moduleExpr: es.Expression,
): [es.VariableDeclaration[], Exclude<es.Program['body'][0], es.ImportDeclaration>[]] {
  const [importNodes, otherNodes] = filterImportDeclarations(program);
  const declNodes = importNodes.flatMap((moduleName, nodes) => {
    const expr = create.memberExpression(moduleExpr, moduleName);

    return nodes.flatMap(({ specifiers }) =>
      specifiers.map(spec =>
        create.constantDeclaration(
          spec.local.name,
          isNamespaceSpecifier(spec) ? expr : create.memberExpression(expr, getImportedName(spec)),
        ),
      ),
    );
  });

  return [declNodes, otherNodes];
}

/**
 * BinaryExpressions get transformed to calls to {@link operators.binaryOp| the binaryOp function}, which provides type checking.
 * For example: `1 + 1` gets transformed to `binaryOp('+', Chapter.SOURCE_4, 1, 1);`
 */
function transformBinaryExpression(node: es.BinaryExpression, ctx: TranspilationContext) {
  const { line, column, source } = getNodeLoc(node);

  return create.callExpression(ctx.nativeIds.binaryOp, [
    create.literal(node.operator),
    create.literal(ctx.chapter),
    // `left` is `Expression | PrivateIdentifier`; private-in expressions are
    // not valid in Source, so the operand is always an Expression.
    transformNode(node.left as es.Expression, ctx),
    transformNode(node.right, ctx),
    create.literal(line),
    create.literal(column),
    create.literal(source),
  ]);
}

/**
 * UnaryExpressions get transformed to calls to {@link operators.unaryOp|the unaryOp function}, which provides type checking.
 * For example: `!true` gets transformed to `unaryOp('!', true)`
 */
function transformUnaryExpression(node: es.UnaryExpression, ctx: TranspilationContext) {
  const { line, column, source } = getNodeLoc(node);

  return create.callExpression(
    ctx.nativeIds.unaryOp,
    [
      create.literal(node.operator),
      transformNode(node.argument, ctx),
      create.literal(line),
      create.literal(column),
      create.literal(source),
    ],
    node.loc,
  );
}

/**
 * Certain node types require boolean expressions. For example, the `test` portion of a while loop should be a boolean.
 * These test expressions get transformed to calls to {@link operators.boolOrErr | boolOrErr} to ensure that
 * they do indeed evaluate to a boolean at runtime.
 * For example:
 * ```js
 * if (x && y) { return 0; }
 * ```
 * gets transformed to
 * ```js
 * if (boolOrErr(x && y)) { return 0; }
 * ```
 * This function only transforms the test expression.
 */
function transformBooleanTest(
  node:
    | es.IfStatement
    | es.ConditionalExpression
    | es.LogicalExpression
    | es.ForStatement
    | es.WhileStatement,
  ctx: TranspilationContext,
) {
  // We have to pass in the entire node because we want the location information of the
  // parent of the test
  const { line, column, source } = getNodeLoc(node);

  return create.callExpression(ctx.nativeIds.boolOrErr, [
    transformNode(
      node.type === 'LogicalExpression' ? node.left : (node.test as es.Expression),
      ctx,
    ),
    create.literal(line),
    create.literal(column),
    create.literal(source),
  ]);
}

/**
 * Property assignment expressions get transformed to calls to {@link operators.getProp | getProp} to ensure that array
 * indices are correct/the desired property exists on the target expression
 *
 * `obj.foo` gets transpiled to `getProp(obj, 'foo')`
 */
function transformPropertyAccess(node: es.MemberExpression, ctx: TranspilationContext) {
  const { line, column, source } = getNodeLoc(node);

  // Ignore super.foo
  if (node.object.type === 'Super') {
    const newNode: es.MemberExpression = {
      ...node,
      object: transformNode(node, ctx),
      property: transformNode(node, ctx),
    };
    return newNode;
  }

  return create.callExpression(
    ctx.nativeIds.getProp,
    [
      transformNode(node.object, ctx),
      node.property.type === 'Identifier' && !node.computed
        ? create.literal(node.property.name)
        : transformNode(node.property as es.Expression, ctx),
      create.literal(line),
      create.literal(column),
      create.literal(source),
    ],
    node.loc,
  );
}

/**
 * Assignment to member expressions get transformed into calls to {@link operators.setProp|setProp}, which provides
 * type checking (i.e arrays must be indexed with numbers).
 * For example:
 * ```js
 * a[0] = "a";
 * // gets transformed into
 * setProp(a, 0, "a");
 * ```
 */
function transformPropertyAssignment(node: es.AssignmentExpression, ctx: TranspilationContext) {
  const { line, column, source } = getNodeLoc(node);

  assert(node.operator === '=', `Unsupported assignment operator: ${node.operator}`, node);

  if (node.left.type !== 'MemberExpression') {
    const newNode: es.AssignmentExpression = {
      ...node,
      right: transformNode(node.right, ctx),
    };
    return newNode;
  }

  const memberExpr = node.left;

  return create.callExpression(
    ctx.nativeIds.setProp,
    [
      memberExpr.object as es.Expression,
      memberExpr.property.type === 'Identifier' && !memberExpr.computed
        ? create.literal(memberExpr.property.name)
        : transformNode(memberExpr.property as es.Expression, ctx),
      transformNode(node.right, ctx),
      create.literal(line),
      create.literal(column),
      create.literal(source),
    ],
    node.loc,
  );
}

/**
 * CallExpressions get transformed into a call to {@link operators.callIfFuncAndRightArgs}. This provides type
 * checking and argument length verification.
 * ```js
 * foo("a", "b");
 * // gets transformed into
 * callIfFuncAndRightArgs(foo, 1, 1, null, nativeStorage, "a", "b");
 * ```
 *
 * A special case occurs when MemberExpressions are called. The bound version also called instead:
 * ```js
 * obj.foo("a", "b");
 * // gets transformed into
 * callIfFuncAndRightArgs(foo.bind(obj), 1, 1, null, nativeStorage, "a", "b");
 * ```
 */
function transformCallExpression(node: es.CallExpression, ctx: TranspilationContext) {
  const { line, column, source } = getNodeLoc(node);

  let callee: es.Expression;
  if (node.callee.type === 'Identifier') {
    const calleeName = node.callee.name;

    if (Object.values(ctx.nativeIds).some(({ name }) => name === calleeName)) {
      // Any calls to transpiler internals don't need to get wrapped
      return node;
    }
    callee = node.callee;
  }
  // else if (node.callee.type === 'MemberExpression') {
  // TODO: Probably need a more robust solution for this
  // const oldObject = transformNode(node.callee.object as es.Expression, ctx);
  // callee = create.callExpression(
  //   create.memberExpression(
  //     transformPropertyAccess(
  //       {
  //         ...node.callee,
  //         type: 'MemberExpression',
  //         property: node.callee.property,
  //         object: oldObject,
  //       },
  //       ctx
  //     ),
  //     'bind',
  //     true
  //   ),
  //   [oldObject]
  // )
  // }
  else {
    callee = transformNode(node.callee as es.Expression, ctx);
  }

  return create.callExpression(
    ctx.nativeIds.callIfFuncAndRightArgs,
    [
      callee,
      create.literal(line),
      create.literal(column),
      create.literal(source),
      ctx.nativeIds.native,
      ...node.arguments.map(each => transformNode(each as any, ctx)),
    ],
    node.loc,
  );
}

/**
 * For functions that need to call other functions (or itself recursively) and then use
 * the returned values, we must augment their return values to allow proper tail calls.
 * This function should be used on the `argument` of a ReturnStatement or on the body
 * of an expression returning ArrowFunctionExpression.
 */
function transformReturnExpression(node: es.Expression, ctx: TranspilationContext): es.Expression {
  switch (node.type) {
    case 'LogicalExpression': {
      return {
        ...node,
        left: transformBooleanTest(node, ctx),
        right: transformReturnExpression(node.right, ctx),
      };
    }
    case 'ConditionalExpression': {
      const newTest = transformBooleanTest(node, ctx);
      const newConsequent = transformReturnExpression(node.consequent, ctx);
      const newAlternate = transformReturnExpression(node.alternate, ctx);

      return create.conditionalExpression(newTest, newConsequent, newAlternate, node.loc);
    }
    case 'CallExpression': {
      const { line, column, source } = getNodeLoc(node);

      const functionName = node.callee.type === 'Identifier' ? node.callee.name : '<anonymous>';

      if (!Object.values(ctx.nativeIds).some(({ name }) => name === functionName)) {
        const newCallee = transformNode(node.callee as es.Expression, ctx);
        const newArgs = node.arguments.map(each => transformNode(each as any, ctx));

        return create.objectExpression([
          create.property('isTail', create.literal(true)),
          create.property('function', newCallee),
          create.property('functionName', create.literal(functionName)),
          create.property('arguments', create.arrayExpression(newArgs)),
          create.property('line', create.literal(line)),
          create.property('column', create.literal(column)),
          create.property('source', create.literal(source)),
        ]);
      }
    }
    default:
      return create.objectExpression([
        create.property('isTail', create.literal(false)),
        create.property('value', transformNode(node, ctx)),
      ]);
  }
}

/**
 * All functions in Source get transformed into ArrowFunctionExpressions.
 * Wherever ArrowFunctionExpressions are declared, they get wrapped with a call to {@link operators.wrap|wrap} that
 * provides varargs information and stringification to Source.
 *
 * Each return statement must also be transformed by {@link transformReturnExpression}.
 * ```js
 * function foo(x) {
 *   return x;
 * }
 * // roughly becomes
 * const foo = wrap(x => ({
 *  isTail: false,
 *   value: x
 * }), false, "function foo(x) { return x; } ");
 * ```
 */
function transformFunction(
  f: es.MaybeNamedFunctionDeclaration | es.FunctionExpression | es.ArrowFunctionExpression,
  ctx: TranspilationContext,
  name?: string,
): es.CallExpression {
  const newBody =
    f.body.type === 'BlockStatement'
      ? transformNode(f.body, ctx)
      : transformReturnExpression(f.body, ctx);

  return create.callExpression(
    ctx.nativeIds.wrap,
    [
      {
        ...f,
        type: 'ArrowFunctionExpression',
        expression: f.type === 'ArrowFunctionExpression' && f.expression,
        body: newBody,
      },
      create.literal(f.params[f.params.length - 1]?.type === 'RestElement'),
      create.literal(generate(f)),
      create.literal(ctx.isPrelude ? 'prelude' : null),
      name === undefined ? create.identifier('undefined') : create.literal(name),
    ],
    f.loc,
  );
}

/**
 * Before each loop, we call `get_time` and store when the loop first began executing. Then, before we execute
 * each iteration, we check that the time since we started looping hasn't yet exceeded the maxExecTime via a call
 * to {@link operators.throwIfTimeout|throwIfTimeout}.
 *
 * This function returns the transformed loop body and the start time declaration.
 *
 * ```js
 * while (true) x = x + 1;
 * // gets transformed into
 *
 * const startTime = get_time();
 * while (true) {
 *   throwIfTimeout(native, startTime, get_time(), 1, 1, null);
 *   x = x + 1;
 * }
 * ```
 */
function addInfiniteLoopProtection(
  node: es.ForStatement | es.WhileStatement,
  ctx: TranspilationContext,
): [es.VariableDeclaration, es.BlockStatement] {
  const getTimeAst = () => create.callExpression(create.identifier('get_time'), []);

  const { line, column, source } = getNodeLoc(node);
  const startTimeConst = getUniqueId(ctx.usedIdentifiers, 'startTime');

  const throwIfTimeoutCall = create.expressionStatement(
    create.callExpression(ctx.nativeIds.throwIfTimeout, [
      ctx.nativeIds.native,
      create.identifier(startTimeConst),
      getTimeAst(),
      create.literal(line),
      create.literal(column),
      create.literal(source),
    ]),
  );

  const { body } = node;
  return [
    create.constantDeclaration(startTimeConst, getTimeAst()),
    create.blockStatement(
      body.type === 'BlockStatement'
        ? [throwIfTimeoutCall, ...transformNode(body, ctx).body]
        : [throwIfTimeoutCall, transformNode(body, ctx)],
    ),
  ];
}

/**
 * There are a set of internal functions and variables that the transpiler must have access to. This
 * function creates a VariableDeclaration for every single internal that is required.
 */
function getDeclarationsToAccessTranspilerInternals(
  nativeIds: NativeIds,
): es.VariableDeclaration[] {
  return Object.entries(nativeIds).map(([key, { name }]) => {
    let value: es.Expression;
    if (key === 'native') {
      value = create.identifier(NATIVE_STORAGE_ID);
    } else if (key === 'globals') {
      value = create.memberExpression(nativeIds.native, 'globals');
    } else {
      value = create.callExpression(
        create.memberExpression(create.memberExpression(nativeIds.native, 'operators'), 'get'),
        [create.literal(key)],
      );
    }
    return create.constantDeclaration(name, value);
  });
}

function transformStatements(stmts: es.Statement[], ctx: TranspilationContext): es.Statement[] {
  return stmts.flatMap(node => {
    switch (node.type) {
      case 'ForStatement': {
        const [startTimeDecl, newBody] = addInfiniteLoopProtection(node, ctx);
        return [
          startTimeDecl,
          {
            ...node,
            init: node.init ? transformNode(node.init as any, ctx) : undefined,
            test: node.test ? transformBooleanTest(node, ctx) : undefined,
            update: node.update ? transformNode(node.update, ctx) : undefined,
            body: newBody,
          },
        ];
      }
      case 'WhileStatement': {
        const newTest = transformBooleanTest(node, ctx);
        const [startTimeDecl, newBody] = addInfiniteLoopProtection(node, ctx);
        return [
          startTimeDecl,
          {
            ...node,
            test: newTest,
            body: newBody,
          },
        ];
      }
      default:
        return [transformNode(node, ctx)];
    }
  });
}

function transformNode(node: es.Expression, ctx: TranspilationContext): es.Expression;
function transformNode(node: es.BlockStatement, ctx: TranspilationContext): es.BlockStatement;
function transformNode(node: es.Statement, ctx: TranspilationContext): es.Statement;
function transformNode(node: Exclude<Node, es.Program>, ctx: TranspilationContext): Node {
  switch (node.type) {
    // Expressions
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return transformFunction(node, ctx);
    case 'AssignmentExpression':
      return transformPropertyAssignment(node, ctx);
    case 'BinaryExpression':
      return transformBinaryExpression(node, ctx);
    case 'CallExpression':
      return transformCallExpression(node, ctx);
    case 'ConditionalExpression':
      return {
        ...node,
        alternate: transformNode(node.alternate, ctx),
        consequent: transformNode(node.consequent, ctx),
        test: transformBooleanTest(node, ctx),
      };
    case 'LogicalExpression':
      return {
        ...node,
        left: transformBooleanTest(node, ctx),
        right: transformNode(node.right, ctx),
      };
    case 'MemberExpression':
      return transformPropertyAccess(node, ctx);
    case 'UnaryExpression':
      return transformUnaryExpression(node, ctx);

    // Statements
    case 'BlockStatement':
      return {
        ...node,
        body: transformStatements(node.body, ctx),
      };
    case 'ExpressionStatement':
      return {
        ...node,
        expression: transformNode(node.expression, ctx),
      };
    case 'FunctionDeclaration': {
      const name = node.id?.name;
      const newFunc = transformFunction(node, ctx, name);

      if (name !== undefined) {
        return create.constantDeclaration(name, newFunc, node.loc);
      } else {
        return newFunc;
      }
    }
    case 'IfStatement':
      return {
        ...node,
        test: transformBooleanTest(node, ctx),
        alternate: node.alternate ? transformNode(node.alternate, ctx) : undefined,
        consequent: transformNode(node.consequent, ctx),
      };
    case 'ReturnStatement':
      return {
        ...node,
        argument: node.argument ? transformReturnExpression(node.argument, ctx) : undefined,
      };
    case 'VariableDeclaration':
      return {
        ...node,
        declarations: node.declarations.map(each => ({
          ...each,
          init: each.init ? transformNode(each.init, ctx) : undefined,
        })),
      };
    default:
      return node;
  }
}

export interface TranspiledResult {
  transpiled: string;
  sourceMapJson?: RawSourceMap;
}

function transpileToSource(
  program: es.Program,
  context: Context,
  skipUndefined: boolean,
  isPrelude: boolean = false,
): TranspiledResult {
  if (program.body.length === 0) {
    return { transpiled: '' };
  }

  checkForUndefinedVariables(program, context, skipUndefined);

  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage),
  ]);
  const nativeIds = getNativeIds(usedIdentifiers);

  // Separate out import nodes so that we can collate them together
  const [importNodes, otherNodes] = transformImportDeclarations(
    program,
    create.memberExpression(nativeIds.native, 'loadedModules'),
  );

  const transformedNodes = transformStatements(otherNodes as es.Statement[], {
    isPrelude,
    chapter: context.chapter,
    usedIdentifiers,
    nativeIds,
  });

  // We collect all globally declared identifiers here since this won't
  // include any internals
  getDeclaredIdentifiers([...importNodes, ...transformedNodes]).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );

  const newStatements = [
    // First, transpiler internals are declared
    ...getDeclarationsToAccessTranspilerInternals(nativeIds),
    // Then, the evaller replacer is added
    getEvallerReplacer(nativeIds.native, usedIdentifiers),
    // This `undefined` is required so that if the user program is empty
    // the entire program evaluates to undefined, as it should
    create.expressionStatement(create.identifier('undefined')),
    // Then, everything declared as an import since imports should behave
    // like they're hoisted
    ...importNodes,
    // Then, the transformed program body
    ...transformedNodes,
  ];

  // If this isn't the first time we're evaluating using this context, then
  // we don't need to redeclare all our builtins
  const newBody =
    context.nativeStorage.evaller === null
      ? [...getBuiltins(context.nativeStorage), create.blockStatement(newStatements)]
      : [create.blockStatement(newStatements)];

  const map = new SourceMapGenerator({ file: 'source' });
  const transpiled = generate(create.program(newBody), { sourceMap: map });
  const sourceMapJson = map.toJSON();
  return { transpiled, sourceMapJson };
}

export function transpileToFullJS(
  program: es.Program,
  context: Context,
  skipUndefined: boolean,
): TranspiledResult {
  if (program.body.length === 0) {
    return { transpiled: '' };
  }

  checkForUndefinedVariables(program, context, skipUndefined);

  const [importNodes, otherNodes] = transformImportDeclarations(
    program,
    create.memberExpression(create.identifier(NATIVE_STORAGE_ID), 'loadedModules'),
  );

  const userCode = [...importNodes, ...(otherNodes as es.Statement[])];

  getFunctionDeclarationNamesInProgram(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );

  getDeclaredIdentifiers(userCode).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );

  /*
   * Because of the weird and funky way fullJSRunner works, the builtins get evaluated as if they were a user
   * program. Normally, the evaller replacer sits at the top of the user program, followed by an `undefined` expression,
   * then any user code:
   * ```
   * {
   *   native.evaller = program => eval(program)
   *   undefined;
   *   const x = 0;
   * }
   * ```
   * But one of the builtins that gets declared is `undefined`, which means we get a ReferenceError if we try to transpile
   * the builtins program normally:
   * ```
   * {
   *   native.evaller = program => eval(program)
   *   undefined; // Can't access undefined before initialization
   *   const undefined = native.builtins.get('undefined');
   * }
   * ```
   * We need to have the `undefined` there, because when the user program gets evaluated, declaration statements don't produce
   * values, so the program evaluates to <Function anonymous> because of the evaller replacer.
   * ```
   * {
   *   native.evaller = program => eval(program)
   *   undefined;
   *   const x = 0;
   * }
   * // evaluates to <Function anonymous>
   * ```
   * So what we need to do is
   * Check if the program only consists of declarations. If so, append `undefined` to the end of the program.
   * `undefined` is either declared as part of the previous program, or declared by one of the declarations above, so no ReferenceError
   *
   * If there are value producing statements, we don't need to append `undefined`, as the last value producing statement will
   * hide the value of the evaller.
   */
  const wrappedStatements = userCode.some(each => !isDeclaration(each))
    ? userCode
    : [...userCode, create.expressionStatement(create.identifier('undefined'))];

  const transpiledProgram: es.Program = create.program([
    create.blockStatement([
      getEvallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set()),
      ...wrappedStatements,
    ]),
  ]);

  const sourceMap = new SourceMapGenerator({ file: 'source' });
  const transpiled = generate(transpiledProgram, { sourceMap });
  const sourceMapJson = sourceMap.toJSON();

  return { transpiled, sourceMapJson };
}

export function transpile(
  program: es.Program,
  context: Context,
  isPrelude: boolean,
  skipUndefined?: boolean,
): TranspiledResult {
  if (context.chapter === Chapter.FULL_JS) {
    return transpileToFullJS(program, context, skipUndefined ?? true);
  } else if (context.variant === Variant.NATIVE) {
    return transpileToFullJS(program, context, skipUndefined ?? false);
  } else {
    console.log('transpiling to source');
    return transpileToSource(program, context, skipUndefined ?? false, isPrelude);
  }
}
