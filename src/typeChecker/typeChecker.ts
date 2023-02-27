import * as es from 'estree'

import {
  ArrayAssignmentError,
  CallingNonFunctionType,
  ConsequentAlternateMismatchError,
  CyclicReferenceError,
  DifferentAssignmentError,
  DifferentNumberArgumentsError,
  InconsistentPredicateTestError,
  InvalidArgumentTypesError,
  InvalidArrayIndexType,
  InvalidTestConditionError,
  ReassignConstError,
  UndefinedIdentifierError
} from '../errors/typeErrors'
import { typedParse } from '../parser/utils'
import {
  Context,
  ContiguousArrayElements,
  ForAll,
  FuncDeclWithInferredTypeAnnotation,
  FunctionType,
  List,
  NodeWithInferredType,
  Pair,
  PredicateTest,
  PredicateType,
  SArray,
  SourceError,
  Type,
  TypeEnvironment,
  Variable
} from '../types'
import { typeToString } from '../utils/stringify'
import {
  InternalCyclicReferenceError,
  InternalDifferentNumberArgumentsError,
  InternalTypeError,
  TypeError,
  UnifyError
} from './internalTypeErrors'
import {
  lookupDeclKind,
  lookupType,
  NEGATIVE_OP,
  pushEnv,
  setDeclKind,
  setType,
  tArray,
  tBool,
  temporaryStreamFuncs,
  tForAll,
  tFunc,
  tList,
  tNumber,
  tPair,
  tString,
  tUndef,
  tVar
} from './utils'

let typeIdCounter = 0

/**
 * Called before and after type inference. First to add typeVar attribute to node, second to resolve
 * the type
 * FunctionDeclaration nodes have the functionTypeVar attribute as well
 * @param node
 * @param constraints: undefined for first call
 */
/* tslint:disable cyclomatic-complexity */
function traverse(node: NodeWithInferredType<es.Node>, constraints?: Constraint[]) {
  if (node === null) {
    // this happens in a holey array [,,,,,]
    return
  }
  if (constraints && node.typability !== 'Untypable') {
    try {
      node.inferredType = applyConstraints(node.inferredType as Type, constraints)
      node.typability = 'Typed'
    } catch (e) {
      if (isInternalTypeError(e) && !(e instanceof InternalCyclicReferenceError)) {
        addTypeError(new TypeError(node, e))
      }
    }
  } else {
    node.inferredType = tVar(`T${typeIdCounter}`)
    typeIdCounter++
  }
  switch (node.type) {
    case 'Program': {
      node.body.forEach(nodeBody => {
        traverse(nodeBody, constraints)
      })
      break
    }
    case 'UnaryExpression': {
      traverse(node.argument, constraints)
      break
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      traverse(node.left, constraints)
      traverse(node.right, constraints)
      break
    }
    case 'ExpressionStatement': {
      traverse(node.expression, constraints)
      break
    }
    case 'BlockStatement': {
      node.body.forEach(nodeBody => {
        traverse(nodeBody, constraints)
      })
      break
    }
    case 'WhileStatement': {
      traverse(node.test, constraints)
      traverse(node.body, constraints)
      break
    }
    case 'ForStatement': {
      traverse(node.init!, constraints)
      traverse(node.test!, constraints)
      traverse(node.update!, constraints)
      traverse(node.body, constraints)
      break
    }
    case 'ConditionalExpression': // both cases are the same
    case 'IfStatement': {
      traverse(node.test, constraints)
      traverse(node.consequent, constraints)
      if (node.alternate) {
        traverse(node.alternate, constraints)
      }
      break
    }
    case 'CallExpression': {
      traverse(node.callee, constraints)
      node.arguments.forEach(arg => {
        traverse(arg, constraints)
      })
      break
    }
    case 'ReturnStatement': {
      const arg = node.argument!
      traverse(arg, constraints)
      break
    }
    case 'VariableDeclaration': {
      const init = node.declarations[0].init!
      traverse(init, constraints)
      break
    }
    case 'ArrowFunctionExpression': {
      node.params.forEach(param => {
        traverse(param, constraints)
      })
      traverse(node.body, constraints)
      break
    }
    case 'FunctionDeclaration': {
      const funcDeclNode = node as FuncDeclWithInferredTypeAnnotation
      if (constraints) {
        try {
          funcDeclNode.functionInferredType = applyConstraints(
            funcDeclNode.functionInferredType as Type,
            constraints
          )
        } catch (e) {
          if (e instanceof InternalCyclicReferenceError) {
            addTypeError(new CyclicReferenceError(node))
          } else if (isInternalTypeError(e)) {
            addTypeError(new TypeError(node, e))
          }
        }
      } else {
        funcDeclNode.functionInferredType = tVar(`T${typeIdCounter}`)
      }
      typeIdCounter++
      funcDeclNode.params.forEach(param => {
        traverse(param, constraints)
      })
      traverse(funcDeclNode.body, constraints)
      break
    }
    case 'AssignmentExpression':
      traverse(node.left, constraints)
      traverse(node.right, constraints)
      break
    case 'ArrayExpression':
      ;(node.elements as ContiguousArrayElements).forEach(element => traverse(element, constraints))
      break
    case 'MemberExpression':
      traverse(node.object, constraints)
      traverse(node.property, constraints)
      break
    default:
      return
  }
}

function isPair(type: Type): type is Pair {
  return type.kind === 'pair'
}

function isList(type: Type): type is List {
  return type.kind === 'list'
}

function getListType(type: Type): Type | null {
  if (isList(type)) {
    return type.elementType
  }
  return null
}

function isInternalTypeError(error: any) {
  return error instanceof InternalTypeError
}

type Constraint = [Variable, Type]
let hasUndefinedIdentifierError = false
let typeErrors: SourceError[] = []

function addTypeError(err: SourceError) {
  if (err instanceof UndefinedIdentifierError && hasUndefinedIdentifierError) {
    return
  }
  hasUndefinedIdentifierError = true
  typeErrors.push(err)
}

