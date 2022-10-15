import * as es from 'estree'

import { InvalidNumberOfArguments, UndefinedVariable } from '../errors/errors'
import { FunctionShouldHaveReturnValueError, TypeMismatchError } from '../errors/typeErrors'
import { NoImplicitReturnUndefinedError } from '../parser/rules/noImplicitReturnUndefined'
import { NoVarError } from '../parser/rules/noVar'
import {
  Context,
  FunctionType,
  NodeWithDeclaredTypeAnnotation,
  Primitive,
  Type,
  TypeAnnotationKeyword,
  TypeAnnotationNode,
  TypeEnvironment
} from '../types'
import { TypeError } from './internalTypeErrors'
import {
  lookupType,
  pushEnv,
  setDeclKind,
  setType,
  tAny,
  tFunc,
  tPrimitive,
  tUnknown
} from './utils'

const typeAnnotationKeywordMap = {
  TSAnyKeyword: TypeAnnotationKeyword.ANY,
  TSBooleanKeyword: TypeAnnotationKeyword.BOOLEAN,
  TSNullKeyword: TypeAnnotationKeyword.NULL,
  TSNumberKeyword: TypeAnnotationKeyword.NUMBER,
  TSStringKeyword: TypeAnnotationKeyword.STRING,
  TSUndefinedKeyword: TypeAnnotationKeyword.UNDEFINED,
  TSUnknownKeyword: TypeAnnotationKeyword.UNKNOWN,
  TSVoidKeyword: TypeAnnotationKeyword.VOID
}

// Special name used for saving return type in type environment
const RETURN_TYPE_IDENTIFIER = '//RETURN_TYPE'

/**
 * Entry function for type checker.
 */
export function checkForTypeErrors(
  program: NodeWithDeclaredTypeAnnotation<es.Program>,
  context: Context
): void {
  const env: TypeEnvironment = context.typeEnvironment
  try {
    traverseAndTypeCheck(program, context, env)
  } catch (error) {
    // Catch-all for errors that should not be reached logically
    context.errors.push(error)
  }
}

/**
 * Recurses through the given node to check for any type errors.
 * Any errors found are added to the context.
 */
