import { generate } from 'astring';
import type es from 'estree';
import type { Context, NativeStorage, Node, NodeTypeToNode } from '../types';
import type * as operators from '../utils/operators';
import * as create from '../utils/ast/astCreator';
import { NATIVE_STORAGE_ID, UNKNOWN_LOCATION } from '../constants';
import type { Chapter } from '../langs';
import assert from '../utils/assert';
import {
  extractDeclarations,
  filterImportDeclarations,
  getImportedName,
} from '../utils/ast/helpers';
import { isNamespaceSpecifier, isVariableDeclaration } from '../utils/ast/typeGuards';
import {
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getUniqueId,
} from '../utils/uniqueIds';

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
 * Returns all the names of variables declared at the top top-level of the program
 */
function getGloballyDeclaredIdentifiers(statements: es.Statement[]): string[] {
  return statements.flatMap(decl => {
    if (isVariableDeclaration(decl)) {
      return extractDeclarations(decl).map(({ name }) => name);
    }
    return [];
  });
}

/**
 * The evaller function is used to evaluate new code within the current evaluation context. This function
 * returns the ast representation of the "evaller", which looks like this
 * in code: `native.evaller = program0 => eval(program0)`.
 */
function getEvallerReplacer(
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
 * Appends a variable declaration declaring the given builtin. Each builtin can be found inside the `builtins` map
 * on the `nativeStorage` object, so it would look like this:
 * - `const math_PI = nativeStorage.builtins.get('math_PI');`
 * Then, it wraps the user program within a BlockStatement to prevent identifiers from user code from clashing
 * with builtin code. This BlockStatement gets appended to the builtin declarations.
 */
function wrapWithBuiltins(progStmts: es.Statement[], nativeStorage: NativeStorage) {
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

  builtinDeclarations.push(create.blockStatement(progStmts));

  return builtinDeclarations;
}

function transformImportDeclarations(
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

  return create.callExpression(ctx.nativeIds.getProp, [
    transformNode(node.object, ctx),
    node.property.type === 'Identifier'
      ? create.literal(node.property.name)
      : transformNode(node.property as es.Expression, ctx),
    create.literal(line),
    create.literal(column),
    create.literal(source),
  ]);
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

  return create.callExpression(ctx.nativeIds.setProp, [
    memberExpr.object as es.Expression,
    memberExpr.property.type === 'Identifier'
      ? create.literal(memberExpr.property.name)
      : transformNode(memberExpr.property as es.Expression, ctx),
    transformNode(node.right, ctx),
    create.literal(line),
    create.literal(column),
    create.literal(source),
  ]);
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

  return create.callExpression(ctx.nativeIds.callIfFuncAndRightArgs, [
    callee,
    create.literal(line),
    create.literal(column),
    create.literal(source),
    ctx.nativeIds.native,
    ...node.arguments.map(each => transformNode(each as any, ctx)),
  ]);
}

/**
 * For functions that need to recursively call themselves, we must augment their return values to allow
 * proper tail calls. This function should be used on the `argument` of a ReturnStatement or on the body
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
      // We need to transform each branch first, because if we don't if the either the consequent
      // or alternate were function calls, they might get transformed into CallExpressions (like property access)
      // when they were not previously, erroneously triggering the CallExpression block below
      const newConsequent = transformNode(transformReturnExpression(node.consequent, ctx), ctx);
      const newAlternate = transformNode(transformReturnExpression(node.alternate, ctx), ctx);
      const newTest = transformBooleanTest(node, ctx);
      return create.conditionalExpression(newTest, newConsequent, newAlternate, node.loc);
    }
    case 'CallExpression': {
      const { line, column, source } = getNodeLoc(node);

      const functionName = node.callee.type === 'Identifier' ? node.callee.name : '<anonymous>';

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
 * provides varargs information to Source and stringification.
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

type NodeTranspiler<T extends Node, U extends Node> = (node: T, ctx: TranspilationContext) => U;

type NodeTranspilers = {
  [K in Node['type']]?: NodeTypeToNode<K> extends es.Expression
    ? NodeTranspiler<NodeTypeToNode<K>, es.Expression>
    : NodeTypeToNode<K> extends es.Statement
      ? NodeTranspiler<NodeTypeToNode<K>, es.Statement>
      : NodeTranspiler<NodeTypeToNode<K>, es.Node>;
};

const nodeTranspilers = {
  // Expressions
  ArrowFunctionExpression: transformFunction,
  FunctionExpression: transformFunction,
  AssignmentExpression: transformPropertyAssignment,
  BinaryExpression: transformBinaryExpression,
  CallExpression: transformCallExpression,
  ConditionalExpression: (node, ctx) => ({
    ...node,
    alternate: transformNode(node.consequent, ctx),
    consequent: transformNode(node.consequent, ctx),
    test: transformBooleanTest(node, ctx),
  }),
  LogicalExpression: (node, ctx) => ({
    ...node,
    left: transformBooleanTest(node, ctx),
    right: transformNode(node.right, ctx),
  }),
  MemberExpression: transformPropertyAccess,
  UnaryExpression: transformUnaryExpression,

  // Statements
  BlockStatement: (stmt, ctx) => ({
    ...stmt,
    body: transformStatements(stmt.body, ctx),
  }),
  ExpressionStatement: (stmt, ctx) => ({
    ...stmt,
    expression: transformNode(stmt.expression, ctx),
  }),
  FunctionDeclaration: (decl, ctx) => {
    const newFunc = transformFunction(decl, ctx);

    if (decl.id) {
      return create.constantDeclaration(decl.id.name, newFunc);
    } else {
      return newFunc;
    }
  },
  IfStatement: (stmt, ctx) => ({
    ...stmt,
    test: transformBooleanTest(stmt, ctx),
    alternate: stmt.alternate ? transformNode(stmt.alternate, ctx) : undefined,
    consequent: transformNode(stmt.consequent, ctx),
  }),
  ReturnStatement: (stmt, ctx) => ({
    ...stmt,
    argument: stmt.argument ? transformReturnExpression(stmt.argument, ctx) : undefined,
  }),
  VariableDeclaration: (decl, ctx) => ({
    ...decl,
    declarations: decl.declarations.map(each => ({
      ...each,
      init: each.init ? transformNode(each.init, ctx) : undefined,
    })),
  }),
} satisfies NodeTranspilers;

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

export function transformNode(node: es.Expression, ctx: TranspilationContext): es.Expression;
export function transformNode(
  node: es.BlockStatement,
  ctx: TranspilationContext,
): es.BlockStatement;
export function transformNode(node: es.Statement, ctx: TranspilationContext): es.Statement;
export function transformNode(node: Exclude<Node, es.Program>, ctx: TranspilationContext): Node {
  if (node.type in nodeTranspilers) {
    // @ts-expect-error Type gets narrowed to never
    return nodeTranspilers[node.type](node, ctx);
  }
  return node;
}

interface TransformResult {
  globallyDeclaredIdentifiers: string[];
  program: es.Program;
}

export function transformProgram(
  program: es.Program,
  context: Context,
  isPrelude: boolean = false,
): TransformResult {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage),
  ]);
  const nativeIds = getNativeIds(usedIdentifiers);

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
  const globallyDeclaredIdentifiers = getGloballyDeclaredIdentifiers([
    ...importNodes,
    ...transformedNodes,
  ]);

  const newStatements = [
    // First, transpiler internals are declared
    ...getDeclarationsToAccessTranspilerInternals(nativeIds),
    // Then, the evaller replacer is added
    getEvallerReplacer(nativeIds.native, usedIdentifiers),
    // This `undefined` is required so that if the user program is empty
    // the entire program evaluates to undefined, as it should
    create.expressionStatement(create.identifier('undefined')),
    // Then, everything declared as an import
    ...importNodes,
    // Then, the transformed program body
    ...transformedNodes,
  ];

  // If this isn't the first time we're evaluating using this context, then
  // we don't need to redeclare all our builtins
  const newBody =
    context.nativeStorage.evaller === null
      ? wrapWithBuiltins(newStatements, context.nativeStorage)
      : [create.blockStatement(newStatements)];

  return {
    globallyDeclaredIdentifiers,
    program: {
      ...program,
      body: newBody,
    },
  };
}
