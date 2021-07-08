import * as es from 'estree'
import { generate } from 'astring'
import * as create from '../utils/astCreator'
import { simple, recursive, WalkerCallback } from '../utils/walkers'
// transforms AST of program

const globalIds = {
  builtinsId: 'builtins',
  functionsId: '__InfLoopFns',
  stateId: '__InfLoopState'
}

enum FunctionNames {
  nothingFunction,
  concretize,
  hybridize,
  wrapArg,
  dummify,
  saveBool,
  saveVar,
  preFunction,
  returnFunction,
  postLoop,
  enterLoop,
  exitLoop,
  trackLoc,
  evalB,
  evalU
}

/**
 * Renames all variables in the program to differentiate shadowed variables and
 * variables declared with the same name but in different scopes.
 * E.g. "function f(f)..." -> "function f_0(f_1)..."
 * @param predefined A table of [key: string, value:string], where variables named 'key' will be renamed to 'value'
 */
function unshadowVariables(program: es.Node, predefined = {}) {
  for (const name of Object.values(globalIds)) {
    predefined[name] = name
  }
  const seenIds = new Set()
  const env = [predefined]
  const genId = (name: string) => {
    let count = 0
    while (seenIds.has(`${name}_${count}`)) count++
    const newName = `${name}_${count}`
    seenIds.add(newName)
    env[0][name] = newName
    return newName
  }
  const unshadowFunctionInner = (
    node: es.FunctionDeclaration | es.ArrowFunctionExpression | es.FunctionExpression,
    s: undefined,
    callback: WalkerCallback<undefined>
  ) => {
    env.unshift({ ...env[0] })
    for (const id of node.params as es.Identifier[]) {
      id.name = genId(id.name)
    }
    callback(node.body, undefined)
    env.shift()
  }
  const doStatements = (stmts: es.Statement[], callback: WalkerCallback<undefined>) => {
    for (const stmt of stmts) {
      if (stmt.type === 'FunctionDeclaration') {
        // do hoisting first
        stmt.id = stmt.id as es.Identifier
        stmt.id.name = genId(stmt.id.name)
      } else if (stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          decl.id = decl.id as es.Identifier
          const newName = genId(decl.id.name)
          decl.id.name = newName
        }
      }
    }
    for (const stmt of stmts) {
      callback(stmt, undefined)
    }
  }
  recursive(program, [{}], {
    BlockStatement(node: es.BlockStatement, s: undefined, callback: WalkerCallback<undefined>) {
      env.unshift({ ...env[0] })
      doStatements(node.body, callback)
      env.shift()
    },
    VariableDeclarator(
      node: es.VariableDeclarator,
      s: undefined,
      callback: WalkerCallback<undefined>
    ) {
      node.id = node.id as es.Identifier
      if (node.init) {
        callback(node.init, s)
      }
    },
    FunctionDeclaration(
      node: es.FunctionDeclaration,
      s: undefined,
      callback: WalkerCallback<undefined>
    ) {
      // note: params can shadow function name
      env.unshift({ ...env[0] })
      for (const id of node.params as es.Identifier[]) {
        id.name = genId(id.name)
      }
      callback(node.body, undefined)
      env.shift()
    },
    ForStatement(node: es.ForStatement, s: undefined, callback: WalkerCallback<undefined>) {
      env.unshift({ ...env[0] })
      if (node.init?.type === 'VariableDeclaration') doStatements([node.init], callback)
      if (node.test) callback(node.test, s)
      if (node.update) callback(node.update, s)
      callback(node.body, s)
      env.shift()
    },
    ArrowFunctionExpression: unshadowFunctionInner,
    FunctionExpression: unshadowFunctionInner,
    Identifier(node: es.Identifier, s: undefined, callback: WalkerCallback<undefined>) {
      if (env[0][node.name]) {
        node.name = env[0][node.name]
      } else {
        create.mutateToMemberExpression(
          node,
          create.identifier(globalIds.functionsId),
          create.literal(FunctionNames.nothingFunction)
        )
        ;(node as any).computed = true
      }
    },
    AssignmentExpression(
      node: es.AssignmentExpression,
      s: undefined,
      callback: WalkerCallback<undefined>
    ) {
      callback(node.left, s)
      callback(node.right, s)
    },
    TryStatement(node: es.TryStatement, s: undefined, callback: WalkerCallback<undefined>) {
      if (!node.finalizer) return // should not happen
      env.unshift({ ...env[0] })
      doStatements(node.block.body, callback)
      doStatements(node.finalizer.body, callback)
      env.shift()
    }
  })
}

