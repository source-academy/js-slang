import * as es from 'estree'
// tslint:disable:no-console

/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 * @param context Additional context such as the week of our source program, comments etc.
 */
export function typeCheck(program: es.Program | undefined): void {
  if (program === undefined || program.body[0] === undefined) {
    return
  }
  // console.log(program)
  const ctx: Ctx = { next: 0, env: {} }
  try {
    program.body.forEach(node => {
      if (1 + 1 === 0) {
        infer(node, ctx)
      }
    })
  } catch (e) {
    console.log(e)
  }
}

// Type Definitions
interface Env {
  [name: string]: TYPE
}

interface Ctx {
  next: number
  env: Env
}

interface Subsitution {
  [key: string]: TYPE
}

function contains(type: TYPE, name: string): boolean {
  switch (type.nodeType) {
    case 'Named':
      return false
    case 'Var':
      return type.name === name
    case 'Function':
      const containedInForTypes = type.fromTypes.reduce((acc, currentType) => {
        return acc || contains(currentType, name)
      }, false)
      return containedInForTypes || contains(type.toType, name)
  }
}

function bindTypeVarToType(nameOfTypeVar: string, type: TYPE): Subsitution {
  if (type.nodeType === 'Var' && nameOfTypeVar === type.name) {
    return {}
  } else if (contains(type, nameOfTypeVar)) {
    throw Error(
      'Contains cyclic reference to itself, where the type being bound to is a function type'
    )
  }
  return {
    [nameOfTypeVar]: type
  }
}

// Attempt to unify two types. If fails due to mismatch, throw error. Else
// provide a substitution to apply unification to the context in the future
function unify(t1: TYPE, t2: TYPE): Subsitution {
  // Trivial case: Both are named types of the same kind
  if (t1.nodeType === 'Named' && t2.nodeType === 'Named' && t1.name === t2.name) {
    return {} // no substitution necessary
  } else if (t1.nodeType === 'Var') {
    // t1 is a type variable
    return bindTypeVarToType(t1.name, t2)
  } else if (t2.nodeType === 'Var') {
    // t2 is a type variable
    return bindTypeVarToType(t2.name, t1)
  } else if (t1.nodeType === 'Function' && t2.nodeType === 'Function') {
    // need to unify parameters types first and then body type
    if (t1.fromTypes.length !== t2.fromTypes.length) {
      throw Error(`Expected ${t1.fromTypes.length} args, got ${t2.fromTypes.length}`)
    }
    let argSubst: Subsitution = {}
    for (let i = 0; i < t1.fromTypes.length; i++) {
      argSubst = composeSubsitutions(argSubst, unify(t1.fromTypes[i], t2.fromTypes[i]))
    }
    const bodySubst = unify(
      applySubstToType(argSubst, t1.toType),
      applySubstToType(argSubst, t2.toType)
    )
    return composeSubsitutions(argSubst, bodySubst)
  } else {
    // Mismatch
    throw Error(`Type Mismatch. Expected ${JSON.stringify(t1)}, instead got ${JSON.stringify(t2)}`)
  }
}

function applySubstToType(subst: Subsitution, type: TYPE): TYPE {
  switch (type.nodeType) {
    case 'Named':
      return type
    case 'Var':
      if (subst[type.name]) {
        return subst[type.name]
      } else {
        return type
      }
    case 'Function':
      return {
        nodeType: 'Function',
        fromTypes: applySubstToTypes(subst, type.fromTypes),
        toType: applySubstToType(subst, type.toType)
      }
  }
}

function applySubstToTypes(subst: Subsitution, types: TYPE[]): TYPE[] {
  return types.map(type => applySubstToType(subst, type))
}

function composeSubsitutions(s1: Subsitution, s2: Subsitution): Subsitution {
  const composedSubst: Subsitution = {}
  Object.keys(s2).forEach(key => {
    composedSubst[key] = applySubstToType(s1, s2[key])
  })
  return { ...s1, ...composedSubst }
}

function cloneCtx(ctx: Ctx): Ctx {
  return {
    ...ctx,
    env: {
      ...ctx.env
    }
  }
}

function applySubstToCtx(subst: Subsitution, ctx: Ctx): void {
  Object.keys(ctx.env).forEach(name => {
    ctx.env[name] = applySubstToType(subst, ctx.env[name])
  })
}

function addToCtx(ctx: Ctx, name: string, type: TYPE): void {
  ctx.env[name] = type
}

function newTypeVar(ctx: Ctx): VAR {
  const newVarId = ctx.next
  ctx.next++
  return {
    nodeType: 'Var',
    name: `TypeVar${newVarId}`
  }
}

type NAMED_TYPE = 'boolean' | 'number' | 'string' | 'null' | 'undefined'

interface NAMED {
  nodeType: 'Named'
  name: NAMED_TYPE
}
interface VAR {
  nodeType: 'Var'
  name: string
}
interface FUNCTION {
  nodeType: 'Function'
  fromTypes: TYPE[]
  toType: TYPE
}
type TYPE = NAMED | VAR | FUNCTION

