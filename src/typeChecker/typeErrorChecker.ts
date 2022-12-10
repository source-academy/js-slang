import * as es from 'estree'
import { cloneDeep, isEqual } from 'lodash'

import { InvalidNumberOfArguments, UndefinedVariable } from '../errors/errors'
import { ModuleNotFoundError } from '../errors/moduleErrors'
import {
  FunctionShouldHaveReturnValueError,
  NoExplicitAnyError,
  TypecastError,
  TypeMismatchError,
  TypeNotAllowedError,
  TypeNotCallableError,
  TypeNotFoundError
} from '../errors/typeErrors'
import { memoizedGetModuleManifest } from '../modules/moduleLoader'
import { NoImplicitReturnUndefinedError } from '../parser/rules/noImplicitReturnUndefined'
import {
  Context,
  disallowedTypes,
  FunctionType,
  Primitive,
  PrimitiveType,
  TSAllowedTypes,
  TSDisallowedTypes,
  Type,
  TypeEnvironment
} from '../types'
import { TypeError } from './internalTypeErrors'
import * as tsEs from './tsESTree'
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
  tLiteral,
  tNumber,
  tPrimitive,
  tString,
  tUndef,
  tUnion,
  tVoid,
  typeAnnotationKeywordToBasicTypeMap
} from './utils'

/**
 * Entry function for type error checker.
 * Checks programs for type errors, and returns the program with all TS-related nodes removed.
 */
export function checkForTypeErrors(program: tsEs.Program, context: Context): es.Program {
  // Deep copy type environment to avoid modifying type environment in the context,
  // which might affect the type inference checker
  const env: TypeEnvironment = cloneDeep(context.typeEnvironment)
  // Override predeclared function types
  for (const [name, type] of source1TypeOverrides) {
    setType(name, type, env)
  }
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
  return removeTSNodes(program)
}

/**
 * Recurses through the given node to check for any type errors,
 * then returns the node's inferred/declared type.
 * Any errors found are added to the context.
 */