/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 */
export function typeCheck(
  program: NodeWithInferredType<es.Program>,
  context: Context
): [NodeWithInferredType<es.Program>, SourceError[]] {
  function typeCheck_(
    program: NodeWithInferredType<es.Program>
  ): [NodeWithInferredType<es.Program>, SourceError[]] {
    typeIdCounter = 0
    hasUndefinedIdentifierError = false
    typeErrors = []
    const env: TypeEnvironment = context.typeEnvironment
    if (context.chapter >= 3 && env.length === 3) {
      // TODO: this is a hack since we don't infer streams properly yet
      // if chapter is 3 and the prelude was just loaded, we change all the stream functions
      const latestEnv = env[2].typeMap
      for (const [name, type] of temporaryStreamFuncs) {
        latestEnv.set(name, type)
      }
    }
    const constraints: Constraint[] = []
    traverse(program)
    try {
      infer(program, env, constraints, true)
    } catch (e) {
      // any errors here are either UX bugs or some actual logical bug
      // we should have either processed them from a InternalTypeError into a SourceError with better explanations
      // or the error is some other issue and we should add a generic runtime error to say something has gone wrong
      if (isInternalTypeError(e)) {
        addTypeError(
          new TypeError(
            program,
            'Uncaught internal type error during typechecking, report this to the adminstrators!\n' +
              e.message
          )
        )
      } else {
        addTypeError(
          new TypeError(
            program,
            'Uncaught error during typechecking, report this to the adminstrators!\n' + e.message
          )
        )
      }
    }
    traverse(program, constraints)
    return [program, typeErrors]
  }

  for (const code of context.unTypecheckedCode) {
    typeCheck_(typedParse(code, context)!)
  }

  context.unTypecheckedCode = []
  return typeCheck_(program)
}

/**
 * Generate a fresh type variable
 * @param typeVar
 */
function freshTypeVar(typeVar: Variable): Variable {
  const newVarId = typeIdCounter
  typeIdCounter++
  return {
    ...typeVar,
    name: `T${newVarId}`
  }
}

/**
 * Replaces all instances of type variables in the type of a polymorphic type
 */
function fresh(monoType: Type, subst: { [typeName: string]: Variable }): Type {
  switch (monoType.kind) {
    case 'primitive':
      return monoType
    case 'list':
      return {
        kind: 'list',
        elementType: fresh(monoType.elementType, subst)
      }
    case 'array':
      return {
        kind: 'array',
        elementType: fresh(monoType.elementType, subst)
      }
    case 'pair':
      return {
        kind: 'pair',
        headType: fresh(monoType.headType, subst),
        tailType: fresh(monoType.tailType, subst)
      }
    case 'variable':
      return subst[monoType.name]
    case 'function':
      return {
        ...monoType,
        parameterTypes: monoType.parameterTypes.map(argType => fresh(argType, subst)),
        returnType: fresh(monoType.returnType, subst)
      }
    default:
      return monoType
  }
}

/** Union of free type variables */
function union(a: Variable[], b: Variable[]): Variable[] {
  const sum = [...a]
  b.forEach(newVal => {
    if (sum.findIndex(val => val.name === newVal.name) === -1) {
      sum.push(newVal)
    }
  })
  return sum
}

function freeTypeVarsInType(type: Type): Variable[] {
  switch (type.kind) {
    case 'primitive':
      return []
    case 'list':
      return freeTypeVarsInType(type.elementType)
    case 'array':
      return freeTypeVarsInType(type.elementType)
    case 'pair':
      return union(freeTypeVarsInType(type.headType), freeTypeVarsInType(type.tailType))
    case 'variable':
      return [type]
    case 'function':
      return union(
        type.parameterTypes.reduce((acc, currentType) => {
          return union(acc, freeTypeVarsInType(currentType))
        }, []),
        freeTypeVarsInType(type.returnType)
      )
    default:
      return []
  }
}

function extractFreeVariablesAndGenFresh(polyType: ForAll): Type {
  const monoType = polyType.polyType
  const freeTypeVars = freeTypeVarsInType(monoType)
  const substitutions = {}
  freeTypeVars.forEach(val => {
    substitutions[val.name] = freshTypeVar(val)
  })
  return fresh(monoType, substitutions)
}

/**
 * Going down the DAG that is the constraint list
 */
function applyConstraints(type: Type, constraints: Constraint[]): Type {
  switch (type.kind) {
    case 'primitive': {
      return type
    }
    case 'pair': {
      const pairHeadType = applyConstraints(type.headType, constraints)
      const pairTailType = applyConstraints(type.tailType, constraints)
      if (pairTailType.kind === 'list' && pairHeadType === getListType(pairTailType)) {
        return tList(pairHeadType)
      } else {
        return tPair(pairHeadType, pairTailType)
      }
    }
    case 'list': {
      const elementType = applyConstraints(type.elementType, constraints)
      return {
        kind: 'list',
        elementType
      }
    }
    case 'array': {
      const elementType = applyConstraints(type.elementType, constraints)
      return {
        kind: 'array',
        elementType
      }
    }
    case 'variable': {
      for (const constraint of constraints) {
        const LHS = constraint[0]
        const RHS = constraint[1]
        if (LHS.name === type.name) {
          if (contains(RHS, LHS.name)) {
            if (isPair(RHS) && LHS === RHS.tailType) {
              return {
                kind: 'list',
                elementType: RHS.headType
              }
            } else if (LHS.kind === 'variable' && LHS === getListType(RHS)) {
              return {
                kind: 'list',
                elementType: LHS
              }
            }
            throw new InternalCyclicReferenceError(type.name)
          }
          return applyConstraints(constraint[1], constraints)
        }
      }
      return type
    }
    case 'function': {
      return {
        ...type,
        parameterTypes: type.parameterTypes.map(fromType =>
          applyConstraints(fromType, constraints)
        ),
        returnType: applyConstraints(type.returnType, constraints)
      }
    }
    default:
      return type
  }
}

/**
 * Check if a type contains a reference to a name, to check for an infinite type
 * e.g. A = B -> A
 * @param type
 * @param name
 */
function contains(type: Type, name: string): boolean {
  switch (type.kind) {
    case 'primitive':
      return false
    case 'pair':
      return contains(type.headType, name) || contains(type.tailType, name)
    case 'array':
    case 'list':
      return contains(type.elementType, name)
    case 'variable':
      return type.name === name
    case 'function':
      const containedInParamTypes = type.parameterTypes.some(currentType =>
        contains(currentType, name)
      )
      return containedInParamTypes || contains(type.returnType, name)
    default:
      return false
  }
}