// tslint:disable-next-line: cyclomatic-complexity
function infer(node: es.Node, ctx: Ctx): [TYPE, Subsitution] {
  const env = ctx.env
  switch (node.type) {
    case 'ExpressionStatement': {
      const inferred = infer(node.expression, ctx)
      return [{ nodeType: 'Named', name: 'undefined' }, inferred[1]]
    }
    case 'ReturnStatement': {
      if (node.argument === undefined) {
        return [{ nodeType: 'Named', name: 'undefined' }, {}]
      } else if (node.argument === null) {
        return [{ nodeType: 'Named', name: 'null' }, {}]
      }
      return infer(node.argument, ctx)
    }
    case 'BlockStatement': {
      const newCtx = cloneCtx(ctx) // create new scope
      let composedSubst: Subsitution = {}
      for (const currentNode of node.body) {
        const [inferredType, subst] = infer(currentNode, newCtx)
        composedSubst = composeSubsitutions(composedSubst, subst)
        applySubstToCtx(composedSubst, newCtx)
        if (currentNode.type === 'ReturnStatement') {
          return [inferredType, composedSubst]
        }
      }
      return [{ nodeType: 'Named', name: 'undefined' }, composedSubst]
    }
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal
      if (literalVal === null) {
        return [{ nodeType: 'Named', name: 'null' }, {}]
      } else if (
        typeOfLiteral === 'boolean' ||
        typeOfLiteral === 'string' ||
        typeOfLiteral === 'number'
      ) {
        return [{ nodeType: 'Named', name: typeOfLiteral }, {}]
      }
      throw Error('Unexpected literal type')
    }
    case 'Identifier': {
      const identifierName = node.name
      if (env[identifierName]) {
        // console.log(env[identifierName])
        return [env[identifierName], {}]
      }
      throw Error('Undefined identifier')
    }
    case 'IfStatement': {
      // type check test
      const [testType, subst1] = infer(node.test, ctx)
      const subst2 = unify(
        {
          nodeType: 'Named',
          name: 'boolean'
        },
        testType
      )
      const subst3 = composeSubsitutions(subst1, subst2)
      applySubstToCtx(subst3, ctx)
      const [, subst4] = infer(node.consequent, ctx)
      const subst5 = composeSubsitutions(subst3, subst4)
      applySubstToCtx(subst5, ctx) // in case we infer anything about the type variables
      if (node.alternate) {
        // Have to decide whether we want both branches to unify. Till then return in if wont work
        const [, subst6] = infer(node.alternate, ctx)
        return [{ nodeType: 'Named', name: 'undefined' }, composeSubsitutions(subst5, subst6)]
      }
      return [{ nodeType: 'Named', name: 'undefined' }, subst5]
    }
    case 'ArrowFunctionExpression': {
      const newCtx = cloneCtx(ctx) // create new scope
      const newTypes: TYPE[] = []
      node.params.forEach((param: es.Identifier) => {
        const newType = newTypeVar(ctx)
        addToCtx(newCtx, param.name, newType)
        newTypes.push(newType)
      })
      const [bodyType, subst] = infer(node.body, newCtx)
      const inferredType: FUNCTION = {
        nodeType: 'Function',
        fromTypes: applySubstToTypes(subst, newTypes),
        toType: bodyType
      }
      console.log(inferredType)
      return [inferredType, subst]
    }
    case 'VariableDeclaration': {
      // forsee issues with recursive declarations
      // assuming constant declaration for now (check the 'kind' field)
      const declarator = node.declarations[0] // exactly 1 declaration allowed per line
      const init = declarator.init
      const id = declarator.id
      if (!init || id.type !== 'Identifier') {
        throw Error('Either no initialization or not an identifier on LHS')
      }
      const [inferredInitType, subst] = infer(init, ctx)
      addToCtx(ctx, id.name, inferredInitType)
      return [{ nodeType: 'Named', name: 'undefined' }, subst]
    }
    case 'CallExpression': {
      const [funcType, subst1] = infer(node.callee, ctx)
      const newCtx = cloneCtx(ctx)
      applySubstToCtx(subst1, newCtx)
      let subst2: Subsitution = {}
      const argTypes: TYPE[] = []
      node.arguments.forEach(arg => {
        const inferredArgType = infer(arg, newCtx)
        argTypes.push(inferredArgType[0])
        subst2 = composeSubsitutions(subst2, inferredArgType[1])
      })
      const newType = newTypeVar(ctx)
      const subst3 = composeSubsitutions(subst1, subst2)
      // Check that our supposed function is an actual function and unify with literal fn type
      const subst4 = unify({ nodeType: 'Function', fromTypes: argTypes, toType: newType }, funcType)
      const funcType1 = applySubstToType(subst4, funcType) as FUNCTION
      // consolidate all substitutions so far
      const subst5 = composeSubsitutions(subst3, subst4)
      // attempt to unify actual argument type with expected type
      const paramTypes = applySubstToTypes(subst5, funcType1.fromTypes)
      let subst6: Subsitution = {}
      paramTypes.forEach((paramType, index) => {
        subst6 = composeSubsitutions(subst6, unify(paramType, argTypes[index]))
      })
      // consolidate new substitutions
      const finalSubst = composeSubsitutions(subst5, subst6)
      const inferredReturnType = applySubstToType(finalSubst, funcType1.toType)
      console.log(inferredReturnType)
      console.log(finalSubst)
      return [inferredReturnType, finalSubst]
    }
    default:
      return [{ nodeType: 'Named', name: 'undefined' }, {}]
  }
}
