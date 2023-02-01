import * as es from 'estree'
import { cloneDeep, isEqual } from 'lodash'

import { ModuleNotFoundError } from '../errors/moduleErrors'
import {
  ConstNotAssignableTypeError,
  FunctionShouldHaveReturnValueError,
  InvalidArrayAccessTypeError,
  InvalidIndexTypeError,
  InvalidNumberOfArgumentsTypeError,
  InvalidNumberOfTypeArgumentsForGenericTypeError,
  TypeAliasNameNotAllowedError,
  TypecastError,
  TypeMismatchError,
  TypeNotAllowedError,
  TypeNotCallableError,
  TypeNotFoundError,
  TypeNotGenericError,
  TypeParameterNameNotAllowedError,
  UndefinedVariableTypeError
} from '../errors/typeErrors'
import { memoizedGetModuleManifest } from '../modules/moduleLoader'
import {
  BindableType,
  Chapter,
  Context,
  disallowedTypes,
  Pair,
  PrimitiveType,
  SArray,
  TSAllowedTypes,
  TSBasicType,
  TSDisallowedTypes,
  Type,
  TypeEnvironment,
  Variable
} from '../types'
import { TypecheckError } from './internalTypeErrors'
import * as tsEs from './tsESTree'
import {
  formatTypeString,
  getTypeOverrides,
  lookupDeclKind,
  lookupType,
  lookupTypeAlias,
  pushEnv,
  RETURN_TYPE_IDENTIFIER,
  setDeclKind,
  setType,
  setTypeAlias,
  tAny,
  tArray,
  tBool,
  tForAll,
  tFunc,
  tList,
  tLiteral,
  tNull,
  tNumber,
  tPair,
  tPrimitive,
  tString,
  tUndef,
  tUnion,
  tVar,
  tVoid,
  typeAnnotationKeywordToBasicTypeMap
} from './utils'

// Type environment is saved as a global variable so that it is not passed between functions excessively
let env: TypeEnvironment = []

/**
 * Entry function for type error checker.
 * Checks program for type errors, and returns the program with all TS-related nodes removed.
 */
export function checkForTypeErrors(program: tsEs.Program, context: Context): es.Program {
  // Deep copy type environment to avoid modifying type environment in the context,
  // which might affect the type inference checker
  env = cloneDeep(context.typeEnvironment)
  // Override predeclared function types
  for (const [name, type] of getTypeOverrides(context.chapter)) {
    setType(name, type, env)
  }
  try {
    typeCheckAndReturnType(program, context)
  } catch (error) {
    // Catch-all for thrown errors
    // (either errors that cause early termination or errors that should not be reached logically)
    console.error(error)
    context.errors.push(
      error instanceof TypecheckError
        ? error
        : new TypecheckError(
            program,
            'Uncaught error during typechecking, report this to the administrators!\n' +
              error.message
          )
    )
  }
  // Reset global variables
  env = []
  return removeTSNodes(program)
}

/**
 * Recurses through the given node to check for any type errors,
 * then returns the node's inferred/declared type.
 * Any errors found are added to the context.
 */
