import * as es from 'estree'
import {
  Context,
  TypeAnnotatedNode,
  Primitive,
  Variable,
  Pair,
  List,
  ForAll,
  SArray,
  Type,
  FunctionType,
  TypeAnnotatedFuncDecl,
  SourceError,
  AllowedDeclarations,
  TypeEnvironment
} from '../types'
import {
  TypeError,
  InternalTypeError,
  UnifyError,
  InternalDifferentNumberArgumentsError,
  InternalCyclicReferenceError
} from './internalTypeErrors'
import {
  ConsequentAlternateMismatchError,
  InvalidTestConditionError,
  DifferentNumberArgumentsError,
  InvalidArgumentTypesError,
  CyclicReferenceError,
  DifferentAssignmentError,
  ReassignConstError,
  ArrayAssignmentError,
  InvalidArrayIndexType,
  UndefinedIdentifierError,
  CallingNonFunctionType
} from '../errors/typeErrors'
import { typeToString } from '../utils/stringify'

/** Name of Unary negative builtin operator */
const NEGATIVE_OP = '-_1'
let typeIdCounter = 0

/**
 * Called before and after type inference. First to add typeVar attribute to node, second to resolve
 * the type
 * FunctionDeclaration nodes have the functionTypeVar attribute as well
 * @param node
 * @param constraints: undefined for first call
 */
/* tslint:disable cyclomatic-complexity */
function traverse(node: TypeAnnotatedNode<es.Node>, constraints?: Constraint[]) {
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
        typeErrors.push(new TypeError(node, e))
      }
    }
  } else {
    node.inferredType = tVar(typeIdCounter)
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
      const funcDeclNode = node as TypeAnnotatedFuncDecl
      if (constraints) {
        try {
          funcDeclNode.functionInferredType = applyConstraints(
            funcDeclNode.functionInferredType as Type,
            constraints
          )
        } catch (e) {
          if (e instanceof InternalCyclicReferenceError) {
            typeErrors.push(new CyclicReferenceError(node))
          } else if (isInternalTypeError(e)) {
            typeErrors.push(new TypeError(node, e))
          }
        }
      } else {
        funcDeclNode.functionInferredType = tVar(typeIdCounter)
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
      node.elements.forEach(element => traverse(element, constraints))
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

// Type Definitions
// Our type environment maps variable names to types.
// it also remembers if names weer declared as const or let
type Env = TypeEnvironment

type Constraint = [Variable, Type]
let typeErrors: SourceError[] = []
/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 */
export function typeCheck(
  program: TypeAnnotatedNode<es.Program>,
  context: Context
): [TypeAnnotatedNode<es.Program>, SourceError[]] {
  typeIdCounter = 0
  typeErrors = []
  const env: Env = context.typeEnvironment
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
  } catch {
    // we ignore the errors here since
    // they would have already been processed
  }
  traverse(program, constraints)
  return [program, typeErrors]
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

function addToConstraintList(constraints: Constraint[], [LHS, RHS]: [Type, Type]): Constraint[] {
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

function lookupType(name: string, env: Env): Type | ForAll | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i].typeMap.has(name)) {
      return env[i].typeMap.get(name)
    }
  }
  return undefined
}

function lookupDeclKind(name: string, env: Env): AllowedDeclarations | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i].declKindMap.has(name)) {
      return env[i].declKindMap.get(name)
    }
  }
  return undefined
}

function setType(name: string, type: Type | ForAll, env: Env) {
  env[env.length - 1].typeMap.set(name, type)
}

function setDeclKind(name: string, kind: AllowedDeclarations, env: Env) {
  env[env.length - 1].declKindMap.set(name, kind)
}

function pushEnv(env: Env) {
  env.push({ typeMap: new Map(), declKindMap: new Map() })
}

/* tslint:disable cyclomatic-complexity */
function infer(
  node: TypeAnnotatedNode<es.Node>,
  env: Env,
  constraints: Constraint[],
  isTopLevelAndLastValStmt: boolean = false
): Constraint[] {
  try {
    return _infer(node, env, constraints, isTopLevelAndLastValStmt)
  } catch (e) {
    if (e instanceof InternalCyclicReferenceError) {
      typeErrors.push(new CyclicReferenceError(node))
      return constraints
    }
    throw e
  }
}

