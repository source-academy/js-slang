import * as es from 'estree'
import { cloneDeep, isEqual } from 'lodash'

import { InvalidNumberOfArguments, UndefinedVariable } from '../errors/errors'
import { ModuleNotFoundError } from '../errors/moduleErrors'
import {
  FunctionShouldHaveReturnValueError,
  NoExplicitAnyError,
  TypecastError,
  TypeMismatchError,
  TypeNotCallableError,
  TypeNotFoundError
} from '../errors/typeErrors'
import { memoizedGetModuleManifest } from '../modules/moduleLoader'
import { NoImplicitReturnUndefinedError } from '../parser/rules/noImplicitReturnUndefined'
import {
  AnnotationTypeNode,
  BaseTypeNode,
  Context,
  FunctionType,
  FunctionTypeNode,
  NodeWithDeclaredTypeAnnotation,
  Primitive,
  PrimitiveType,
  TSTypeAnnotationType,
  Type,
  TypeEnvironment,
  TypeReferenceNode,
  UnionType,
  UnionTypeNode
} from '../types'
import { TypeError } from './internalTypeErrors'
import {
  formatTypeString,
  lookupType,
  lookupTypeAlias,
  pushEnv,
  RETURN_TYPE_IDENTIFIER,
  setDeclKind,
  setType,
  setTypeAlias,
  source1TypeOverrides,
  tAny,
  tBool,
  tFunc,
  tNumber,
  tPrimitive,
  tString,
  tUndef,
  tUnion,
  tVoid,
  typeAnnotationKeywordToPrimitiveTypeMap
} from './utils'

/**
 * Checks programs for type errors, and returns the program with all TS-related nodes removed.
 */
export function checkForTypeErrors(
  program: NodeWithDeclaredTypeAnnotation<es.Program>,
  context: Context
): es.Program {
  // Deep copy type environment
  const env: TypeEnvironment = cloneDeep(context.typeEnvironment)
  // Override predeclared function types
  for (const [name, type] of source1TypeOverrides) {
    setType(name, type, env)
  }
  try {
    typeCheckAndReturnType(program, context, env)
    return removeTSNodes(program)
  } catch (error) {
    // Catch-all for thrown errors
    // (either errors that cause early termination or errors that should not be reached logically)
    console.error(error)
    context.errors.push(
      error instanceof TypeError
        ? error
        : new TypeError(
            program,
            'Uncaught error during typechecking, report this to the administrators!\n' +
              error.message
          )
    )
    return program
  }
}

/**
 * Recurses through the given node to check for any type errors,
 * then returns the node's inferred/declared type.
 * Any errors found are added to the context.
 */
