import * as es from 'estree'
import {
  TypeAnnotatedNode,
  Primitive,
  Variable,
  Pair,
  List,
  ForAll,
  Type,
  FunctionType,
  TypeAnnotatedFuncDecl,
  SourceError
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
  UndefinedIdentifierError
} from '../errors/typeErrors'
/* tslint:disable:object-literal-key-quotes no-console no-string-literal*/

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
    }
    case 'Literal':
    case 'Identifier':
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
type Env = Map<string, Type | ForAll>

function cloneEnv(env: Env) {
  return new Map(env.entries())
}

type Constraint = [Variable, Type]
let typeErrors: SourceError[] = []
/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 */
export function typeCheck(
  program: TypeAnnotatedNode<es.Program>
): [TypeAnnotatedNode<es.Program>, SourceError[]] {
  typeIdCounter = 0
  typeErrors = []
  const env: Env = new Map(initialEnv)
  const constraints: Constraint[] = []
  traverse(program)
  infer(program, env, constraints, true)
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
 * Apply the following normalizations
 * List<T1> ==> Pair<T1, List<T1>>
 * Pair<T1, Pair<T2, List<T3>> -> Pair<T4, List<T4>>
 */
function applyConstraints(type: Type, constraints: Constraint[]): Type {
  const result = __applyConstraints(type, constraints)
  if (isList(result)) {
    const list = result
    return {
      kind: 'pair',
      headType: getListType(list) as Type,
      tailType: list
    }
  } else if (isPair(result)) {
    const pair = result
    const _tail = pair.tailType
    if (isPair(_tail)) {
      const tail = _tail
      if (getListType(tail.tailType) !== null) {
        addToConstraintList(constraints, [tail.headType, getListType(tail.tailType) as Type])
        addToConstraintList(constraints, [tail.headType, pair.headType])
        return __applyConstraints(tail, constraints)
      }
    }
  }
  return result
}

/**
 * Going down the DAG that is the constraint list
 */
function __applyConstraints(type: Type, constraints: Constraint[]): Type {
  switch (type.kind) {
    case 'primitive': {
      return type
    }
    case 'pair': {
      return {
        kind: 'pair',
        headType: __applyConstraints(type.headType, constraints),
        tailType: __applyConstraints(type.tailType, constraints)
      }
    }
    case 'list': {
      const listType = __applyConstraints(type.elementType, constraints)
      return {
        kind: 'list',
        elementType: listType
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
    return constraints
  } else if (LHS.kind === 'list' && RHS.kind === 'list') {
    return addToConstraintList(constraints, [LHS.elementType, RHS.elementType])
  } else if (LHS.kind === 'pair' && RHS.kind === 'pair') {
    let newConstraints = constraints
    newConstraints = addToConstraintList(constraints, [LHS.headType, RHS.headType])
    newConstraints = addToConstraintList(constraints, [LHS.tailType, RHS.tailType])
    return newConstraints
  } else if (LHS.kind === 'variable') {
    // case when we have a new constraint like T_1 = T_1
    if (RHS.kind === 'variable' && RHS.name === LHS.name) {
      return constraints
    } else if (contains(RHS, LHS.name)) {
      if (isPair(RHS) && (LHS === RHS.tailType || LHS === getListType(RHS.tailType))) {
        // T1 = Pair<T2, T1> ===> T1 = List<T2>
        return addToConstraintList(constraints, [LHS, tList(RHS.headType)])
      } else if (LHS.kind === 'variable' && LHS === getListType(RHS)) {
        constraints.push([LHS, RHS])
        return constraints
      }
      throw new InternalCyclicReferenceError(LHS.name)
    }
    if (cannotBeResolvedIfAddable(LHS, RHS)) {
      throw new UnifyError(LHS, RHS)
    }
    // call to apply constraints ensures that there is no term in RHS that occurs earlier in constraint list on LHS
    return occursOnLeftInConstraintList(LHS, constraints, applyConstraints(RHS, constraints))
  } else if (RHS.kind === 'variable') {
    // swap around so the type var is on the left hand side
    return addToConstraintList(constraints, [RHS, LHS])
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
  } else {
    throw new UnifyError(LHS, RHS)
  }
}

function ifStatementHasReturn(node: es.IfStatement): boolean {
  const consNode = node.consequent as es.BlockStatement // guaranteed that they are block statements
  const altNode = node.alternate as es.BlockStatement // guaranteed to be a block and exist
  return blockStatementHasReturn(consNode) || blockStatementHasReturn(altNode)
}

function blockStatementHasReturn(node: es.BlockStatement): boolean {
  const body = node.body
  for (const stmt of body) {
    if (stmt.type === 'ReturnStatement') {
      return true
    } else if (stmt.type === 'IfStatement') {
      if (ifStatementHasReturn(stmt)) {
        return true
      }
    } else if (stmt.type === 'BlockStatement') {
      if (blockStatementHasReturn(stmt)) {
        return true
      }
    }
  }
  return false
}

/* tslint:disable cyclomatic-complexity */
function infer(
  node: TypeAnnotatedNode<es.Node>,
  env: Env,
  constraints: Constraint[],
  isLastStatementInBlock = false
): Constraint[] {
  try {
    return _infer(node, env, constraints, isLastStatementInBlock)
  } catch (e) {
    if (e instanceof InternalCyclicReferenceError) {
      // cyclic reference errors only happen in function declarations
      // which would have been caught when inferring it
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
  isLastStatementInBlock = false
): Constraint[] {
  const storedType = node.inferredType as Variable
  switch (node.type) {
    case 'UnaryExpression': {
      const op = node.operator === '-' ? NEGATIVE_OP : node.operator
      const funcType = env.get(op) as FunctionType // in either case its a monomorphic type
      const argNode = node.argument as TypeAnnotatedNode<es.Node>
      const argType = argNode.inferredType as Variable
      let newConstraints = constraints
      const receivedTypes: Type[] = []
      newConstraints = infer(argNode, env, newConstraints)
      receivedTypes.push(applyConstraints(argNode.inferredType!, newConstraints))
      try {
        newConstraints = addToConstraintList(newConstraints, [tFunc(argType, storedType), funcType])
      } catch (e) {
        if (e instanceof UnifyError) {
          const expectedTypes = funcType.parameterTypes
          typeErrors.push(
            new InvalidArgumentTypesError(node, [argNode], expectedTypes, receivedTypes)
          )
        }
      }
      return newConstraints
    }
    case 'LogicalExpression': // both cases are the same
    case 'BinaryExpression': {
      const envType = env.get(node.operator)!
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
    case 'Program':
    case 'BlockStatement': {
      const newEnv = cloneEnv(env) // create new scope
      const lastStatementIndex = node.body.length - 1
      const lastCheckedNodeIndex = isLastStatementInBlock
        ? lastStatementIndex
        : node.body.findIndex((currentNode, index) => {
            return (
              index === lastStatementIndex ||
              currentNode.type === 'ReturnStatement' ||
              (currentNode.type === 'IfStatement' && ifStatementHasReturn(currentNode))
            )
          })
      let lastDeclNodeIndex = -1
      let lastDeclFound = false
      let n = lastStatementIndex
      const declNodes: (TypeAnnotatedFuncDecl | TypeAnnotatedNode<es.VariableDeclaration>)[] = []
      while (n >= 0) {
        const currNode = node.body[n]
        if (currNode.type === 'FunctionDeclaration' || currNode.type === 'VariableDeclaration') {
          // in the event we havent yet found our last decl
          // and we are not after our first return statement
          if (!lastDeclFound && n <= lastCheckedNodeIndex) {
            lastDeclFound = true
            lastDeclNodeIndex = n
          }
          declNodes.push(currNode)
        }
        n--
      }
      declNodes.forEach(declNode => {
        if (declNode.type === 'FunctionDeclaration' && declNode.id !== null) {
          newEnv.set(declNode.id.name, declNode.functionInferredType as Variable)
        } else if (
          declNode.type === 'VariableDeclaration' &&
          declNode.declarations[0].id.type === 'Identifier'
        ) {
          newEnv.set(
            declNode.declarations[0].id.name,
            (declNode.declarations[0].init as TypeAnnotatedNode<es.Node>).inferredType as Variable
          )
        }
      })
      const lastNode = node.body[lastCheckedNodeIndex] as TypeAnnotatedNode<es.Node>
      const lastNodeType = (isLastStatementInBlock && lastNode.type === 'ExpressionStatement'
        ? (lastNode.expression as TypeAnnotatedNode<es.Node>).inferredType
        : lastNode.inferredType) as Variable
      let newConstraints = addToConstraintList(constraints, [storedType, lastNodeType])
      for (let i = 0; i <= lastDeclNodeIndex; i++) {
        newConstraints = infer(node.body[i], newEnv, newConstraints)
      }
      declNodes.forEach(declNode => {
        if (declNode.type === 'FunctionDeclaration' && declNode.id !== null) {
          newEnv.set(
            declNode.id.name,
            tForAll(applyConstraints(declNode.functionInferredType as Variable, newConstraints))
          )
        } else if (
          declNode.type === 'VariableDeclaration' &&
          declNode.declarations[0].id.type === 'Identifier'
        ) {
          newEnv.set(
            declNode.declarations[0].id.name,
            tForAll(
              applyConstraints(
                (declNode.declarations[0].init as TypeAnnotatedNode<es.Node>)
                  .inferredType as Variable,
                newConstraints
              )
            )
          )
        }
      })
      for (let i = lastDeclNodeIndex + 1; i <= lastCheckedNodeIndex; i++) {
        // for the last statement, if it is an if statement, pass down isLastStatementinBlock variable
        const checkedNode = node.body[i]
        if (i === lastCheckedNodeIndex && checkedNode.type === 'IfStatement') {
          newConstraints = infer(checkedNode, newEnv, newConstraints, isLastStatementInBlock)
        } else {
          newConstraints = infer(checkedNode, newEnv, newConstraints)
        }
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
      if (env.has(identifierName)) {
        const envType = env.get(identifierName)!
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
      let newConstraints = addToConstraintList(constraints, [testType, tBool])
      newConstraints = addToConstraintList(newConstraints, [storedType, consType])
      const altNode = node.alternate as TypeAnnotatedNode<es.Node>
      if (altNode) {
        const altType = altNode.inferredType as Variable
        newConstraints = addToConstraintList(newConstraints, [consType, altType])
      }
      try {
        newConstraints = infer(testNode, env, newConstraints)
      } catch (e) {
        if (e instanceof UnifyError) {
          typeErrors.push(new InvalidTestConditionError(node, e.LHS))
        }
      }
      newConstraints = infer(consNode, env, newConstraints, isLastStatementInBlock)
      if (altNode) {
        try {
          newConstraints = infer(altNode, env, newConstraints, isLastStatementInBlock)
        } catch (e) {
          if (e instanceof UnifyError) {
            typeErrors.push(new ConsequentAlternateMismatchError(node, e.RHS, e.LHS))
          }
        }
      }
      return newConstraints
    }
    case 'ArrowFunctionExpression': {
      const newEnv = cloneEnv(env) // create new scope
      const paramNodes = node.params
      const paramTypes: Variable[] = paramNodes.map(
        paramNode => (paramNode as TypeAnnotatedNode<es.Node>).inferredType as Variable
      )
      const bodyNode = node.body as TypeAnnotatedNode<es.Node>
      paramTypes.push(bodyNode.inferredType as Variable)
      const newConstraints = addToConstraintList(constraints, [storedType, tFunc(...paramTypes)])
      paramNodes.forEach((paramNode: TypeAnnotatedNode<es.Identifier>) => {
        newEnv.set(paramNode.name, paramNode.inferredType as Variable)
      })
      return infer(bodyNode, newEnv, newConstraints)
    }
    case 'VariableDeclaration': {
      const initNode = node.declarations[0].init!
      return infer(initNode, env, addToConstraintList(constraints, [storedType, tUndef]))
    }
    case 'FunctionDeclaration': {
      const funcDeclNode = node as TypeAnnotatedFuncDecl
      let newConstraints = addToConstraintList(constraints, [storedType, tUndef])
      const newEnv = cloneEnv(env) // create new scope
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
        newEnv.set(paramNode.name, paramNode.inferredType as Variable)
      })
      return infer(bodyNode, newEnv, newConstraints)
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
          const expectedTypes = (calledFunctionType as FunctionType).parameterTypes
          typeErrors.push(
            new InvalidArgumentTypesError(node, argNodes, expectedTypes, receivedTypes)
          )
        } else if (e instanceof InternalDifferentNumberArgumentsError) {
          typeErrors.push(new DifferentNumberArgumentsError(node, e.numExpectedArgs, e.numReceived))
        }
      }
      return newConstraints
    }
    default:
      return constraints
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

function tVar(name: string | number): Variable {
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

function tForAll(type: Type): ForAll {
  return {
    kind: 'forall',
    polyType: type
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

const listFuncs: [string, Type | ForAll][] = [['list', tForAll(tVar('T1'))]]

const primitiveFuncs: [string, Type | ForAll][] = [
  [NEGATIVE_OP, tFunc(tNumber, tNumber)],
  ['!', tFunc(tBool, tBool)],
  ['&&', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  ['||', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  // NOTE for now just handle for Number === Number
  ['===', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['!==', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
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

const initialEnv = [...predeclaredNames, ...pairFuncs, ...listFuncs, ...primitiveFuncs]