function occursOnLeftInConstraintList(
  LHS: Variable,
  constraints: Constraint[],
  RHS: Type
): Constraint[] {
  for (const constraint of constraints) {
    if (constraint[0].name === LHS.name) {
      // when LHS occurs earlier in original constrain list
      return addToConstraintList(constraints, [RHS, constraint[1]])
    }
  }
  if (RHS.kind === 'variable') {
    if (LHS.constraint === 'addable' && RHS.constraint === 'none') {
      // We need to modify the type of the RHS so that it is at least as specific as the LHS
      // this is so we are going from least to most specific as we recursively try to determine
      // type of a type variable
      RHS.constraint = LHS.constraint
    }
  }
  if (LHS !== RHS) constraints.push([LHS, RHS])
  return constraints
}

function cannotBeResolvedIfAddable(LHS: Variable, RHS: Type): boolean {
  return (
    LHS.constraint === 'addable' &&
    RHS.kind !== 'variable' &&
    !(RHS.kind === 'primitive' && (RHS.name === 'string' || RHS.name === 'number'))
  )
}

function downgradePredicateToFunction(_type: PredicateType): FunctionType {
  return {
    kind: 'function',
    parameterTypes: [freshTypeVar(tVar('T'))],
    returnType: tBool
  }
}

function genFreshPredicateType(): FunctionType {
  return tFunc(freshTypeVar(tVar('T')), tBool)
}

function addToConstraintList(constraints: Constraint[], [LHS, RHS]: [Type, Type]): Constraint[] {
  // First handle primitives and variables, which don't require structural unification
  if (LHS.kind === 'primitive' && RHS.kind === 'primitive' && LHS.name === RHS.name) {
    // if t is base type and t' also base type of the same kind, do nothing
    return constraints
  } else if (LHS.kind !== 'variable' && RHS.kind === 'variable') {
    // if t is not a type var and t' is type var, then swap order
    return addToConstraintList(constraints, [RHS, LHS])
  } else if (LHS.kind === 'variable') {
    RHS = applyConstraints(RHS, constraints)
    if ((RHS.kind === 'primitive' || RHS.kind === 'variable') && LHS.name === RHS.name) {
      // if t is type var and S(t') is a type var with same name, do nothing
      return constraints
    } else if (RHS.kind === 'pair' && LHS === RHS.tailType) {
      // if t is type var and S(t') = Pair(t'',t), add t = List(t'')
      addToConstraintList(constraints, [LHS, tList(RHS.headType)])
    } else if (RHS.kind === 'pair' && RHS.tailType.kind === 'list') {
      // if t = type var and t' = Pair(T1, List<T2>), add T1 = T2 and t = List(T1)
      const newConstraints = addToConstraintList(constraints, [
        RHS.headType,
        getListType(RHS.tailType)!
      ])
      return addToConstraintList(newConstraints, [LHS, tList(RHS.headType)])
    } else if (contains(RHS, LHS.name)) {
      // if t is tpye var and S(t') is function, list or pair type and t contained in S(t'), throw
      // recursive definition error
      throw new InternalCyclicReferenceError(LHS.name)
    }
    if (cannotBeResolvedIfAddable(LHS, RHS)) {
      throw new UnifyError(LHS, RHS)
    }
    return occursOnLeftInConstraintList(LHS, constraints, applyConstraints(RHS, constraints))
  } else if (LHS.kind === 'function' && RHS.kind === 'function') {
    if (LHS.parameterTypes.length !== RHS.parameterTypes.length) {
      throw new InternalDifferentNumberArgumentsError(
        RHS.parameterTypes.length,
        LHS.parameterTypes.length
      )
    }
    let newConstraints = constraints
    for (let i = 0; i < LHS.parameterTypes.length; i++) {
      newConstraints = addToConstraintList(newConstraints, [
        LHS.parameterTypes[i],
        RHS.parameterTypes[i]
      ])
    }
    newConstraints = addToConstraintList(newConstraints, [LHS.returnType, RHS.returnType])
    return newConstraints
  } else if (LHS.kind === 'pair' && RHS.kind === 'pair') {
    // if t = Pair<T1, T2> and t' = Pair<T3, T4>, add T1 = T3 and T2 = T4
    const newConstraints = addToConstraintList(constraints, [LHS.headType, RHS.headType])
    return addToConstraintList(newConstraints, [LHS.tailType, RHS.tailType])
  } else if (LHS.kind === 'list' && RHS.kind === 'list') {
    // if t = List<T1> and t' = List<T2>, add T1 = T2
    return addToConstraintList(constraints, [LHS.elementType, RHS.elementType])
  } else if (LHS.kind === 'list' && RHS.kind === 'pair') {
    // if t = List<T1> and t' = Pair<T2, T3>, add t' = Pair<T1, List<T1>>
    return addToConstraintList(constraints, [RHS, tPair(LHS.elementType, LHS)])
  } else if (RHS.kind === 'list' && LHS.kind === 'pair') {
    // if t = Pair<T1, T2> and t' = List<T3>, add t = Pair<T3, List<T3>>
    return addToConstraintList(constraints, [LHS, tPair(RHS.elementType, RHS)])
  } else if (LHS.kind === 'array' && RHS.kind === 'array') {
    // if t = Array<T1> and t' = Array<T2>, add T1 = T2
    return addToConstraintList(constraints, [LHS.elementType, RHS.elementType])
  }
  throw new UnifyError(LHS, RHS)
}

// Type checks consequent and alternate in a nested type environment as opposed to the current one.
function addPredicateTestToConstraintList(
  node: NodeWithInferredType<es.Node>,
  tests: PredicateTest[],
  consequent: NodeWithInferredType<es.Node>,
  isTopLevelAndLastValStmt: boolean,
  env: TypeEnvironment,
  constraints: Constraint[]
): Constraint[] {
  // Add the constraints coming from the cons node,
  // but we first have to temporarily replace the type variable for the predicated variable
  // with a new one
  pushEnv(env)

  // first create new type variables for every variable hidden in a test
  // note we do this in two passes in case multiple type tests share the same variable
  // in those cases, we want to combine all constraints together, which is done in the second pass
  for (const test of tests) {
    setType(test.argVarName, freshTypeVar(tVar('PredicatedT')), env)
  }

  // next apply the constraints from each type test
  for (const test of tests) {
    const argVarType = lookupType(test.argVarName, env) as Type
    const preUnifyType = applyConstraints(argVarType, constraints)
    const predicateTestType =
      test.ifTrueType.kind === 'forall'
        ? extractFreeVariablesAndGenFresh(test.ifTrueType)
        : test.ifTrueType
    try {
      constraints = addToConstraintList(constraints, [argVarType, predicateTestType])
    } catch (e) {
      if (e instanceof UnifyError) {
        addTypeError(
          new InconsistentPredicateTestError(
            test.node,
            test.argVarName,
            preUnifyType,
            predicateTestType
          )
        )
      }
    }
  }

  constraints = infer(consequent, env, constraints, isTopLevelAndLastValStmt)
  env.pop()

  return constraints
}

