import type es from 'estree'

import assert from '../assert'
import { simple } from '../walkers'
import { ArrayMap } from '../dict'
import type { Node } from '../../types'
import { isImportDeclaration } from './typeGuards'

export function getModuleDeclarationSource(
  node: Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
): string {
  assert(
    typeof node.source?.value === 'string',
    `Expected ${node.type} to have a source value of type string, got ${node.source?.value}`
  )
  return node.source.value
}

/**
 * Filters out all import declarations from a program, and sorts them by
 * the module they import from
 */
export function filterImportDeclarations({
  body
}: es.Program): [
  ArrayMap<string, es.ImportDeclaration>,
  Exclude<es.Program['body'][0], es.ImportDeclaration>[]
] {
  return body.reduce(
    ([importNodes, otherNodes], node) => {
      if (!isImportDeclaration(node)) return [importNodes, [...otherNodes, node]]

      const moduleName = getModuleDeclarationSource(node)
      importNodes.add(moduleName, node)
      return [importNodes, otherNodes]
    },
    [new ArrayMap(), []] as [
      ArrayMap<string, es.ImportDeclaration>,
      Exclude<es.Program['body'][0], es.ImportDeclaration>[]
    ]
  )
}

export function mapIdentifiersToNames(ids: es.Identifier[]): string[] {
  return ids.map(({ name }) => name)
}

export function getIdentifiersFromVariableDeclaration(decl: es.VariableDeclaration) {
  function internal(node: es.Pattern): es.Identifier | es.Identifier[] {
    switch (node.type) {
      case 'ArrayPattern':
        return node.elements.flatMap(internal)
      case 'AssignmentPattern':
        return internal(node.left)
      case 'Identifier':
        return node
      case 'MemberExpression':
        throw new Error(
          'Should not get MemberExpressions as part of the id for a VariableDeclarator'
        )
      case 'ObjectPattern':
        return node.properties.flatMap(prop =>
          prop.type === 'RestElement' ? internal(prop) : internal(prop.value)
        )
      case 'RestElement':
        return internal(node.argument)
    }
  }

  return decl.declarations.flatMap(({ id }) => internal(id))
}

export function getDeclaredIdentifiers(
  decl:
    | es.Declaration
    | Exclude<es.ModuleDeclaration, es.ExportAllDeclaration>
    | es.Program
    | es.BlockStatement,
  checkForVarDeclarations?: boolean
): es.Identifier[] {
  if (decl.type === 'Program' || decl.type === 'BlockStatement') {
    const varDecls: es.Identifier[] = []
    if (checkForVarDeclarations) {
      simple(decl, {
        VariableDeclaration(node: es.VariableDeclaration) {
          // just to account for any 'var' declarations
          // which technically are always globally scoped
          if (node.kind !== 'var') return
          getIdentifiersFromVariableDeclaration(node).forEach(identifier =>
            varDecls.push(identifier)
          )
        }
      })
    }

    // Don't recursively find declared identifiers
    return [...varDecls, ...decl.body.flatMap(internal)]
  }

  function internal(decl: Node): es.Identifier[] {
    switch (decl.type) {
      case 'ClassDeclaration':
      case 'FunctionDeclaration':
        // Identifier is only null when part of a export default declaration
        // in which case that node introduces no new identifiers
        return decl.id ? [decl.id] : []
      case 'ExportDefaultDeclaration':
      case 'ExportNamedDeclaration':
        return decl.declaration ? internal(decl.declaration) : []
      case 'ImportDeclaration':
        return decl.specifiers.map(({ local }) => local)
      case 'VariableDeclaration':
        return getIdentifiersFromVariableDeclaration(decl)
      default:
        return []
    }
  }

  return internal(decl)
}

export const getImportedName = (
  spec:
    | Exclude<es.ImportDeclaration['specifiers'][number], es.ImportNamespaceSpecifier>
    | es.ExportSpecifier
) => {
  switch (spec.type) {
    case 'ImportDefaultSpecifier':
      return 'default'
    case 'ImportSpecifier':
      return spec.imported.name
    case 'ExportSpecifier':
      return spec.local.name
  }
}