function typeCheckAndReturnType(node: tsEs.Node, context: Context): Type {
  switch (node.type) {
    case 'Literal': {
      // Infers type
      if (node.value === undefined) {
        return tUndef
      }
      if (node.value === null) {
        // For Source 1, skip typecheck as null literals will be handled by the noNull rule,
        // which is run after typechecking
        return context.chapter === Chapter.SOURCE_1 ? tAny : tNull
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
      // Casting is safe here as above check already narrows type to string, number or boolean
      return tPrimitive(typeof node.value as PrimitiveType, node.value)
    }
    case 'Identifier': {
      const varName = node.name
      const varType = lookupTypeAndRemoveForAllAndPredicateTypes(varName)
      if (varType) {
        return varType
      } else {
        context.errors.push(new UndefinedVariableTypeError(node, varName))
        return tAny
      }
    }
    case 'RestElement':
    case 'SpreadElement':
      // TODO: Add support for rest and spread element
      return tAny
    case 'Program':
    case 'BlockStatement': {
      let returnType: Type = tVoid
      pushEnv(env)

      if (node.type === 'Program') {
        // Import statements should only exist in program body
        handleImportDeclarations(node, context)
      }

      // Add all declarations in the current scope to the environment first
      addTypeDeclarationsToEnvironment(node, context)

      // Check all statements in program/block body
      for (const stmt of node.body) {
        if (stmt.type === 'IfStatement' || stmt.type === 'ReturnStatement') {
          returnType = typeCheckAndReturnType(stmt, context)
          if (stmt.type === 'ReturnStatement') {
            // If multiple return statements are present, only take the first type
            break
          }
        } else {
          typeCheckAndReturnType(stmt, context)
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
      return typeCheckAndReturnType(node.expression, context)
    }
    case 'ConditionalExpression':
    case 'IfStatement': {
      // Predicate type must be boolean/any
      const predicateType = typeCheckAndReturnType(node.test, context)
      checkForTypeMismatch(node, predicateType, tBool, context)

      // Return type is union of consequent and alternate type
      const consType = typeCheckAndReturnType(node.consequent, context)
      const altType = node.alternate ? typeCheckAndReturnType(node.alternate, context) : tUndef
      return mergeTypes(consType, altType)
    }
    case 'UnaryExpression': {
      const argType = typeCheckAndReturnType(node.argument, context)
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
          throw new TypecheckError(node, 'Unknown operator')
      }
    }
    case 'BinaryExpression': {
      return typeCheckAndReturnBinaryExpressionType(node, context)
    }
    case 'LogicalExpression': {
      // Left type must be boolean/any
      const leftType = typeCheckAndReturnType(node.left, context)
      checkForTypeMismatch(node, leftType, tBool, context)

      // Return type is union of boolean and right type
      const rightType = typeCheckAndReturnType(node.right, context)
      return mergeTypes(tBool, rightType)
    }
    case 'ArrowFunctionExpression': {
      return typeCheckAndReturnArrowFunctionType(node, context)
    }
    case 'FunctionDeclaration':
      if (node.id === null) {
        // Block should not be reached since node.id is only null when function declaration
        // is part of `export default function`, which is not used in Source
        throw new TypecheckError(node, 'Function declaration should always have an identifier')
      }

      // Only identifiers/rest elements are used as function params in Source
      const params = node.params.filter(
        (param): param is tsEs.Identifier | tsEs.RestElement =>
          param.type === 'Identifier' || param.type === 'RestElement'
      )
      if (params.length !== node.params.length) {
        throw new TypecheckError(node, 'Unknown function parameter type')
      }
      const fnName = node.id.name
      const expectedReturnType = getTypeAnnotationType(node.returnType, context)

      // If the function has variable number of arguments, set function type as any
      // TODO: Add support for variable number of function arguments
      const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
      if (hasVarArgs) {
        setType(fnName, tAny, env)
        return tUndef
      }

      const types = getParamTypes(params, context)
      // Return type will always be last item in types array
      types.push(expectedReturnType)
      const fnType = tFunc(...types)

      // Type check function body, creating new environment to store arg types, return type and function type
      pushEnv(env)
      params.forEach((param: tsEs.Identifier) => {
        setType(param.name, getTypeAnnotationType(param.typeAnnotation, context), env)
      })
      // Set unique identifier so that typechecking can be carried out for return statements
      setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
      setType(fnName, fnType, env)
      const actualReturnType = typeCheckAndReturnType(node.body, context)
      env.pop()

      if (
        isEqual(actualReturnType, tVoid) &&
        !isEqual(expectedReturnType, tAny) &&
        !isEqual(expectedReturnType, tVoid)
      ) {
        // Type error where function does not return anything when it should
        context.errors.push(new FunctionShouldHaveReturnValueError(node))
      } else {
        checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
      }

      // Save function type in type env
      setType(fnName, fnType, env)
      return tUndef
    case 'VariableDeclaration': {
      if (node.kind === 'var') {
        throw new TypecheckError(node, 'Variable declaration using "var" is not allowed')
      }
      if (node.declarations.length !== 1) {
        throw new TypecheckError(
          node,
          'Variable declaration should have one and only one declaration'
        )
      }
      if (node.declarations[0].id.type !== 'Identifier') {
        throw new TypecheckError(node, 'Variable declaration ID should be an identifier')
      }
      const id = node.declarations[0].id
      if (!node.declarations[0].init) {
        throw new TypecheckError(node, 'Variable declaration must have value')
      }
      const init = node.declarations[0].init
      // Look up declared type if current environment contains name
      const expectedType = env[env.length - 1].typeMap.has(id.name)
        ? lookupTypeAndRemoveForAllAndPredicateTypes(id.name) ??
          getTypeAnnotationType(id.typeAnnotation, context)
        : getTypeAnnotationType(id.typeAnnotation, context)
      const initType = typeCheckAndReturnType(init, context)
      checkForTypeMismatch(node, initType, expectedType, context)

      // Save variable type and decl kind in type env
      setType(id.name, expectedType, env)
      setDeclKind(id.name, node.kind, env)
      return tUndef
    }
    case 'CallExpression': {
      const callee = node.callee
      const args = node.arguments
      if (context.chapter >= 2 && callee.type === 'Identifier') {
        // Special functions for Source 2+: pair, list, head, tail
        // Pairs and lists are data structures, but since code is not evaluated when type-checking,
        // we can only get the types of pairs and lists by looking at the pair and list function calls.
        // The typical way of getting the return type of call expressions is insufficient to type pairs and lists,
        // hence these functions are handled separately.
        const fnName = callee.name
        if (fnName === 'pair') {
          if (args.length !== 2) {
            context.errors.push(new InvalidNumberOfArgumentsTypeError(node, 2, args.length))
            return tPair(tAny, tAny)
          }
          return tPair(
            typeCheckAndReturnType(args[0], context),
            typeCheckAndReturnType(args[1], context)
          )
        }
        if (fnName === 'list') {
          if (args.length === 0) {
            return tNull
          }
          // Element type is union of all types of arguments in list
          let elementType = typeCheckAndReturnType(args[0], context)
          for (let i = 1; i < args.length; i++) {
            elementType = mergeTypes(elementType, typeCheckAndReturnType(args[i], context))
          }
          // Type the list as a pair, for use when checking for type mismatches against pairs
          let pairType = tPair(typeCheckAndReturnType(args[args.length - 1], context), tNull)
          for (let i = args.length - 2; i >= 0; i--) {
            pairType = tPair(typeCheckAndReturnType(args[i], context), pairType)
          }
          return tList(elementType, pairType)
        }
        if (fnName === 'head' || fnName === 'tail') {
          if (args.length !== 1) {
            context.errors.push(new InvalidNumberOfArgumentsTypeError(node, 1, args.length))
            return tAny
          }
          const actualType = typeCheckAndReturnType(args[0], context)
          // Argument should be either a pair or a list
          const expectedType = tUnion(tPair(tAny, tAny), tList(tAny))
          const numErrors = context.errors.length
          checkForTypeMismatch(node, actualType, expectedType, context)
          if (context.errors.length > numErrors) {
            // If errors were found, return "any" type
            return tAny
          }
          if (actualType.kind === 'pair') {
            return fnName === 'head' ? actualType.headType : actualType.tailType
          }
          if (actualType.kind === 'list') {
            return fnName === 'head'
              ? actualType.elementType
              : tList(
                  actualType.elementType,
                  actualType.typeAsPair && actualType.typeAsPair.tailType.kind === 'pair'
                    ? actualType.typeAsPair.tailType
                    : undefined
                )
          }
          return actualType
        }
      }
      const calleeType = typeCheckAndReturnType(callee, context)
      if (calleeType.kind !== 'function') {
        if (calleeType.kind !== 'primitive' || calleeType.name !== 'any') {
          context.errors.push(new TypeNotCallableError(node, formatTypeString(calleeType)))
        }
        return tAny
      }

      // If any of the arguments is a spread element, skip type checking of arguments
      // TODO: Add support for type checking of call expressions with spread elements
      const hasVarArgs = args.reduce((prev, curr) => prev || curr.type === 'SpreadElement', false)
      if (hasVarArgs) {
        return calleeType.returnType
      }

      // Check argument types before returning declared return type
      const expectedTypes = calleeType.parameterTypes
      if (args.length !== expectedTypes.length) {
        context.errors.push(
          new InvalidNumberOfArgumentsTypeError(node, expectedTypes.length, args.length)
        )
        return calleeType.returnType
      }
      checkArgTypes(node, expectedTypes, context)
      return calleeType.returnType
    }
    case 'AssignmentExpression':
      const expectedType = typeCheckAndReturnType(node.left, context)
      const actualType = typeCheckAndReturnType(node.right, context)

      if (node.left.type === 'Identifier' && lookupDeclKind(node.left.name, env) === 'const') {
        context.errors.push(new ConstNotAssignableTypeError(node, node.left.name))
      }
      checkForTypeMismatch(node, actualType, expectedType, context)
      return actualType
    case 'ArrayExpression':
      // Casting is safe here as Source disallows use of spread elements and holes in arrays
      const elements = node.elements.filter(
        (elem): elem is Exclude<tsEs.ArrayExpression['elements'][0], tsEs.SpreadElement | null> =>
          elem !== null && elem.type !== 'SpreadElement'
      )
      if (elements.length !== node.elements.length) {
        throw new TypecheckError(node, 'Disallowed array element type')
      }
      if (elements.length === 0) {
        return tArray(tAny)
      }
      const elementTypes = elements.map(elem => typeCheckAndReturnType(elem, context))
      return tArray(mergeTypes(...elementTypes))
    case 'MemberExpression':
      const indexType = typeCheckAndReturnType(node.property, context)
      const objectType = typeCheckAndReturnType(node.object, context)
      // Index must be number
      if (hasTypeMismatchErrors(indexType, tNumber)) {
        context.errors.push(new InvalidIndexTypeError(node, formatTypeString(indexType, true)))
      }
      // Expression being accessed must be array
      if (objectType.kind !== 'array') {
        context.errors.push(new InvalidArrayAccessTypeError(node, formatTypeString(objectType)))
        return tAny
      }
      return objectType.elementType
    case 'ReturnStatement': {
      if (!node.argument) {
        // Skip typecheck as unspecified literals will be handled by the noImplicitReturnUndefined rule,
        // which is run after typechecking
        return tUndef
      } else {
        // Check type only if return type is specified
        const expectedType = lookupTypeAndRemoveForAllAndPredicateTypes(RETURN_TYPE_IDENTIFIER)
        if (expectedType) {
          const argumentType = typeCheckAndReturnType(node.argument, context)
          checkForTypeMismatch(node, argumentType, expectedType, context)
          return expectedType
        } else {
          return typeCheckAndReturnType(node.argument, context)
        }
      }
    }
    case 'WhileStatement': {
      // Predicate must be boolean
      const testType = typeCheckAndReturnType(node.test, context)
      checkForTypeMismatch(node, testType, tBool, context)
      return typeCheckAndReturnType(node.body, context)
    }
    case 'ForStatement': {
      // Add new environment so that new variable declared in init node can be isolated to within for statement only
      pushEnv(env)
      if (node.init) {
        typeCheckAndReturnType(node.init, context)
      }
      if (node.test) {
        // Predicate must be boolean
        const testType = typeCheckAndReturnType(node.test, context)
        checkForTypeMismatch(node, testType, tBool, context)
      }
      if (node.update) {
        typeCheckAndReturnType(node.update, context)
      }
      const bodyType = typeCheckAndReturnType(node.body, context)
      env.pop()
      return bodyType
    }
    case 'ImportDeclaration':
      // No typechecking needed, import declarations have already been handled separately
      return tUndef
    case 'TSTypeAliasDeclaration':
      // No typechecking needed, type has already been added to environment
      return tUndef
    case 'TSAsExpression':
      const originalType = typeCheckAndReturnType(node.expression, context)
      const typeToCastTo = getTypeAnnotationType(node, context)
      const formatAsLiteral =
        typeContainsLiteralType(originalType) || typeContainsLiteralType(typeToCastTo)
      if (hasTypeMismatchErrors(typeToCastTo, originalType)) {
        context.errors.push(
          new TypecastError(
            node,
            formatTypeString(originalType, formatAsLiteral),
            formatTypeString(typeToCastTo, formatAsLiteral)
          )
        )
      }
      return typeToCastTo
    case 'TSInterfaceDeclaration':
      throw new TypecheckError(node, 'Interface declarations are not allowed')
    default:
      throw new TypecheckError(node, 'Unknown node type')
  }
}

/**
 * Adds types for imported functions to the type environment.
 * All imports have their types set to the "any" primitive type.
 */
function handleImportDeclarations(node: tsEs.Program, context: Context) {
  const importStmts: tsEs.ImportDeclaration[] = node.body.filter(
    (stmt): stmt is tsEs.ImportDeclaration => stmt.type === 'ImportDeclaration'
  )
  if (importStmts.length === 0) {
    return
  }
  const modules = memoizedGetModuleManifest()
  const moduleList = Object.keys(modules)
  importStmts.forEach(stmt => {
    // Source only uses strings for import source value
    const moduleName = stmt.source.value as string
    if (!moduleList.includes(moduleName)) {
      context.errors.push(new ModuleNotFoundError(moduleName, stmt))
    }
    stmt.specifiers.map(spec => {
      if (spec.type !== 'ImportSpecifier') {
        throw new TypecheckError(stmt, 'Unknown specifier type')
      }

      setType(spec.local.name, tAny, env)
    })
  })
}

/**
 * Adds all types for variable/function/type declarations to the current environment.
 * This is so that the types can be referenced before the declarations are initialized.
 * Type checking is not carried out as this function is only responsible for hoisting declarations.
 */
function addTypeDeclarationsToEnvironment(
  node: tsEs.Program | tsEs.BlockStatement,
  context: Context
) {
  node.body.forEach(node => {
    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        // Only identifiers/rest elements are used as function params in Source
        const params = node.params.filter(
          (param): param is tsEs.Identifier | tsEs.RestElement =>
            param.type === 'Identifier' || param.type === 'RestElement'
        )
        if (params.length !== node.params.length) {
          throw new TypecheckError(node, 'Unknown function parameter type')
        }
        const fnName = node.id.name
        const returnType = getTypeAnnotationType(node.returnType, context)

        // If the function has variable number of arguments, set function type as any
        // TODO: Add support for variable number of function arguments
        const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
        if (hasVarArgs) {
          setType(fnName, tAny, env)
          break
        }

        const types = getParamTypes(params, context)
        // Return type will always be last item in types array
        types.push(returnType)
        const fnType = tFunc(...types)

        // Save function type in type env
        setType(fnName, fnType, env)
        break
      case 'VariableDeclaration':
        if (node.kind === 'var') {
          throw new TypecheckError(node, 'Variable declaration using "var" is not allowed')
        }
        if (node.declarations.length !== 1) {
          throw new TypecheckError(
            node,
            'Variable declaration should have one and only one declaration'
          )
        }
        if (node.declarations[0].id.type !== 'Identifier') {
          throw new TypecheckError(node, 'Variable declaration ID should be an identifier')
        }
        const id = node.declarations[0].id as tsEs.Identifier
        const expectedType = getTypeAnnotationType(id.typeAnnotation, context)

        // Save variable type and decl kind in type env
        setType(id.name, expectedType, env)
        setDeclKind(id.name, node.kind, env)
        break
      case 'TSTypeAliasDeclaration':
        const alias = node.id.name
        if (Object.values(typeAnnotationKeywordToBasicTypeMap).includes(alias as TSBasicType)) {
          context.errors.push(new TypeAliasNameNotAllowedError(node, alias))
          break
        }
        if (context.chapter >= 2 && (alias === 'Pair' || alias === 'List')) {
          context.errors.push(new TypeAliasNameNotAllowedError(node, alias))
          break
        }

        let type: BindableType = tAny
        if (node.typeParameters && node.typeParameters.params.length > 0) {
          const typeParams: Variable[] = []
          // Add type parameters to enclosing environment
          pushEnv(env)
          node.typeParameters.params.forEach(param => {
            if (param.type !== 'TSTypeParameter') {
              throw new TypecheckError(node, 'Invalid type parameter type')
            }
            const name = param.name
            if (Object.values(typeAnnotationKeywordToBasicTypeMap).includes(name as TSBasicType)) {
              context.errors.push(new TypeParameterNameNotAllowedError(param, name))
              return
            }
            const typeVariable = tVar(name)
            setTypeAlias(name, typeVariable, env)
            typeParams.push(typeVariable)
          })
          // Add own name to enclosing environment for handling recursive types
          setTypeAlias(alias, tVar(alias, typeParams), env)
          type = tForAll(getTypeAnnotationType(node, context), typeParams)
          env.pop()
        } else {
          type = getTypeAnnotationType(node, context)
        }
        setTypeAlias(alias, type, env)
        break
      default:
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
  context: Context
): Type {
  const leftType = typeCheckAndReturnType(node.left, context)
  const rightType = typeCheckAndReturnType(node.right, context)
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
      // However, the case where one side is string and other side is number is not allowed
      if (leftTypeString === 'number' || leftTypeString === 'string') {
        checkForTypeMismatch(node, rightType, leftType, context)
        // If left type is number or string, return left type
        return leftType
      }
      if (rightTypeString === 'number' || rightTypeString === 'string') {
        checkForTypeMismatch(node, leftType, rightType, context)
        // If left type is not number or string but right type is number or string, return right type
        return rightType
      }

      // Return type is number | string if both left and right are neither number nor string
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
      throw new TypecheckError(node, 'Unknown operator')
  }
}

/**
 * Typechecks the body of an arrow function, adding any type errors to context if necessary.
 * Then, returns the inferred/declared type of the function.
 */
function typeCheckAndReturnArrowFunctionType(
  node: tsEs.ArrowFunctionExpression,
  context: Context
): Type {
  // Only identifiers/rest elements are used as function params in Source
  const params = node.params.filter(
    (param): param is tsEs.Identifier | tsEs.RestElement =>
      param.type === 'Identifier' || param.type === 'RestElement'
  )
  if (params.length !== node.params.length) {
    throw new TypecheckError(node, 'Unknown function parameter type')
  }
  const expectedReturnType = getTypeAnnotationType(node.returnType, context)

  // If the function has variable number of arguments, set function type as any
  // TODO: Add support for variable number of function arguments
  const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
  if (hasVarArgs) {
    return tAny
  }

  // Type check function body, creating new environment to store arg types and return type
  pushEnv(env)
  params.forEach((param: tsEs.Identifier) => {
    setType(param.name, getTypeAnnotationType(param.typeAnnotation, context), env)
  })
  // Set unique identifier so that typechecking can be carried out for return statements
  setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
  const actualReturnType = typeCheckAndReturnType(node.body, context)
  env.pop()

  if (
    isEqual(actualReturnType, tVoid) &&
    !isEqual(expectedReturnType, tAny) &&
    !isEqual(expectedReturnType, tVoid)
  ) {
    // Type error where function does not return anything when it should
    context.errors.push(new FunctionShouldHaveReturnValueError(node))
  } else {
    checkForTypeMismatch(node, actualReturnType, expectedReturnType, context)
  }

  const types = getParamTypes(params, context)
  // Return type will always be last item in types array
  types.push(node.returnType ? expectedReturnType : actualReturnType)
  return tFunc(...types)
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
 * Returns true if the actual type and the expected type do not match, false otherwise.
 * The two types will not match if the intersection of the two types is empty.
 */
function hasTypeMismatchErrors(actualType: Type, expectedType: Type): boolean {
  if (isEqual(actualType, tAny) || isEqual(expectedType, tAny)) {
    // Exit early as "any" is guaranteed not to cause type mismatch errors
    return false
  }
  if (expectedType.kind !== 'variable' && actualType.kind === 'variable') {
    // If the expected type is not a variable type but the actual type is a variable type,
    // Swap the order of the types around
    // This removes the need to check if the actual type is a variable type in all of the switch cases
    return hasTypeMismatchErrors(expectedType, actualType)
  }
  if (expectedType.kind !== 'union' && actualType.kind === 'union') {
    // If the expected type is not a union type but the actual type is a union type,
    // Check if the expected type matches any of the actual types
    // This removes the need to check if the actual type is a union type in all of the switch cases
    return !containsType(actualType.types, expectedType)
  }
  switch (expectedType.kind) {
    case 'variable':
      if (actualType.kind === 'variable') {
        // If both are variable types, compare without expanding
        return (
          expectedType.name !== actualType.name ||
          !isEqual(expectedType.typeArgs, actualType.typeArgs)
        )
      }
      // Expand variable type and compare expanded type with actual type
      const aliasType = lookupTypeAlias(expectedType.name, env)
      if (aliasType && aliasType.kind === 'forall') {
        // Clone type to prevent modifying generic type saved in type env
        let polyType = cloneDeep(aliasType.polyType)
        if (expectedType.typeArgs) {
          if (aliasType.typeParams?.length !== expectedType.typeArgs.length) {
            return true
          }
          for (let i = 0; i < expectedType.typeArgs.length; i++) {
            polyType = substituteVariableTypes(
              polyType,
              aliasType.typeParams[i],
              expectedType.typeArgs[i]
            )
          }
        }
        return hasTypeMismatchErrors(actualType, polyType)
      }
      return true
    case 'primitive':
      if (actualType.kind === 'literal') {
        return expectedType.value === undefined
          ? typeof actualType.value !== expectedType.name
          : actualType.value !== expectedType.value
      }
      if (actualType.kind !== 'primitive') {
        return true
      }
      return actualType.name !== expectedType.name
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
        // to simulate contravariance for function parameter types
        // This will be useful if type checking in Source Typed were to be made stricter in the future
        if (hasTypeMismatchErrors(expectedParamTypes[i], actualParamTypes[i])) {
          return true
        }
      }
      // Check return type
      return hasTypeMismatchErrors(actualType.returnType, expectedType.returnType)
    case 'union':
      // If actual type is not union type, check if actual type matches one of the expected types
      if (actualType.kind !== 'union') {
        return !containsType(expectedType.types, actualType)
      }
      // If both are union types, there are no type errors as long as one of the types match
      for (const type of actualType.types) {
        if (containsType(expectedType.types, type)) {
          return false
        }
      }
      return true
    case 'literal':
      if (actualType.kind !== 'literal' && actualType.kind !== 'primitive') {
        return true
      }
      if (actualType.kind === 'primitive' && actualType.value === undefined) {
        return actualType.name !== typeof expectedType.value
      }
      return actualType.value !== expectedType.value
    case 'pair':
      if (actualType.kind === 'list') {
        // Special case, as lists are pairs
        if (actualType.typeAsPair !== undefined) {
          // If pair representation of list is present, check against pair type
          return hasTypeMismatchErrors(actualType.typeAsPair, expectedType)
        }
        // Head of pair should match list element type; tail of pair should match list type
        return (
          hasTypeMismatchErrors(actualType.elementType, expectedType.headType) ||
          hasTypeMismatchErrors(actualType, expectedType.tailType)
        )
      }
      if (actualType.kind !== 'pair') {
        return true
      }
      return (
        hasTypeMismatchErrors(actualType.headType, expectedType.headType) ||
        hasTypeMismatchErrors(actualType.tailType, expectedType.tailType)
      )
    case 'list':
      if (isEqual(actualType, tNull)) {
        // Null matches against any list type as null is empty list
        return false
      }
      if (actualType.kind === 'pair') {
        // Special case, as pairs can be lists
        if (expectedType.typeAsPair !== undefined) {
          // If pair representation of list is present, check against pair type
          return hasTypeMismatchErrors(actualType, expectedType.typeAsPair)
        }
        // Head of pair should match list element type; tail of pair should match list type
        return (
          hasTypeMismatchErrors(actualType.headType, expectedType.elementType) ||
          hasTypeMismatchErrors(actualType.tailType, expectedType)
        )
      }
      if (actualType.kind !== 'list') {
        return true
      }
      return hasTypeMismatchErrors(actualType.elementType, expectedType.elementType)
    case 'array':
      if (actualType.kind === 'union') {
        // Special case: number[] | string[] matches with (number | string)[]
        const types = actualType.types.filter((type): type is SArray => type.kind === 'array')
        if (types.length !== actualType.types.length) {
          return true
        }
        const combinedType = types.map(type => type.elementType)
        return hasTypeMismatchErrors(tUnion(...combinedType), expectedType.elementType)
      }
      if (actualType.kind !== 'array') {
        return true
      }
      return hasTypeMismatchErrors(actualType.elementType, expectedType.elementType)
    default:
      return true
  }
}

/**
 * Checks the types of the arguments of the given call expression.
 * If number of arguments is different, add InvalidNumberOfArguments error to context and terminates early.
 * Else, checks each argument against its expected type.
 */
function checkArgTypes(node: tsEs.CallExpression, expectedTypes: Type[], context: Context) {
  const args = node.arguments
  if (args.length !== expectedTypes.length) {
    context.errors.push(
      new InvalidNumberOfArgumentsTypeError(node, expectedTypes.length, args.length)
    )
    return
  }
  for (let i = 0; i < expectedTypes.length; i++) {
    const expectedType = expectedTypes[i]
    const node = args[i]
    const actualType = typeCheckAndReturnType(node, context)
    checkForTypeMismatch(node, actualType, expectedType, context)
  }
}

/**
 * Converts type annotation/type alias declaration node to its corresponding type representation in Source.
 * If no type annotation exists, returns the "any" primitive type.
 */
function getTypeAnnotationType(
  annotationNode:
    | tsEs.TSTypeAnnotation
    | tsEs.TSTypeAliasDeclaration
    | tsEs.TSAsExpression
    | undefined,
  context: Context
): Type {
  if (!annotationNode) {
    return tAny
  }
  return getAnnotatedType(annotationNode.typeAnnotation, context)
}

/**
 * Converts type node to its corresponding type representation in Source.
 */
function getAnnotatedType(typeNode: tsEs.TSType, context: Context): Type {
  switch (typeNode.type) {
    case 'TSFunctionType':
      const params = typeNode.parameters
      // If the function has variable number of arguments, set function type as any
      // TODO: Add support for variable number of function arguments
      const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
      if (hasVarArgs) {
        return tAny
      }
      const fnTypes = getParamTypes(params, context)
      // Return type will always be last item in types array
      fnTypes.push(getTypeAnnotationType(typeNode.typeAnnotation, context))
      return tFunc(...fnTypes)
    case 'TSLiteralType':
      const value = typeNode.literal.value
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypecheckError(typeNode, 'Unknown literal type')
      }
      return tLiteral(value)
    case 'TSArrayType':
      return tArray(getAnnotatedType(typeNode.elementType, context))
    case 'TSUnionType':
      const unionTypes = typeNode.types.map(node => getAnnotatedType(node, context))
      return mergeTypes(...unionTypes)
    case 'TSIntersectionType':
      throw new TypecheckError(typeNode, 'Intersection types are not allowed')
    case 'TSTypeReference':
      const name = typeNode.typeName.name
      if (context.chapter >= 2) {
        // Special types for Source 2+: Pair, List
        if (name === 'Pair') {
          if (!typeNode.typeParameters || typeNode.typeParameters.params.length !== 2) {
            context.errors.push(
              new InvalidNumberOfTypeArgumentsForGenericTypeError(typeNode, name, 2)
            )
            return tPair(tAny, tAny)
          }
          const typeParams = typeNode.typeParameters.params.filter(
            (param): param is tsEs.TSType => param.type !== 'TSTypeParameter'
          )
          if (typeParams.length !== typeNode.typeParameters.params.length) {
            throw new TypecheckError(typeNode, 'Invalid type parameter type')
          }
          return tPair(
            getAnnotatedType(typeParams[0], context),
            getAnnotatedType(typeParams[1], context)
          )
        }
        if (name === 'List') {
          if (!typeNode.typeParameters || typeNode.typeParameters.params.length !== 1) {
            context.errors.push(
              new InvalidNumberOfTypeArgumentsForGenericTypeError(typeNode, name, 1)
            )
            return tList(tAny)
          }
          const typeParams = typeNode.typeParameters.params.filter(
            (param): param is tsEs.TSType => param.type !== 'TSTypeParameter'
          )
          if (typeParams.length !== typeNode.typeParameters.params.length) {
            throw new TypecheckError(typeNode, 'Invalid type parameter type')
          }
          return tList(getAnnotatedType(typeParams[0], context))
        }
      }
      return lookupTypeAliasAndRemoveForAllAndPredicateTypes(typeNode, name, context)
    case 'TSParenthesizedType':
      return getAnnotatedType(typeNode.typeAnnotation, context)
    default:
      return getBasicType(typeNode, context)
  }
}

/**
 * Converts array of function parameters into array of types.
 */
function getParamTypes(params: (tsEs.Identifier | tsEs.RestElement)[], context: Context): Type[] {
  return params.map(param => getTypeAnnotationType(param.typeAnnotation, context))
}

/**
 * Converts node type to basic type, adding errors to context if disallowed/unknown types are used.
 * If errors are found, returns the "any" type to prevent throwing of further errors.
 */
function getBasicType(node: tsEs.TSKeywordType, context: Context) {
  const basicType = typeAnnotationKeywordToBasicTypeMap[node.type] ?? 'unknown'
  if (
    disallowedTypes.includes(basicType as TSDisallowedTypes) ||
    (context.chapter === 1 && basicType === 'null')
  ) {
    context.errors.push(new TypeNotAllowedError(node, basicType))
    return tAny
  }
  return tPrimitive(basicType as PrimitiveType | TSAllowedTypes)
}

/**
 * Wrapper function for lookupType that removes ForAll and Predicate types,
 * since they are not used in the type error checker.
 */
function lookupTypeAndRemoveForAllAndPredicateTypes(name: string): Type | undefined {
  const type = lookupType(name, env)
  if (!type) {
    return undefined
  }
  if (type.kind === 'forall') {
    // Skip typecheck as function has variable number of arguments;
    // this only occurs for certain prelude functions
    // TODO: Add support for ForAll type to type error checker
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
 * Wrapper function for lookupTypeAlias that removes forall and predicate types.
 * An error is thrown for predicate types as type aliases should not ever be predicate types.
 * For forall types, the given type arguments are substituted into the poly type,
 * and the resulting type is returned.
 */
function lookupTypeAliasAndRemoveForAllAndPredicateTypes(
  typeNode: tsEs.TSTypeReference,
  name: string,
  context: Context
): Type {
  const type = lookupTypeAlias(name, env)
  if (!type) {
    context.errors.push(new TypeNotFoundError(typeNode, name))
    return tAny
  }
  if (type.kind === 'predicate') {
    throw new TypecheckError(typeNode, 'Type alias should not be predicate type')
  }
  if (type.kind === 'forall') {
    if (!type.typeParams) {
      throw new TypecheckError(typeNode, 'Generic type aliases must have type parameters')
    }
    if (
      !typeNode.typeParameters ||
      typeNode.typeParameters.params.length !== type.typeParams.length
    ) {
      context.errors.push(
        new InvalidNumberOfTypeArgumentsForGenericTypeError(typeNode, name, type.typeParams.length)
      )
      return tAny
    }
    // Clone type to prevent modifying generic type saved in type env
    let polyType = cloneDeep(type.polyType)
    const typesToSub = typeNode.typeParameters.params
    for (let i = 0; i < type.typeParams.length; i++) {
      const typeToSub = typesToSub[i]
      if (typeToSub.type === 'TSTypeParameter') {
        throw new TypecheckError(typeNode, 'Type argument should not be type parameter')
      }
      polyType = substituteVariableTypes(
        polyType,
        type.typeParams[i],
        getAnnotatedType(typeToSub, context)
      )
    }
    return polyType
  }
  if (typeNode.typeParameters !== undefined && type.kind !== 'variable') {
    context.errors.push(new TypeNotGenericError(typeNode, name))
    return tAny
  }
  return type
}

/**
 * Recurses through the given type and returns a new type
 * with all variable types that match the given type variable substituted with the type to substitute.
 */
function substituteVariableTypes(type: Type, typeVar: Variable, typeToSub: Type): Type {
  switch (type.kind) {
    case 'primitive':
    case 'literal':
      return type
    case 'variable':
      if (type.name === typeVar.name) {
        return typeToSub
      }
      if (type.typeArgs) {
        for (let i = 0; i < type.typeArgs.length; i++) {
          if (isEqual(type.typeArgs[i], typeVar)) {
            type.typeArgs[i] = typeToSub
          }
        }
      }
      return type
    case 'function':
      const types = type.parameterTypes.map(param =>
        substituteVariableTypes(param, typeVar, typeToSub)
      )
      types.push(substituteVariableTypes(type.returnType, typeVar, typeToSub))
      return tFunc(...types)
    case 'union':
      return tUnion(...type.types.map(type => substituteVariableTypes(type, typeVar, typeToSub)))
    case 'pair':
      return tPair(
        substituteVariableTypes(type.headType, typeVar, typeToSub),
        substituteVariableTypes(type.tailType, typeVar, typeToSub)
      )
    case 'list':
      return tList(
        substituteVariableTypes(type.elementType, typeVar, typeToSub),
        type.typeAsPair && (substituteVariableTypes(type.typeAsPair, typeVar, typeToSub) as Pair)
      )
    case 'array':
      return tArray(substituteVariableTypes(type.elementType, typeVar, typeToSub))
    default:
      return type
  }
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
    } else {
      if (!containsType(mergedTypes, currType)) {
        mergedTypes.push(currType)
      }
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
    if (!hasTypeMismatchErrors(typeToCheck, type)) {
      return true
    }
  }
  return false
}

/**
 * Traverses through the program and removes all TS-related nodes, returning the result.
 */
function removeTSNodes(node: tsEs.Node | undefined | null): any {
  if (node === undefined || node === null) {
    return node
  }
  const type = node.type
  switch (type) {
    case 'Literal':
    case 'Identifier': {
      return node
    }
    case 'Program':
    case 'BlockStatement': {
      const newBody: tsEs.Statement[] = []
      node.body.forEach(stmt => {
        const type = stmt.type
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
      node.alternate = removeTSNodes(node.alternate)
      return node
    }
    case 'UnaryExpression':
    case 'RestElement':
    case 'SpreadElement':
    case 'ReturnStatement': {
      node.argument = removeTSNodes(node.argument)
      return node
    }
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AssignmentExpression': {
      node.left = removeTSNodes(node.left)
      node.right = removeTSNodes(node.right)
      return node
    }
    case 'ArrowFunctionExpression':
    case 'FunctionDeclaration':
      node.body = removeTSNodes(node.body)
      return node
    case 'VariableDeclaration': {
      node.declarations[0].init = removeTSNodes(node.declarations[0].init)
      return node
    }
    case 'CallExpression': {
      node.arguments = node.arguments.map(removeTSNodes)
      return node
    }
    case 'ArrayExpression':
      // Casting is safe here as Source disallows use of spread elements and holes in arrays
      node.elements = node.elements.map(removeTSNodes)
      return node
    case 'MemberExpression':
      node.property = removeTSNodes(node.property)
      node.object = removeTSNodes(node.object)
      return node
    case 'WhileStatement': {
      node.test = removeTSNodes(node.test)
      node.body = removeTSNodes(node.body)
      return node
    }
    case 'ForStatement': {
      node.init = removeTSNodes(node.init)
      node.test = removeTSNodes(node.test)
      node.update = removeTSNodes(node.update)
      node.body = removeTSNodes(node.body)
      return node
    }
    case 'TSAsExpression':
      // Remove wrapper node
      return removeTSNodes(node.expression)
    default:
      // Remove all other TS nodes
      return type.startsWith('TS') ? undefined : node
  }
}
