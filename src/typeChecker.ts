import * as es from 'estree'
// tslint:disable:no-console
// tslint:disable: object-literal-key-quotes
/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 * @param context Additional context such as the week of our source program, comments etc.
 */
export function typeCheck(program: es.Program | undefined): void {
  if (program === undefined || program.body[0] === undefined) {
    return
  }
  const ctx: Ctx = { next: 0, env: initialEnv }
  try {
    // dont run type check for predefined functions as they include constructs we can't handle
    // like lists etc.
    if (program.body.length < 10) {
      program.body.forEach(node => {
        infer(node, ctx)
      })
      // console.log(ctx.env)
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}

// Type Definitions
// An environment maps variables (which are expressions) to types. Do not confuse with a
// substitution which maps type variables to types
interface Env {
  [name: string]: TYPE
}

/**
 * Context contains the environment along with some other information that we might need
 */
interface Ctx {
  next: number // next type variable to be generated
  env: Env // mapping of variables in scope to types
}

// a map of type variable names to types assigned to them
// A substitution maps type variables to types while an environment maps variables (which are
// expressions) to types
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

/**
 * Replace type variables in a type that are present in a given substitution
 * and return the type with those variables with their substituted values
 * e.g. applying substitution of {"a": Bool, "b": Int} to type (a -> b) will give
 * the type: Bool -> Int
 * @param subst
 * @param types
 */
function applySubstToTypes(subst: Subsitution, types: TYPE[]): TYPE[] {
  return types.map(type => applySubstToType(subst, type))
}

/**
 * Applies the first substitution to the types of the second one and then
 * combines the result with the first substitution
 * @param s1
 * @param s2
 */
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
    case 'UnaryExpression': {
      const [inferredType, subst1] = infer(node.argument, ctx)
      const funcType = env[node.operator] as FUNCTION
      const newType = newTypeVar(ctx)
      const subst2 = unify(
        {
          nodeType: 'Function',
          fromTypes: [inferredType],
          toType: newType
        },
        funcType
      )
      const composedSubst = composeSubsitutions(subst1, subst2)
      return [applySubstToType(composedSubst, funcType.toType), composedSubst]
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      const [inferredLeft, leftSubst] = infer(node.left, ctx)
      const [inferredRight, rightSubst] = infer(node.right, ctx)
      let composedSubst = composeSubsitutions(leftSubst, rightSubst)

      const funcType = env[node.operator] as FUNCTION
      const newType = newTypeVar(ctx)
      const subst1 = unify(
        {
          nodeType: 'Function',
          fromTypes: [inferredLeft, inferredRight],
          toType: newType
        },
        funcType
      )
      composedSubst = composeSubsitutions(subst1, composedSubst)
      const inferredReturnType = applySubstToType(composedSubst, funcType.toType)
      return [inferredReturnType, composedSubst]
    }
    case 'ExpressionStatement': {
      const inferred = infer(node.expression, ctx)
      return [tNamedUndef, inferred[1]]
    }
    case 'ReturnStatement': {
      if (node.argument === undefined) {
        return [tNamedUndef, {}]
      } else if (node.argument === null) {
        return [tNamedNull, {}]
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
      return [tNamedUndef, composedSubst]
    }
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal
      if (literalVal === null) {
        return [tNamedNull, {}]
      } else if (
        typeOfLiteral === 'boolean' ||
        typeOfLiteral === 'string' ||
        typeOfLiteral === 'number'
      ) {
        return [tNamed(typeOfLiteral), {}]
      }
      throw Error('Unexpected literal type')
    }
    case 'Identifier': {
      const identifierName = node.name
      if (env[identifierName]) {
        return [env[identifierName], {}]
      }
      throw Error('Undefined identifier')
    }
    case 'ConditionalExpression': // both cases are the same 
    case 'IfStatement': {
      // type check test
      const [testType, subst1] = infer(node.test, ctx)
      const subst2 = unify(tNamedBool, testType)
      const subst3 = composeSubsitutions(subst1, subst2)
      applySubstToCtx(subst3, ctx)
      const [, subst4] = infer(node.consequent, ctx)
      const subst5 = composeSubsitutions(subst3, subst4)
      applySubstToCtx(subst5, ctx) // in case we infer anything about the type variables
      if (node.alternate) {
        // Have to decide whether we want both branches to unify. Till then return in if wont work
        const [, subst6] = infer(node.alternate, ctx)
        return [tNamedUndef, composeSubsitutions(subst5, subst6)]
      }
      return [tNamedUndef, subst5]
    }
    case 'ArrowFunctionExpression': {
      const newTypes: TYPE[] = []
      node.params.forEach(() => {
        const newType = newTypeVar(ctx)
        newTypes.push(newType)
      })
      // clone scope only after we have accounted for all the new type variables to be created
      const newCtx = cloneCtx(ctx)
      node.params.forEach((param: es.Identifier, index) => {
        const newType = newTypes[index]
        addToCtx(newCtx, param.name, newType)
      })
      const [bodyType, subst] = infer(node.body, newCtx)
      const inferredType: FUNCTION = {
        nodeType: 'Function',
        fromTypes: applySubstToTypes(subst, newTypes),
        toType: bodyType
      }
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
      // get a reference to the type variable representing our new variable
      // this is so we know of any references made to our variable in the init
      // (i.e. perhaps in some kind of recursive definition)
      const newType = newTypeVar(ctx)
      addToCtx(ctx, id.name, newType)
      const [inferredInitType, subst1] = infer(init, ctx)
      // In case we made a reference to our declared variable in our init, need to type
      // check the usage to see if the inferred init type is compatible with the inferred type of our
      // type variable based on the usage inside init
      const subst2 = unify(inferredInitType, applySubstToType(subst1, newType))
      const composedSubst = composeSubsitutions(subst1, subst2)
      addToCtx(ctx, id.name, applySubstToType(composedSubst, inferredInitType))
      return [tNamedUndef, composedSubst]
    }
    case 'FunctionDeclaration': {
      const id = node.id
      if (id === null) {
        throw Error('No identifier for function declaration')
      }
      const paramTypes: TYPE[] = []
      node.params.forEach(() => {
        const newType = newTypeVar(ctx)
        paramTypes.push(newType)
      })
      // similar to variable declaration, catch possible type errors such as wrongly using identifier
      // not as a function. for that we need to create a type variable and introduce it into the context
      const functionType: FUNCTION = {
        nodeType: 'Function',
        fromTypes: paramTypes,
        toType: newTypeVar(ctx)
      }
      addToCtx(ctx, id.name, functionType)
      // clone scope only after we have accounted for all the new type variables to be created
      const newCtx = cloneCtx(ctx)
      node.params.forEach((param: es.Identifier, index) => {
        const newType = paramTypes[index]
        addToCtx(newCtx, param.name, newType)
      })
      const [bodyType, subst1] = infer(node.body, newCtx)
      // unify, for the same reason as in variable declaration
      const inferredType: FUNCTION = {
        nodeType: 'Function',
        fromTypes: applySubstToTypes(subst1, paramTypes),
        toType: bodyType
      }
      const subst2 = unify(inferredType, applySubstToType(subst1, functionType))
      const composedSubst = composeSubsitutions(subst1, subst2)
      addToCtx(ctx, id.name, applySubstToType(composedSubst, inferredType))
      return [tNamedUndef, composedSubst]
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
      const subst4 = unify(funcType, { nodeType: 'Function', fromTypes: argTypes, toType: newType })
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
      return [inferredReturnType, finalSubst]
    }
    default:
      return [tNamedUndef, {}]
  }
}