// Type checks consequent and alternate in a nested type environment as opposed to the current one.
function addPredicateTestConditionalToConstraintList(
  node: NodeWithInferredType<es.IfStatement | es.ConditionalExpression>,
  tests: PredicateTest[],
  consequent: NodeWithInferredType<es.Node>,
  alternate: NodeWithInferredType<es.Node> | undefined,
  isTopLevelAndLastValStmt: boolean,
  env: TypeEnvironment,
  constraints: Constraint[]
): Constraint[] {
  constraints = addPredicateTestToConstraintList(
    node,
    tests,
    consequent,
    isTopLevelAndLastValStmt,
    env,
    constraints
  )

  // Add the constraints coming from the alt node,
  // which have no additional constraints coming from the predicate
  if (alternate !== undefined) {
    try {
      constraints = infer(alternate, env, constraints, isTopLevelAndLastValStmt)
    } catch (e) {
      if (e instanceof UnifyError) {
        addTypeError(new ConsequentAlternateMismatchError(node, e.RHS, e.LHS))
      }
    }
  }

  return constraints
}

function statementHasReturn(node: es.Node): boolean {
  switch (node.type) {
    case 'IfStatement': {
      return statementHasReturn(node.consequent) || statementHasReturn(node.alternate!)
    }
    case 'BlockStatement': {
      return node.body.some(stmt => statementHasReturn(stmt))
    }
    case 'ForStatement':
    case 'WhileStatement': {
      return statementHasReturn(node.body)
    }
    case 'ReturnStatement': {
      return true
    }
    default: {
      return false
    }
  }
}

// These are the only two possible kinds of value returning statements when excluding return statements
function stmtHasValueReturningStmt(node: es.Node): boolean {
  switch (node.type) {
    case 'ExpressionStatement': {
      return true
    }
    case 'IfStatement': {
      return (
        stmtHasValueReturningStmt(node.consequent) || stmtHasValueReturningStmt(node.alternate!)
      )
    }
    case 'BlockStatement': {
      return node.body.some(stmt => stmtHasValueReturningStmt(stmt))
    }
    case 'ForStatement':
    case 'WhileStatement': {
      return stmtHasValueReturningStmt(node.body)
    }
    default: {
      return false
    }
  }
}

// Helper function to extract all predicate tests in a "positive position".
//
// Predicate tests in a positive position
// necessarily evaluate to true whenever the entire expression evaluates to true.
// For example, in the expression
//   (TEST1 && TEST2 && ... && TESTn)
// TEST1, TEST2, ... would all necessarily evaluate to true if the entire expression evaluates to true.
// Of these expressions, those that are also predicate tests are returned.
// For another example, in the expression
//   !(TEST1 || TEST2)
// TEST1 and TEST2 necessarily evaluate to false if the entire expression evaluates to true,
// and thus predicate tests in the "negative positions" of those expressions
// are extracted as well.
function extractPositiveTypeTests(
  node: NodeWithInferredType<es.Node>,
  env: TypeEnvironment,
  result: PredicateTest[] = []
): PredicateTest[] {
  if (node.type === 'LogicalExpression' && node.operator === '&&') {
    result = extractPositiveTypeTests(node.left, env, result)
    return extractPositiveTypeTests(node.right, env, result)
  } else if (node.type === 'UnaryExpression' && node.operator === '!') {
    return extractNegativeTypeTests(node.argument, env, result)
  } else if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.arguments.length === 1 &&
    node.arguments[0].type === 'Identifier'
  ) {
    // Check that it's a proper predicate test,
    // i.e. callee is a type predicate, exactly one argument, and argument names an identifier.
    const calleeType = lookupType(node.callee.name, env)
    if (calleeType !== undefined && calleeType.kind === 'predicate') {
      // It is a proper predicate test
      result.push({ node, ifTrueType: calleeType.ifTrueType, argVarName: node.arguments[0].name })
      return result
    }
  }
  return result
}

// Helper function to extract all predicate tests in a "negative position".
//
// Predicate tests in a negative position
// necessarily evaluate to true whenever the entire expression evaluates to false.
// For example, in the expression
//   (!TEST1 || !TEST2 || ... || !TESTn)
// TEST1, TEST2, ... would all necessarily evaluate to true if the entire expression evaluates to false.
// Of these expressions, those that are also predicate tests are returned.
// For another example, in the expression
//   !(TEST1 && TEST2)
// TEST1 and TEST2 necessarily evaluate to true if the entire expression evaluates to false,
// and thus predicate tests in the "positive positions" of those expressions
// are extracted as well.
function extractNegativeTypeTests(
  node: NodeWithInferredType<es.Node>,
  env: TypeEnvironment,
  result: PredicateTest[] = []
): PredicateTest[] {
  if (node.type === 'LogicalExpression' && node.operator === '||') {
    result = extractNegativeTypeTests(node.left, env, result)
    return extractNegativeTypeTests(node.right, env, result)
  } else if (node.type === 'UnaryExpression' && node.operator === '!') {
    return extractPositiveTypeTests(node.argument, env, result)
  }
  return result
}

/**
 * The following is the index of the node whose value will be the value of the block itself.
 * At the top level and if we are currently in the last value returning stmt of the parent block stmt,
 * we will use the last value returning statement of the current block. Anywhere else, we will use
 * either the first return statement or the last statement in the block otherwise
 */
