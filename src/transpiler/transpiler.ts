/**
 * This whole transpiler includes many many many many hacks to get stuff working.
 * Order in which certain functions are called matter as well.
 * There should be an explanation on it coming up soon.
 */
import { generate } from 'astring';
import type es from 'estree';
import cloneDeep from 'lodash/cloneDeep';
import { type RawSourceMap, SourceMapGenerator } from 'source-map';
import { NATIVE_STORAGE_ID, UNKNOWN_LOCATION } from '../constants';
import { Chapter, Variant } from '../langs';
import type { Context, NativeStorage, Node } from '../types';
import * as create from '../utils/ast/astCreator';
import {
  filterImportDeclarations,
  getImportedName,
  getSourceVariableDeclaration,
} from '../utils/ast/helpers';
import { isNamespaceSpecifier, isVariableDeclaration } from '../utils/ast/typeGuards';
import { simple } from '../utils/ast/walkers';
import {
  getFunctionDeclarationNamesInProgram,
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getNativeIds,
  getUniqueId,
  type NativeIds,
} from '../utils/uniqueIds';
import { checkForUndefinedVariables } from '../validator/validator';

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
 * True iff `program` imports at least one module — the signal `transpile` uses to decide whether
 * this chunk needs dual (async) compilation. A chunk containing no imports of its own can still
 * *reach* a previously-imported module binding (declared by an earlier REPL chunk); that case is
 * the caller's responsibility — see `SourceEvaluator`'s `hasEverLoadedAModule` — not this function's,
 * which only ever looks at `program`'s own body.
 */
export function hasImports(program: es.Program): boolean {
  return program.body.some(node => node.type === 'ImportDeclaration');
}

export function getGloballyDeclaredIdentifiers(program: es.Program): string[] {
  return program.body.filter(isVariableDeclaration).map(decl => {
    const {
      id: { name },
    } = getSourceVariableDeclaration(decl);
    return name;
  });
}

export function getBuiltins(nativeStorage: NativeStorage): es.Statement[] {
  const builtinsStatements: es.Statement[] = [];
  nativeStorage.builtins.forEach((_unused, name: string) => {
    builtinsStatements.push(
      create.constantDeclaration(
        name,
        create.callExpression(
          create.memberExpression(
            create.memberExpression(create.identifier(NATIVE_STORAGE_ID), 'builtins'),
            'get',
          ),
          [create.literal(name)],
        ),
      ),
    );
  });

  return builtinsStatements;
}

export function evallerReplacer(
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

function generateFunctionsToStringMap(program: es.Program) {
  const map: Map<Node, string> = new Map();
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      map.set(node, generate(node));
    },
    FunctionDeclaration(node: es.FunctionDeclaration) {
      map.set(node, generate(node));
    },
  });
  return map;
}

function transformFunctionDeclarationsToArrowFunctions(
  program: es.Program,
  functionsToStringMap: Map<Node, string>,
) {
  simple(program, {
    FunctionDeclaration(node: es.VariableDeclaration) {
      const { id, params, body, loc } = node as es.FunctionDeclaration & es.VariableDeclaration;
      node.type = 'VariableDeclaration';
      node = node;
      const asArrowFunction = create.blockArrowFunction(params as es.Identifier[], body, loc);
      functionsToStringMap.set(asArrowFunction, functionsToStringMap.get(node)!);
      node.declarations = [
        {
          type: 'VariableDeclarator',
          id,
          init: asArrowFunction,
        },
      ];
      node.kind = 'const';
    },
  });
}

/**
 * Transforms all arrow functions
 * (arg1, arg2, ...) => { statement1; statement2; return statement3; }
 *
 * to
 *
 * <NATIVE STORAGE>.operators.wrap((arg1, arg2, ...) => {
 *   statement1;statement2;return statement3;
 * })
 *
 * to allow for iterative processes to take place
 */

function wrapArrowFunctionsToAllowNormalCallsAndNiceToString(
  program: es.Program,
  functionsToStringMap: Map<Node, string>,
  globalIds: NativeIds,
  isPrelude: boolean,
) {
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      const hasRestElement = node.params[node.params.length - 1]?.type === 'RestElement';
      const optionalParams = node.params.filter(x => x.type === 'AssignmentPattern');

      // If it's undefined then we're dealing with a thunk
      if (functionsToStringMap.get(node)! !== undefined) {
        create.mutateToCallExpression(node, globalIds.wrap, [
          { ...node },
          create.literal(hasRestElement || optionalParams.length),
          create.identifier('undefined'),
          create.literal(functionsToStringMap.get(node)!),
          create.literal(isPrelude ? 'prelude' : null),
        ]);
      }
    },
  });
}