function typeCheckAndReturnType(node: tsEs.Node, context: Context, env: TypeEnvironment): Type {
  switch (node.type) {
    case 'Literal': {
      // Infers type
      if (node.value === undefined) {
        return tUndef
      }
      if (node.value === null) {
        // TODO: Handle null literal types for Source 2 and above
        return tAny
      }
      if (
        typeof node.value !== 'string' &&
        typeof node.value !== 'number' &&
        typeof node.value !== 'boolean'
      ) {
        // Skip typecheck as unspecified literals will be handled by the noUnspecifiedLiteral rule,
        // which is run after typechecking
        return tAny
      }
      return tPrimitive(typeof node.value as PrimitiveType, node.value)
    }
    case 'Identifier': {
      const varName = node.name
      const varType = lookupTypeAndRemoveForAllAndPredicateTypes(varName, env)
      if (varType) {
        return varType
      } else {
        context.errors.push(new UndefinedVariable(varName, node))
        return tAny
      }
    }
    case 'Program':
    case 'BlockStatement': {
      let returnType: Type = tVoid
      pushEnv(env)

      if (node.type === 'Program') {
        // Import statements should only exist in program body
        handleImportDeclarations(node, context, env)
      }

      // Add all declarations in the current scope to the environment first
      addTypeDeclarationsToEnvironment(node, context, env)

      // Check all statements in program/block body
      for (const stmt of node.body) {
        if (stmt.type === 'IfStatement' || stmt.type === 'ReturnStatement') {
          returnType = typeCheckAndReturnType(stmt, context, env)
          if (stmt.type === 'ReturnStatement') {
            // If multiple return statements are present, only take the first type
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
      // Predicate type must be boolean/any
      const predicateType = typeCheckAndReturnType(node.test, context, env)
      checkForTypeMismatch(node, predicateType, tBool, context)

      // Return type is union of consequent and alternate type
      const consType = typeCheckAndReturnType(node.consequent, context, env)
      const altType = node.alternate ? typeCheckAndReturnType(node.alternate, context, env) : tUndef
      return mergeTypes(consType, altType)
    }
    case 'UnaryExpression': {
      const argType = typeCheckAndReturnType(node.argument, context, env)
      const operator = node.operator
      switch (operator) {
        case '-':
          // Only number/any type allowed
          checkForTypeMismatch(node, argType, tNumber, context)
          return tNumber
        case '!':
          // Only boolean/any type allowed
          checkForTypeMismatch(node, argType, tBool, context)
          return tBool
        case 'typeof':
          // No checking needed, typeof operation can be used on any type
          return tString
        default:
          throw new TypeError(node, 'Unknown operator')
      }
    }
    case 'BinaryExpression': {
      return typeCheckAndReturnBinaryExpressionType(node, context, env)
    }
    case 'LogicalExpression': {
      // Left type must be boolean/any
      const leftType = typeCheckAndReturnType(node.left, context, env)
      checkForTypeMismatch(node, leftType, tBool, context)

      // Return type is union of boolean and right type
      const rightType = typeCheckAndReturnType(node.right, context, env)
      return mergeTypes(tBool, rightType)
    }
    case 'ArrowFunctionExpression': {
      return typeCheckAndReturnArrowFunctionType(node, context, env)
    }
    case 'FunctionDeclaration':
      // Only identifiers are used as function params in Source
      const params = node.params as tsEs.Identifier[]
      const expectedReturnType = getTypeAnnotationType(node.returnType, context, env)

      const types = getParamTypes(params, context, env)
      // Return type will always be last item in types array
      types.push(expectedReturnType)
      const fnType = tFunc(...types)

      // Type check function body, creating new environment to store arg types, return type and function type
      pushEnv(env)
      params.forEach(param => {
        setType(param.name, getTypeAnnotationType(param.typeAnnotation, context, env), env)
      })
      // Set unique identifier so that typechecking can be carried out for return statements
      setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
      setType(node.id!.name, fnType, env)
      const actualReturnType = typeCheckAndReturnType(node.body, context, env)
      env.pop()

      if (
        (actualReturnType as Primitive).name === 'void' &&
        (expectedReturnType as Primitive).name !== 'any' &&
        (expectedReturnType as Primitive).name !== 'void'
      ) {
        // Type error where function does not return anything when it should
        context.errors.push(new FunctionShouldHaveReturnValueError(node))
      } else {
        checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
      }

      // No need to save variable type again, return undefined type
      return tUndef
    case 'VariableDeclaration': {
      const id = node.declarations[0].id as tsEs.Identifier
      const init = node.declarations[0].init!
      // Look up declared type directly as type has already been added to environment
      const expectedType =
        lookupTypeAndRemoveForAllAndPredicateTypes(id.name, env) ??
        getTypeAnnotationType(id.typeAnnotation, context, env)
      const initType = typeCheckAndReturnType(init, context, env)
      checkForTypeMismatch(node, initType, expectedType, context)

      // No need to save variable type again, return undefined type
      return tUndef
    }
    case 'CallExpression': {
      const callee = node.callee
      switch (callee.type) {
        case 'Identifier':
          const fnName = callee.name
          const fnType = lookupTypeAndRemoveForAllAndPredicateTypes(fnName, env)
          if (fnType) {
            if (fnType.kind !== 'function') {
              if ((fnType as Primitive).name !== 'any') {
                context.errors.push(new TypeNotCallableError(node, fnName))
              }
              return tAny
            }
            // Check argument types before returning declared return type
            const expectedTypes = fnType.parameterTypes
            const args = node.arguments
            if (args.length !== expectedTypes.length) {
              context.errors.push(
                new InvalidNumberOfArguments(node, expectedTypes.length, args.length)
              )
              return fnType.returnType
            }
            checkArgTypes(node, expectedTypes, context, env)
            return fnType.returnType
          } else {
            context.errors.push(new UndefinedVariable(fnName, node))
            return tAny
          }
        case 'ArrowFunctionExpression':
          const arrowFnType = typeCheckAndReturnArrowFunctionType(callee, context, env)
          // Check argument types before returning return type of arrow fn
          const expectedTypes = arrowFnType.parameterTypes
          const args = node.arguments
          if (args.length !== expectedTypes.length) {
            context.errors.push(
              new InvalidNumberOfArguments(node, expectedTypes.length, args.length)
            )
            return arrowFnType.returnType
          }
          checkArgTypes(node, expectedTypes, context, env)
          return arrowFnType.returnType
        default:
          throw new TypeError(node, 'Unknown callee type')
      }
    }
    case 'ReturnStatement': {
      if (!node.argument) {
        context.errors.push(new NoImplicitReturnUndefinedError(node))
        return tUndef
      } else {
        // Check type only if return type is specified
        const expectedType = lookupTypeAndRemoveForAllAndPredicateTypes(RETURN_TYPE_IDENTIFIER, env)
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
      // No typechecking needed, import declarations have already been handled separately
      return tUndef
    default:
      // Cast to TS nodes that are not officially supported by acorn
      const tsNode = node as unknown as tsEs.TSNode
      switch (tsNode.type) {
        case 'TSTypeAliasDeclaration':
          // No typechecking needed, type has already been added to environment
          return tUndef
        case 'TSAsExpression':
          const originalType = typeCheckAndReturnType(tsNode.expression, context, env)
          const typeToCastTo = getTypeAnnotationType(tsNode, context, env)
          if ((typeToCastTo as Primitive).name === 'any') {
            context.errors.push(new NoExplicitAnyError(tsNode))
          }
          const formatAsLiteral =
            typeContainsLiteralType(originalType) || typeContainsLiteralType(typeToCastTo)
          if (hasTypeMismatchErrors(typeToCastTo, originalType)) {
            context.errors.push(
              new TypecastError(
                tsNode,
                formatTypeString(originalType, formatAsLiteral),
                formatTypeString(typeToCastTo, formatAsLiteral)
              )
            )
          }
          return typeToCastTo
        case 'TSInterfaceDeclaration':
          throw new TypeError(node, 'Interface declarations are not allowed')
        default:
          throw new TypeError(node, 'Unknown node type')
      }
  }
}

/**
 * Adds types for imported functions to the type environment.
 * All imports have their types set to the "any" primitive type.
 */
function handleImportDeclarations(node: tsEs.Program, context: Context, env: TypeEnvironment) {
  const importStmts: tsEs.ImportDeclaration[] = node.body.filter(
    stmt => stmt.type === 'ImportDeclaration'
  ) as tsEs.ImportDeclaration[]
  if (importStmts.length === 0) {
    return
  }
  const modules = memoizedGetModuleManifest()
  const moduleList = Object.keys(modules)
  importStmts.forEach(stmt => {
    const moduleName = stmt.source.value as string
    if (!moduleList.includes(moduleName)) {
      context.errors.push(new ModuleNotFoundError(moduleName, stmt))
    }
    stmt.specifiers.map(spec => {
      if (spec.type !== 'ImportSpecifier') {
        throw new TypeError(stmt, 'Unknown specifier type')
      }

      setType(spec.local.name, tAny, env)
    })
  })
}

/**
 * Adds all types for variable/function/type declarations to the current environment.
 * This is so that the types can be referenced before the declarations are initialized.
 */
function addTypeDeclarationsToEnvironment(
  node: tsEs.Program | tsEs.BlockStatement,
  context: Context,
  env: TypeEnvironment
) {
  node.body.forEach(node => {
    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id === null) {
          // Block should not be reached since node.id is only null when function declaration
          // is part of `export default function`, which is not used in Source
          throw new TypeError(node, 'Function declaration should always have an identifier')
        }
        // Only identifiers are used as function params in Source
        const params = node.params as tsEs.Identifier[]
        const returnType = getTypeAnnotationType(node.returnType, context, env)

        const types = getParamTypes(params, context, env)
        // Return type will always be last item in types array
        types.push(returnType)
        const fnType = tFunc(...types)

        // Save function type in type env
        setType(node.id.name, fnType, env)
        break
      case 'VariableDeclaration':
        if (node.kind === 'var') {
          throw new TypeError(node, 'Variable declaration using "var" is not allowed')
        }
        if (node.declarations.length !== 1) {
          throw new TypeError(node, 'Variable declaration should have one and only one declaration')
        }
        if (node.declarations[0].id.type !== 'Identifier') {
          throw new TypeError(node, 'Variable declaration ID should be an identifier')
        }
        const id = node.declarations[0].id as tsEs.Identifier
        const expectedType = getTypeAnnotationType(id.typeAnnotation, context, env)

        // Save variable type and decl kind in type env
        setType(id.name, expectedType, env)
        setDeclKind(id.name, node.kind, env)
        break
      default:
        // Cast to TS nodes that are not officially supported by acorn
        const tsNode = node as unknown as tsEs.TSNode
        if (tsNode.type === 'TSTypeAliasDeclaration') {
          const id = tsNode.id
          const type = getTypeAnnotationType(tsNode, context, env)
          setTypeAlias(id.name, type, env)
        }
        break
    }
  })
}

/**
 * Typechecks the body of a binary expression, adding any type errors to context if necessary.
 * Then, returns the type of the binary expression, inferred based on the operator.
 */
function typeCheckAndReturnBinaryExpressionType(
  node: tsEs.BinaryExpression,
  context: Context,
  env: TypeEnvironment
): Type {
  const leftType = typeCheckAndReturnType(node.left, context, env)
  const rightType = typeCheckAndReturnType(node.right, context, env)
  const leftTypeString = formatTypeString(leftType)
  const rightTypeString = formatTypeString(rightType)
  const operator = node.operator
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      // Return type number
      checkForTypeMismatch(node, leftType, tNumber, context)
      checkForTypeMismatch(node, rightType, tNumber, context)
      return tNumber
    case '+':
      // Both sides can only be number, string, or any
      // However, case where one side is string and other side is number is not allowed
      if (leftTypeString === 'number' || leftTypeString === 'string') {
        checkForTypeMismatch(node, rightType, leftType, context)
        // If string + number, return string; else return left type
        if (leftTypeString === 'string' || rightTypeString === 'string') {
          return tString
        }
        return leftType
      }
      if (rightTypeString === 'number' || rightTypeString === 'string') {
        checkForTypeMismatch(node, leftType, rightType, context)
        // If string + number, return string; else return right type
        if (leftTypeString === 'string' || rightTypeString === 'string') {
          return tString
        }
        return rightType
      }

      // Return type number | string
      checkForTypeMismatch(node, leftType, tUnion(tNumber, tString), context)
      checkForTypeMismatch(node, rightType, tUnion(tNumber, tString), context)
      return tUnion(tNumber, tString)
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '!==':
    case '===':
      // In Source 3 and above, skip type checking as equality can be applied between two items of any type
      if (context.chapter > 2 && (operator === '===' || operator === '!==')) {
        return tBool
      }
      // Both sides can only be number, string, or any
      // However, case where one side is string and other side is number is not allowed
      if (leftTypeString === 'number' || leftTypeString === 'string') {
        checkForTypeMismatch(node, rightType, leftType, context)
        return tBool
      }
      if (rightTypeString === 'number' || rightTypeString === 'string') {
        checkForTypeMismatch(node, leftType, rightType, context)
        return tBool
      }

      // Return type boolean
      checkForTypeMismatch(node, leftType, tUnion(tNumber, tString), context)
      checkForTypeMismatch(node, rightType, tUnion(tNumber, tString), context)
      return tBool
    default:
      return tAny
  }
}

/**
 * Typechecks the body of an arrow function, adding any type errors to context if necessary.
 * Then, returns the inferred/declared type of the function.
 */
function typeCheckAndReturnArrowFunctionType(
  node: tsEs.ArrowFunctionExpression,
  context: Context,
  env: TypeEnvironment
): FunctionType {
  // Only identifiers are used as function params in Source
  const params = node.params as tsEs.Identifier[]
  const expectedReturnType = getTypeAnnotationType(node.returnType, context, env)

  // Type check function body, creating new environment to store arg types and return type
  pushEnv(env)
  params.forEach(param => {
    setType(param.name, getTypeAnnotationType(param.typeAnnotation, context, env), env)
  })
  // Set unique identifier so that typechecking can be carried out for return statements
  setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
  const actualReturnType = typeCheckAndReturnType(node.body, context, env)
  env.pop()

  if (
    (actualReturnType as Primitive).name === 'void' &&
    (expectedReturnType as Primitive).name !== 'any' &&
    (expectedReturnType as Primitive).name !== 'void'
  ) {
    // Type error where function does not return anything when it should
    context.errors.push(new FunctionShouldHaveReturnValueError(node))
  } else {
    checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
  }

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
  node: tsEs.Node,
  actualType: Type,
  expectedType: Type,
  context: Context
): void {
  const formatAsLiteral =
    typeContainsLiteralType(expectedType) || typeContainsLiteralType(actualType)
  if (hasTypeMismatchErrors(actualType, expectedType)) {
    context.errors.push(
      new TypeMismatchError(
        node,
        formatTypeString(actualType, formatAsLiteral),
        formatTypeString(expectedType, formatAsLiteral)
      )
    )
  }
}

/**
 * Returns true if given type contains literal type, false otherwise.
 * This is necessary to determine whether the type mismatch errors
 * should be formatted as literal type or primitive type.
 */
function typeContainsLiteralType(type: Type): boolean {
  switch (type.kind) {
    case 'primitive':
    case 'variable':
      return false
    case 'literal':
      return true
    case 'function':
      return (
        typeContainsLiteralType(type.returnType) ||
        type.parameterTypes.reduce((prev, curr) => prev || typeContainsLiteralType(curr), false)
      )
    case 'union':
      return type.types.reduce((prev, curr) => prev || typeContainsLiteralType(curr), false)
    default:
      return false
  }
}

/**
 * Returns a boolean if the two given types are equal, false otherwise.
 */
function hasTypeMismatchErrors(actualType: Type, expectedType: Type): boolean {
  if ((actualType as Primitive).name === 'any' || (expectedType as Primitive).name === 'any') {
    // Exit early as "any" is guaranteed not to cause type mismatch errors
    return false
  }
  switch (expectedType.kind) {
    case 'primitive':
    case 'variable':
      if (actualType.kind === 'literal') {
        return typeof actualType.value !== (expectedType as Primitive).name
      }
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
        // Note that actual and expected types are swapped here
        // as expected type should be subset of actual type for function arguments
        if (hasTypeMismatchErrors(expectedParamTypes[i], actualParamTypes[i])) {
          return true
        }
      }
      // Check return type
      return hasTypeMismatchErrors(actualType.returnType, expectedType.returnType)
    case 'union':
      // If not union type, actual type should match one of the expected types
      if (actualType.kind !== 'union') {
        return !containsType(expectedType.types, actualType)
      }
      // If both are union types, every type in the actual types should match one of the expected types
      for (const type of actualType.types) {
        if (!containsType(expectedType.types, type)) {
          return true
        }
      }
      return false
    case 'literal':
      if (actualType.kind !== 'literal' && actualType.kind !== 'primitive') {
        return true
      }
      return actualType.value !== expectedType.value
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
  node: tsEs.CallExpression,
  expectedTypes: Type[],
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
 * Converts type annotation/type alias declaration node to its corresponding type representation in Source.
 * If no type annotation exists, returns the "any" primitive type.
 */
function getTypeAnnotationType(
  annotationNode:
    | tsEs.AnnotationTypeNode
    | tsEs.TypeAliasDeclarationNode
    | tsEs.AsExpressionNode
    | undefined,
  context: Context,
  env: TypeEnvironment
): Type {
  if (!annotationNode) {
    return tAny
  }
  return getAnnotatedType(annotationNode.typeAnnotation, context, env)
}

/**
 * Converts type node to its corresponding type representation in Source.
 */
function getAnnotatedType(typeNode: tsEs.TypeNode, context: Context, env: TypeEnvironment): Type {
  switch (typeNode.type) {
    case 'TSFunctionType':
      const fnTypes = getParamTypes(typeNode.parameters, context, env)
      // Return type will always be last item in types array
      fnTypes.push(getTypeAnnotationType(typeNode.typeAnnotation, context, env))
      return tFunc(...fnTypes)
    case 'TSUnionType':
      const unionTypes = typeNode.types.map(node => getAnnotatedType(node, context, env))
      return mergeTypes(...unionTypes)
    case 'TSLiteralType':
      const value = typeNode.literal.value
      if (!['string', 'number', 'boolean'].includes(typeof value)) {
        throw new TypeError(typeNode as unknown as tsEs.Node, 'Unknown literal type')
      }
      return tLiteral(value as string | number | boolean)
    case 'TSIntersectionType':
      throw new TypeError(typeNode as unknown as tsEs.Node, 'Intersection types are not allowed')
    case 'TSTypeReference':
      const declaredType = lookupTypeAlias(typeNode.typeName.name, env)
      if (!declaredType) {
        context.errors.push(new TypeNotFoundError(typeNode, typeNode.typeName.name))
        return tAny
      }
      return declaredType
    default:
      return getPrimitiveType(typeNode, context)
  }
}

/**
 * Converts array of function parameters into array of types.
 */
function getParamTypes(params: tsEs.Identifier[], context: Context, env: TypeEnvironment): Type[] {
  return params.map(param => getTypeAnnotationType(param.typeAnnotation, context, env))
}

/**
 * Converts node type to primitive type, adding errors to context if disallowed/unknown types are used.
 * If errors are found, returns the "any" type to prevent throwing of further errors.
 */
function getPrimitiveType(node: tsEs.TypeKeywordNode, context: Context) {
  const primitiveType = typeAnnotationKeywordToBasicTypeMap[node.type] ?? 'unknown'
  if (
    disallowedTypes.includes(primitiveType as TSDisallowedTypes) ||
    (context.chapter === 1 && primitiveType === 'null')
  ) {
    context.errors.push(new TypeNotAllowedError(node, primitiveType))
    return tAny
  }
  return tPrimitive(primitiveType as PrimitiveType | TSAllowedTypes)
}

/**
 * Wrapper function for lookupType that removes ForAll and Predicate types,
 * since they are not used in the type error checker.
 */
function lookupTypeAndRemoveForAllAndPredicateTypes(
  name: string,
  env: TypeEnvironment
): Type | undefined {
  const type = lookupType(name, env)
  if (!type) {
    return undefined
  }
  if (type.kind === 'forall') {
    // Skip typecheck as function has variable number of arguments;
    // this only occurs for certain prelude functions
    return tAny
  }
  if (type.kind === 'predicate') {
    // All predicate functions (e.g. is_number)
    // take in 1 parameter and return a boolean
    return tFunc(tAny, tBool)
  }
  return type
}

/**
 * Combines all types provided in the parameters into one, removing duplicate types in the process.
 */
function mergeTypes(...types: Type[]): Type {
  const mergedTypes: Type[] = []
  for (const currType of types) {
    if (isEqual(currType, tAny)) {
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
    if (typeToCheck.kind === 'primitive') {
      // If both types are primitives, ignore values
      if (type.kind === 'primitive' && typeToCheck.name === type.name) {
        return true
      }
      // If checking primitive against literal, check by value
      if (type.kind === 'literal' && typeToCheck.value === type.value) {
        return true
      }
    }
    // If checking literal against primitive, check by type
    if (
      typeToCheck.kind === 'literal' &&
      type.kind === 'primitive' &&
      typeof typeToCheck.value === type.name
    ) {
      return true
    }
  }
  return false
}

/**
 * Traverses through the program and removes all TS-related nodes, returning the result.
 */
function removeTSNodes(node: tsEs.Node): any {
  switch (node.type) {
    case 'Literal':
    case 'Identifier': {
      return node
    }
    case 'Program':
    case 'BlockStatement': {
      const newBody: tsEs.Statement[] = []
      node.body.forEach(stmt => {
        const type = stmt.type as string
        if (type.startsWith('TS')) {
          switch (type) {
            case 'TSAsExpression':
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
      const tsNode = node as unknown as tsEs.TSNode
      const type = tsNode.type
      switch (type) {
        case 'TSAsExpression':
          // Remove wrapper node
          return removeTSNodes(tsNode.expression)
        default:
          // Remove all other TS nodes
          return type.startsWith('TS') ? undefined : node
      }
  }
}
