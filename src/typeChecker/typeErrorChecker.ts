import * as es from 'estree'

import { InvalidNumberOfArguments, UndefinedVariable } from '../errors/errors'
import { FunctionShouldHaveReturnValueError, TypeMismatchError } from '../errors/typeErrors'
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
  UnionType,
  UnionTypeNode
} from '../types'
import { TypeError } from './internalTypeErrors'
import {
  formatTypeString,
  lookupType,
  pushEnv,
  RETURN_TYPE_IDENTIFIER,
  setDeclKind,
  setType,
  tAny,
  tBool,
  tFunc,
  tNumber,
  tPrimitive,
  tString,
  tUnion,
  tUnknown,
  tVoid,
  typeAnnotationKeywordToPrimitiveTypeMap
} from './utils'

/**
 * Entry function for type checker.
 */
export function checkForTypeErrors(
  program: NodeWithDeclaredTypeAnnotation<es.Program>,
  context: Context
): void {
  const env: TypeEnvironment = context.typeEnvironment
  try {
    typeCheckAndReturnType(program, context, env)
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
      // Check all statements in program/block body
      for (const nodeBody of node.body) {
        if (nodeBody.type === 'IfStatement' || nodeBody.type === 'ReturnStatement') {
          returnType = typeCheckAndReturnType(nodeBody, context, env)
          if (nodeBody.type === 'ReturnStatement') {
            break
          }
        } else {
          typeCheckAndReturnType(nodeBody, context, env)
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
      return tUnion(consType, altType)
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
      const returnType = getAnnotatedType(node.returnType)

      // Type check function body, creating new environment to store arg types/return type
      pushEnv(env)
      params.forEach(param => {
        setType(param.name, getAnnotatedType(param.typeAnnotation), env)
      })
      setType(RETURN_TYPE_IDENTIFIER, returnType, env)
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

      const types = getParamTypes(params)
      // Return type will always be last item in types array
      types.push(returnType)
      const fnType = tFunc(...types)
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
      const expectedType = getAnnotatedType(id.typeAnnotation)
      const initType = typeCheckAndReturnType(init, context, env)
      checkForTypeMismatch(node, initType, expectedType, context)
      // Save variable type and decl kind in type env
      setType(id.name, expectedType, env)
      setDeclKind(id.name, node.kind, env)
      return tVoid
    }
    case 'CallExpression': {
      const fnName = (node.callee as es.Identifier).name
      const fnType = lookupType(fnName, env) as FunctionType | undefined
      if (fnType) {
        const expectedTypes = fnType.parameterTypes as Primitive[]
        const args = node.arguments
        if (args.length !== expectedTypes.length) {
          context.errors.push(new InvalidNumberOfArguments(node, expectedTypes.length, args.length))
          return tVoid
        }
        checkArgTypes(node, expectedTypes, context, env)
        return fnType?.returnType
      } else {
        context.errors.push(new UndefinedVariable(fnName, node))
        return tVoid
      }
    }
    case 'ReturnStatement': {
      if (!node.argument) {
        context.errors.push(new NoImplicitReturnUndefinedError(node))
        return tVoid
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
    default:
      return tUnknown
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
      return tUnknown
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
      return tUnknown
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
): UnionType {
  const leftType = typeCheckAndReturnType(node.left, context, env)
  if ((leftType as Primitive).name !== PrimitiveType.BOOLEAN) {
    context.errors.push(
      new TypeMismatchError(node, formatTypeString(leftType), PrimitiveType.BOOLEAN)
    )
  }
  const rightType = typeCheckAndReturnType(node.right, context, env)
  return tUnion(tBool, rightType)
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
  const expectedReturnType = getAnnotatedType(node.returnType)

  // Type check function body, creating new environment to store arg types
  pushEnv(env)
  params.forEach(param => {
    setType(param.name, getAnnotatedType(param.typeAnnotation), env)
  })
  const actualReturnType = typeCheckAndReturnType(body, context, env)
  checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
  env.pop()

  const types = getParamTypes(params)
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
  annotationNode: AnnotationTypeNode | undefined
): Primitive | FunctionType | UnionType {
  if (!annotationNode) {
    return tAny
  }
  const annotatedTypeNode = annotationNode.typeAnnotation
  switch (annotatedTypeNode.type) {
    case TSTypeAnnotationType.TSFunctionType:
      const fnTypeNode = annotatedTypeNode as FunctionTypeNode
      const fnTypes = getParamTypes(fnTypeNode.parameters)
      // Return type will always be last item in types array
      fnTypes.push(getAnnotatedType(fnTypeNode.typeAnnotation))
      return tFunc(...fnTypes)
    case TSTypeAnnotationType.TSUnionType:
      const unionTypeNode = annotatedTypeNode as UnionTypeNode
      const unionTypes = unionTypeNode.types.map(getPrimitiveType)
      return tUnion(...unionTypes)
    case TSTypeAnnotationType.TSIntersectionType:
      throw new TypeError(
        annotationNode as unknown as es.Node,
        'Intersection types are not allowed.'
      )
    default:
      return getPrimitiveType(annotatedTypeNode)
  }
}

/**
 * Converts array of function parameters into array of types.
 */
function getParamTypes(params: NodeWithDeclaredTypeAnnotation<es.Identifier>[]): Type[] {
  return params.map(param => getAnnotatedType(param.typeAnnotation))
}

/**
 * Converts node type to primitive type.
 * If type is not found, returns the "unknown" primitive type.
 */
function getPrimitiveType(node: BaseTypeNode) {
  return tPrimitive(typeAnnotationKeywordToPrimitiveTypeMap[node.type] ?? PrimitiveType.UNKNOWN)
}