/**
 * Marks every arrow function in the program `async`, in dual/async mode only. Every Source function
 * value is, by the time this runs, an `ArrowFunctionExpression` — `transformFunctionDeclarationsToArrowFunctions`
 * has already turned every `function` declaration into one — so this single pass covers both original
 * arrows and converted declarations uniformly.
 *
 * `async` is required for a function's own body to legally contain the `await` calls
 * `transformCallExpressionsToCheckIfFunction` is about to insert. Must run before
 * `wrapArrowFunctionsToAllowNormalCallsAndNiceToString`, whose `{ ...node }` shallow copy needs
 * `.async` already set to carry it into the copy that becomes the function's real body.
 */
function markArrowFunctionsAsync(program: es.Program) {
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      node.async = true;
    },
  });
}

/**
 * Transforms all return statements (including expression arrow functions) to return an intermediate value
 * return nonFnCall + 1;
 *  =>
 * return {isTail: false, value: nonFnCall + 1};
 *
 * return fnCall(arg1, arg2);
 * => return {isTail: true, function: fnCall, arguments: [arg1, arg2]}
 *
 * conditional and logical expressions will be recursively looped through as well
 */
function transformReturnStatementsToAllowProperTailCalls(program: es.Program) {
  function transformLogicalExpression(expression: es.Expression): es.Expression {
    switch (expression.type) {
      case 'LogicalExpression':
        return create.logicalExpression(
          expression.operator,
          expression.left,
          transformLogicalExpression(expression.right),
          expression.loc,
        );
      case 'ConditionalExpression':
        return create.conditionalExpression(
          expression.test,
          transformLogicalExpression(expression.consequent),
          transformLogicalExpression(expression.alternate),
          expression.loc,
        );
      case 'CallExpression':
        expression = expression;
        const { line, column } = (expression.loc ?? UNKNOWN_LOCATION).start;
        const source = expression.loc?.source ?? null;
        const functionName =
          expression.callee.type === 'Identifier' ? expression.callee.name : '<anonymous>';

        const args = expression.arguments;

        return create.objectExpression([
          create.property('isTail', create.literal(true)),
          create.property('function', expression.callee as es.Expression),
          create.property('functionName', create.literal(functionName)),
          create.property('arguments', create.arrayExpression(args as es.Expression[])),
          create.property('line', create.literal(line)),
          create.property('column', create.literal(column)),
          create.property('source', create.literal(source)),
        ]);
      default:
        return create.objectExpression([
          create.property('isTail', create.literal(false)),
          create.property('value', expression),
        ]);
    }
  }

  simple(program, {
    ReturnStatement(node: es.ReturnStatement) {
      node.argument = transformLogicalExpression(node.argument!);
    },
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      if (node.expression) {
        node.body = transformLogicalExpression(node.body as es.Expression);
      }
    },
  });
}

/**
 * Wraps every call in the program through {@link callIfFuncAndRightArgs} (or, in async/dual mode,
 * its twin — see transpiler.ts's module doc) for argument checking and the proper-tail-call
 * trampoline.
 *
 * `isAsync` is the only difference from the non-module path: the callee changes from
 * `callIfFuncAndRightArgs` to `callIfFuncAndRightArgsAsync`, and the resulting call is wrapped in an
 * `await` (`mutateToAwaitCallExpression` rather than `mutateToCallExpression`) — needed because the
 * callee might now be a Conductor module closure, which crosses the boundary as an
 * `ExternCallable`, i.e. always Promise-returning by protocol regardless of whether any *particular*
 * call actually suspends.
 */