function typeCheckAndReturnType(
  node: NodeWithDeclaredTypeAnnotation<es.Node>,
  context: Context,
  env: TypeEnvironment
): Type {
  switch (node.type) {
    case 'Literal': {
      // Infers type
      const typeOfLiteral = typeof node.value as PrimitiveType
      if (Object.values(PrimitiveType).includes(typeOfLiteral)) {
        return tPrimitive(typeOfLiteral)
      }
      throw new TypeError(node, 'Unknown literal type.')
    }
    case 'Identifier': {
      const varName = node.name
      const varType = lookupType(varName, env)
      if (varType) {
        return varType as Type
      } else {
        context.errors.push(new UndefinedVariable(varName, node))
        return tAny
      }
    }
    case 'Program':
    case 'BlockStatement': {
      let returnType: Type = tVoid
      pushEnv(env)
      // Handle import statements
      if (node.type === 'Program') {
        handleImportDeclarations(node, context, env)
      }
      // Check all statements in program/block body
      for (const stmt of node.body) {
        if (stmt.type === 'IfStatement' || stmt.type === 'ReturnStatement') {
          returnType = typeCheckAndReturnType(stmt, context, env)
          if (stmt.type === 'ReturnStatement') {
            break
          }
        } else {
          typeCheckAndReturnType(stmt, context, env)
        }
      }
      if (node.type === 'BlockStatement') {
        // Types are saved for programs, but not for blocks
        env.pop()
      }

      return returnType
    }
    case 'ExpressionStatement': {
      // Check expression
      return typeCheckAndReturnType(node.expression, context, env)
    }
    case 'ConditionalExpression':
    case 'IfStatement': {
      const predicateType = typeCheckAndReturnType(node.test, context, env)
      checkForTypeMismatch(node, predicateType, tBool, context)
      const consType = typeCheckAndReturnType(node.consequent, context, env)
      const altType = node.alternate ? typeCheckAndReturnType(node.alternate, context, env) : tVoid
      return mergeTypes(consType, altType)
    }
    case 'UnaryExpression': {
      return typeCheckAndReturnUnaryExpressionType(node, context, env)
    }
    case 'BinaryExpression': {
      return typeCheckAndReturnBinaryExpressionType(node, context, env)
    }
    case 'LogicalExpression': {
      return typeCheckAndReturnLogicalExpressionType(node, context, env)
    }
    case 'ArrowFunctionExpression': {
      return typeCheckAndReturnArrowFunctionType(node, context, env)
    }
    case 'FunctionDeclaration':
      if (node.id === null) {
        // Block should not be reached since node.id is only null when function declaration
        // is part of `export default function`, which is not used in Source
        throw new TypeError(node, 'Function declaration should always have an identifier.')
      }
      const params = node.params as NodeWithDeclaredTypeAnnotation<es.Identifier>[]
      const returnType = getAnnotatedType(node.returnType, context, env)

      const types = getParamTypes(params, context, env)
      // Return type will always be last item in types array
      types.push(returnType)
      const fnType = tFunc(...types)

      // Type check function body, creating new environment to store arg types, return type and function type
      pushEnv(env)
      params.forEach(param => {
        setType(param.name, getAnnotatedType(param.typeAnnotation, context, env), env)
      })
      setType(RETURN_TYPE_IDENTIFIER, returnType, env)
      setType(node.id.name, fnType, env)
      const actualReturnType = typeCheckAndReturnType(node.body, context, env)
      // Type error where function does not return anything when it should
      if (
        (actualReturnType as Primitive).name === PrimitiveType.VOID &&
        returnType.kind === 'primitive' &&
        returnType.name !== PrimitiveType.ANY &&
        returnType.name !== PrimitiveType.VOID
      ) {
        context.errors.push(new FunctionShouldHaveReturnValueError(node))
      }
      env.pop()

      checkForTypeMismatch(node, actualReturnType, returnType, context)

      // Save function type
      setType(node.id.name, fnType, env)
      return tVoid
    case 'VariableDeclaration': {
      if (node.kind === 'var') {
        throw new TypeError(node, 'Variable declaration using "var" is not allowed.')
      }
      if (node.declarations.length !== 1) {
        throw new TypeError(node, 'Variable declaration should have one and only one declaration.')
      }
      if (node.declarations[0].id.type !== 'Identifier') {
        throw new TypeError(node, 'Variable declaration ID should be an identifier.')
      }
      const id = node.declarations[0].id as NodeWithDeclaredTypeAnnotation<es.Identifier>
      const init = node.declarations[0].init!
      const expectedType = getAnnotatedType(id.typeAnnotation, context, env)
      const initType = typeCheckAndReturnType(init, context, env)
      checkForTypeMismatch(node, initType, expectedType, context)
      // Save variable type and decl kind in type env
      setType(id.name, expectedType, env)
      setDeclKind(id.name, node.kind, env)
      return tVoid
    }
    case 'CallExpression': {
      const fnName = (node.callee as es.Identifier).name
      const fnType = lookupType(fnName, env)
      if (fnType) {
        if (fnType.kind === 'forall') {
          // Skip typecheck as function has variable number of arguments
          return tAny
        }
        if (fnType.kind !== 'function') {
          if ((fnType as Primitive).name !== PrimitiveType.ANY) {
            context.errors.push(new TypeNotCallableError(node, fnName))
          }
          return tAny
        }
        const expectedTypes = fnType.parameterTypes as Primitive[]
        const args = node.arguments
        if (args.length !== expectedTypes.length) {
          context.errors.push(new InvalidNumberOfArguments(node, expectedTypes.length, args.length))
          return fnType.returnType
        }
        checkArgTypes(node, expectedTypes, context, env)
        return fnType.returnType
      } else {
        context.errors.push(new UndefinedVariable(fnName, node))
        return tAny
      }
    }
    case 'ReturnStatement': {
      if (!node.argument) {
        context.errors.push(new NoImplicitReturnUndefinedError(node))
        return tUndef
      } else {
        const expectedType = lookupType(RETURN_TYPE_IDENTIFIER, env) as Type
        if (expectedType) {
          const argumentType = typeCheckAndReturnType(node.argument, context, env)
          checkForTypeMismatch(node, argumentType, expectedType, context)
          return expectedType
        } else {
          return typeCheckAndReturnType(node.argument, context, env)
        }
      }
    }
    case 'ImportDeclaration':
      return tVoid
    default:
      const nodeAsAny = node as any
      switch (nodeAsAny.type) {
        case TSTypeAnnotationType.TSTypeAliasDeclaration:
          const id = nodeAsAny.id
          const type = getAnnotatedType(nodeAsAny, context, env)
          setTypeAlias(id.name, type, env)
          return tVoid
        case TSTypeAnnotationType.TSAsExpression:
          const originalType = typeCheckAndReturnType(nodeAsAny.expression, context, env)
          const typeToCastTo = getAnnotatedType(nodeAsAny, context, env)
          if ((typeToCastTo as Primitive).name === PrimitiveType.ANY) {
            context.errors.push(new NoExplicitAnyError(node))
          }
          if (hasTypeMismatchErrors(typeToCastTo, originalType)) {
            context.errors.push(
              new TypecastError(
                node,
                formatTypeString(originalType),
                formatTypeString(typeToCastTo)
              )
            )
          }
          return typeToCastTo
        default:
          return tAny
      }
  }
}

