import * as es from 'estree'
import assert from '../assert'
import { isDeclaration } from './typeGuards'

import { recursive } from './walkers'

export function extractIdsFromPattern(pattern: es.Pattern): Set<es.Identifier> {
  const ids = new Set<es.Identifier>()
  recursive(pattern, null, {
    ArrayPattern: ({ elements }: es.ArrayPattern, _state, c) =>
      elements.forEach(elem => {
        if (elem) c(elem, null)
      }),
    AssignmentPattern: (p: es.AssignmentPattern, _state, c) => {
      c(p.left, null)
      c(p.right, null)
    },
    Identifier: (id: es.Identifier) => ids.add(id),
    ObjectPattern: ({ properties }: es.ObjectPattern, _state, c) =>
      properties.forEach(prop => c(prop, null)),
    RestElement: ({ argument }: es.RestElement, _state, c) => c(argument, null)
  })
  return ids
}

type Processors<T> = {
  FunctionDeclaration: (node: es.FunctionDeclaration) => T
  ClassDeclaration: (node: es.ClassDeclaration) => T
  Expression: (node: es.Expression) => T
}

export function processExportDefaultDeclaration<T>(
  node: es.ExportDefaultDeclaration,
  processors: Processors<T>
) {
  if (isDeclaration(node.declaration)) {
    const declaration = node.declaration
    assert(
      declaration.type !== 'VariableDeclaration',
      'ExportDefaultDeclarations cannot have VariableDeclarations'
    )

    if (declaration.type === 'FunctionDeclaration') {
      if (declaration.id) {
        return processors.FunctionDeclaration(declaration)
      }

      return processors.Expression({
        ...declaration,
        type: 'FunctionExpression'
      })
    }

    if (declaration.id) {
      return processors.ClassDeclaration(declaration)
    }

    return processors.Expression({
      ...declaration,
      type: 'ClassExpression'
    })
  }

  return processors.Expression(node.declaration)
}