/**
 * Returns the original name of the variable before
 * it was changed during the code instrumentation process.
 */
export function getOriginalName(name: string) {
  if (/^anon[0-9]+$/.exec(name)) {
    return '(anonymous)'
  }
  let cutAt = name.length - 1
  while (name.charAt(cutAt) !== '_') cutAt--
  return name.slice(0, cutAt)
}

function callFunction(fun: FunctionNames) {
  return create.memberExpression(create.identifier(globalIds.functionsId), fun)
}

function wrapCallArguments(program: es.Program) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      if (node.callee.type === 'MemberExpression') return
      for (const arg of node.arguments) {
        create.mutateToCallExpression(arg, callFunction(FunctionNames.wrapArg), [
          { ...(arg as es.Expression) },
          create.identifier(globalIds.stateId)
        ])
      }
    }
  })
}

/**
 * Turn all "is_null(x)" calls to "is_null(x, stateId)" to
 * facilitate checking of infinite streams in stream mode.
 */
function addStateToIsNull(program: es.Program) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'is_null_0') {
        node.arguments.push(create.identifier(globalIds.stateId))
      }
    }
  })
}

/**
 * Changes logical expressions to the corresponding conditional.
 * Reduces the number of types of expressions we have to consider
 * for the rest of the code transformations.
 */
function transformLogicalExpressions(program: es.Program) {
  simple(program, {
    LogicalExpression(node: es.LogicalExpression) {
      if (node.operator === '&&') {
        create.mutateToConditionalExpression(node, node.left, node.right, create.literal(false))
      } else {
        create.mutateToConditionalExpression(node, node.left, create.literal(true), node.right)
      }
    }
  })
}

/**
 * Changes -ary operations to functions that accept hybrid values as arguments.
 * E.g. "1+1" -> "functions.evalB('+',1,1)"
 */
function hybridizeBinaryUnaryOperations(program: es.Node) {
  simple(program, {
    BinaryExpression(node: es.BinaryExpression) {
      const { operator, left, right } = node
      create.mutateToCallExpression(node, callFunction(FunctionNames.evalB), [
        create.literal(operator),
        left,
        right
      ])
    },
    UnaryExpression(node: es.UnaryExpression) {
      const { operator, argument } = node as es.UnaryExpression
      create.mutateToCallExpression(node, callFunction(FunctionNames.evalU), [
        create.literal(operator),
        argument
      ])
    }
  })
}

function hybridizeVariablesAndLiterals(program: es.Node) {
  recursive(program, true, {
    Identifier(node: es.Identifier, state: boolean, callback: WalkerCallback<boolean>) {
      if (state) {
        create.mutateToCallExpression(node, callFunction(FunctionNames.hybridize), [
          create.identifier(node.name),
          create.literal(node.name),
          create.identifier(globalIds.stateId)
        ])
      }
    },
    Literal(node: es.Literal, state: boolean, callback: WalkerCallback<boolean>) {
      if (state && (typeof node.value === 'boolean' || typeof node.value === 'number')) {
        create.mutateToCallExpression(node, callFunction(FunctionNames.dummify), [
          create.literal(node.value)
        ])
      }
    },
    CallExpression(node: es.CallExpression, state: boolean, callback: WalkerCallback<boolean>) {
      // ignore callee
      for (const arg of node.arguments) {
        callback(arg, state)
      }
    },
    MemberExpression(node: es.MemberExpression, state: boolean, callback: WalkerCallback<boolean>) {
      if (node.object.type === 'Identifier' && node.object.name === globalIds.functionsId) return
      callback(node.object, false)
      callback(node.property, false)
      create.mutateToCallExpression(node.object, callFunction(FunctionNames.concretize), [
        { ...node.object } as es.Expression
      ])
      create.mutateToCallExpression(node.property, callFunction(FunctionNames.concretize), [
        { ...node.property } as es.Expression
      ])
    }
  })
}

