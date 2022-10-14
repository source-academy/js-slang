import * as es from 'estree'

import { TypeMismatchError } from '../errors/typeErrors'
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

/**
 * Entry function for type checker.
 */
export function checkForTypeErrors(
  program: NodeWithDeclaredTypeAnnotation<es.Program>,
  context: Context
): void {
  const env: TypeEnvironment = context.typeEnvironment
  traverseAndTypeCheck(program, context, env)
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
        // TODO: Handle error
        return
      }
      const types = getParamTypes(node.params as NodeWithDeclaredTypeAnnotation<es.Identifier>[])
      // Return type will always be last item in types array
      types.push(getAnnotatedType(node.returnType))
      const fnType = tFunc(...types)
      // Save function type in type env
      setType(node.id?.name, fnType, env)
      break
    case 'VariableDeclaration': {
      if (node.kind === 'var') {
        // TODO: Handle error
        return
      }
      // TODO: Handle non-identifier instances
      const id = node.declarations[0].id as NodeWithDeclaredTypeAnnotation<es.Identifier>
      const init = node.declarations[0].init!
      if (id.typeAnnotation) {
        const expectedType = getAnnotatedType(id.typeAnnotation)
        checkForTypeMismatch(init, expectedType, context)
        // Save variable type and decl kind in type env
        setType(id.name, expectedType, env)
        setDeclKind(id.name, node.kind, env)
      }
      traverseAndTypeCheck(id, context, env)
      break
    }
    case 'CallExpression': {
      const fnType = lookupType((node.callee as es.Identifier).name, env) as
        | FunctionType
        | undefined
      // TODO: Handle function not found error
      if (fnType) {
        checkParamTypes(fnType.parameterTypes as Primitive[], node.arguments, context)
      }
      break
    }
    default:
      break
  }
}

function checkParamTypes(expected: Primitive[], actual: es.Node[], context: Context) {
  if (expected.length !== actual.length) {
    return
  }
  for (let i = 0; i < expected.length; i++) {
    const expectedType = expected[i]
    const node = actual[i]
    checkForTypeMismatch(node, expectedType, context)
  }
}

/**
 * Recurses through the given node to get the inferred type.
 */
function getInferredType(node: es.Node): Primitive {
  switch (node.type) {
    case 'Literal': {
      const literalVal = node.value
      const typeOfLiteral = typeof literalVal as TypeAnnotationKeyword
      if (Object.values(TypeAnnotationKeyword).includes(typeOfLiteral)) {
        return tPrimitive(typeOfLiteral)
      }
      return tUnknown
    }
    default:
      return tUnknown
  }
}

/**
 * Infers the type of the given node, then checks against the given expected type.
 * If not equal, adds type mismatch error to context.
 */
function checkForTypeMismatch(node: es.Node, expectedType: Primitive, context: Context) {
  const actualType = getInferredType(node)
  if (expectedType != tAny && expectedType != actualType) {
    context.errors.push(new TypeMismatchError(node, actualType.name, expectedType.name))
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
 */
function getAnnotatedType(annotationNode: TypeAnnotationNode | undefined): Primitive {
  if (!annotationNode) {
    return tPrimitive(TypeAnnotationKeyword.ANY)
  }
  return tPrimitive(
    typeAnnotationKeywordMap[annotationNode.typeAnnotation.type] ?? TypeAnnotationKeyword.UNKNOWN
  )
}
