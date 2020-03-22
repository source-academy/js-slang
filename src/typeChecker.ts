import * as es from 'estree'
/* tslint:disable:object-literal-key-quotes no-console no-string-literal*/

let typeIdCounter = 0
/**
 * Traverse node and add `type_id` attr to it. This id will be used to recover inferred node types
 * after finishing type checking
 * @param node
 */
function traverse(node: es.Node) {
  // @ts-ignore
  node.typeVar = tVar(typeIdCounter)
  typeIdCounter++
  switch (node.type) {
    case 'Program': {
      node.body.forEach(nodeBody => {
        traverse(nodeBody)
      })
      break
    }
    case 'UnaryExpression': {
      traverse(node.argument)
      break
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      traverse(node.left)
      traverse(node.right)
      break
    }
    case 'ExpressionStatement': {
      traverse(node.expression)
      break
    }
    case 'BlockStatement': {
      node.body.forEach(nodeBody => {
        traverse(nodeBody)
      })
      break
    }
    case 'ConditionalExpression': // both cases are the same
    case 'IfStatement': {
      traverse(node.test)
      traverse(node.consequent)
      if (node.alternate) {
        traverse(node.alternate)
      }
      break
    }
    case 'CallExpression': {
      traverse(node.callee)
      node.arguments.forEach(arg => {
        traverse(arg)
      })
      break
    }
    case 'ReturnStatement': {
      // no implicit return undefined allowed in source, unsure if it will ever return null but unlikely, as
      // a return null; statement will have an argument which is a Literal node which has value null
      const arg = node.argument
      if (arg === undefined || arg === null) {
        return
      }
      traverse(arg)
      break
    }
    case 'VariableDeclaration': {
      const init = node.declarations[0].init
      if (init === undefined || init === null) {
        return
      }
      traverse(init)
      break
    }
    case 'ArrowFunctionExpression': {
      node.params.forEach(param => {
        traverse(param)
      })
      traverse(node.body)
      break
    }
    case 'FunctionDeclaration':
    // const id
    case 'Literal':
    case 'Identifier':
    default:
      return
  }
}

type NAMED_TYPE = 'bool' | 'float' | 'string' | 'undefined'
type VAR_TYPE = 'any' | 'numerical' | 'addable'

interface NAMED {
  nodeType: 'Named'
  name: NAMED_TYPE
}
interface VAR {
  nodeType: 'Var'
  name: string
  type: VAR_TYPE
}

interface FUNCTION {
  nodeType: 'Function'
  fromTypes: TYPE[]
  toType: TYPE
}

/** Polytype */
interface FORALL {
  nodeType: 'Forall'
  type: TYPE
}

/** Monotypes */
type TYPE = NAMED | VAR | FUNCTION

// Type Definitions
// Our type environment maps variable names to types.
interface Env {
  [name: string]: TYPE | FORALL
}

function cloneEnv(env: Env) {
  return {
    ...env
  }
}

type Constraint = [VAR, TYPE]

/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 * @param context Additional context such as the week of our source program, comments etc.
 */