/**
 * Adds types for imported functions to the type environment.
 */
function handleImportDeclarations(
  node: NodeWithDeclaredTypeAnnotation<es.Program>,
  context: Context,
  env: TypeEnvironment
) {
  const importStmts: es.ImportDeclaration[] = node.body.filter(
    stmt => stmt.type === 'ImportDeclaration'
  ) as es.ImportDeclaration[]
  if (importStmts.length > 0) {
    const modules = memoizedGetModuleManifest()
    const moduleList = Object.keys(modules)
    importStmts.forEach(stmt => {
      const moduleName = stmt.source.value as string
      if (!moduleList.includes(moduleName)) {
        context.errors.push(new ModuleNotFoundError(moduleName, stmt))
      }
      stmt.specifiers.map(spec => {
        if (spec.type !== 'ImportSpecifier') {
          throw new Error(
            `I expected only ImportSpecifiers to be allowed, but encountered ${spec.type}.`
          )
        }

        setType(spec.local.name, tAny, env)
      })
    })
  }
}

/**
 * Typechecks the body of a unary expression, adding any type errors to context if necessary.
 * Then, returns the type of the unary expression, inferred based on the operator.
 */
function typeCheckAndReturnUnaryExpressionType(
  node: es.UnaryExpression,
  context: Context,
  env: TypeEnvironment
): Primitive {
  const argType = formatTypeString(typeCheckAndReturnType(node.argument, context, env))
  const operator = node.operator
  switch (operator) {
    case '-':
      if (argType !== PrimitiveType.NUMBER && argType !== PrimitiveType.ANY) {
        context.errors.push(new TypeMismatchError(node, argType, PrimitiveType.NUMBER))
      }
      return tNumber
    case '!':
      if (argType !== PrimitiveType.BOOLEAN && argType !== PrimitiveType.ANY) {
        context.errors.push(new TypeMismatchError(node, argType, PrimitiveType.BOOLEAN))
      }
      return tBool
    case 'typeof':
      return tString
    default:
      return tAny
  }
}

/**
 * Typechecks the body of a binary expression, adding any type errors to context if necessary.
 * Then, returns the type of the binary expression, inferred based on the operator.
 */
