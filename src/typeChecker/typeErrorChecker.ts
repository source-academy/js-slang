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
 * Checks if the given program contains any type errors.
 * @param program program to be type-checked
 * @param context context of evaluation
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
 * Terminates the moment an error is found.
 * @param node node to be type-checked
 * @param context context of evaluation
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
      node.body.forEach(nodeBody => {
        traverseAndTypeCheck(nodeBody, context, env)
      })
      if (node.type === 'BlockStatement') {
        // if program, we want to save the types there, so only pop for blocks
        env.pop()
      }
      break
    }
    case 'CallExpression': {
      const fnType = lookupType((node.callee as es.Identifier).name, env) as
        | FunctionType
        | undefined
      if (fnType) {
        checkParamTypes(fnType.parameterTypes as Primitive[], node.arguments, context)
        if (context.errors.length > 0) {
          return
        }
      }
      break
    }
    case 'ExpressionStatement': {
      traverseAndTypeCheck(node.expression, context, env)
      break
    }
    case 'FunctionDeclaration':
      if (node.id === null) {
        return
      }
      const returnType = getAnnotatedType(node.returnType)
      const types = getParamTypes(node.params as NodeWithDeclaredTypeAnnotation<es.Identifier>[])
      types.push(returnType)
      const fnType = tFunc(...types)
      setType(node.id?.name, fnType, env)
      break
    case 'VariableDeclaration': {
      if (node.kind === 'var') {
        return
      }
      const id = node.declarations[0].id as NodeWithDeclaredTypeAnnotation<es.Identifier>
      const init = node.declarations[0].init!
      if (id.typeAnnotation) {
        const expectedType = getAnnotatedType(id.typeAnnotation)
        const actualType = getInferredType(init)
        if (expectedType != tAny && expectedType != actualType) {
          context.errors.push(new TypeMismatchError(node, actualType.name, expectedType.name))
          return
        }
        setType(id.name, expectedType, env)
        setDeclKind(id.name, node.kind, env)
      }
      traverseAndTypeCheck(id, context, env)
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
    const actualType = getInferredType(actual[i])
    if (expectedType != tAny && expectedType != actualType) {
      context.errors.push(new TypeMismatchError(actual[i], actualType.name, expectedType.name))
      return
    }
  }
}

function getParamTypes(params: NodeWithDeclaredTypeAnnotation<es.Identifier>[]): Type[] {
  return params.map(param => getAnnotatedType(param.typeAnnotation))
}

/**
 * Recurses through the given node to get the inferred type
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

function getAnnotatedType(annotationNode: TypeAnnotationNode | undefined): Primitive {
  if (!annotationNode) {
    return tPrimitive(TypeAnnotationKeyword.ANY)
  }
  return tPrimitive(
    typeAnnotationKeywordMap[annotationNode.typeAnnotation.type] ?? TypeAnnotationKeyword.UNKNOWN
  )
}