// =======================================
// Private Helper Parsing Functions
// =======================================

function tNamed(name: NAMED_TYPE): NAMED {
  return {
    nodeType: 'Named',
    name
  }
}

const tNamedBool = tNamed('boolean')
const tNamedNumber = tNamed('number')
const tNamedNull = tNamed('null')
// const tNamedString = tNamed('string')
const tNamedUndef = tNamed('undefined')

function tFunc(...types: TYPE[]): FUNCTION {
  const fromTypes = types.slice(0, -1)
  const toType = types.slice(-1)[0]
  return {
    nodeType: 'Function',
    fromTypes,
    toType
  }
}

const initialEnv = {
  Infinity: tNamedNumber,
  NaN: tNamedNumber,
  undefined: tNamedUndef,
  '!': tFunc(tNamedBool, tNamedBool),
  '&&': tFunc(tNamedBool, tNamedBool, tNamedBool),
  '||': tFunc(tNamedBool, tNamedBool, tNamedBool),
  // NOTE for now just handle for Number === Number
  '===': tFunc(tNamedNumber, tNamedNumber, tNamedBool),
  '!==': tFunc(tNamedNumber, tNamedNumber, tNamedBool),
  // "Bool==": tFunc(tNamedBool(), tNamedBool(), tNamedBool()),
  '+': tFunc(tNamedNumber, tNamedNumber, tNamedNumber),
  '-': tFunc(tNamedNumber, tNamedNumber, tNamedNumber),
  '*': tFunc(tNamedNumber, tNamedNumber, tNamedNumber)
  // '/': tFunc(tNamedNumber(), tNamedNumber(), tNamedNumber())
}
