import assert from '../assert'
import { isDeclaration } from './typeGuards'
import type * as es from './types'
import { recursive } from './walkers'

export function extractIdsFromPattern(pattern: es.Pattern): Set<es.Identifier> {
  const ids = new Set<es.Identifier>()
  if (pattern.type === 'MemberExpression') return ids

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

export function declarationToExpression(node: es.ClassDeclaration): es.ClassExpression
export function declarationToExpression(node: es.FunctionDeclaration): es.FunctionExpression
export function declarationToExpression({
  type,
  ...node
}: es.FunctionDeclaration | es.ClassDeclaration) {
  return {
    ...node,
    type: type === 'FunctionDeclaration' ? 'FunctionExpression' : 'ClassExpression'
  } as es.FunctionExpression | es.ClassExpression
}

type ExportDefaultProcessors<T> = {
  FunctionDeclaration: (node: es.FunctionDeclarationWithId) => T
  ClassDeclaration: (node: es.ClassDeclarationWithId) => T
  Expression: (node: es.Expression) => T
}

export function processExportDefaultDeclaration<T>(
  node: es.ExportDefaultDeclaration,
  processors: ExportDefaultProcessors<T>
) {
  if (isDeclaration(node.declaration)) {
    const declaration = node.declaration
    assert(
      declaration.type !== 'VariableDeclaration',
      'ExportDefaultDeclarations cannot have VariableDeclarations'
    )

    if (declaration.type === 'FunctionDeclaration') {
      if (declaration.id) {
        return processors.FunctionDeclaration(declaration as es.FunctionDeclarationWithId)
      }

      return processors.Expression({
        ...declaration,
        type: 'FunctionExpression'
      })
    }

    if (declaration.id) {
      return processors.ClassDeclaration(declaration as es.ClassDeclarationWithId)
    }

    return processors.Expression({
      ...declaration,
      type: 'ClassExpression'
    })
  }

  return processors.Expression(node.declaration)
}

type ExportNamedProcessors<T> = {
  withVarDecl: (node: es.VariableDeclaration) => T
  withClass: (node: es.ClassDeclarationWithId) => T
  withFunction: (node: es.FunctionDeclarationWithId) => T
  localExports: (node: es.ExportNamedLocalDeclaration) => T
  withSource: (node: es.ExportNamedDeclarationWithSource) => T
}

export function processExportNamedDeclaration<T>(
  node: es.ExportNamedDeclaration,
  processors: ExportNamedProcessors<T>
) {
  if (node.declaration) {
    switch (node.declaration.type) {
      case 'VariableDeclaration':
        return processors.withVarDecl(node.declaration)
      case 'FunctionDeclaration':
        return processors.withFunction(node.declaration as es.FunctionDeclarationWithId)
      case 'ClassDeclaration':
        return processors.withClass(node.declaration as es.ClassDeclarationWithId)
    }
  } else if (node.source) {
    return processors.withSource(node as es.ExportNamedDeclarationWithSource)
  } else {
    return processors.localExports(node as es.ExportNamedLocalDeclaration)
  }
}