function transformCallExpressionsToCheckIfFunction(
  program: es.Program,
  globalIds: NativeIds,
  isAsync: boolean,
) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start;
      const source = node.loc?.source ?? null;
      const args = node.arguments;
      const callee = node.callee as es.Expression;

      // `node.arguments`'s declared type (`(Expression | SpreadElement)[]`) is wider than
      // `mutateTo*CallExpression`'s (`Expression[]`) — Source's own grammar never puts a spread
      // element in call-argument position, matching the assumption `mutateToCallExpression`'s other
      // existing callers already make.
      const wrappedArgs = [
        callee,
        create.literal(line),
        create.literal(column),
        create.literal(source),
        globalIds.native,
        ...args,
      ] as es.Expression[];

      if (isAsync) {
        create.mutateToAwaitCallExpression(
          node,
          globalIds.callIfFuncAndRightArgsAsync,
          wrappedArgs,
        );
      } else {
        create.mutateToCallExpression(node, globalIds.callIfFuncAndRightArgs, wrappedArgs);
      }
    },
  });
}

function transformSomeExpressionsToCheckIfBoolean(program: es.Program, globalIds: NativeIds) {
  function transform(
    node:
      | es.IfStatement
      | es.ConditionalExpression
      | es.LogicalExpression
      | es.ForStatement
      | es.WhileStatement,
  ) {
    const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start;
    const source = node.loc?.source ?? null;
    const test = node.type === 'LogicalExpression' ? 'left' : 'test';
    (node as any)[test] = create.callExpression(globalIds.boolOrErr, [
      (node as any)[test],
      create.literal(line),
      create.literal(column),
      create.literal(source),
    ]);
  }

  simple(program, {
    IfStatement: transform,
    ConditionalExpression: transform,
    LogicalExpression: transform,
    ForStatement: transform,
    WhileStatement: transform,
  });
}

function transformUnaryAndBinaryOperationsToFunctionCalls(
  program: es.Program,
  globalIds: NativeIds,
  chapter: Chapter,
) {
  simple(program, {
    BinaryExpression(node: es.BinaryExpression) {
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start;
      const source = node.loc?.source ?? null;
      const { operator, left, right } = node;
      create.mutateToCallExpression(node, globalIds.binaryOp, [
        create.literal(operator),
        create.literal(chapter),
        // `left` is `Expression | PrivateIdentifier`; private-in expressions are
        // not valid in Source, so the operand is always an Expression.
        left as es.Expression,
        right,
        create.literal(line),
        create.literal(column),
        create.literal(source),
      ]);
    },
    UnaryExpression(node: es.UnaryExpression) {
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start;
      const source = node.loc?.source ?? null;
      const { operator, argument } = node;
      create.mutateToCallExpression(node, globalIds.unaryOp, [
        create.literal(operator),
        argument,
        create.literal(line),
        create.literal(column),
        create.literal(source),
      ]);
    },
  });
}

function getComputedProperty(computed: boolean, property: es.Expression): es.Expression {
  return computed ? property : create.literal((property as es.Identifier).name);
}

function transformPropertyAssignment(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    AssignmentExpression(node: es.AssignmentExpression) {
      if (node.left.type === 'MemberExpression') {
        const { object, property, computed, loc } = node.left;
        const { line, column } = (loc ?? UNKNOWN_LOCATION).start;
        const source = loc?.source ?? null;
        create.mutateToCallExpression(node, globalIds.setProp, [
          object as es.Expression,
          getComputedProperty(computed, property as es.Expression),
          node.right,
          create.literal(line),
          create.literal(column),
          create.literal(source),
        ]);
      }
    },
  });
}

function transformPropertyAccess(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    MemberExpression(node: es.MemberExpression) {
      const { object, property, computed, loc } = node;
      const { line, column } = (loc ?? UNKNOWN_LOCATION).start;
      const source = loc?.source ?? null;

      create.mutateToCallExpression(node, globalIds.getProp, [
        object as es.Expression,
        getComputedProperty(computed, property as es.Expression),
        create.literal(line),
        create.literal(column),
        create.literal(source),
      ]);
    },
  });
}

function addInfiniteLoopProtection(
  program: es.Program,
  globalIds: NativeIds,
  usedIdentifiers: Set<string>,
) {
  const getTimeAst = () => create.callExpression(create.identifier('get_time'), []);

  function instrumentLoops(node: es.Program | es.BlockStatement) {
    const newStatements = [];
    for (const statement of node.body) {
      if (statement.type === 'ForStatement' || statement.type === 'WhileStatement') {
        const startTimeConst = getUniqueId(usedIdentifiers, 'startTime');
        newStatements.push(create.constantDeclaration(startTimeConst, getTimeAst()));
        if (statement.body.type === 'BlockStatement') {
          const { line, column } = (statement.loc ?? UNKNOWN_LOCATION).start;
          const source = statement.loc?.source ?? null;
          statement.body.body.unshift(
            create.expressionStatement(
              create.callExpression(globalIds.throwIfTimeout, [
                globalIds.native,
                create.identifier(startTimeConst),
                getTimeAst(),
                create.literal(line),
                create.literal(column),
                create.literal(source),
              ]),
            ),
          );
        }
      }
      newStatements.push(statement);
    }
    node.body = newStatements;
  }

  simple(program, {
    Program: instrumentLoops,
    BlockStatement: instrumentLoops,
  });
}