function trackVariableAssignment(program: es.Node) {
  simple(program, {
    AssignmentExpression(node: es.AssignmentExpression) {
      if (node.left.type === 'Identifier') {
        node.right = create.callExpression(callFunction(FunctionNames.saveVar), [
          node.right,
          create.literal(node.left.name),
          create.identifier(globalIds.stateId)
        ])
      } else if (node.left.type === 'MemberExpression') {
        node.right = create.callExpression(callFunction(FunctionNames.concretize), [
          { ...node.right }
        ])
      }
    }
  })
}

function saveTheTest(
  node: es.IfStatement | es.ConditionalExpression | es.WhileStatement | es.ForStatement
) {
  if (node.test === null || node.test === undefined) {
    return
  }
  const newTest = create.callExpression(callFunction(FunctionNames.saveBool), [
    node.test,
    create.identifier(globalIds.stateId)
  ])
  node.test = newTest
}

function inPlaceEnclose(node: es.Statement, prepend?: es.Statement, append?: es.Statement) {
  const shallowCopy = { ...node }
  node.type = 'BlockStatement'
  node = node as es.BlockStatement
  node.body = [shallowCopy]
  if (prepend !== undefined) {
    node.body.unshift(prepend)
  }
  if (append !== undefined) {
    node.body.push(append)
  }
}

function trackIfStatements(program: es.Node) {
  const theFunction = (node: es.IfStatement | es.ConditionalExpression) => saveTheTest(node)
  simple(program, { IfStatement: theFunction, ConditionalExpression: theFunction })
}

function trackLoops(program: es.Node) {
  const makeCallStatement = (name: FunctionNames, args: es.Expression[]) =>
    create.expressionStatement(create.callExpression(callFunction(name), args))
  const stateExpr = create.identifier(globalIds.stateId)
  simple(program, {
    WhileStatement: (node: es.WhileStatement) => {
      saveTheTest(node)
      inPlaceEnclose(node.body, undefined, makeCallStatement(FunctionNames.postLoop, [stateExpr]))
      inPlaceEnclose(
        node,
        makeCallStatement(FunctionNames.enterLoop, [stateExpr]),
        makeCallStatement(FunctionNames.exitLoop, [stateExpr])
      )
    },
    ForStatement: (node: es.ForStatement) => {
      saveTheTest(node)
      const theUpdate = node.update ? node.update : create.identifier('undefined')
      node.update = create.callExpression(callFunction(FunctionNames.postLoop), [
        stateExpr,
        theUpdate
      ])
      inPlaceEnclose(
        node,
        makeCallStatement(FunctionNames.enterLoop, [stateExpr]),
        makeCallStatement(FunctionNames.exitLoop, [stateExpr])
      )
    }
  })
}

function trackFunctions(program: es.Node) {
  const preFunction = (name: string, params: es.Pattern[]) => {
    const args = params
      .filter(x => x.type === 'Identifier')
      .map(x => (x as es.Identifier).name)
      .map(x => create.arrayExpression([create.literal(x), create.identifier(x)]))

    return create.expressionStatement(
      create.callExpression(callFunction(FunctionNames.preFunction), [
        create.literal(name),
        create.arrayExpression(args),
        create.identifier(globalIds.stateId)
      ])
    )
  }

  let counter = 0
  const anonFunction = (node: es.ArrowFunctionExpression | es.FunctionExpression) => {
    if (node.body.type !== 'BlockStatement') {
      create.mutateToReturnStatement(node.body, { ...node.body })
    }
    inPlaceEnclose(node.body as es.Statement, preFunction(`anon${counter++}`, node.params))
  }
  simple(program, {
    ArrowFunctionExpression: anonFunction,
    FunctionExpression: anonFunction,
    FunctionDeclaration(node: es.FunctionDeclaration) {
      const name = (node.id as es.Identifier).name
      inPlaceEnclose(node.body, preFunction(name, node.params))
    }
  })
  simple(program, {
    ReturnStatement(node: es.ReturnStatement) {
      const hasNoArgs = node.argument === null || node.argument === undefined
      const arg = hasNoArgs ? create.identifier('undefined') : (node.argument as es.Expression)
      const argsForCall = [arg, create.identifier(globalIds.stateId)]
      node.argument = create.callExpression(callFunction(FunctionNames.returnFunction), argsForCall)
    }
  })
}

