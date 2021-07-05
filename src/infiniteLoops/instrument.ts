import * as es from 'estree'
import { generate } from 'astring'
import * as create from '../utils/astCreator'
import { simple, recursive, WalkerCallback } from '../utils/walkers'
// transforms AST of program
// TODO: implement tail recursion

function unshadowVariables(program: es.Node, functionsId: string, predefined = {}) {
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
  recursive(program, [{}], {
    BlockStatement(node: es.BlockStatement, s: undefined, callback: WalkerCallback<undefined>) {
      env.unshift({ ...env[0] })
      for (const stmt of node.body) {
        callback(stmt, s)
      }
      env.shift()
    },
    VariableDeclarator(
      node: es.VariableDeclarator,
      s: undefined,
      callback: WalkerCallback<undefined>
    ) {
      node.id = node.id as es.Identifier
      const newName = genId(node.id.name)
      node.id.name = newName
      if (node.init) {
        callback(node.init, s)
      }
    },
    FunctionDeclaration(
      node: es.FunctionDeclaration,
      s: undefined,
      callback: WalkerCallback<undefined>
    ) {
      node.id = node.id as es.Identifier
      node.id.name = genId(node.id.name)
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
      if (node.init) callback(node.init, s)
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
          create.identifier(functionsId),
          create.identifier('nothingFunction')
        )
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
      for (const stmt of node.block.body) {
        callback(stmt, s)
      }
      for (const stmt of node.finalizer.body) {
        callback(stmt, s)
      }
      env.shift()
    }
  })
}

export function getOriginalName(name: string) {
  let cutAt = name.length - 1
  while (name.charAt(cutAt) !== '_') cutAt--
  return name.slice(0, cutAt)
}

function addStateToIsNull(program: es.Program, stateId: string) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'is_null_0') {
        node.arguments.push(create.identifier(stateId))
      }
    }
  })
}

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

function callFunction(fun: string, functionsId: string) {
  return create.memberExpression(create.identifier(functionsId), fun)
}

function hybridizeBinaryUnaryOperations(program: es.Node, functionsId: string) {
  simple(program, {
    BinaryExpression(node: es.BinaryExpression) {
      const { operator, left, right } = node
      create.mutateToCallExpression(node, callFunction('evalB', functionsId), [
        create.literal(operator),
        left,
        right
      ])
    },
    UnaryExpression(node: es.UnaryExpression) {
      const { operator, argument } = node as es.UnaryExpression
      create.mutateToCallExpression(node, callFunction('evalU', functionsId), [
        create.literal(operator),
        argument
      ])
    }
  })
}

function trackVariableRetrieval(program: es.Node, functionsId: string, stateId: string) {
  recursive(program, undefined, {
    Identifier(node: es.Identifier, state: undefined, callback: WalkerCallback<undefined>) {
      create.mutateToCallExpression(node, callFunction('hybridize', functionsId), [
        create.literal(node.name),
        create.identifier(node.name),
        create.identifier(stateId)
      ])
    },
    CallExpression(node: es.CallExpression, state: undefined, callback: WalkerCallback<undefined>) {
      // ignore callee
      for (const arg of node.arguments) {
        callback(arg, state)
      }
    }
  })
}

function trackVariableAssignment(program: es.Node, functionsId: string, stateId: string) {
  simple(program, {
    AssignmentExpression(node: es.AssignmentExpression) {
      if (node.left.type === 'Identifier') {
        node.right = create.callExpression(callFunction('saveVar', functionsId), [
          create.literal(node.left.name),
          node.right,
          create.identifier(stateId)
        ])
      } else if (node.left.type === 'MemberExpression') {
        // BIG TODO
      }
    }
  })
}