function wrapWithBuiltins(statements: es.Statement[], nativeStorage: NativeStorage) {
  return create.blockStatement([...getBuiltins(nativeStorage), create.blockStatement(statements)]);
}

function getDeclarationsToAccessTranspilerInternals(
  globalIds: NativeIds,
): es.VariableDeclaration[] {
  return Object.entries(globalIds).map(([key, { name }]) => {
    let value: es.Expression;
    if (key === 'native') {
      value = create.identifier(NATIVE_STORAGE_ID);
    } else if (key === 'globals') {
      value = create.memberExpression(globalIds.native, 'globals');
    } else {
      value = create.callExpression(
        create.memberExpression(create.memberExpression(globalIds.native, 'operators'), 'get'),
        [create.literal(key)],
      );
    }
    return create.constantDeclaration(name, value);
  });
}

export type TranspiledResult = { transpiled: string; sourceMapJson?: RawSourceMap };

/**
 * Dual/async mode cannot rely on `eval()`'s own completion-value tracking — the mechanism the sync
 * path uses to report "the value of the program" for free, with no code of its own: `eval` reports
 * the value of the last statement it actually executed, propagating through `if`/`for`/`while`
 * exactly as the ECMAScript spec's Completion Records do. Async mode instead runs the program inside
 * an `async` IIFE (see `transpileToSource`'s use of this function), whose own completion — an
 * ordinary function return — is *not* eval's implicit one, so there is nothing to fall back on.
 *
 * This reproduces that same propagation by hand, for exactly the statement shapes Source's grammar
 * allows at a position that can be "last": `ExpressionStatement` (the common case — assign into
 * `resultId`) and three constructs that all share one rule — `IfStatement`, `ForStatement` and
 * `WhileStatement` each reset to `undefined` *immediately before themselves*, then recurse into
 * whichever branch/body actually runs (Source requires braces on `if`, so a branch is always a
 * `BlockStatement`). Resetting first, rather than merely leaving `resultId` untouched, is what makes
 * a branch/body whose own last statement is itself empty-completion (a bare declaration) correctly
 * report `undefined` instead of silently carrying forward whatever ran *before* the construct — per
 * spec, `if (true) { let y = 10; }`'s own completion is `undefined`, not "whatever came before the
 * `if`", even though a bare `let y = 10;` in isolation (no `if` around it) *does* carry the previous
 * value through. A loop's reset also naturally reproduces "last iteration's last value", since the
 * same rewritten body statements run — and keep assigning into the same `resultId` — on every pass.
 * Every other statement type (`VariableDeclaration`, `FunctionDeclaration`, an import) has an empty
 * completion in spec terms and is never itself reset, which is what lets it correctly carry the
 * previous statement's value through when it is the LAST statement in a plain list.
 *
 * Verified against plain `eval()` on every construct Source's grammar can put in program-final
 * position, including the two cases naive reasoning gets wrong (see this file's test suite): a
 * zero-iteration loop, and a taken `if` branch that ends in a bare declaration.
 */