function typeCheckAndReturnBinaryExpressionType(
  node: es.BinaryExpression,
  context: Context,
  env: TypeEnvironment
): Primitive | UnionType {
  const leftType = formatTypeString(typeCheckAndReturnType(node.left, context, env))
  const rightType = formatTypeString(typeCheckAndReturnType(node.right, context, env))
  const operator = node.operator
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      // Both sides can only be either number or any
      if (leftType !== PrimitiveType.NUMBER && leftType !== PrimitiveType.ANY) {
        context.errors.push(new TypeMismatchError(node, leftType, PrimitiveType.NUMBER))
      }
      if (rightType !== PrimitiveType.NUMBER && rightType !== PrimitiveType.ANY) {
        context.errors.push(new TypeMismatchError(node, rightType, PrimitiveType.NUMBER))
      }
      return tNumber
    case '+':
      // Both sides can only be number, string, or any
      // However, case where one side is string and other side is number is not allowed
      if (leftType === PrimitiveType.NUMBER || leftType === PrimitiveType.STRING) {
        if (rightType !== leftType && rightType !== PrimitiveType.ANY) {
          context.errors.push(new TypeMismatchError(node, rightType, leftType))
        }
        return tPrimitive(leftType)
      }
      if (rightType === PrimitiveType.NUMBER || rightType === PrimitiveType.STRING) {
        if (leftType !== rightType && leftType !== PrimitiveType.ANY) {
          context.errors.push(new TypeMismatchError(node, leftType, rightType))
        }
        return tPrimitive(rightType)
      }
      if (leftType !== PrimitiveType.ANY) {
        context.errors.push(
          new TypeMismatchError(node, leftType, formatTypeString(tUnion(tNumber, tString)))
        )
      }
      if (rightType !== PrimitiveType.ANY) {
        context.errors.push(
          new TypeMismatchError(node, rightType, formatTypeString(tUnion(tNumber, tString)))
        )
      }
      return tAny
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '!==':
    case '===':
      // In Source 3 and above, equality can be applied between two items of any type
      if (context.chapter > 2 && (operator === '===' || operator === '!==')) {
        return tBool
      }
      // Both sides can only be number, string, or any
      // However, case where one side is string and other side is number is not allowed
      if (leftType === PrimitiveType.NUMBER || leftType === PrimitiveType.STRING) {
        if (rightType !== leftType && rightType !== PrimitiveType.ANY) {
          context.errors.push(new TypeMismatchError(node, rightType, leftType))
        }
        return tBool
      }
      if (rightType === PrimitiveType.NUMBER || rightType === PrimitiveType.STRING) {
        if (leftType !== rightType && leftType !== PrimitiveType.ANY) {
          context.errors.push(new TypeMismatchError(node, leftType, rightType))
        }
        return tBool
      }
      if (leftType !== PrimitiveType.ANY) {
        context.errors.push(
          new TypeMismatchError(node, leftType, formatTypeString(tUnion(tNumber, tString)))
        )
      }
      if (rightType !== PrimitiveType.ANY) {
        context.errors.push(
          new TypeMismatchError(node, rightType, formatTypeString(tUnion(tNumber, tString)))
        )
      }
      return tBool
    default:
      return tAny
  }
}

/**
 * Typechecks the body of a logical expression, adding any type errors to context if necessary.
 * Then, returns the type of the logical expression.
 * The return type is a union of the left expression type (boolean) and right expression type.
 */
function typeCheckAndReturnLogicalExpressionType(
  node: es.LogicalExpression,
  context: Context,
  env: TypeEnvironment
): Type {
  const leftType = typeCheckAndReturnType(node.left, context, env)
  if ((leftType as Primitive).name !== PrimitiveType.BOOLEAN) {
    context.errors.push(
      new TypeMismatchError(node, formatTypeString(leftType), PrimitiveType.BOOLEAN)
    )
  }
  const rightType = typeCheckAndReturnType(node.right, context, env)
  return mergeTypes(tBool, rightType)
}

/**
 * Typechecks the body of an arrow function, adding any type errors to context if necessary.
 * Then, returns the inferred/declared type of the function.
 */
function typeCheckAndReturnArrowFunctionType(
  node: NodeWithDeclaredTypeAnnotation<es.ArrowFunctionExpression>,
  context: Context,
  env: TypeEnvironment
): FunctionType {
  const params = node.params as NodeWithDeclaredTypeAnnotation<es.Identifier>[]
  const body = node.body
  const expectedReturnType = getAnnotatedType(node.returnType, context, env)

  // Type check function body, creating new environment to store arg types
  pushEnv(env)
  params.forEach(param => {
    setType(param.name, getAnnotatedType(param.typeAnnotation, context, env), env)
  })
  const actualReturnType = typeCheckAndReturnType(body, context, env)
  checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
  env.pop()

  const types = getParamTypes(params, context, env)
  // Return type will always be last item in types array
  types.push(expectedReturnType)
  const fnType = tFunc(...types)
  return fnType
}