function saveTheTest(
  node: es.IfStatement | es.ConditionalExpression | es.WhileStatement | es.ForStatement,
  functionsId: string,
  stateId: string
) {
  if (node.test === null || node.test === undefined) {
    return
  }
  const newTest = create.callExpression(callFunction('saveBool', functionsId), [
    node.test,
    create.identifier(stateId)
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

function trackIfStatements(program: es.Node, functionsId: string, stateId: string) {
  const theFunction = (node: es.IfStatement | es.ConditionalExpression) =>
    saveTheTest(node, functionsId, stateId)
  simple(program, { IfStatement: theFunction, ConditionalExpression: theFunction })
}

function trackLoops(program: es.Node, functionsId: string, stateId: string) {
  const makeCallStatement = (name: string, args: es.Expression[]) =>
    create.expressionStatement(create.callExpression(callFunction(name, functionsId), args))
  const stateExpr = create.identifier(stateId)
  simple(program, {
    WhileStatement: (node: es.WhileStatement) => {
      saveTheTest(node, functionsId, stateId)
      inPlaceEnclose(node.body, undefined, makeCallStatement('postLoop', [stateExpr]))
      inPlaceEnclose(
        node,
        makeCallStatement('enterLoop', [stateExpr]),
        makeCallStatement('exitLoop', [stateExpr])
      )
    },
    ForStatement: (node: es.ForStatement) => {
      saveTheTest(node, functionsId, stateId)
      const theUpdate = node.update ? node.update : create.identifier('undefined')
      node.update = create.callExpression(callFunction('postLoop', functionsId), [
        stateExpr,
        theUpdate
      ])
      inPlaceEnclose(
        node,
        makeCallStatement('enterLoop', [stateExpr]),
        makeCallStatement('exitLoop', [stateExpr])
      )
    }
  })
}

function trackFunctions(program: es.Node, functionsId: string, stateId: string) {
  const preFunction = (name: string, params: es.Pattern[]) => {
    const args = params
      .filter(x => x.type === 'Identifier')
      .map(x => (x as es.Identifier).name)
      .map(x => create.arrayExpression([create.literal(x), create.identifier(x)]))

    return create.expressionStatement(
      create.callExpression(callFunction('preFunction', functionsId), [
        create.literal(name),
        create.arrayExpression(args),
        create.identifier(stateId)
      ])
    )
  }

  let counter = 0
  const anonFunction = (node: es.ArrowFunctionExpression | es.FunctionExpression) => {
    const bodyAsStatement =
      node.body.type === 'BlockStatement' ? node.body : create.expressionStatement(node.body)
    inPlaceEnclose(bodyAsStatement, preFunction(`anon${counter++}`, node.params))
  }
  simple(program, {
    ArrowFunctionExpression: anonFunction,
    FunctionExpression: anonFunction,
    FunctionDeclaration(node: es.FunctionDeclaration) {
      const name = (node.id as es.Identifier).name
      inPlaceEnclose(node.body, preFunction(name, node.params))
    },
    ReturnStatement(node: es.ReturnStatement) {
      const arg =
        node.argument === null || node.argument === undefined
          ? create.identifier('undefined')
          : node.argument
      node.argument = create.callExpression(callFunction('returnFunction', functionsId), [
        arg,
        create.identifier(stateId)
      ])
    }
  })
}

function builtinsToStmts(builtinsName: string, builtins: IterableIterator<string>) {
  const makeDecl = (name: string) =>
    create.declaration(
      name,
      'const',
      create.callExpression(create.memberExpression(create.identifier(builtinsName), 'get'), [
        create.literal(name)
      ])
    )
  return [...builtins].map(makeDecl)
}

function toVarDeclaration(stmt: es.Statement) {
  simple(stmt, {
    VariableDeclaration(node: es.VariableDeclaration) {
      node.kind = 'var'
    }
  })
}

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

function trackLocations(program: es.Program, functionsId: string, stateId: string) {
  // Note: only add locations for most recently entered code
  const trackerFn = create.memberExpression(create.identifier(functionsId), 'trackLoc')
  const stateExpr = create.identifier(stateId)
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
export function instrument(
  previous: es.Program[],
  program: es.Program,
  builtins: IterableIterator<string>
): [string, string, string, string] {
  const builtinsId = 'builtins'
  const functionsId = '__InfLoopFns'
  const stateId = '__InfLoopState'
  const predefined = {}
  predefined[builtinsId] = builtinsId
  predefined[functionsId] = functionsId
  predefined[stateId] = stateId
  const innerProgram = { ...program }
  for (const toWrap of previous) {
    wrapOldCode(program, toWrap.body as es.Statement[])
  }
  wrapOldCode(program, builtinsToStmts(builtinsId, builtins))
  unshadowVariables(program, functionsId, predefined)
  transformLogicalExpressions(program)
  hybridizeBinaryUnaryOperations(program, functionsId)
  trackVariableRetrieval(program, functionsId, stateId)
  trackVariableAssignment(program, functionsId, stateId)
  trackIfStatements(program, functionsId, stateId)
  trackLocations(innerProgram, functionsId, stateId)
  trackLoops(program, functionsId, stateId)
  trackFunctions(program, functionsId, stateId)
  addStateToIsNull(program, stateId)
  const code = generate(program)
  return [code, functionsId, stateId, builtinsId]
}