/* tslint:disable cyclomatic-complexity */
function _infer(
  node: TypeAnnotatedNode<es.Node>,
  env: Env,
  constraints: Constraint[],
  isTopLevelAndLastValStmt: boolean = false
): Constraint[] {
  const storedType = node.inferredType as Variable
  switch (node.type) {
    case 'UnaryExpression': {
      const op = node.operator === '-' ? NEGATIVE_OP : node.operator
      const funcType = lookupType(op, env) as FunctionType // in either case its a monomorphic type
      const argNode = node.argument as TypeAnnotatedNode<es.Node>
      const argType = argNode.inferredType as Variable
      const receivedTypes: Type[] = []
      let newConstraints = infer(argNode, env, constraints)
      receivedTypes.push(applyConstraints(argNode.inferredType!, newConstraints))
      try {
        newConstraints = addToConstraintList(newConstraints, [tFunc(argType, storedType), funcType])
      } catch (e) {
        if (e instanceof UnifyError) {
          const expectedTypes = funcType.parameterTypes
          typeErrors.push(
            new InvalidArgumentTypesError(node, [argNode], expectedTypes, receivedTypes)
          )
          return newConstraints
        }
      }
      return newConstraints
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      const envType = lookupType(node.operator, env)!
      const opType = envType.kind === 'forall' ? extractFreeVariablesAndGenFresh(envType) : envType
      const leftNode = node.left as TypeAnnotatedNode<es.Node>
      const leftType = leftNode.inferredType as Variable
      const rightNode = node.right as TypeAnnotatedNode<es.Node>
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
          typeErrors.push(
            new InvalidArgumentTypesError(node, argNodes, expectedTypes, receivedTypes)
          )
        }
      }
      return newConstraints
    }
    case 'ExpressionStatement': {
      return infer(node.expression, env, addToConstraintList(constraints, [storedType, tUndef]))
    }
    case 'ReturnStatement': {
      const argNode = node.argument as TypeAnnotatedNode<es.Node>
      return infer(
        argNode,
        env,
        addToConstraintList(constraints, [storedType, argNode.inferredType as Variable])
      )
    }
    case 'WhileStatement': {
      const testNode = node.test as TypeAnnotatedNode<es.Node>
      const testType = testNode.inferredType as Variable
      const bodyNode = node.body as TypeAnnotatedNode<es.Node>
      const bodyType = bodyNode.inferredType as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, bodyType])
      try {
        newConstraints = infer(testNode, env, newConstraints)
        newConstraints = addToConstraintList(newConstraints, [testType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          typeErrors.push(new InvalidTestConditionError(node, e.RHS))
        }
      }
      return infer(bodyNode, env, newConstraints, isTopLevelAndLastValStmt)
    }
    case 'ForStatement': {
      const initNode = node.init as TypeAnnotatedNode<es.Node>
      const testNode = node.test as TypeAnnotatedNode<es.Node>
      const testType = testNode.inferredType as Variable
      const bodyNode = node.body as TypeAnnotatedNode<es.Node>
      const bodyType = bodyNode.inferredType as Variable
      const updateNode = node.update as TypeAnnotatedNode<es.Node>
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
          (initNode.declarations[0].init as TypeAnnotatedNode<es.Node>).inferredType as Variable,
          env
        )
        setDeclKind(initName, initNode.kind, env)
        newConstraints = infer(initNode, env, newConstraints)
        setType(
          initName,
          tForAll(
            applyConstraints(
              (initNode.declarations[0].init as TypeAnnotatedNode<es.Node>)
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
          typeErrors.push(new InvalidTestConditionError(node, e.RHS))
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
            if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier') {
              setType(specifier.imported.name, tForAll(tVar('T1')), env)
              setDeclKind(specifier.imported.name, 'const', env)
            }
          }
        }
      }
      const lastStatementIndex = node.body.length - 1
      const returnValNodeIndex = returnBlockValueNodeIndexFor(node, isTopLevelAndLastValStmt)
      let lastDeclNodeIndex = -1
      let lastDeclFound = false
      let n = lastStatementIndex
      const declNodes: (TypeAnnotatedFuncDecl | TypeAnnotatedNode<es.VariableDeclaration>)[] = []
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
            (declNode.declarations[0].init as TypeAnnotatedNode<es.Node>).inferredType as Variable,
            env
          )
          setDeclKind(declName, declNode.kind, env)
        }
      })
      const lastNode = node.body[returnValNodeIndex] as TypeAnnotatedNode<es.Node>
      const lastNodeType = (isTopLevelAndLastValStmt && lastNode.type === 'ExpressionStatement'
        ? (lastNode.expression as TypeAnnotatedNode<es.Node>).inferredType
        : lastNode.inferredType) as Variable
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
                (declNode.declarations[0].init as TypeAnnotatedNode<es.Node>)
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
        return addToConstraintList(constraints, [storedType, tList(tVar(typeIdCounter++))])
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
        } else {
          return addToConstraintList(constraints, [storedType, envType])
        }
      }
      typeErrors.push(new UndefinedIdentifierError(node, identifierName))
      return constraints
    }
    case 'ConditionalExpression': // both cases are the same
    case 'IfStatement': {
      const testNode = node.test as TypeAnnotatedNode<es.Node>
      const testType = testNode.inferredType as Variable
      const consNode = node.consequent as TypeAnnotatedNode<es.Node>
      const consType = consNode.inferredType as Variable
      const altNode = node.alternate as TypeAnnotatedNode<es.Node>
      const altType = altNode.inferredType as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, consType])
      try {
        newConstraints = infer(testNode, env, newConstraints)
        newConstraints = addToConstraintList(newConstraints, [testType, tBool])
      } catch (e) {
        if (e instanceof UnifyError) {
          typeErrors.push(new InvalidTestConditionError(node, e.RHS))
        }
      }
      newConstraints = infer(consNode, env, newConstraints, isTopLevelAndLastValStmt)
      try {
        newConstraints = infer(altNode, env, newConstraints, isTopLevelAndLastValStmt)
        newConstraints = addToConstraintList(newConstraints, [consType, altType])
      } catch (e) {
        if (e instanceof UnifyError) {
          typeErrors.push(new ConsequentAlternateMismatchError(node, e.RHS, e.LHS))
        }
      }
      return newConstraints
    }
    case 'ArrowFunctionExpression': {
      pushEnv(env)
      const paramNodes = node.params
      const paramTypes: Variable[] = paramNodes.map(
        paramNode => (paramNode as TypeAnnotatedNode<es.Node>).inferredType as Variable
      )
      const bodyNode = node.body as TypeAnnotatedNode<es.Node>
      paramTypes.push(bodyNode.inferredType as Variable)
      const newConstraints = addToConstraintList(constraints, [storedType, tFunc(...paramTypes)])
      paramNodes.forEach((paramNode: TypeAnnotatedNode<es.Identifier>) => {
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
      const funcDeclNode = node as TypeAnnotatedFuncDecl
      let newConstraints = addToConstraintList(constraints, [storedType, tUndef])
      pushEnv(env)
      const storedFunctionType = funcDeclNode.functionInferredType as Variable
      const paramNodes = node.params as TypeAnnotatedNode<es.Pattern>[]
      const paramTypes = paramNodes.map(paramNode => paramNode.inferredType as Variable)
      const bodyNode = node.body as TypeAnnotatedNode<es.BlockStatement>
      paramTypes.push(bodyNode.inferredType as Variable)
      newConstraints = addToConstraintList(newConstraints, [
        storedFunctionType,
        tFunc(...paramTypes)
      ])
      paramNodes.forEach((paramNode: TypeAnnotatedNode<es.Identifier>) => {
        setType(paramNode.name, paramNode.inferredType as Variable, env)
      })
      const result = infer(bodyNode, env, newConstraints)
      env.pop()
      return result
    }
    case 'CallExpression': {
      const calleeNode = node.callee as TypeAnnotatedNode<es.Node>
      const calleeType = calleeNode.inferredType as Variable
      const argNodes = node.arguments as TypeAnnotatedNode<es.Node>[]
      const argTypes: Variable[] = argNodes.map(argNode => argNode.inferredType as Variable)
      argTypes.push(storedType)
      let newConstraints = constraints
      newConstraints = infer(calleeNode, env, newConstraints)
      const calledFunctionType = applyConstraints(
        (calleeNode as TypeAnnotatedNode<es.Node>).inferredType!,
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
            typeErrors.push(
              new InvalidArgumentTypesError(node, argNodes, expectedTypes, receivedTypes)
            )
          } else {
            typeErrors.push(new CallingNonFunctionType(node, calledFunctionType))
          }
        } else if (e instanceof InternalDifferentNumberArgumentsError) {
          typeErrors.push(new DifferentNumberArgumentsError(node, e.numExpectedArgs, e.numReceived))
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
      const leftNode = node.left as TypeAnnotatedNode<es.Identifier | es.MemberExpression>
      const rightNode = node.right as TypeAnnotatedNode<es.Node>
      const rightType = rightNode.inferredType as Variable
      const leftType = leftNode.inferredType as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, rightType])
      newConstraints = infer(rightNode, env, newConstraints)
      if (leftNode.type === 'Identifier' && lookupDeclKind(leftNode.name, env) === 'const') {
        typeErrors.push(new ReassignConstError(node))
        return newConstraints
      }
      newConstraints = infer(leftNode, env, newConstraints)
      try {
        return addToConstraintList(newConstraints, [rightType, leftType])
      } catch (e) {
        if (e instanceof UnifyError) {
          if (leftNode.type === 'Identifier') {
            typeErrors.push(
              new DifferentAssignmentError(
                node,
                applyConstraints(leftType, newConstraints),
                applyConstraints(rightType, newConstraints)
              )
            )
          } else {
            typeErrors.push(
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
      const elements = node.elements as TypeAnnotatedNode<es.Node>[]
      // infer the types of array elements
      elements.forEach(element => {
        newConstraints = infer(element, env, newConstraints)
      })
      const arrayElementType = tVar(typeIdCounter++)
      newConstraints = addToConstraintList(newConstraints, [storedType, tArray(arrayElementType)])
      elements.forEach(element => {
        try {
          newConstraints = addToConstraintList(newConstraints, [
            arrayElementType,
            element.inferredType!
          ])
        } catch (e) {
          if (e instanceof UnifyError) {
            typeErrors.push(
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
      const obj = node.object as TypeAnnotatedNode<es.Identifier>
      const objName = obj.name
      const property = node.property as TypeAnnotatedNode<es.Node>
      const propertyType = property.inferredType as Variable
      let newConstraints = infer(property, env, constraints)
      // Check that property is of type number
      // type in env can be either var or forall
      const envType = lookupType(objName, env)!
      const arrayType =
        envType.kind === 'forall'
          ? extractFreeVariablesAndGenFresh(envType)
          : applyConstraints(envType, newConstraints)
      if (arrayType.kind !== 'array')
        throw new InternalTypeError(
          `Expected ${objName} to be an array, got ${typeToString(arrayType)}`
        )
      const expectedElementType = arrayType.elementType
      try {
        newConstraints = addToConstraintList(constraints, [propertyType, tNumber])
      } catch (e) {
        if (e instanceof UnifyError) {
          typeErrors.push(
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

// =======================================
// Private Helper Parsing Functions
// =======================================

function tPrimitive(name: Primitive['name']): Primitive {
  return {
    kind: 'primitive',
    name
  }
}

export function tVar(name: string | number): Variable {
  return {
    kind: 'variable',
    name: `T${name}`,
    constraint: 'none'
  }
}

function tAddable(name: string): Variable {
  return {
    kind: 'variable',
    name: `${name}`,
    constraint: 'addable'
  }
}

function tPair(var1: Type, var2: Type): Pair {
  return {
    kind: 'pair',
    headType: var1,
    tailType: var2
  }
}

function tList(var1: Type): List {
  return {
    kind: 'list',
    elementType: var1
  }
}

export function tForAll(type: Type): ForAll {
  return {
    kind: 'forall',
    polyType: type
  }
}

function tArray(var1: Type): SArray {
  return {
    kind: 'array',
    elementType: var1
  }
}

const tBool = tPrimitive('boolean')
const tNumber = tPrimitive('number')
const tString = tPrimitive('string')
const tUndef = tPrimitive('undefined')

function tFunc(...types: Type[]): FunctionType {
  const parameterTypes = types.slice(0, -1)
  const returnType = types.slice(-1)[0]
  return {
    kind: 'function',
    parameterTypes,
    returnType
  }
}

const predeclaredNames: [string, Type | ForAll][] = [
  // constants
  ['Infinity', tNumber],
  ['NaN', tNumber],
  ['undefined', tUndef],
  ['math_E', tNumber],
  ['math_LN2', tNumber],
  ['math_LN10', tNumber],
  ['math_LOG2E', tNumber],
  ['math_LOG10E', tNumber],
  ['math_PI', tNumber],
  ['math_SQRT1_2', tNumber],
  ['math_SQRT2', tNumber],
  // is something functions
  ['is_boolean', tForAll(tFunc(tVar('T'), tBool))],
  ['is_number', tForAll(tFunc(tVar('T'), tBool))],
  ['is_string', tForAll(tFunc(tVar('T'), tBool))],
  ['is_undefined', tForAll(tFunc(tVar('T'), tBool))],
  // math functions
  ['math_abs', tFunc(tNumber, tNumber)],
  ['math_acos', tFunc(tNumber, tNumber)],
  ['math_acosh', tFunc(tNumber, tNumber)],
  ['math_asin', tFunc(tNumber, tNumber)],
  ['math_asinh', tFunc(tNumber, tNumber)],
  ['math_atan', tFunc(tNumber, tNumber)],
  ['math_atan2', tFunc(tNumber, tNumber, tNumber)],
  ['math_atanh', tFunc(tNumber, tNumber)],
  ['math_cbrt', tFunc(tNumber, tNumber)],
  ['math_ceil', tFunc(tNumber, tNumber)],
  ['math_clz32', tFunc(tNumber, tNumber)],
  ['math_cos', tFunc(tNumber, tNumber)],
  ['math_cosh', tFunc(tNumber, tNumber)],
  ['math_exp', tFunc(tNumber, tNumber)],
  ['math_expm1', tFunc(tNumber, tNumber)],
  ['math_floor', tFunc(tNumber, tNumber)],
  ['math_fround', tFunc(tNumber, tNumber)],
  ['math_hypot', tForAll(tVar('T'))],
  ['math_imul', tFunc(tNumber, tNumber, tNumber)],
  ['math_log', tFunc(tNumber, tNumber)],
  ['math_log1p', tFunc(tNumber, tNumber)],
  ['math_log2', tFunc(tNumber, tNumber)],
  ['math_log10', tFunc(tNumber, tNumber)],
  ['math_max', tForAll(tVar('T'))],
  ['math_min', tForAll(tVar('T'))],
  ['math_pow', tFunc(tNumber, tNumber, tNumber)],
  ['math_random', tFunc(tNumber)],
  ['math_round', tFunc(tNumber, tNumber)],
  ['math_sign', tFunc(tNumber, tNumber)],
  ['math_sin', tFunc(tNumber, tNumber)],
  ['math_sinh', tFunc(tNumber, tNumber)],
  ['math_sqrt', tFunc(tNumber, tNumber)],
  ['math_tan', tFunc(tNumber, tNumber)],
  ['math_tanh', tFunc(tNumber, tNumber)],
  ['math_trunc', tFunc(tNumber, tNumber)],
  // misc functions
  ['parse_int', tFunc(tString, tNumber, tNumber)],
  ['prompt', tFunc(tString, tString)],
  ['runtime', tFunc(tNumber)],
  ['stringify', tForAll(tFunc(tVar('T'), tString))],
  ['display', tForAll(tVar('T'))],
  ['error', tForAll(tVar('T'))]
]

const headType = tVar('headType')
const tailType = tVar('tailType')

const pairFuncs: [string, Type | ForAll][] = [
  ['pair', tForAll(tFunc(headType, tailType, tPair(headType, tailType)))],
  ['head', tForAll(tFunc(tPair(headType, tailType), headType))],
  ['tail', tForAll(tFunc(tPair(headType, tailType), tailType))],
  ['is_pair', tForAll(tFunc(tVar('T'), tBool))],
  ['is_null', tForAll(tFunc(tPair(headType, tailType), tBool))]
]

const mutatingPairFuncs: [string, Type | ForAll][] = [
  ['set_head', tForAll(tFunc(tPair(headType, tailType), headType, tUndef))],
  ['set_tail', tForAll(tFunc(tPair(headType, tailType), tailType, tUndef))]
]

const arrayFuncs: [string, Type | ForAll][] = [
  ['is_array', tForAll(tFunc(tVar('T'), tBool))],
  ['array_length', tForAll(tFunc(tArray(tVar('T')), tNumber))]
]

const listFuncs: [string, Type | ForAll][] = [['list', tForAll(tVar('T1'))]]

const primitiveFuncs: [string, Type | ForAll][] = [
  [NEGATIVE_OP, tFunc(tNumber, tNumber)],
  ['!', tFunc(tBool, tBool)],
  ['&&', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  ['||', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  ['<', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['<=', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['>', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['>=', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['+', tForAll(tFunc(tAddable('A'), tAddable('A'), tAddable('A')))],
  ['%', tFunc(tNumber, tNumber, tNumber)],
  ['-', tFunc(tNumber, tNumber, tNumber)],
  ['*', tFunc(tNumber, tNumber, tNumber)],
  ['/', tFunc(tNumber, tNumber, tNumber)]
]

// Source 2 and below restricts === to addables
const preS3equalityFuncs: [string, ForAll][] = [
  ['===', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['!==', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))]
]

// Source 3 and above allows any values as arguments for ===
const postS3equalityFuncs: [string, ForAll][] = [
  ['===', tForAll(tFunc(tVar('T1'), tVar('T2'), tBool))],
  ['!==', tForAll(tFunc(tVar('T1'), tVar('T2'), tBool))]
]

const temporaryStreamFuncs: [string, ForAll][] = [
  ['is_stream', tForAll(tFunc(tVar('T1'), tBool))],
  ['list_to_stream', tForAll(tFunc(tList(tVar('T1')), tVar('T2')))],
  ['stream_to_list', tForAll(tFunc(tVar('T1'), tList(tVar('T2'))))],
  ['stream_length', tForAll(tFunc(tVar('T1'), tNumber))],
  ['stream_map', tForAll(tFunc(tVar('T1'), tVar('T2')))],
  ['build_stream', tForAll(tFunc(tNumber, tFunc(tNumber, tVar('T1')), tVar('T2')))],
  ['stream_for_each', tForAll(tFunc(tFunc(tVar('T1'), tVar('T2')), tBool))],
  ['stream_reverse', tForAll(tFunc(tVar('T1'), tVar('T1')))],
  ['stream_append', tForAll(tFunc(tVar('T1'), tVar('T1'), tVar('T1')))],
  ['stream_member', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_remove', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_remove_all', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_filter', tForAll(tFunc(tFunc(tVar('T1'), tBool), tVar('T2'), tVar('T2')))],
  ['enum_stream', tForAll(tFunc(tNumber, tNumber, tVar('T1')))],
  ['integers_from', tForAll(tFunc(tNumber, tVar('T1')))],
  ['eval_stream', tForAll(tFunc(tVar('T1'), tNumber, tList(tVar('T2'))))],
  ['stream_ref', tForAll(tFunc(tVar('T1'), tNumber, tVar('T2')))]
]

export function createTypeEnvironment(chapter: number): Env {
  const initialTypeMappings = [...predeclaredNames, ...primitiveFuncs]
  if (chapter >= 2) {
    initialTypeMappings.push(...pairFuncs, ...listFuncs)
  }
  if (chapter >= 3) {
    initialTypeMappings.push(...postS3equalityFuncs, ...mutatingPairFuncs, ...arrayFuncs)
  } else {
    initialTypeMappings.push(...preS3equalityFuncs)
  }

  return [
    {
      typeMap: new Map(initialTypeMappings),
      declKindMap: new Map(initialTypeMappings.map(val => [val[0], 'const']))
    }
  ]
}