function builtinsToStmts(builtins: Iterable<string>) {
  const makeDecl = (name: string) =>
    create.declaration(
      name,
      'const',
      create.callExpression(
        create.memberExpression(create.identifier(globalIds.builtinsId), 'get'),
        [create.literal(name)]
      )
    )
  return [...builtins].map(makeDecl)
}

/**
 * Make all variables in the 'try' block function-scoped so they
 * can be accessed in the 'finally' block
 */
function toVarDeclaration(stmt: es.Statement) {
  simple(stmt, {
    VariableDeclaration(node: es.VariableDeclaration) {
      node.kind = 'var'
    }
  })
}

/**
 * There may have been other programs run in the REPL. This hack
 * 'combines' the other programs and the current program into a single
 * large program by enclosing the past programs in 'try' blocks, and the
 * current program in a 'finally' block. Any errors (including detected
 * infinite loops) in the past code will be ignored in the empty 'catch'
 * block.
 */
function wrapOldCode(current: es.Program, toWrap: es.Statement[]) {
  for (const stmt of toWrap) {
    toVarDeclaration(stmt)
  }
  const tryStmt: es.TryStatement = {
    type: 'TryStatement',
    block: create.blockStatement([...toWrap]),
    handler: {
      type: 'CatchClause',
      param: create.identifier('e'),
      body: create.blockStatement([])
    },
    finalizer: create.blockStatement([...(current.body as es.Statement[])])
  }
  current.body = [tryStmt]
}

function makePositions(position: es.Position) {
  return create.objectExpression([
    create.property('line', create.literal(position.line)),
    create.property('column', create.literal(position.column))
  ])
}

function savePositionAsExpression(loc: es.SourceLocation | undefined | null) {
  if (loc !== undefined && loc !== null) {
    return create.objectExpression([
      create.property('start', makePositions(loc.start)),
      create.property('end', makePositions(loc.end))
    ])
  } else {
    return create.identifier('undefined')
  }
}

function trackLocations(program: es.Program) {
  // Note: only add locations for most recently entered code
  const trackerFn = callFunction(FunctionNames.trackLoc)
  const stateExpr = create.identifier(globalIds.stateId)
  const doLoops = (
    node: es.ForStatement | es.WhileStatement,
    state: undefined,
    callback: WalkerCallback<undefined>
  ) => {
    inPlaceEnclose(
      node.body,
      create.expressionStatement(
        create.callExpression(trackerFn, [savePositionAsExpression(node.loc), stateExpr])
      )
    )
  }
  recursive(program, undefined, {
    CallExpression(node: es.CallExpression, state: undefined, callback: WalkerCallback<undefined>) {
      if (node.callee.type === 'MemberExpression') return
      const copy: es.CallExpression = { ...node }
      const lazyCall = create.arrowFunctionExpression([], copy)
      create.mutateToCallExpression(node, trackerFn, [
        savePositionAsExpression(node.loc),
        stateExpr,
        lazyCall
      ])
    },
    ForStatement: doLoops,
    WhileStatement: doLoops
  })
}

// previous: most recent first (at ix 0)
function instrument(
  previous: es.Program[],
  program: es.Program,
  builtins: Iterable<string>
): [string, string, string, string] {
  const { builtinsId, functionsId, stateId } = globalIds
  const predefined = {}
  predefined[builtinsId] = builtinsId
  predefined[functionsId] = functionsId
  predefined[stateId] = stateId
  const innerProgram = { ...program }
  for (const toWrap of previous) {
    wrapOldCode(program, toWrap.body as es.Statement[])
  }
  wrapOldCode(program, builtinsToStmts(builtins))
  unshadowVariables(program, predefined)
  transformLogicalExpressions(program)
  hybridizeBinaryUnaryOperations(program)
  hybridizeVariablesAndLiterals(program)
  // tracking functions: add functions to record runtime data.

  trackVariableAssignment(program)
  trackIfStatements(program)
  trackLoops(program)
  trackFunctions(program)
  trackLocations(innerProgram)
  addStateToIsNull(program)
  wrapCallArguments(program)
  const code = generate(program)
  return [code, functionsId, stateId, builtinsId]
}

export { instrument, FunctionNames as InfiniteLoopRuntimeFunctions }