function returnBlockValueNodeIndexFor(
  node: es.Program | es.BlockStatement,
  isTopLevelAndLastValStmt: boolean
): number {
  const lastStatementIndex = node.body.length - 1
  if (isTopLevelAndLastValStmt) {
    for (let index = lastStatementIndex; index >= 0; index--) {
      if (stmtHasValueReturningStmt(node.body[index])) {
        return index
      }
    }
    // in the case there are no value returning statements in the body
    // return the last statement
    return lastStatementIndex
  } else {
    return node.body.findIndex((currentNode, index) => {
      return index === lastStatementIndex || statementHasReturn(currentNode)
    })
  }
}

/* tslint:disable cyclomatic-complexity */
function infer(
  node: NodeWithInferredType<es.Node>,
  env: TypeEnvironment,
  constraints: Constraint[],
  isTopLevelAndLastValStmt: boolean = false
): Constraint[] {
  try {
    return _infer(node, env, constraints, isTopLevelAndLastValStmt)
  } catch (e) {
    if (e instanceof InternalCyclicReferenceError) {
      addTypeError(new CyclicReferenceError(node))
      return constraints
    }
    throw e
  }
}

/* tslint:disable cyclomatic-complexity */
function _infer(
  node: NodeWithInferredType<es.Node>,
  env: TypeEnvironment,
  constraints: Constraint[],
  isTopLevelAndLastValStmt: boolean = false
): Constraint[] {
  const storedType = node.inferredType as Variable
  switch (node.type) {
    case 'UnaryExpression': {
      const op = node.operator === '-' ? NEGATIVE_OP : node.operator
      const funcType = lookupType(op, env) as FunctionType // in either case its a monomorphic type
      const argNode = node.argument as NodeWithInferredType<es.Node>
      const argType = argNode.inferredType as Variable
      const receivedTypes: Type[] = []
      let newConstraints = infer(argNode, env, constraints)
      receivedTypes.push(applyConstraints(argNode.inferredType!, newConstraints))
      try {
        newConstraints = addToConstraintList(newConstraints, [tFunc(argType, storedType), funcType])
      } catch (e) {
        if (e instanceof UnifyError) {
          const expectedTypes = funcType.parameterTypes
          addTypeError(new InvalidArgumentTypesError(node, [argNode], expectedTypes, receivedTypes))
          return newConstraints
        }
      }
      return newConstraints
    }
    case 'LogicalExpression': {
      // We specially handle the cases where
      //  - the LHS of an && operator contains predicate tests in positive positions
      //  - the LHS of an || operator contains predicate tests in negative positions
      // For the following examples,
      //   (TEST1 && TEST2 && ... && TESTn) && CONS
      //   !(TEST1 && TEST2 && ... && TESTn) || CONS
      // TEST1 to TESTn are all in positive positions and negative positions respectively,
      // so if there are predicate tests in those positions,
      // we will type check CONS in a more specific type context
      // with the predicate tests "applied".

      // Basics that apply to both predicate test logical expressions as well as standard binary expressions:
      // node type = lhs type = rhs type = boolean
      // Note that this doesn't really follow the informal typing in the Source 3 documentation,
      // but we have no choice since we don't have union types, and every logical expression
      // always has a chance of returning the LHS, which is a boolean.
      const leftNode = node.left as NodeWithInferredType<es.Node>
      const leftType = leftNode.inferredType as Variable
      const rightNode = node.right as NodeWithInferredType<es.Node>
      const rightType = rightNode.inferredType as Variable

      let newConstraints = constraints

      newConstraints = addToConstraintList(constraints, [storedType, tBool])

      newConstraints = infer(leftNode, env, newConstraints)
      const receivedLeftType = applyConstraints(leftNode.inferredType!, newConstraints)

      // Handle predicate test cases
      // In this case, it only affects how we infer the right type.
      let receivedRightType: Type | undefined = undefined

      if (node.operator === '&&') {
        // e.g. (TEST1 && TEST2 && ... && TESTn) && CONS
        const positiveTypeTests = extractPositiveTypeTests(node.left, env)
        if (positiveTypeTests.length > 0) {
          newConstraints = addPredicateTestToConstraintList(
            node,
            positiveTypeTests,
            node.right,
            isTopLevelAndLastValStmt,
            env,
            newConstraints
          )
          receivedRightType = applyConstraints(rightNode.inferredType!, newConstraints)
        }
      } else if (node.operator === '||') {
        // e.g. (!TEST1 || !TEST2 || ... || !TESTn) || CONS
        const negativeTypeTests = extractNegativeTypeTests(node.left, env)
        if (negativeTypeTests.length > 0) {
          newConstraints = addPredicateTestToConstraintList(
            node,
            negativeTypeTests,
            node.right,
            isTopLevelAndLastValStmt,
            env,
            newConstraints
          )
          receivedRightType = applyConstraints(rightNode.inferredType!, newConstraints)
        }
      }

      if (receivedRightType === undefined) {
        // Handle normal binary expression case
        newConstraints = infer(rightNode, env, newConstraints)
        receivedRightType = applyConstraints(rightNode.inferredType!, newConstraints)
      }

      // Now left and right types have been computed.
      // Assert that they match
      try {
        newConstraints = addToConstraintList(constraints, [leftType, tBool])
        newConstraints = addToConstraintList(constraints, [rightType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(
            new InvalidArgumentTypesError(
              node,
              [leftNode, rightNode],
              [tBool, tBool],
              [receivedLeftType, receivedRightType]
            )
          )
        }
      }

      return newConstraints
    }
    case 'BinaryExpression': {
      const envType = lookupType(node.operator, env)!
      const opType =
        envType.kind === 'forall'
          ? extractFreeVariablesAndGenFresh(envType)
          : envType.kind === 'predicate'
          ? downgradePredicateToFunction(envType)
          : envType
      const leftNode = node.left as NodeWithInferredType<es.Node>
      const leftType = leftNode.inferredType as Variable
      const rightNode = node.right as NodeWithInferredType<es.Node>
      const rightType = rightNode.inferredType as Variable

      const argNodes = [leftNode, rightNode]
      let newConstraints = constraints
      const receivedTypes: Type[] = []
      argNodes.forEach(argNode => {
        newConstraints = infer(argNode, env, newConstraints)
        receivedTypes.push(applyConstraints(argNode.inferredType!, newConstraints))
      })
      try {
        newConstraints = addToConstraintList(constraints, [
          tFunc(leftType, rightType, storedType),
          opType
        ])
      } catch (e) {
        if (e instanceof UnifyError) {
          const expectedTypes = (opType as FunctionType).parameterTypes
          addTypeError(new InvalidArgumentTypesError(node, argNodes, expectedTypes, receivedTypes))
        }
      }
      return newConstraints
    }
    case 'ExpressionStatement': {
      return infer(node.expression, env, addToConstraintList(constraints, [storedType, tUndef]))
    }
    case 'ReturnStatement': {
      const argNode = node.argument as NodeWithInferredType<es.Node>
      return infer(
        argNode,
        env,
        addToConstraintList(constraints, [storedType, argNode.inferredType as Variable])
      )
    }
    case 'WhileStatement': {
      const testNode = node.test as NodeWithInferredType<es.Node>
      const testType = testNode.inferredType as Variable
      const bodyNode = node.body as NodeWithInferredType<es.Node>
      const bodyType = bodyNode.inferredType as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, bodyType])
      try {
        newConstraints = infer(testNode, env, newConstraints)
        newConstraints = addToConstraintList(newConstraints, [testType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(new InvalidTestConditionError(node, e.RHS))
        }
      }
      return infer(bodyNode, env, newConstraints, isTopLevelAndLastValStmt)
    }
    case 'ForStatement': {
      const initNode = node.init as NodeWithInferredType<es.Node>
      const testNode = node.test as NodeWithInferredType<es.Node>
      const testType = testNode.inferredType as Variable
      const bodyNode = node.body as NodeWithInferredType<es.Node>
      const bodyType = bodyNode.inferredType as Variable
      const updateNode = node.update as NodeWithInferredType<es.Node>
      let newConstraints = addToConstraintList(constraints, [storedType, bodyType])
      pushEnv(env)
      if (
        initNode.type === 'VariableDeclaration' &&
        initNode.kind !== 'var' &&
        initNode.declarations[0].id.type === 'Identifier'
      ) {
        // we need to introduce it into the scope and do something similar to what we do when
        // evaluating a block statement
        const initName = initNode.declarations[0].id.name
        setType(
          initName,
          (initNode.declarations[0].init as NodeWithInferredType<es.Node>).inferredType as Variable,
          env
        )
        setDeclKind(initName, initNode.kind, env)
        newConstraints = infer(initNode, env, newConstraints)
        setType(
          initName,
          tForAll(
            applyConstraints(
              (initNode.declarations[0].init as NodeWithInferredType<es.Node>)
                .inferredType as Variable,
              newConstraints
            )
          ),
          env
        )
      } else {
        newConstraints = infer(initNode, env, newConstraints)
      }
      try {
        newConstraints = infer(testNode, env, newConstraints)
        newConstraints = addToConstraintList(newConstraints, [testType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(new InvalidTestConditionError(node, e.RHS))
        }
      }
      newConstraints = infer(updateNode, env, newConstraints)
      const result = infer(bodyNode, env, newConstraints, isTopLevelAndLastValStmt)
      env.pop()
      return result
    }
    case 'Program':
    case 'BlockStatement': {
      pushEnv(env)
      for (const statement of node.body) {
        if (statement.type === 'ImportDeclaration') {
          for (const specifier of statement.specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.local.type === 'Identifier') {
              setType(specifier.local.name, tForAll(tVar('T1')), env)
              setDeclKind(specifier.local.name, 'const', env)
            }
          }
        }
      }
      const lastStatementIndex = node.body.length - 1
      const returnValNodeIndex = returnBlockValueNodeIndexFor(node, isTopLevelAndLastValStmt)
      let lastDeclNodeIndex = -1
      let lastDeclFound = false
      let n = lastStatementIndex
      const declNodes: (
        | FuncDeclWithInferredTypeAnnotation
        | NodeWithInferredType<es.VariableDeclaration>
      )[] = []
      while (n >= 0) {
        const currNode = node.body[n]
        if (currNode.type === 'FunctionDeclaration' || currNode.type === 'VariableDeclaration') {
          // in the event we havent yet found our last decl
          if (!lastDeclFound) {
            lastDeclFound = true
            lastDeclNodeIndex = n
          }
          declNodes.push(currNode)
        }
        n--
      }
      declNodes.forEach(declNode => {
        if (declNode.type === 'FunctionDeclaration' && declNode.id !== null) {
          const declName = declNode.id.name
          setType(declName, declNode.functionInferredType!, env)
          setDeclKind(declName, 'const', env)
        } else if (
          declNode.type === 'VariableDeclaration' &&
          declNode.kind !== 'var' &&
          declNode.declarations[0].id.type === 'Identifier'
        ) {
          const declName = declNode.declarations[0].id.name
          setType(
            declName,
            (declNode.declarations[0].init as NodeWithInferredType<es.Node>)
              .inferredType as Variable,
            env
          )
          setDeclKind(declName, declNode.kind, env)
        }
      })
      const lastNode = node.body[returnValNodeIndex] as NodeWithInferredType<es.Node>
      const lastNodeType = (
        isTopLevelAndLastValStmt && lastNode.type === 'ExpressionStatement'
          ? (lastNode.expression as NodeWithInferredType<es.Node>).inferredType
          : lastNode.inferredType
      ) as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, lastNodeType])
      for (let i = 0; i <= lastDeclNodeIndex; i++) {
        if (i === returnValNodeIndex) {
          newConstraints = infer(node.body[i], env, newConstraints, isTopLevelAndLastValStmt)
        } else {
          newConstraints = infer(node.body[i], env, newConstraints)
        }
      }
      declNodes.forEach(declNode => {
        if (declNode.type === 'FunctionDeclaration' && declNode.id !== null) {
          setType(
            declNode.id.name,
            tForAll(applyConstraints(declNode.functionInferredType as Variable, newConstraints)),
            env
          )
        } else if (
          declNode.type === 'VariableDeclaration' &&
          declNode.declarations[0].id.type === 'Identifier'
        ) {
          setType(
            declNode.declarations[0].id.name,
            tForAll(
              applyConstraints(
                (declNode.declarations[0].init as NodeWithInferredType<es.Node>)
                  .inferredType as Variable,
                newConstraints
              )
            ),
            env
          )
        }
      })
      for (let i = lastDeclNodeIndex + 1; i <= lastStatementIndex; i++) {
        // for the last statement, if it is an if statement, pass down isLastStatementinBlock variable
        const checkedNode = node.body[i]
        if (i === returnValNodeIndex) {
          newConstraints = infer(checkedNode, env, newConstraints, isTopLevelAndLastValStmt)
        } else {
          newConstraints = infer(checkedNode, env, newConstraints)
        }
      }
      if (node.type === 'BlockStatement') {
        // if program, we want to save the types there, so only pop for blocks
        env.pop()
      }
      return newConstraints
    }
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal
      if (literalVal === null) {
        return addToConstraintList(constraints, [storedType, tList(tVar(`T${typeIdCounter++}`))])
      } else if (typeOfLiteral === 'number') {
        return addToConstraintList(constraints, [storedType, tNumber])
      } else if (typeOfLiteral === 'boolean') {
        return addToConstraintList(constraints, [storedType, tBool])
      } else if (typeOfLiteral === 'string') {
        return addToConstraintList(constraints, [storedType, tString])
      }
      throw Error('Unexpected literal type')
    }
    case 'Identifier': {
      const identifierName = node.name
      const envType = lookupType(identifierName, env)
      if (envType !== undefined) {
        if (envType.kind === 'forall') {
          return addToConstraintList(constraints, [
            storedType,
            extractFreeVariablesAndGenFresh(envType)
          ])
        } else if (envType.kind === 'predicate') {
          return addToConstraintList(constraints, [storedType, genFreshPredicateType()])
        } else {
          return addToConstraintList(constraints, [storedType, envType])
        }
      }
      addTypeError(new UndefinedIdentifierError(node, identifierName))
      return constraints
    }
    case 'ConditionalExpression': // both cases are the same
    case 'IfStatement': {
      // We specially handle the cases where the condition expression
      // either contains predicate tests in positive positions or in negative positions.
      // For the following example,
      //   (TEST1 && TEST2 && ... && TESTn) ? CONS : ALT
      // TEST1 to TESTn are all in positive positions,
      // so if there are predicate tests in those positions,
      // we will type check CONS in a more specific type context respectively
      // with the predicate tests "applied".
      // For the example
      //   (!TEST1 || !TEST2 || ... || !TESTn) ? CONS : ALT
      // TEST1 to TESTn are all in negative positions,
      // so if there are predicate tests in those positions,
      // we will type check ALT in a more specific type context respectively
      // with the predicate tests "applied".
      //
      // If the condition expression has no predicate tests in either positive nor negative positions,
      // then type checking proceeds as usual:
      //  - the type constraints of CONS and ALT,
      //  - an equality constraint between the return types of CONS and ALT,
      //  - an equality constraint between the return type of the condition expression and boolean
      // is added to the constraint set.

      const testNode = node.test as NodeWithInferredType<es.Node>
      const testType = testNode.inferredType as Variable
      const consNode = node.consequent as NodeWithInferredType<es.Node>
      const consType = consNode.inferredType as Variable
      const altNode = node.alternate as NodeWithInferredType<es.Node>
      const altType = altNode.inferredType as Variable

      // The basics, these apply to both predicate tests as well as standard conditionals

      let newConstraints = constraints
      // test type = boolean
      try {
        newConstraints = infer(testNode, env, newConstraints)
        newConstraints = addToConstraintList(newConstraints, [testType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(new InvalidTestConditionError(node, e.RHS))
        }
      }

      // Handle predicate test cases

      const positiveTypeTests = extractPositiveTypeTests(testNode, env)
      const negativeTypeTests = extractNegativeTypeTests(testNode, env)
      if (positiveTypeTests.length > 0) {
        newConstraints = addPredicateTestConditionalToConstraintList(
          node,
          positiveTypeTests,
          consNode,
          altNode,
          isTopLevelAndLastValStmt,
          env,
          newConstraints
        )
      } else if (negativeTypeTests.length > 0) {
        newConstraints = addPredicateTestConditionalToConstraintList(
          node,
          negativeTypeTests,
          altNode, // Note consNode and altNode are flipped as these are negative predicate tests
          consNode,
          isTopLevelAndLastValStmt,
          env,
          newConstraints
        )
      } else {
        // This is a standard conditional, simply add cons and alt constraints to the set
        newConstraints = infer(consNode, env, newConstraints, isTopLevelAndLastValStmt)
        try {
          newConstraints = infer(altNode, env, newConstraints, isTopLevelAndLastValStmt)
        } catch (e) {
          if (e instanceof UnifyError) {
            addTypeError(new ConsequentAlternateMismatchError(node, e.RHS, e.LHS))
          }
        }
      }

      // Now both left and right side have their types inferred
      // Assert that they agree
      try {
        newConstraints = addToConstraintList(newConstraints, [storedType, consType])
        newConstraints = addToConstraintList(newConstraints, [storedType, altType])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(new ConsequentAlternateMismatchError(node, e.RHS, e.LHS))
        }
      }

      return newConstraints
    }
    case 'ArrowFunctionExpression': {
      pushEnv(env)
      const paramNodes = node.params
      const paramTypes: Variable[] = paramNodes.map(
        paramNode => (paramNode as NodeWithInferredType<es.Node>).inferredType as Variable
      )
      const bodyNode = node.body as NodeWithInferredType<es.Node>
      paramTypes.push(bodyNode.inferredType as Variable)
      const newConstraints = addToConstraintList(constraints, [storedType, tFunc(...paramTypes)])
      paramNodes.forEach((paramNode: NodeWithInferredType<es.Identifier>) => {
        setType(paramNode.name, paramNode.inferredType as Variable, env)
      })
      const result = infer(bodyNode, env, newConstraints)
      env.pop()
      return result
    }
    case 'VariableDeclaration': {
      const initNode = node.declarations[0].init!
      return infer(initNode, env, addToConstraintList(constraints, [storedType, tUndef]))
    }
    case 'FunctionDeclaration': {
      const funcDeclNode = node as FuncDeclWithInferredTypeAnnotation
      let newConstraints = addToConstraintList(constraints, [storedType, tUndef])
      pushEnv(env)
      const storedFunctionType = funcDeclNode.functionInferredType as Variable
      const paramNodes = node.params as NodeWithInferredType<es.Pattern>[]
      const paramTypes = paramNodes.map(paramNode => paramNode.inferredType as Variable)
      const bodyNode = node.body as NodeWithInferredType<es.BlockStatement>
      paramTypes.push(bodyNode.inferredType as Variable)
      newConstraints = addToConstraintList(newConstraints, [
        storedFunctionType,
        tFunc(...paramTypes)
      ])
      paramNodes.forEach((paramNode: NodeWithInferredType<es.Identifier>) => {
        setType(paramNode.name, paramNode.inferredType as Variable, env)
      })
      const result = infer(bodyNode, env, newConstraints)
      env.pop()
      return result
    }
    case 'CallExpression': {
      const calleeNode = node.callee as NodeWithInferredType<es.Node>
      const calleeType = calleeNode.inferredType as Variable
      const argNodes = node.arguments as NodeWithInferredType<es.Node>[]
      const argTypes: Variable[] = argNodes.map(argNode => argNode.inferredType as Variable)
      argTypes.push(storedType)
      let newConstraints = constraints
      newConstraints = infer(calleeNode, env, newConstraints)
      const calledFunctionType = applyConstraints(
        (calleeNode as NodeWithInferredType<es.Node>).inferredType!,
        newConstraints
      )
      const receivedTypes: Type[] = []
      argNodes.forEach(argNode => {
        newConstraints = infer(argNode, env, newConstraints)
        receivedTypes.push(applyConstraints(argNode.inferredType!, newConstraints))
      })
      try {
        newConstraints = addToConstraintList(constraints, [tFunc(...argTypes), calleeType])
      } catch (e) {
        if (e instanceof UnifyError) {
          if (calledFunctionType.kind === 'function') {
            const expectedTypes = calledFunctionType.parameterTypes
            addTypeError(
              new InvalidArgumentTypesError(node, argNodes, expectedTypes, receivedTypes)
            )
          } else {
            addTypeError(new CallingNonFunctionType(node, calledFunctionType))
          }
        } else if (e instanceof InternalDifferentNumberArgumentsError) {
          addTypeError(new DifferentNumberArgumentsError(node, e.numExpectedArgs, e.numReceived))
        }
      }
      return newConstraints
    }
    case 'AssignmentExpression': {
      // need to handle array item assignment
      // Two cases:
      // 1. LHS is identifier
      // 2. LHS is member expression
      // x = ...., need to check that x is not const
      // arr[x]
      const leftNode = node.left as NodeWithInferredType<es.Identifier | es.MemberExpression>
      const rightNode = node.right as NodeWithInferredType<es.Node>
      const rightType = rightNode.inferredType as Variable
      const leftType = leftNode.inferredType as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, rightType])
      newConstraints = infer(rightNode, env, newConstraints)
      if (leftNode.type === 'Identifier' && lookupDeclKind(leftNode.name, env) === 'const') {
        addTypeError(new ReassignConstError(node))
        return newConstraints
      }
      newConstraints = infer(leftNode, env, newConstraints)
      try {
        return addToConstraintList(newConstraints, [rightType, leftType])
      } catch (e) {
        if (e instanceof UnifyError) {
          if (leftNode.type === 'Identifier') {
            addTypeError(
              new DifferentAssignmentError(
                node,
                applyConstraints(leftType, newConstraints),
                applyConstraints(rightType, newConstraints)
              )
            )
          } else {
            addTypeError(
              new ArrayAssignmentError(
                node,
                tArray(applyConstraints(leftType, newConstraints)),
                tArray(applyConstraints(rightType, newConstraints))
              )
            )
          }
        }
      }
      return newConstraints
    }
    case 'ArrayExpression': {
      let newConstraints = constraints
      const elements = node.elements as NodeWithInferredType<es.Node>[]
      // infer the types of array elements
      elements.forEach(element => {
        newConstraints = infer(element, env, newConstraints)
      })
      const arrayElementType = tVar(`T${typeIdCounter++}`)
      newConstraints = addToConstraintList(newConstraints, [storedType, tArray(arrayElementType)])
      elements.forEach(element => {
        try {
          newConstraints = addToConstraintList(newConstraints, [
            arrayElementType,
            element.inferredType!
          ])
        } catch (e) {
          if (e instanceof UnifyError) {
            addTypeError(
              new ArrayAssignmentError(
                node,
                applyConstraints(node.inferredType!, newConstraints) as SArray,
                tArray(applyConstraints(element.inferredType!, newConstraints))
              )
            )
          }
        }
      })
      return newConstraints
    }
    case 'MemberExpression': {
      // object and property
      // need to check that property is number and add constraints that inferredType is array
      // element type
      const obj = node.object as NodeWithInferredType<es.Identifier>
      const objName = obj.name
      const property = node.property as NodeWithInferredType<es.Node>
      const propertyType = property.inferredType as Variable
      let newConstraints = infer(property, env, constraints)
      // Check that property is of type number
      // type in env can be either var or forall
      const envType = lookupType(objName, env)!

      // ensure envType is a monotype.
      // polytype arrays are not supported (or make sense, tbh), and they can't be predicates either.
      if (envType.kind === 'predicate') {
        if (envType.ifTrueType.kind === 'forall') {
          throw new InternalTypeError(
            `Expected ${objName} to be an array, got ${typeToString(
              extractFreeVariablesAndGenFresh(envType.ifTrueType)
            )}`
          )
        } else {
          throw new InternalTypeError(
            `Expected ${objName} to be an array, got ${typeToString(envType.ifTrueType)}`
          )
        }
      } else if (envType.kind === 'forall') {
        throw new InternalTypeError(
          `Expected ${objName} to be an array, got ${typeToString(
            extractFreeVariablesAndGenFresh(envType)
          )}`
        )
      }

      // ensure that the type is actually an array after unification
      const arrayType = applyConstraints(envType, newConstraints)
      if (arrayType.kind !== 'array')
        throw new InternalTypeError(
          `Expected ${objName} to be an array, got ${typeToString(arrayType)}`
        )

      const expectedElementType = arrayType.elementType
      try {
        newConstraints = addToConstraintList(constraints, [propertyType, tNumber])
      } catch (e) {
        if (e instanceof UnifyError) {
          addTypeError(
            new InvalidArrayIndexType(node, applyConstraints(propertyType, newConstraints))
          )
        }
      }
      return addToConstraintList(newConstraints, [storedType, expectedElementType])
    }
    default:
      return addToConstraintList(constraints, [storedType, tUndef])
  }
}