export function transformStatementsToTrackCompletionValue(
  statements: es.Statement[],
  resultId: es.Identifier,
): es.Statement[] {
  const assignResult = (expr: es.Expression) =>
    create.expressionStatement(create.assignmentExpression(resultId, expr));
  const resetResult = () => assignResult(create.identifier('undefined'));

  const transformBranch = (stmt: es.Statement): es.Statement =>
    stmt.type === 'BlockStatement'
      ? create.blockStatement(
          transformStatementsToTrackCompletionValue(stmt.body, resultId),
          stmt.loc,
        )
      : transformOne(stmt);

  function transformOne(stmt: es.Statement): es.Statement {
    switch (stmt.type) {
      case 'ExpressionStatement':
        return assignResult(stmt.expression);
      case 'IfStatement':
        // Resetting to `undefined` before the statement — not merely leaving `resultId`
        // untouched — matters when the taken branch's own completion is itself empty (e.g. it
        // ends in a bare declaration): per spec, `IfStatement`'s completion in that case is
        // `undefined`, dropping whatever value was running *before* the `if`, not carrying it
        // through. Exactly the same rule `ForStatement`/`WhileStatement` need below, and for the
        // same reason.
        return create.blockStatement([
          resetResult(),
          {
            ...stmt,
            consequent: transformBranch(stmt.consequent),
            alternate: stmt.alternate ? transformBranch(stmt.alternate) : stmt.alternate,
          },
        ]);
      case 'ForStatement':
      case 'WhileStatement':
        return create.blockStatement(
          [resetResult(), { ...stmt, body: transformBranch(stmt.body) }],
          stmt.loc,
        );
      default:
        return stmt;
    }
  }

  return statements.map(transformOne);
}

function transpileToSource(
  originalProgram: es.Program,
  context: Context,
  skipUndefined: boolean,
  isPrelude: boolean,
  isAsync: boolean,
): TranspiledResult {
  if (originalProgram.body.length === 0) {
    return { transpiled: '' };
  }

  const program = cloneDeep(originalProgram);

  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage),
  ]);
  const globalIds = getNativeIds(program, usedIdentifiers);

  const functionsToStringMap = generateFunctionsToStringMap(program);

  transformReturnStatementsToAllowProperTailCalls(program);
  transformCallExpressionsToCheckIfFunction(program, globalIds, isAsync);
  transformUnaryAndBinaryOperationsToFunctionCalls(program, globalIds, context.chapter);
  transformSomeExpressionsToCheckIfBoolean(program, globalIds);
  transformPropertyAssignment(program, globalIds);
  transformPropertyAccess(program, globalIds);
  checkForUndefinedVariables(program, context, globalIds, skipUndefined);
  // checkProgramForUndefinedVariables(program, context, skipUndefined)
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap);
  if (isAsync) {
    // Every user function must be able to contain the `await` calls just inserted above — must run
    // before wrapArrowFunctionsToAllowNormalCallsAndNiceToString, whose shallow copy of each arrow
    // needs `.async` already set to carry it into the function that actually executes.
    markArrowFunctionsAsync(program);
  }
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(
    program,
    functionsToStringMap,
    globalIds,
    isPrelude,
  );
  addInfiniteLoopProtection(program, globalIds, usedIdentifiers);

  const [importNodes, otherNodes] = transformImportDeclarations(
    program,
    create.memberExpression(globalIds.native, 'loadedModules'),
  );

  program.body = (importNodes as es.Program['body']).concat(otherNodes);

  // Must run on the still-flat statement list, exactly as in sync mode: this seeds cross-chunk
  // "was this name already declared" tracking, which async mode still populates even though (see
  // the module design doc, source-academy/js-slang#2081) a name an async-mode chunk itself declares
  // does not actually survive into a *later* chunk the way a sync-mode chunk's does — a known,
  // documented gap, not something to silently paper over by skipping this call.
  getGloballyDeclaredIdentifiers(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );

  // In async mode, the import bindings stay OUTSIDE the completion-value IIFE below, unlike the
  // rest of the chunk's own code. An import binding is a plain property read
  // (`native.loadedModules.foo.bar`) that never needs `await` — the module it names was already
  // loaded, as a separate step, before this chunk was ever transpiled — so there is no reason to
  // trap it inside the IIFE's own function scope, which a *later* chunk's separate `eval()` call
  // cannot see into (see the class doc on SourceEvaluator's `hasEverLoadedAModule`). Keeping it in
  // the same outer, eval-chainable scope sync mode already relies on is what lets a later chunk with
  // no import of its own still use a name an earlier chunk imported.
  const otherStatements = otherNodes as es.Statement[];
  const lastStatements = isAsync
    ? [buildAsyncCompletionValueIIFE(otherStatements, usedIdentifiers)]
    : otherStatements;

  const newStatements = [
    ...getDeclarationsToAccessTranspilerInternals(globalIds),
    evallerReplacer(globalIds.native, usedIdentifiers),
    create.expressionStatement(create.identifier('undefined')),
    ...(importNodes as es.Statement[]),
    ...lastStatements,
  ];

  program.body =
    context.nativeStorage.evaller === null
      ? [wrapWithBuiltins(newStatements, context.nativeStorage)]
      : [create.blockStatement(newStatements)];

  const map = new SourceMapGenerator({ file: 'source' });
  const transpiled = generate(program, { sourceMap: map });
  const sourceMapJson = map.toJSON();
  return { transpiled, sourceMapJson };
}