/**
 * Checks if the two given types are equal.
 * If not equal, adds type mismatch error to context.
 */
function checkForTypeMismatch(
  node: es.Node,
  actualType: Type,
  expectedType: Type,
  context: Context
): void {
  if (hasTypeMismatchErrors(actualType, expectedType)) {
    context.errors.push(
      new TypeMismatchError(node, formatTypeString(actualType), formatTypeString(expectedType))
    )
  }
}

/**
 * Checks if the two given types are equal.
 */
function hasTypeMismatchErrors(actualType: Type, expectedType: Type): boolean {
  if (
    (actualType as Primitive).name === PrimitiveType.ANY ||
    (expectedType as Primitive).name === PrimitiveType.ANY
  ) {
    // Exit early as "any" is guaranteed not to cause type mismatch errors
    return false
  }
  switch (expectedType.kind) {
    case 'primitive':
    case 'variable':
      return (actualType as Primitive).name !== (expectedType as Primitive).name
    case 'function':
      if (actualType.kind !== 'function') {
        return true
      }
      // Check parameter types
      const actualParamTypes = actualType.parameterTypes
      const expectedParamTypes = expectedType.parameterTypes
      if (actualParamTypes.length !== expectedParamTypes.length) {
        return true
      }
      for (let i = 0; i < actualType.parameterTypes.length; i++) {
        if (hasTypeMismatchErrors(actualParamTypes[i], expectedParamTypes[i])) {
          return true
        }
      }
      // Check return type
      return hasTypeMismatchErrors(actualType.returnType, expectedType.returnType)
    case 'union':
      const expectedSet = new Set(expectedType.types.map(formatTypeString))
      // If not union type, expected set should contain actual type
      if (actualType.kind !== 'union') {
        return !expectedSet.has(formatTypeString(actualType))
      }
      // If both are union types, actual set should be a subset of expected set
      const actualSet = new Set(actualType.types.map(formatTypeString))
      for (const elem of actualSet) {
        if (!expectedSet.has(elem)) {
          return true
        }
      }
      return false
    default:
      return true
  }
}

/**
 * Checks the types of the arguments of the given call expression.
 * If number of arguments is different, add InvalidNumberOfArguments error to context and terminates early.
 * Else, checks each argument against its expected type.
 */
function checkArgTypes(
  node: es.CallExpression,
  expectedTypes: Primitive[],
  context: Context,
  env: TypeEnvironment
) {
  const args = node.arguments
  if (args.length !== expectedTypes.length) {
    context.errors.push(new InvalidNumberOfArguments(node, expectedTypes.length, args.length))
    return
  }
  for (let i = 0; i < expectedTypes.length; i++) {
    const expectedType = expectedTypes[i]
    const node = args[i]
    const actualType = typeCheckAndReturnType(node, context, env)
    checkForTypeMismatch(node, actualType, expectedType, context)
  }
}

/**
 * Converts type annotation node to its corresponding type representation in Source.
 * If no type annotation exists, returns the "any" primitive type.
 */
function getAnnotatedType(
  annotationNode: AnnotationTypeNode | undefined,
  context: Context,
  env: TypeEnvironment
): Type {
  if (!annotationNode) {
    return tAny
  }
  const annotatedTypeNode = annotationNode.typeAnnotation
  switch (annotatedTypeNode.type) {
    case TSTypeAnnotationType.TSFunctionType:
      const fnTypeNode = annotatedTypeNode as FunctionTypeNode
      const fnTypes = getParamTypes(fnTypeNode.parameters, context, env)
      // Return type will always be last item in types array
      fnTypes.push(getAnnotatedType(fnTypeNode.typeAnnotation, context, env))
      return tFunc(...fnTypes)
    case TSTypeAnnotationType.TSUnionType:
      const unionTypeNode = annotatedTypeNode as UnionTypeNode
      const unionTypes = unionTypeNode.types.map(getPrimitiveType)
      return mergeTypes(...unionTypes)
    case TSTypeAnnotationType.TSIntersectionType:
      throw new TypeError(
        annotationNode as unknown as es.Node,
        'Intersection types are not allowed.'
      )
    case TSTypeAnnotationType.TSTypeReference:
      const typeReferenceNode = annotatedTypeNode as TypeReferenceNode
      const declaredType = lookupTypeAlias(typeReferenceNode.typeName.name, env)
      if (!declaredType) {
        context.errors.push(
          new TypeNotFoundError(
            annotationNode as unknown as es.Node,
            typeReferenceNode.typeName.name
          )
        )
        return tAny
      }
      return declaredType
    default:
      return getPrimitiveType(annotatedTypeNode)
  }
}

