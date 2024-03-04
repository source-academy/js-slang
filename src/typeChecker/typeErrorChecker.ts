import { parse as babelParse } from '@babel/parser'
import * as es from 'estree'
import { cloneDeep, isEqual } from 'lodash'

import { ModuleNotFoundError } from '../errors/moduleErrors'
import {
  ConstNotAssignableTypeError,
  DuplicateTypeAliasError,
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
import { parseTreeTypesPrelude } from './parseTreeTypes.prelude'
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
  tStream,
  tString,
  tUndef,
  tUnion,
  tVar,
  tVoid,
  typeAnnotationKeywordToBasicTypeMap
} from './utils'

// Context and type environment are saved as global variables so that they are not passed between functions excessively
let context: Context = {} as Context
let env: TypeEnvironment = []

/**
 * Entry function for type error checker.
 * Checks program for type errors, and returns the program with all TS-related nodes removed.
 */
export function checkForTypeErrors(program: tsEs.Program, inputContext: Context): es.Program {
  // Set context as global variable
  context = inputContext
  // Deep copy type environment to avoid modifying type environment in the context,
  // which might affect the type inference checker
  env = cloneDeep(context.typeEnvironment)
  // Override predeclared function types
  for (const [name, type] of getTypeOverrides(context.chapter)) {
    setType(name, type, env)
  }
  if (context.chapter >= 4) {
    // Add parse tree types to type environment
    const source4Types = babelParse(parseTreeTypesPrelude, {
      sourceType: 'module',
      plugins: ['typescript', 'estree']
    }).program as unknown as tsEs.Program
    typeCheckAndReturnType(source4Types)
  }
  try {
    typeCheckAndReturnType(program)
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
  context = {} as Context
  env = []
  return removeTSNodes(program)
}

/**
 * Recurses through the given node to check for any type errors,
 * then returns the node's inferred/declared type.
 * Any errors found are added to the context.
 */
function typeCheckAndReturnType(node: tsEs.Node): Type {
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
    case 'TemplateLiteral': {
      // Quasis array should only have one element as
      // string interpolation is not allowed in Source
      return tPrimitive('string', node.quasis[0].value.raw)
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
        handleImportDeclarations(node)
      }

      // Add all declarations in the current scope to the environment first
      addTypeDeclarationsToEnvironment(node)

      // Check all statements in program/block body
      for (const stmt of node.body) {
        if (stmt.type === 'IfStatement' || stmt.type === 'ReturnStatement') {
          returnType = typeCheckAndReturnType(stmt)
          if (stmt.type === 'ReturnStatement') {
            // If multiple return statements are present, only take the first type
            break
          }
        } else {
          typeCheckAndReturnType(stmt)
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
      return typeCheckAndReturnType(node.expression)
    }
    case 'ConditionalExpression':
    case 'IfStatement': {
      // Typecheck predicate against boolean
      const predicateType = typeCheckAndReturnType(node.test)
      checkForTypeMismatch(node, predicateType, tBool)

      // Return type is union of consequent and alternate type
      const consType = typeCheckAndReturnType(node.consequent)
      const altType = node.alternate ? typeCheckAndReturnType(node.alternate) : tUndef
      return mergeTypes(node, consType, altType)
    }
    case 'UnaryExpression': {
      const argType = typeCheckAndReturnType(node.argument)
      const operator = node.operator
      switch (operator) {
        case '-':
          // Typecheck against number
          checkForTypeMismatch(node, argType, tNumber)
          return tNumber
        case '!':
          // Typecheck against boolean
          checkForTypeMismatch(node, argType, tBool)
          return tBool
        case 'typeof':
          // No checking needed, typeof operation can be used on any type
          return tString
        default:
          throw new TypecheckError(node, 'Unknown operator')
      }
    }
    case 'BinaryExpression': {
      return typeCheckAndReturnBinaryExpressionType(node)
    }
    case 'LogicalExpression': {
      // Typecheck left type against boolean
      const leftType = typeCheckAndReturnType(node.left)
      checkForTypeMismatch(node, leftType, tBool)

      // Return type is union of boolean and right type
      const rightType = typeCheckAndReturnType(node.right)
      return mergeTypes(node, tBool, rightType)
    }
    case 'ArrowFunctionExpression': {
      return typeCheckAndReturnArrowFunctionType(node)
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
      const expectedReturnType = getTypeAnnotationType(node.returnType)

      // If the function has variable number of arguments, set function type as any
      // TODO: Add support for variable number of function arguments
      const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
      if (hasVarArgs) {
        setType(fnName, tAny, env)
        return tUndef
      }

      const types = getParamTypes(params)
      // Return type will always be last item in types array
      types.push(expectedReturnType)
      const fnType = tFunc(...types)

      // Typecheck function body, creating new environment to store arg types, return type and function type
      pushEnv(env)
      params.forEach((param: tsEs.Identifier) => {
        setType(param.name, getTypeAnnotationType(param.typeAnnotation), env)
      })
      // Set unique identifier so that typechecking can be carried out for return statements
      setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
      setType(fnName, fnType, env)
      const actualReturnType = typeCheckAndReturnType(node.body)
      env.pop()

      if (
        isEqual(actualReturnType, tVoid) &&
        !isEqual(expectedReturnType, tAny) &&
        !isEqual(expectedReturnType, tVoid)
      ) {
        // Type error where function does not return anything when it should
        context.errors.push(new FunctionShouldHaveReturnValueError(node))
      } else {
        checkForTypeMismatch(node, actualReturnType, expectedReturnType)
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
          getTypeAnnotationType(id.typeAnnotation)
        : getTypeAnnotationType(id.typeAnnotation)
      const initType = typeCheckAndReturnType(init)
      checkForTypeMismatch(node, initType, expectedType)

      // Save variable type and decl kind in type env
      setType(id.name, expectedType, env)
      setDeclKind(id.name, node.kind, env)
      return tUndef
    }
    case 'CallExpression': {
      const callee = node.callee
      const args = node.arguments
      if (context.chapter >= 2 && callee.type === 'Identifier') {
        // Special functions for Source 2+: list, head, tail, stream
        // The typical way of getting the return type of call expressions is insufficient to type lists,
        // as we need to save the pair representation of the list as well (lists are pairs).
        // head and tail should preserve the pair representation of lists whenever possible.
        // Hence, these 3 functions are handled separately.
        // Streams are treated similarly to lists, except only for Source 3+ and we do not need to store the pair representation.
        const fnName = callee.name
        if (fnName === 'list') {
          if (args.length === 0) {
            return tNull
          }
          // Element type is union of all types of arguments in list
          let elementType = typeCheckAndReturnType(args[0])
          for (let i = 1; i < args.length; i++) {
            elementType = mergeTypes(node, elementType, typeCheckAndReturnType(args[i]))
          }
          // Type the list as a pair, for use when checking for type mismatches against pairs
          let pairType = tPair(typeCheckAndReturnType(args[args.length - 1]), tNull)
          for (let i = args.length - 2; i >= 0; i--) {
            pairType = tPair(typeCheckAndReturnType(args[i]), pairType)
          }
          return tList(elementType, pairType)
        }
        if (fnName === 'head' || fnName === 'tail') {
          if (args.length !== 1) {
            context.errors.push(new InvalidNumberOfArgumentsTypeError(node, 1, args.length))
            return tAny
          }
          const actualType = typeCheckAndReturnType(args[0])
          // Argument should be either a pair or a list
          const expectedType = tUnion(tPair(tAny, tAny), tList(tAny))
          const numErrors = context.errors.length
          checkForTypeMismatch(node, actualType, expectedType)
          if (context.errors.length > numErrors) {
            // If errors were found, return "any" type
            return tAny
          }
          return fnName === 'head' ? getHeadType(node, actualType) : getTailType(node, actualType)
        }
        if (fnName === 'stream' && context.chapter >= 3) {
          if (args.length === 0) {
            return tNull
          }
          // Element type is union of all types of arguments in stream
          let elementType = typeCheckAndReturnType(args[0])
          for (let i = 1; i < args.length; i++) {
            elementType = mergeTypes(node, elementType, typeCheckAndReturnType(args[i]))
          }
          return tStream(elementType)
        }
      }
      const calleeType = typeCheckAndReturnType(callee)
      if (calleeType.kind !== 'function') {
        if (calleeType.kind !== 'primitive' || calleeType.name !== 'any') {
          context.errors.push(new TypeNotCallableError(node, formatTypeString(calleeType)))
        }
        return tAny
      }

      const expectedTypes = calleeType.parameterTypes
      let returnType = calleeType.returnType

      // If any of the arguments is a spread element, skip type checking of arguments
      // TODO: Add support for type checking of call expressions with spread elements
      const hasVarArgs = args.reduce((prev, curr) => prev || curr.type === 'SpreadElement', false)
      if (hasVarArgs) {
        return returnType
      }

      // Check argument types before returning declared return type
      if (args.length !== expectedTypes.length) {
        context.errors.push(
          new InvalidNumberOfArgumentsTypeError(node, expectedTypes.length, args.length)
        )
        return returnType
      }

      for (let i = 0; i < expectedTypes.length; i++) {
        const node = args[i]
        const actualType = typeCheckAndReturnType(node)
        // Get all valid type variable mappings for current argument
        const mappings = getTypeVariableMappings(node, actualType, expectedTypes[i])
        // Apply type variable mappings to subsequent argument types and return type
        for (const mapping of mappings) {
          const typeVar = tVar(mapping[0])
          const typeToSub = mapping[1]
          for (let j = i; j < expectedTypes.length; j++) {
            expectedTypes[j] = substituteVariableTypes(expectedTypes[j], typeVar, typeToSub)
          }
          returnType = substituteVariableTypes(returnType, typeVar, typeToSub)
        }
        // Typecheck current argument
        checkForTypeMismatch(node, actualType, expectedTypes[i])
      }
      return returnType
    }
    case 'AssignmentExpression':
      const expectedType = typeCheckAndReturnType(node.left)
      const actualType = typeCheckAndReturnType(node.right)

      if (node.left.type === 'Identifier' && lookupDeclKind(node.left.name, env) === 'const') {
        context.errors.push(new ConstNotAssignableTypeError(node, node.left.name))
      }
      checkForTypeMismatch(node, actualType, expectedType)
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
      const elementTypes = elements.map(elem => typeCheckAndReturnType(elem))
      return tArray(mergeTypes(node, ...elementTypes))
    case 'MemberExpression':
      const indexType = typeCheckAndReturnType(node.property)
      const objectType = typeCheckAndReturnType(node.object)
      // Typecheck index against number
      if (hasTypeMismatchErrors(node, indexType, tNumber)) {
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
          const argumentType = typeCheckAndReturnType(node.argument)
          checkForTypeMismatch(node, argumentType, expectedType)
          return expectedType
        } else {
          return typeCheckAndReturnType(node.argument)
        }
      }
    }
    case 'WhileStatement': {
      // Typecheck predicate against boolean
      const testType = typeCheckAndReturnType(node.test)
      checkForTypeMismatch(node, testType, tBool)
      return typeCheckAndReturnType(node.body)
    }
    case 'ForStatement': {
      // Add new environment so that new variable declared in init node can be isolated to within for statement only
      pushEnv(env)
      if (node.init) {
        typeCheckAndReturnType(node.init)
      }
      if (node.test) {
        // Typecheck predicate against boolean
        const testType = typeCheckAndReturnType(node.test)
        checkForTypeMismatch(node, testType, tBool)
      }
      if (node.update) {
        typeCheckAndReturnType(node.update)
      }
      const bodyType = typeCheckAndReturnType(node.body)
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
      const originalType = typeCheckAndReturnType(node.expression)
      const typeToCastTo = getTypeAnnotationType(node)
      const formatAsLiteral =
        typeContainsLiteralType(originalType) || typeContainsLiteralType(typeToCastTo)
      // Type to cast to must have some overlap with original type
      if (hasTypeMismatchErrors(node, typeToCastTo, originalType)) {
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
function handleImportDeclarations(node: tsEs.Program) {
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
function addTypeDeclarationsToEnvironment(node: tsEs.Program | tsEs.BlockStatement) {
  node.body.forEach(bodyNode => {
    switch (bodyNode.type) {
      case 'FunctionDeclaration':
        if (bodyNode.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        // Only identifiers/rest elements are used as function params in Source
        const params = bodyNode.params.filter(
          (param): param is tsEs.Identifier | tsEs.RestElement =>
            param.type === 'Identifier' || param.type === 'RestElement'
        )
        if (params.length !== bodyNode.params.length) {
          throw new TypecheckError(bodyNode, 'Unknown function parameter type')
        }
        const fnName = bodyNode.id.name
        const returnType = getTypeAnnotationType(bodyNode.returnType)

        // If the function has variable number of arguments, set function type as any
        // TODO: Add support for variable number of function arguments
        const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
        if (hasVarArgs) {
          setType(fnName, tAny, env)
          break
        }

        const types = getParamTypes(params)
        // Return type will always be last item in types array
        types.push(returnType)
        const fnType = tFunc(...types)

        // Save function type in type env
        setType(fnName, fnType, env)
        break
      case 'VariableDeclaration':
        if (bodyNode.kind === 'var') {
          throw new TypecheckError(bodyNode, 'Variable declaration using "var" is not allowed')
        }
        if (bodyNode.declarations.length !== 1) {
          throw new TypecheckError(
            bodyNode,
            'Variable declaration should have one and only one declaration'
          )
        }
        if (bodyNode.declarations[0].id.type !== 'Identifier') {
          throw new TypecheckError(bodyNode, 'Variable declaration ID should be an identifier')
        }
        const id = bodyNode.declarations[0].id as tsEs.Identifier
        const expectedType = getTypeAnnotationType(id.typeAnnotation)

        // Save variable type and decl kind in type env
        setType(id.name, expectedType, env)
        setDeclKind(id.name, bodyNode.kind, env)
        break
      case 'TSTypeAliasDeclaration':
        if (node.type === 'BlockStatement') {
          throw new TypecheckError(
            bodyNode,
            'Type alias declarations may only appear at the top level'
          )
        }
        const alias = bodyNode.id.name
        if (Object.values(typeAnnotationKeywordToBasicTypeMap).includes(alias as TSBasicType)) {
          context.errors.push(new TypeAliasNameNotAllowedError(bodyNode, alias))
          break
        }
        if (lookupTypeAlias(alias, env) !== undefined) {
          // Only happens when attempting to declare type aliases that share names with predeclared types (e.g. Pair, List)
          // Declaration of two type aliases with the same name will be caught as syntax error by parser
          context.errors.push(new DuplicateTypeAliasError(bodyNode, alias))
          break
        }

        let type: BindableType = tAny
        if (bodyNode.typeParameters && bodyNode.typeParameters.params.length > 0) {
          const typeParams: Variable[] = []
          // Check validity of type parameters
          pushEnv(env)
          bodyNode.typeParameters.params.forEach(param => {
            if (param.type !== 'TSTypeParameter') {
              throw new TypecheckError(bodyNode, 'Invalid type parameter type')
            }
            const name = param.name
            if (Object.values(typeAnnotationKeywordToBasicTypeMap).includes(name as TSBasicType)) {
              context.errors.push(new TypeParameterNameNotAllowedError(param, name))
              return
            }
            typeParams.push(tVar(name))
          })
          type = tForAll(getTypeAnnotationType(bodyNode), typeParams)
          env.pop()
        } else {
          type = getTypeAnnotationType(bodyNode)
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
function typeCheckAndReturnBinaryExpressionType(node: tsEs.BinaryExpression): Type {
  const leftType = typeCheckAndReturnType(node.left)
  const rightType = typeCheckAndReturnType(node.right)
  const leftTypeString = formatTypeString(leftType)
  const rightTypeString = formatTypeString(rightType)
  const operator = node.operator
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%':
      // Typecheck both sides against number
      checkForTypeMismatch(node, leftType, tNumber)
      checkForTypeMismatch(node, rightType, tNumber)
      // Return type number
      return tNumber
    case '+':
      // Typecheck both sides against number or string
      // However, the case where one side is string and other side is number is not allowed
      if (leftTypeString === 'number' || leftTypeString === 'string') {
        checkForTypeMismatch(node, rightType, leftType)
        // If left type is number or string, return left type
        return leftType
      }
      if (rightTypeString === 'number' || rightTypeString === 'string') {
        checkForTypeMismatch(node, leftType, rightType)
        // If left type is not number or string but right type is number or string, return right type
        return rightType
      }

      checkForTypeMismatch(node, leftType, tUnion(tNumber, tString))
      checkForTypeMismatch(node, rightType, tUnion(tNumber, tString))
      // Return type is number | string if both left and right are neither number nor string
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
      // Typecheck both sides against number or string
      // However, case where one side is string and other side is number is not allowed
      if (leftTypeString === 'number' || leftTypeString === 'string') {
        checkForTypeMismatch(node, rightType, leftType)
        return tBool
      }
      if (rightTypeString === 'number' || rightTypeString === 'string') {
        checkForTypeMismatch(node, leftType, rightType)
        return tBool
      }

      checkForTypeMismatch(node, leftType, tUnion(tNumber, tString))
      checkForTypeMismatch(node, rightType, tUnion(tNumber, tString))
      // Return type boolean
      return tBool
    default:
      throw new TypecheckError(node, 'Unknown operator')
  }
}

/**
 * Typechecks the body of an arrow function, adding any type errors to context if necessary.
 * Then, returns the inferred/declared type of the function.
 */
function typeCheckAndReturnArrowFunctionType(node: tsEs.ArrowFunctionExpression): Type {
  // Only identifiers/rest elements are used as function params in Source
  const params = node.params.filter(
    (param): param is tsEs.Identifier | tsEs.RestElement =>
      param.type === 'Identifier' || param.type === 'RestElement'
  )
  if (params.length !== node.params.length) {
    throw new TypecheckError(node, 'Unknown function parameter type')
  }
  const expectedReturnType = getTypeAnnotationType(node.returnType)

  // If the function has variable number of arguments, set function type as any
  // TODO: Add support for variable number of function arguments
  const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
  if (hasVarArgs) {
    return tAny
  }

  // Typecheck function body, creating new environment to store arg types and return type
  pushEnv(env)
  params.forEach((param: tsEs.Identifier) => {
    setType(param.name, getTypeAnnotationType(param.typeAnnotation), env)
  })
  // Set unique identifier so that typechecking can be carried out for return statements
  setType(RETURN_TYPE_IDENTIFIER, expectedReturnType, env)
  const actualReturnType = typeCheckAndReturnType(node.body)
  env.pop()

  if (
    isEqual(actualReturnType, tVoid) &&
    !isEqual(expectedReturnType, tAny) &&
    !isEqual(expectedReturnType, tVoid)
  ) {
    // Type error where function does not return anything when it should
    context.errors.push(new FunctionShouldHaveReturnValueError(node))
  } else {
    checkForTypeMismatch(node, actualReturnType, expectedReturnType)
  }

  const types = getParamTypes(params)
  // Return type will always be last item in types array
  types.push(node.returnType ? expectedReturnType : actualReturnType)
  return tFunc(...types)
}

/**
 * Recurses through the two given types and returns an array of tuples
 * that map type variable names to the type to substitute.
 */
function getTypeVariableMappings(
  node: tsEs.Node,
  actualType: Type,
  expectedType: Type
): [string, Type][] {
  // If type variable mapping is found, terminate early
  if (expectedType.kind === 'variable') {
    return [[expectedType.name, actualType]]
  }
  // If actual type is a type reference, expand type first
  if (actualType.kind === 'variable') {
    actualType = lookupTypeAliasAndRemoveForAllTypes(node, actualType)
  }
  const mappings: [string, Type][] = []
  switch (expectedType.kind) {
    case 'pair':
      if (actualType.kind === 'list') {
        if (actualType.typeAsPair !== undefined) {
          mappings.push(
            ...getTypeVariableMappings(node, actualType.typeAsPair.headType, expectedType.headType)
          )
          mappings.push(
            ...getTypeVariableMappings(node, actualType.typeAsPair.tailType, expectedType.tailType)
          )
        } else {
          mappings.push(
            ...getTypeVariableMappings(node, actualType.elementType, expectedType.headType)
          )
          mappings.push(
            ...getTypeVariableMappings(node, actualType.elementType, expectedType.tailType)
          )
        }
      }
      if (actualType.kind === 'pair') {
        mappings.push(...getTypeVariableMappings(node, actualType.headType, expectedType.headType))
        mappings.push(...getTypeVariableMappings(node, actualType.tailType, expectedType.tailType))
      }
      break
    case 'list':
      if (actualType.kind === 'list') {
        mappings.push(
          ...getTypeVariableMappings(node, actualType.elementType, expectedType.elementType)
        )
      }
      break
    case 'function':
      if (
        actualType.kind === 'function' &&
        actualType.parameterTypes.length === expectedType.parameterTypes.length
      ) {
        for (let i = 0; i < actualType.parameterTypes.length; i++) {
          mappings.push(
            ...getTypeVariableMappings(
              node,
              actualType.parameterTypes[i],
              expectedType.parameterTypes[i]
            )
          )
        }
        mappings.push(
          ...getTypeVariableMappings(node, actualType.returnType, expectedType.returnType)
        )
      }
      break
    default:
      break
  }
  return mappings
}

/**
 * Checks if the actual type matches the expected type.
 * If not, adds type mismatch error to context.
 */
function checkForTypeMismatch(node: tsEs.Node, actualType: Type, expectedType: Type): void {
  const formatAsLiteral =
    typeContainsLiteralType(expectedType) || typeContainsLiteralType(actualType)
  if (hasTypeMismatchErrors(node, actualType, expectedType)) {
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
 * This is necessary to determine whether types should be formatted as
 * literal type or primitive type in error messages.
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
 *
 * @param node Current node being checked
 * @param actualType Type being checked
 * @param expectedType Type the actual type is being checked against
 * @param visitedTypeAliasesForActualType Array that keeps track of previously encountered type aliases
 * for actual type to prevent infinite recursion
 * @param visitedTypeAliasesForExpectedType Array that keeps track of previously encountered type aliases
 * for expected type to prevent infinite recursion
 * @param skipTypeAliasExpansion If true, type aliases are not expanded (e.g. in type alias declarations)
 * @returns true if the actual type and the expected type do not match, false otherwise
 */
function hasTypeMismatchErrors(
  node: tsEs.Node,
  actualType: Type,
  expectedType: Type,
  visitedTypeAliasesForActualType: Variable[] = [],
  visitedTypeAliasesForExpectedType: Variable[] = [],
  skipTypeAliasExpansion: boolean = false
): boolean {
  if (isEqual(actualType, tAny) || isEqual(expectedType, tAny)) {
    // Exit early as "any" is guaranteed not to cause type mismatch errors
    return false
  }
  if (expectedType.kind !== 'variable' && actualType.kind === 'variable') {
    // If the expected type is not a variable type but the actual type is a variable type,
    // Swap the order of the types around
    // This removes the need to check if the actual type is a variable type in all of the switch cases
    return hasTypeMismatchErrors(
      node,
      expectedType,
      actualType,
      visitedTypeAliasesForExpectedType,
      visitedTypeAliasesForActualType,
      skipTypeAliasExpansion
    )
  }
  if (expectedType.kind !== 'union' && actualType.kind === 'union') {
    // If the expected type is not a union type but the actual type is a union type,
    // Check if the expected type matches any of the actual types
    // This removes the need to check if the actual type is a union type in all of the switch cases
    return !containsType(
      node,
      actualType.types,
      expectedType,
      visitedTypeAliasesForActualType,
      visitedTypeAliasesForExpectedType
    )
  }
  switch (expectedType.kind) {
    case 'variable':
      if (actualType.kind === 'variable') {
        // If both are variable types, types match if both name and type arguments match
        if (expectedType.name === actualType.name) {
          if (expectedType.typeArgs === undefined || expectedType.typeArgs.length === 0) {
            return actualType.typeArgs === undefined ? false : actualType.typeArgs.length !== 0
          }
          if (actualType.typeArgs?.length !== expectedType.typeArgs.length) {
            return true
          }
          for (let i = 0; i < expectedType.typeArgs.length; i++) {
            if (
              hasTypeMismatchErrors(
                node,
                actualType.typeArgs[i],
                expectedType.typeArgs[i],
                visitedTypeAliasesForActualType,
                visitedTypeAliasesForExpectedType,
                skipTypeAliasExpansion
              )
            ) {
              return true
            }
          }
          return false
        }
      }
      for (const visitedType of visitedTypeAliasesForExpectedType) {
        if (isEqual(visitedType, expectedType)) {
          // Circular dependency, treat as type mismatch
          return true
        }
      }
      // Skips expansion, treat as type mismatch
      if (skipTypeAliasExpansion) {
        return true
      }
      visitedTypeAliasesForExpectedType.push(expectedType)
      // Expand type and continue typechecking
      const aliasType = lookupTypeAliasAndRemoveForAllTypes(node, expectedType)
      return hasTypeMismatchErrors(
        node,
        actualType,
        aliasType,
        visitedTypeAliasesForActualType,
        visitedTypeAliasesForExpectedType,
        skipTypeAliasExpansion
      )
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
        if (
          hasTypeMismatchErrors(
            node,
            expectedParamTypes[i],
            actualParamTypes[i],
            visitedTypeAliasesForExpectedType,
            visitedTypeAliasesForActualType,
            skipTypeAliasExpansion
          )
        ) {
          return true
        }
      }
      // Check return type
      return hasTypeMismatchErrors(
        node,
        actualType.returnType,
        expectedType.returnType,
        visitedTypeAliasesForActualType,
        visitedTypeAliasesForExpectedType,
        skipTypeAliasExpansion
      )
    case 'union':
      // If actual type is not union type, check if actual type matches one of the expected types
      if (actualType.kind !== 'union') {
        return !containsType(node, expectedType.types, actualType)
      }
      // If both are union types, there are no type errors as long as one of the types match
      for (const type of actualType.types) {
        if (containsType(node, expectedType.types, type)) {
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
          return hasTypeMismatchErrors(
            node,
            actualType.typeAsPair,
            expectedType,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          )
        }
        // Head of pair should match list element type; tail of pair should match list type
        return (
          hasTypeMismatchErrors(
            node,
            actualType.elementType,
            expectedType.headType,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          ) ||
          hasTypeMismatchErrors(
            node,
            actualType,
            expectedType.tailType,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          )
        )
      }
      if (actualType.kind !== 'pair') {
        return true
      }
      return (
        hasTypeMismatchErrors(
          node,
          actualType.headType,
          expectedType.headType,
          visitedTypeAliasesForActualType,
          visitedTypeAliasesForExpectedType,
          skipTypeAliasExpansion
        ) ||
        hasTypeMismatchErrors(
          node,
          actualType.tailType,
          expectedType.tailType,
          visitedTypeAliasesForActualType,
          visitedTypeAliasesForExpectedType,
          skipTypeAliasExpansion
        )
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
          return hasTypeMismatchErrors(
            node,
            actualType,
            expectedType.typeAsPair,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          )
        }
        // Head of pair should match list element type; tail of pair should match list type
        return (
          hasTypeMismatchErrors(
            node,
            actualType.headType,
            expectedType.elementType,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          ) ||
          hasTypeMismatchErrors(
            node,
            actualType.tailType,
            expectedType,
            visitedTypeAliasesForActualType,
            visitedTypeAliasesForExpectedType,
            skipTypeAliasExpansion
          )
        )
      }
      if (actualType.kind !== 'list') {
        return true
      }
      return hasTypeMismatchErrors(
        node,
        actualType.elementType,
        expectedType.elementType,
        visitedTypeAliasesForActualType,
        visitedTypeAliasesForExpectedType,
        skipTypeAliasExpansion
      )
    case 'array':
      if (actualType.kind === 'union') {
        // Special case: number[] | string[] matches with (number | string)[]
        const types = actualType.types.filter((type): type is SArray => type.kind === 'array')
        if (types.length !== actualType.types.length) {
          return true
        }
        const combinedType = types.map(type => type.elementType)
        return hasTypeMismatchErrors(
          node,
          tUnion(...combinedType),
          expectedType.elementType,
          visitedTypeAliasesForActualType,
          visitedTypeAliasesForExpectedType,
          skipTypeAliasExpansion
        )
      }
      if (actualType.kind !== 'array') {
        return true
      }
      return hasTypeMismatchErrors(
        node,
        actualType.elementType,
        expectedType.elementType,
        visitedTypeAliasesForActualType,
        visitedTypeAliasesForExpectedType,
        skipTypeAliasExpansion
      )
    default:
      return true
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
    | undefined
): Type {
  if (!annotationNode) {
    return tAny
  }
  return getAnnotatedType(annotationNode.typeAnnotation)
}

/**
 * Converts type node to its corresponding type representation in Source.
 */
function getAnnotatedType(typeNode: tsEs.TSType): Type {
  switch (typeNode.type) {
    case 'TSFunctionType':
      const params = typeNode.parameters
      // If the function has variable number of arguments, set function type as any
      // TODO: Add support for variable number of function arguments
      const hasVarArgs = params.reduce((prev, curr) => prev || curr.type === 'RestElement', false)
      if (hasVarArgs) {
        return tAny
      }
      const fnTypes = getParamTypes(params)
      // Return type will always be last item in types array
      fnTypes.push(getTypeAnnotationType(typeNode.typeAnnotation))
      return tFunc(...fnTypes)
    case 'TSLiteralType':
      const value = typeNode.literal.value
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new TypecheckError(typeNode, 'Unknown literal type')
      }
      return tLiteral(value)
    case 'TSArrayType':
      return tArray(getAnnotatedType(typeNode.elementType))
    case 'TSUnionType':
      const unionTypes = typeNode.types.map(node => getAnnotatedType(node))
      return mergeTypes(typeNode, ...unionTypes)
    case 'TSIntersectionType':
      throw new TypecheckError(typeNode, 'Intersection types are not allowed')
    case 'TSTypeReference':
      const name = typeNode.typeName.name
      // Save name and type arguments in variable type
      if (typeNode.typeParameters) {
        const typesToSub: Type[] = []
        for (const paramNode of typeNode.typeParameters.params) {
          if (paramNode.type === 'TSTypeParameter') {
            throw new TypecheckError(typeNode, 'Type argument should not be type parameter')
          }
          typesToSub.push(getAnnotatedType(paramNode))
        }
        return tVar(name, typesToSub)
      }
      return tVar(name)
    case 'TSParenthesizedType':
      return getAnnotatedType(typeNode.typeAnnotation)
    default:
      return getBasicType(typeNode)
  }
}

/**
 * Converts an array of function parameters into an array of types.
 */
function getParamTypes(params: (tsEs.Identifier | tsEs.RestElement)[]): Type[] {
  return params.map(param => getTypeAnnotationType(param.typeAnnotation))
}

/**
 * Returns the head type of the input type.
 */
function getHeadType(node: tsEs.Node, type: Type): Type {
  switch (type.kind) {
    case 'pair':
      return type.headType
    case 'list':
      return type.elementType
    case 'union':
      return tUnion(...type.types.map(type => getHeadType(node, type)))
    case 'variable':
      return getHeadType(node, lookupTypeAliasAndRemoveForAllTypes(node, type))
    default:
      return type
  }
}

/**
 * Returns the tail type of the input type.
 */
function getTailType(node: tsEs.Node, type: Type): Type {
  switch (type.kind) {
    case 'pair':
      return type.tailType
    case 'list':
      return tList(
        type.elementType,
        type.typeAsPair && type.typeAsPair.tailType.kind === 'pair'
          ? type.typeAsPair.tailType
          : undefined
      )
    case 'union':
      return tUnion(...type.types.map(type => getTailType(node, type)))
    case 'variable':
      return getTailType(node, lookupTypeAliasAndRemoveForAllTypes(node, type))
    default:
      return type
  }
}

/**
 * Converts node type to basic type, adding errors to context if disallowed/unknown types are used.
 * If errors are found, returns the "any" type to prevent throwing of further errors.
 */
function getBasicType(node: tsEs.TSKeywordType) {
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
 * Wrapper function for lookupTypeAlias that removes forall and predicate types.
 * Predicate types are substituted with the function type that takes in 1 argument and returns a boolean.
 * For forall types, the poly type is returned.
 */
function lookupTypeAndRemoveForAllAndPredicateTypes(name: string): Type | undefined {
  const type = lookupType(name, env)
  if (!type) {
    return undefined
  }
  if (type.kind === 'forall') {
    if (type.polyType.kind !== 'function') {
      // Skip typecheck as function has variable number of arguments;
      // this only occurs for certain prelude functions
      // TODO: Add support for functions with variable number of arguments
      return tAny
    }
    // Clone type so that original type is not modified
    return cloneDeep(type.polyType)
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
function lookupTypeAliasAndRemoveForAllTypes(node: tsEs.Node, varType: Variable): Type {
  // Check if type alias exists
  const aliasType = lookupTypeAlias(varType.name, env)
  if (!aliasType) {
    context.errors.push(new TypeNotFoundError(node, varType.name))
    return tAny
  }
  // If type saved in type environment is not generic,
  // given variable type should not have type arguments
  if (aliasType.kind !== 'forall') {
    if (varType.typeArgs !== undefined && varType.typeArgs.length > 0) {
      context.errors.push(new TypeNotGenericError(node, varType.name))
      return tAny
    }
    return aliasType
  }
  // Check type parameters
  if (aliasType.typeParams === undefined) {
    if (varType.typeArgs !== undefined && varType.typeArgs.length > 0) {
      context.errors.push(new TypeNotGenericError(node, varType.name))
    }
    return tAny
  }
  if (varType.typeArgs?.length !== aliasType.typeParams.length) {
    context.errors.push(
      new InvalidNumberOfTypeArgumentsForGenericTypeError(
        node,
        varType.name,
        aliasType.typeParams.length
      )
    )
    return tAny
  }
  // Clone type to prevent modifying generic type saved in type env
  let polyType = cloneDeep(aliasType.polyType)
  // Substitute all type parameters with type arguments
  for (let i = 0; i < varType.typeArgs.length; i++) {
    polyType = substituteVariableTypes(polyType, aliasType.typeParams[i], varType.typeArgs[i])
  }
  return polyType
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
      if (isEqual(type, typeVar)) {
        return typeToSub
      }
      if (type.typeArgs !== undefined) {
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
 * Type aliases encountered are not expanded as it is sufficient to compare the variable types at name level without expanding them;
 * in fact, expanding type aliases here would lead to type aliases with circular dependencies being incorrectly flagged as not declared.
 */
function mergeTypes(node: tsEs.Node, ...types: Type[]): Type {
  const mergedTypes: Type[] = []
  for (const currType of types) {
    if (isEqual(currType, tAny)) {
      return tAny
    }
    if (currType.kind === 'union') {
      for (const type of currType.types) {
        if (!containsType(node, mergedTypes, type, [], [], true)) {
          mergedTypes.push(type)
        }
      }
    } else {
      if (!containsType(node, mergedTypes, currType, [], [], true)) {
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
function containsType(
  node: tsEs.Node,
  arr: Type[],
  typeToCheck: Type,
  visitedTypeAliasesForTypes: Variable[] = [],
  visitedTypeAliasesForTypeToCheck: Variable[] = [],
  skipTypeAliasExpansion: boolean = false
) {
  for (const type of arr) {
    if (
      !hasTypeMismatchErrors(
        node,
        typeToCheck,
        type,
        visitedTypeAliasesForTypeToCheck,
        visitedTypeAliasesForTypes,
        skipTypeAliasExpansion
      )
    ) {
      return true
    }
  }
  return false
}

/**
 * Traverses through the program and removes all TS-related nodes, returning the result.
 */
export function removeTSNodes(node: tsEs.Node | undefined | null): any {
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