/**
 * Wraps a dual-mode chunk's own non-import statements in `(async () => { ...; return __result__;
 * })()` — an immediately-invoked async arrow, the only way for this chunk's `await` calls to be
 * syntactically legal (see this file's module doc on why `eval()`'s own completion-value tracking
 * cannot be reused here, and `transformStatementsToTrackCompletionValue`'s doc for how the returned
 * value is computed instead). Import bindings are deliberately NOT passed to this function —
 * `transpileToSource` keeps them outside it, in the same outer scope sync mode already uses, since
 * they're plain property reads that never need `await` (see `SourceEvaluator`'s own class doc on
 * why that specifically is what lets a later chunk still reach an earlier one's import).
 *
 * The evaluated program's own value is exactly the value of the ONE resulting ExpressionStatement —
 * a call to this IIFE — so `eval()`/`nativeStorage.evaller`'s completion-value tracking (unmodified,
 * still relied on one level up — see `evallerReplacer`) reports it correctly with no further work:
 * calling an async function always synchronously returns a Promise, and that Promise *is* the
 * completion value the sync machinery reports, for `sourceRunner.ts`'s native runner to await.
 */
function buildAsyncCompletionValueIIFE(
  statements: es.Statement[],
  usedIdentifiers: Set<string>,
): es.Statement {
  const resultId = create.identifier(getUniqueId(usedIdentifiers, 'result'));
  const trackedStatements = transformStatementsToTrackCompletionValue(statements, resultId);

  const body = create.blockStatement([
    create.variableDeclaration(
      [create.variableDeclarator(resultId, create.identifier('undefined'))],
      'let',
    ),
    ...trackedStatements,
    create.returnStatement(resultId),
  ]);

  const iife = create.blockArrowFunction([], body);
  iife.async = true;

  return create.expressionStatement(create.callExpression(iife, []));
}

function transpileToFullJS(
  originalProgram: es.Program,
  context: Context,
  skipUndefined: boolean,
): TranspiledResult {
  if (originalProgram.body.length === 0) {
    return { transpiled: '' };
  }

  const program = cloneDeep(originalProgram);

  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage),
  ]);

  const globalIds = getNativeIds(program, usedIdentifiers);
  checkForUndefinedVariables(program, context, globalIds, skipUndefined);

  const [importNodes, otherNodes] = transformImportDeclarations(
    program,
    create.memberExpression(create.identifier(NATIVE_STORAGE_ID), 'loadedModules'),
  );

  program.body = (importNodes as es.Program['body']).concat(otherNodes);
  getFunctionDeclarationNamesInProgram(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );
  getGloballyDeclaredIdentifiers(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id),
  );
  const transpiledProgram: es.Program = create.program([
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set()),
    create.expressionStatement(create.identifier('undefined')),
    ...(importNodes as es.Statement[]),
    ...(otherNodes as es.Statement[]),
  ]);

  const sourceMap = new SourceMapGenerator({ file: 'source' });
  const transpiled = generate(transpiledProgram, { sourceMap });
  const sourceMapJson = sourceMap.toJSON();

  return { transpiled, sourceMapJson };
}

/**
 * `isAsync` selects dual/async-mode compilation (see this file's module doc): every call in the
 * program routes through `await callIfFuncAndRightArgsAsync` instead of the plain trampoline, and
 * the whole chunk runs inside an async IIFE. Ignored for `Chapter.FULL_JS`/`Variant.NATIVE`
 * (`transpileToFullJS`) — modules under that path are out of scope for now (see
 * source-academy/js-slang#2081).
 */
export function transpile(
  program: es.Program,
  context: Context,
  isPrelude: boolean,
  skipUndefined = false,
  isAsync = false,
): TranspiledResult {
  if (context.chapter === Chapter.FULL_JS) {
    return transpileToFullJS(program, context, true);
  } else if (context.variant === Variant.NATIVE) {
    return transpileToFullJS(program, context, false);
  } else {
    return transpileToSource(program, context, skipUndefined, isPrelude, isAsync);
  }
}