function traverseAndTypeCheck(
  node: NodeWithDeclaredTypeAnnotation<es.Node>,
  context: Context,
  env: TypeEnvironment
): void {
  switch (node.type) {
    case 'Program':
    case 'BlockStatement': {
      pushEnv(env)
      // Check all statements in program/block body
      node.body.forEach(nodeBody => {
        traverseAndTypeCheck(nodeBody, context, env)
      })
      if (node.type === 'BlockStatement') {
        // Types are saved for programs, but not for blocks
        env.pop()
      }
      break
    }
    case 'ExpressionStatement': {
      // Check expression
      traverseAndTypeCheck(node.expression, context, env)
      break
    }
    case 'FunctionDeclaration':
      if (node.id === null) {
        // Block should not be reached since node.id is only null when function declaration
        // is part of `export default function`, which is not used in source
        throw new TypeError(node, 'Function declaration should have an identifier')
      }
      const params = node.params as NodeWithDeclaredTypeAnnotation<es.Identifier>[]
      const returnType = getAnnotatedType(node.returnType)

      // Type check function body, creating new environment to store arg types/return type
      pushEnv(env)
      params.forEach(param => {
        setType(param.name, getAnnotatedType(param.typeAnnotation), env)
      })
      setType(RETURN_TYPE_IDENTIFIER, returnType, env)
      let hasReturnStmt = false
      // Skipping type check of node.body since it is always a BlockStatement
      node.body.body.forEach(stmt => {
        if (stmt.type === 'ReturnStatement') {
          hasReturnStmt = true
        }
        traverseAndTypeCheck(stmt, context, env)
      })
      // Type error where function does not return anything when it should
      if (
        !hasReturnStmt &&
        returnType.name !== TypeAnnotationKeyword.ANY &&
        returnType.name !== TypeAnnotationKeyword.VOID
      ) {
        context.errors.push(new FunctionShouldHaveReturnValueError(node))
      }
      env.pop()

      const types = getParamTypes(params)
      // Return type will always be last item in types array
      types.push(returnType)
      const fnType = tFunc(...types)
      // Save function type
      setType(node.id.name, fnType, env)
      break
    case 'VariableDeclaration': {
      if (node.kind === 'var') {
        context.errors.push(new NoVarError(node))
        return
      }
      // TODO: Handle non-identifier instances
      const id = node.declarations[0].id as NodeWithDeclaredTypeAnnotation<es.Identifier>
      const init = node.declarations[0].init!
      const expectedType = getAnnotatedType(id.typeAnnotation)
      checkForTypeMismatch(init, expectedType, context, env)
      // Save variable type and decl kind in type env
      setType(id.name, expectedType, env)
      setDeclKind(id.name, node.kind, env)
      break
    }
    case 'CallExpression': {
      const fnName = (node.callee as es.Identifier).name
      const fnType = lookupType(fnName, env) as FunctionType | undefined
      if (fnType) {
        const expectedTypes = fnType.parameterTypes as Primitive[]
        const args = node.arguments
        if (args.length !== expectedTypes.length) {
          context.errors.push(new InvalidNumberOfArguments(node, expectedTypes.length, args.length))
          return
        }
        checkArgTypes(node, expectedTypes, context, env)
      } else {
        context.errors.push(new UndefinedVariable(fnName, node))
      }
      break
    }
    case 'ReturnStatement': {
      if (!node.argument) {
        context.errors.push(new NoImplicitReturnUndefinedError(node))
      } else {
        const expectedType = (lookupType(RETURN_TYPE_IDENTIFIER, env) as Primitive) ?? tAny
        checkForTypeMismatch(node.argument, expectedType, context, env)
        break
      }
    }
    default:
      break
  }
}

/**
 * Recurses through the given node to get the declared type.
 * If the node is a literal, the type is inferred.
 */
function getInferredOrDeclaredType(
  node: es.Node,
  context: Context,
  env: TypeEnvironment
): Primitive {
  switch (node.type) {
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal as TypeAnnotationKeyword
      if (Object.values(TypeAnnotationKeyword).includes(typeOfLiteral)) {
        return tPrimitive(typeOfLiteral)
      }
      return tUnknown
    }
    case 'Identifier': {
      const varName = node.name
      const varType = lookupType(varName, env)
      if (varType) {
        return varType as Primitive
      } else {
        context.errors.push(new UndefinedVariable(varName, node))
        return tUnknown
      }
    }
    default:
      return tUnknown
  }
}

/**
 * Infers the type of the given node, then checks against the given expected type.
 * If not equal, adds type mismatch error to context.
 */
function checkForTypeMismatch(
  node: es.Node,
  expectedType: Primitive,
  context: Context,
  env: TypeEnvironment
) {
  const actualType = getInferredOrDeclaredType(node, context, env)
  if (
    expectedType.name !== TypeAnnotationKeyword.ANY &&
    actualType.name !== TypeAnnotationKeyword.ANY &&
    expectedType.name !== actualType.name
  ) {
    context.errors.push(new TypeMismatchError(node, actualType.name, expectedType.name))
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
    checkForTypeMismatch(node, expectedType, context, env)
  }
}

/**
 * Converts array of function parameters into array of types.
 */
function getParamTypes(params: NodeWithDeclaredTypeAnnotation<es.Identifier>[]): Type[] {
  return params.map(param => getAnnotatedType(param.typeAnnotation))
}

/**
 * Converts type annotation node to its corresponding type representation in Source.
 * If no type annotation exists, returns the "any" type.
 */
function getAnnotatedType(annotationNode: TypeAnnotationNode | undefined): Primitive {
  if (!annotationNode) {
    return tAny
  }
  return tPrimitive(
    typeAnnotationKeywordMap[annotationNode.typeAnnotation.type] ?? TypeAnnotationKeyword.UNKNOWN
  )
}