/**
 * Converts array of function parameters into array of types.
 */
function getParamTypes(
  params: NodeWithDeclaredTypeAnnotation<es.Identifier>[],
  context: Context,
  env: TypeEnvironment
): Type[] {
  return params.map(param => getAnnotatedType(param.typeAnnotation, context, env))
}

/**
 * Converts node type to primitive type.
 * If type is not found, returns the "unknown" primitive type.
 */
function getPrimitiveType(node: BaseTypeNode) {
  return tPrimitive(typeAnnotationKeywordToPrimitiveTypeMap[node.type] ?? PrimitiveType.UNKNOWN)
}

/**
 * Combines all types provided in the parameters into one, removing duplicate types in the process.
 */
function mergeTypes(...types: Type[]): Type {
  const mergedTypes: Type[] = []
  for (const currType of types) {
    if (currType == tAny) {
      return tAny
    }
    if (currType.kind === 'union') {
      for (const type of currType.types) {
        if (!containsType(mergedTypes, type)) {
          mergedTypes.push(type)
        }
      }
    } else if (!containsType(mergedTypes, currType)) {
      mergedTypes.push(currType)
    } else {
      // Duplicate type, do nothing
    }
  }
  if (mergedTypes.length === 1) {
    return mergedTypes[0]
  }
  return tUnion(...mergedTypes)
}

/**
 * Checks if a type exists in an array of types.
 */
function containsType(arr: Type[], typeToCheck: Type) {
  for (const type of arr) {
    if (isEqual(type, typeToCheck)) {
      return true
    }
  }
  return false
}

/**
 * Traverses through the program and removes all TS-related nodes, returning the result.
 */
function removeTSNodes(node: NodeWithDeclaredTypeAnnotation<es.Node>): any {
  switch (node.type) {
    case 'Literal':
    case 'Identifier': {
      return node
    }
    case 'Program':
    case 'BlockStatement': {
      const newBody: es.Statement[] = []
      node.body.forEach(stmt => {
        const type = stmt.type as string
        if (type.startsWith('TS')) {
          switch (type) {
            case TSTypeAnnotationType.TSAsExpression:
              newBody.push(removeTSNodes(stmt))
              break
            default:
              // Remove node from body
              break
          }
        } else {
          newBody.push(removeTSNodes(stmt))
        }
      })
      node.body = newBody
      return node
    }
    case 'ExpressionStatement': {
      node.expression = removeTSNodes(node.expression)
      return node
    }
    case 'ConditionalExpression':
    case 'IfStatement': {
      node.test = removeTSNodes(node.test)
      node.consequent = removeTSNodes(node.consequent)
      if (node.alternate) {
        node.alternate = removeTSNodes(node.alternate)
      }
      return node
    }
    case 'UnaryExpression': {
      node.argument = removeTSNodes(node.argument)
      return node
    }
    case 'BinaryExpression':
    case 'LogicalExpression': {
      node.left = removeTSNodes(node.left)
      node.right = removeTSNodes(node.right)
      return node
    }
    case 'ArrowFunctionExpression':
    case 'FunctionDeclaration':
      node.body = removeTSNodes(node.body)
      return node
    case 'VariableDeclaration': {
      const init = node.declarations[0].init!
      node.declarations[0].init = removeTSNodes(init)
      return node
    }
    case 'CallExpression': {
      node.arguments = node.arguments.map(removeTSNodes)
      return node
    }
    case 'ReturnStatement': {
      if (node.argument) {
        node.argument = removeTSNodes(node.argument)
      }
      return node
    }
    default:
      const nodeAsAny = node as any
      const type = nodeAsAny.type
      switch (type) {
        case TSTypeAnnotationType.TSAsExpression:
          return removeTSNodes(nodeAsAny.expression)
        default:
          return type.startsWith('TS') ? undefined : node
      }
  }
}
