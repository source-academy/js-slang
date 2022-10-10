import * as es from 'estree'

import { TypeMismatchError } from '../errors/typeErrors'
import { Context } from '../types'

type NodeWithTypeAnnotation<T extends es.Node> = TypeAnnotation & T

type TypeAnnotation = {
  typeAnnotation?: TypeAnnotationNode
}

interface TypeAnnotationNode extends es.BaseNode {
  type: 'TSTypeAnnotation'
  typeAnnotation: es.BaseNode
}

const typeAnnotationKeywordMap = {
  TSAnyKeyword: 'any',
  TSBooleanKeyword: 'boolean',
  TSNullKeyword: 'null',
  TSNumberKeyword: 'number',
  TSStringKeyword: 'string',
  TSUndefinedKeyword: 'undefined',
  TSUnknownKeyword: 'unknown',
  TSVoidKeyword: 'void'
}

/**
 * Checks if the given program contains any type errors.
 * @param program program to be type-checked
 * @param context context of evaluation
 */
export function checkForTypeErrors(
  program: NodeWithTypeAnnotation<es.Program>,
  context: Context
): void {
  traverseAndTypeCheck(program, context)
}

/**
 * Recurses through the given node to check for any type errors.
 * Terminates the moment an error is found.
 * @param node node to be type-checked
 * @param context context of evaluation
 */
function traverseAndTypeCheck(node: NodeWithTypeAnnotation<es.Node>, context: Context): void {
  switch (node.type) {
    case 'Program': {
      node.body.forEach(nodeBody => {
        traverseAndTypeCheck(nodeBody, context)
      })
      break
    }
    case 'VariableDeclaration': {
      const id = node.declarations[0].id as NodeWithTypeAnnotation<es.Identifier>
      const init = node.declarations[0].init!
      if (id.typeAnnotation) {
        const expectedType = getAnnotatedType(id.typeAnnotation)
        const actualType = getInferredType(init)
        if (expectedType !== actualType) {
          context.errors.push(new TypeMismatchError(node, actualType, expectedType))
          return
        }
      }
      traverseAndTypeCheck(id, context)
      break
    }
    default:
      break
  }
}

/**
 * Recurses through the given node to get the inferred type
 */
function getInferredType(node: es.Node): string {
  switch (node.type) {
    case 'Literal': {
      return typeof node.value
    }
    default:
      return 'unknown'
  }
}

function getAnnotatedType(annotationNode: TypeAnnotationNode): string {
  return typeAnnotationKeywordMap[annotationNode.typeAnnotation.type] ?? 'unknown'
}