export function typeCheck(program: es.Program | undefined): void {
  if (program === undefined || program.body[0] === undefined) {
    return
  }
  const env: Env = initialEnv
  const constraints: Constraint[] = []
  try {
    // dont run type check for predefined functions as they include constructs we can't handle
    // like lists etc.
    if (program.body.length < 10) {
      traverse(program)
      console.log(program.body[0] as any)
      // TODO: We need to do the top level transformation? and run the program as a single block
      program.body.forEach(node => {
        infer(node, env, constraints)
      })
      // console.log(env)
      console.log(constraints)
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}

/**
 * Generate a fresh type variable
 * @param typeVar
 */
function freshTypeVar(typeVar: VAR): VAR {
  const newVarId = typeIdCounter
  typeIdCounter++
  return {
    ...typeVar,
    name: `T_${newVarId}`
  }
}

/**
 * Replaces all instances of type variables in the type of a polymorphic type
 */
function fresh(monoType: TYPE, subst: { [typeName: string]: VAR }): TYPE {
  switch (monoType.nodeType) {
    case 'Named':
      return monoType
    case 'Var':
      return subst[monoType.name]
    case 'Function':
      return {
        ...monoType,
        fromTypes: monoType.fromTypes.map(argType => fresh(argType, subst)),
        toType: fresh(monoType.toType, subst)
      }
  }
}

/** Union of free type variables */
function union(a: VAR[], b: VAR[]): VAR[] {
  const sum = [...a]
  b.forEach(newVal => {
    if (sum.findIndex(val => val.name === newVal.name) === -1) {
      sum.push(newVal)
    }
  })
  return sum
}

function freeTypeVarsInType(type: TYPE): VAR[] {
  switch (type.nodeType) {
    case 'Named':
      return []
    case 'Var':
      return [type]
    case 'Function':
      return union(
        type.fromTypes.reduce((acc, currentType) => {
          return union(acc, freeTypeVarsInType(currentType))
        }, []),
        freeTypeVarsInType(type.toType)
      )
  }
}

function extractFreeVariablesAndGenFresh(polyType: FORALL): TYPE {
  const monoType = polyType.type
  const freeTypeVars = freeTypeVarsInType(monoType)
  const substitutions = {}
  freeTypeVars.forEach(val => {
    substitutions[val.name] = freshTypeVar(val)
  })
  return fresh(monoType, substitutions)
}

/**
 * Check if a type contains a reference to a name, to check for an infinite type
 * e.g. A = B -> A
 * @param type
 * @param name
 */
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

function occursOnLeftInConstraintList(
  LHS: VAR,
  constraints: Constraint[],
  RHS: TYPE
): Constraint[] {
  for (const constraint of constraints) {
    if (constraint[0].name === LHS.name) {
      // check if we shoud add a new constraint t'=t'' or t''=t', according to spec
      if (constraint[1].nodeType === 'Var') {
        for (const cons of constraints) {
          // if t'', which is constraint[1] already occurs earlier in the form t'', we need
          // to ensure our new constraint to be added is of the form t''=t'
          if (cons[0].name === constraint[1].name) {
            return addToConstraintList(constraints, [constraint[1], RHS])
          }
        }
      }
      return addToConstraintList(constraints, [RHS, constraint[1]])
    }
  }
  if (RHS.nodeType === 'Var') {
    if (LHS.type === 'numerical' || (LHS.type === 'addable' && RHS.type === 'any')) {
      // We need to modify the type of the RHS so that it is at least as specific as the LHS
      // this is so we are going from least to most specific as we recursively try to determine
      // type of a type variable
      RHS.type = LHS.type
    }
  }
  constraints.push([LHS, RHS])
  return constraints
}

function cannotBeResolvedIfAddable(LHS: VAR, RHS: TYPE): boolean {
  return (
    LHS.type === 'addable' &&
    RHS.nodeType !== 'Var' &&
    !(RHS.nodeType === 'Named' && (RHS.name === 'string' || RHS.name === 'float'))
  )
}

function cannotBeResolvedIfNumerical(LHS: VAR, RHS: TYPE): boolean {
  return (
    LHS.type === 'numerical' &&
    RHS.nodeType !== 'Var' &&
    !(RHS.nodeType === 'Named' && RHS.name === 'float')
  )
}

function addToConstraintList(constraints: Constraint[], [LHS, RHS]: [TYPE, TYPE]): Constraint[] {
  if (LHS.nodeType === 'Named' && RHS.nodeType === 'Named' && LHS.name === RHS.name) {
    return constraints
  } else if (LHS.nodeType === 'Var') {
    // case when we have a new constraint like T_1 = T_1
    if (RHS.nodeType === 'Var' && RHS.name === LHS.name) {
      return constraints
    } else if (contains(RHS, LHS.nodeType)) {
      throw Error(
        'Contains cyclic reference to itself, where the type being bound to is a function type'
      )
    }
    if (cannotBeResolvedIfAddable(LHS, RHS)) {
      throw Error(`Expected either a number or a string, got ${JSON.stringify(RHS)} instead.`)
    } else if (cannotBeResolvedIfNumerical(LHS, RHS)) {
      throw Error(`Expected a number, got ${JSON.stringify(RHS)} instead.`)
    }
    return occursOnLeftInConstraintList(LHS, constraints, RHS)
  } else if (RHS.nodeType === 'Var') {
    // swap around so the type var is on the left hand side
    return addToConstraintList(constraints, [RHS, LHS])
  } else if (LHS.nodeType === 'Function' && RHS.nodeType === 'Function') {
    if (LHS.fromTypes.length !== RHS.fromTypes.length) {
      throw Error(`Expected ${LHS.fromTypes.length} args, got ${RHS.fromTypes.length}`)
    }
    let newConstraints = constraints
    for (let i = 0; i < LHS.fromTypes.length; i++) {
      newConstraints = addToConstraintList(newConstraints, [LHS.fromTypes[i], RHS.fromTypes[i]])
    }
    newConstraints = addToConstraintList(newConstraints, [LHS.toType, RHS.toType])
    return newConstraints
  } else {
    throw Error(`Types do not unify: ${JSON.stringify(LHS)} vs ${JSON.stringify(RHS)}`)
  }
}

function infer(node: es.Node, env: Env, constraints: Constraint[]): Constraint[] {
  // @ts-ignore
  const storedType: VAR = node.typeVar
  switch (node.type) {
    case 'UnaryExpression': {
      // guaranteed to be a monomorphic function type as we only have the negation op
      const funcType = env[node.operator] as FUNCTION
      const argNode = node.argument
      // @ts-ignore
      const argType = argNode.typeVar
      return infer(argNode, env, addToConstraintList(constraints, [tFunc(argType, storedType), funcType]))
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      const envType = env[node.operator]
      const opType =
        envType.nodeType === 'Forall' ? extractFreeVariablesAndGenFresh(envType) : envType
      const leftNode = node.left
      // @ts-ignore
      const leftType = leftNode.typeVar
      const rightNode = node.right
      // @ts-ignore
      const rightType = rightNode.typeVar
      let newConstraints = addToConstraintList(constraints, [
        tFunc(leftType, rightType, storedType),
        opType
      ])
      newConstraints = infer(leftNode, env, newConstraints)
      return infer(rightNode, env, newConstraints)
    }
    case 'ExpressionStatement': {
      return infer(
        node.expression,
        env,
        addToConstraintList(constraints, [storedType, tNamedUndef])
      )
    }
    case 'ReturnStatement': {
      if (node.argument === undefined || node.argument === null) {
        throw Error('Node argument cannot be undefined or null')
      }
      const argNode = node.argument
      // @ts-ignore
      return infer(argNode, env, addToConstraintList(constraints, [storedType, argNode.typeVar]))
    }
    case 'BlockStatement': {
      // assuming no const decl for now
      const newEnv = cloneEnv(env) // create new scope
      const lastNodeIndex = node.body.findIndex((currentNode, index) => {
        return index === node.body.length - 1 || currentNode.type === 'ReturnStatement'
      })
      // @ts-ignore
      const lastNodeType = node.body[lastNodeIndex].typeVar
      let newConstraints = addToConstraintList(constraints, [storedType, lastNodeType])
      for (let i = 0; i <= lastNodeIndex; i++) {
        newConstraints = infer(node.body[i], newEnv, newConstraints)
      }
      return newConstraints
    }
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal
      if (literalVal === null) {
        // will need to change this to make it a pair type when doing S2
        return addToConstraintList(constraints, [storedType, tNamedUndef])
      } else if (typeof literalVal === 'number' && Math.round(literalVal) === literalVal) {
        return addToConstraintList(constraints, [storedType, freshTypeVar(tNumerical(''))])
      } else if (typeOfLiteral === 'number') {
        return addToConstraintList(constraints, [storedType, tNamedFloat])
      } else if (typeOfLiteral === 'boolean') {
        return addToConstraintList(constraints, [storedType, tNamedBool])
      } else if (typeOfLiteral === 'string') {
        return addToConstraintList(constraints, [storedType, tNamedString])
      }
      throw Error('Unexpected literal type')
    }
    case 'Identifier': {
      const identifierName = node.name
      if (env[identifierName]) {
        const envType = env[identifierName]
        if (envType.nodeType === 'Forall') {
          return addToConstraintList(constraints, [
            storedType,
            extractFreeVariablesAndGenFresh(envType)
          ])
        } else {
          return addToConstraintList(constraints, [storedType, envType])
        }
      }
      throw Error(`Undefined identifier: ${identifierName}`)
    }
    case 'ConditionalExpression': // both cases are the same
    case 'IfStatement': {
      const testNode = node.test
      // @ts-ignore
      const testType = testNode.typeVar
      let newConstraints = addToConstraintList(constraints, [testType, tNamedBool])
      const consNode = node.consequent
      // @ts-ignore
      const consType = consNode.typeVar
      newConstraints = addToConstraintList(newConstraints, [storedType, consType])
      const altNode = node.alternate
      if (altNode) {
        // @ts-ignore
        const altType = altNode.typeVar
        newConstraints = addToConstraintList(newConstraints, [consType, altType])
      }
      newConstraints = infer(testNode, env, newConstraints)
      newConstraints = infer(consNode, env, newConstraints)
      if (altNode) {
        newConstraints = infer(altNode, env, newConstraints)
      }
      return newConstraints
    }
    case 'ArrowFunctionExpression': {
      // const newTypes: TYPE[] = []
      // node.params.forEach(() => {
      //   const newType = newTypeVar(ctx)
      //   newTypes.push(newType)
      // })
      // // clone scope only after we have accounted for all the new type variables to be created
      // const newCtx = cloneCtx(ctx)
      // node.params.forEach((param: es.Identifier, index) => {
      //   const newType = newTypes[index]
      //   addToCtx(newCtx, param.name, newType)
      // })
      // const [bodyType, subst] = infer(node.body, newCtx)
      // const inferredType: FUNCTION = {
      //   nodeType: 'Function',
      //   fromTypes: applySubstToTypes(subst, newTypes),
      //   toType: bodyType
      // }
      // return [inferredType, subst]
      return []
    }
    case 'VariableDeclaration': {
      // forsee issues with recursive declarations
      // assuming constant declaration for now (check the 'kind' field)
      // const declarator = node.declarations[0] // exactly 1 declaration allowed per line
      // const init = declarator.init

      // // moved to preprocessDeclaration
      // const id = declarator.id
      // if (!init || id.type !== 'Identifier') {
      //   throw Error('Either no initialization or not an identifier on LHS')
      // }
      // // // get a reference to the type variable representing our new variable
      // // // this is so we know of any references made to our variable in the init
      // // // (i.e. perhaps in some kind of recursive definition)
      // // const newType = newTypeVar(ctx)
      // // addToCtx(ctx, id.name, newType)

      // const [inferredInitType, subst1] = infer(init, ctx)
      // generalize(ctx.env, inferredInitType) // REDUNDANT CALL
      // // In case we made a reference to our declared variable in our init, need to type
      // // check the usage to see if the inferred init type is compatible with the inferred type of our
      // // type variable based on the usage inside init
      // const varType = ctx.env[id.name] as VAR
      // const subst2 = unify(inferredInitType, applySubstToType(subst1, varType))
      // const composedSubst = composeSubsitutions(subst1, subst2)
      // addToCtx(ctx, id.name, applySubstToType(composedSubst, inferredInitType))
      // return [tNamedUndef, composedSubst]
      return []
    }
    case 'FunctionDeclaration': {
      // const id = node.id
      // console.log(node)
      // if (id === null) {
      //   throw Error('No identifier for function declaration')
      // }
      // // const paramTypes: TYPE[] = []
      // // node.params.forEach(() => {
      // //   const newType = newTypeVar(ctx)
      // //   paramTypes.push(newType)
      // // })
      // // // similar to variable declaration, catch possible type errors such as wrongly using identifier
      // // // not as a function. for that we need to create a type variable and introduce it into the context
      // // const functionType: FUNCTION = {
      // //   nodeType: 'Function',
      // //   fromTypes: paramTypes,
      // //   toType: newTypeVar(ctx)
      // // }
      // // addToCtx(ctx, id.name, functionType)
      // // clone scope only after we have accounted for all the new type variables to be created
      // const funcType = ctx.env[id.name] as FUNCTION
      // const newCtx = cloneCtx(ctx)
      // node.params.forEach((param: es.Identifier, index) => {
      //   const newType = funcType.fromTypes[index]
      //   addToCtx(newCtx, param.name, newType)
      // })
      // const [bodyType, subst1] = infer(node.body, newCtx)
      // // unify, for the same reason as in variable declaration
      // const inferredType: FUNCTION = {
      //   nodeType: 'Function',
      //   fromTypes: applySubstToTypes(subst1, funcType.fromTypes),
      //   toType: bodyType
      // }
      // console.log('inferredType for function')
      // console.log(inferredType)
      // const subst2 = unify(inferredType, applySubstToType(subst1, funcType))
      // const composedSubst = composeSubsitutions(subst1, subst2)
      // addToCtx(ctx, id.name, applySubstToType(composedSubst, inferredType))
      // return [tNamedUndef, composedSubst]
      return []
    }
    case 'CallExpression': {
      const calleeNode = node.callee
      // @ts-ignore
      const calleeType = calleeNode.typeVar
      const argNodes = node.arguments
      // @ts-ignore
      const argTypes: VAR[] = argNodes.map(argNode => argNode.typeVar)
      argTypes.push(storedType)
      let newConstraints = addToConstraintList(constraints, [tFunc(...argTypes), calleeType])
      newConstraints = infer(calleeNode, env, newConstraints)
      argNodes.forEach(argNode => {
        newConstraints = infer(argNode, env, newConstraints)
      })
      return newConstraints
      // const [funcType, subst1] = infer(node.callee, ctx)
      // const newCtx = cloneCtx(ctx)
      // applySubstToCtx(subst1, newCtx)
      // let subst2: Subsitution = {}
      // const argTypes: TYPE[] = []
      // node.arguments.forEach(arg => {
      //   const inferredArgType = infer(arg, newCtx)
      //   argTypes.push(inferredArgType[0])
      //   subst2 = composeSubsitutions(subst2, inferredArgType[1])
      // })
      // const newType = newTypeVar(ctx)
      // const subst3 = composeSubsitutions(subst1, subst2)
      // // Check that our supposed function is an actual function and unify with literal fn type
      // const subst4 = unify(funcType, { nodeType: 'Function', fromTypes: argTypes, toType: newType })
      // const funcType1 = applySubstToType(subst4, funcType) as FUNCTION
      // // consolidate all substitutions so far
      // const subst5 = composeSubsitutions(subst3, subst4)
      // // attempt to unify actual argument type with expected type
      // const paramTypes = applySubstToTypes(subst5, funcType1.fromTypes)
      // let subst6: Subsitution = {}
      // paramTypes.forEach((paramType, index) => {
      //   subst6 = composeSubsitutions(subst6, unify(paramType, argTypes[index]))
      // })
      // // consolidate new substitutions
      // const finalSubst = composeSubsitutions(subst5, subst6)
      // const inferredReturnType = applySubstToType(finalSubst, funcType1.toType)
      // return [inferredReturnType, finalSubst]
      return []
    }
    default:
      return []
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

function tVar(name: string | number): VAR {
  return {
    nodeType: 'Var',
    name: `T_${name}`,
    type: 'any'
  }
}

function tAddable(name: string): VAR {
  return {
    nodeType: 'Var',
    name: `T_${name}`,
    type: 'addable'
  }
}

function tNumerical(name: string): VAR {
  return {
    nodeType: 'Var',
    name: `T_${name}`,
    type: 'numerical'
  }
}

function tForAll(type: TYPE): FORALL {
  return {
    nodeType: 'Forall',
    type
  }
}

const tNamedBool = tNamed('bool')
const tNamedFloat = tNamed('float')
const tNamedString = tNamed('string')
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

const predeclaredNames = {
  // constants
  Infinity: tNamedFloat,
  NaN: tNamedFloat,
  undefined: tNamedUndef,
  math_LN2: tNamedFloat,
  math_LN10: tNamedFloat,
  math_LOG2E: tNamedFloat,
  math_LOG10E: tNamedFloat,
  math_PI: tNamedFloat,
  math_SQRT1_2: tNamedFloat,
  math_SQRT2: tNamedFloat,
  // is something functions
  // is_boolean: tForAll(['A'], tFunc(tVar('A'), tNamedBool)),
  // is_function: tForAll(['A'], tFunc(tVar('A'), tNamedBool)),
  // is_number: tForAll(['A'], tFunc(tVar('A'), tNamedBool)),
  // is_string: tForAll(['A'], tFunc(tVar('A'), tNamedBool)),
  // is_undefined: tForAll(['A'], tFunc(tVar('A'), tNamedBool)),
  // math functions
  math_abs: tFunc(tNamedFloat, tNamedFloat),
  math_acos: tFunc(tNamedFloat, tNamedFloat),
  math_acosh: tFunc(tNamedFloat, tNamedFloat),
  math_asin: tFunc(tNamedFloat, tNamedFloat),
  math_asinh: tFunc(tNamedFloat, tNamedFloat),
  math_atan: tFunc(tNamedFloat, tNamedFloat),
  math_atan2: tFunc(tNamedFloat, tNamedFloat),
  math_atanh: tFunc(tNamedFloat, tNamedFloat),
  math_cbrt: tFunc(tNamedFloat, tNamedFloat),
  math_ceil: tFunc(tNamedFloat, tNamedFloat),
  math_clz32: tFunc(tNamedFloat, tNamedFloat),
  math_cos: tFunc(tNamedFloat, tNamedFloat),
  math_cosh: tFunc(tNamedFloat, tNamedFloat),
  math_exp: tFunc(tNamedFloat, tNamedFloat),
  math_expm1: tFunc(tNamedFloat, tNamedFloat),
  math_floor: tFunc(tNamedFloat, tNamedFloat),
  math_fround: tFunc(tNamedFloat, tNamedFloat),
  math_hypot: tFunc(tNamedFloat, tNamedFloat),
  math_imul: tFunc(tNamedFloat, tNamedFloat),
  math_log: tFunc(tNamedFloat, tNamedFloat),
  math_log1p: tFunc(tNamedFloat, tNamedFloat),
  math_log2: tFunc(tNamedFloat, tNamedFloat),
  math_log10: tFunc(tNamedFloat, tNamedFloat),
  math_max: tFunc(tNamedFloat, tNamedFloat),
  math_min: tFunc(tNamedFloat, tNamedFloat),
  math_pow: tFunc(tNamedFloat, tNamedFloat),
  math_random: tFunc(tNamedFloat, tNamedFloat),
  math_round: tFunc(tNamedFloat, tNamedFloat),
  math_sign: tFunc(tNamedFloat, tNamedFloat),
  math_sin: tFunc(tNamedFloat, tNamedFloat),
  math_sinh: tFunc(tNamedFloat, tNamedFloat),
  math_sqrt: tFunc(tNamedFloat, tNamedFloat),
  math_tan: tFunc(tNamedFloat, tNamedFloat),
  math_tanh: tFunc(tNamedFloat, tNamedFloat),
  math_trunc: tFunc(tNamedFloat, tNamedFloat),
  // misc functions
  parse_int: tFunc(tNamedString, tNamedFloat, tNamedFloat),
  prompt: tFunc(tNamedString, tNamedString),
  runtime: tFunc(tNamedFloat),
  stringify: tFunc(tVar('any'), tNamedString)
}

const primitiveFuncs = {
  '!': tFunc(tNamedBool, tNamedBool),
  '&&': tFunc(tNamedBool, tNamedBool, tNamedBool),
  '||': tFunc(tNamedBool, tNamedBool, tNamedBool),
  // NOTE for now just handle for Number === Number
  '===': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '!==': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '<': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '<=': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '>': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '>=': tForAll(tFunc(tVar('A'), tVar('A'), tNamedBool)),
  '+': tForAll(tFunc(tAddable('A'), tAddable('A'), tAddable('A'))),
  '%': tForAll(tFunc(tNumerical('A'), tNumerical('A'), tNumerical('A'))),
  '-': tForAll(tFunc(tNumerical('A'), tNumerical('A'), tNumerical('A'))),
  '*': tForAll(tFunc(tNumerical('A'), tNumerical('A'), tNumerical('A'))),
  '/': tForAll(tFunc(tNumerical('A'), tNumerical('B'), tNamedFloat))
}

const initialEnv = {
  ...predeclaredNames,
  ...primitiveFuncs
}
