import type es from 'estree'

import assert from '../assert'
import { simple } from '../walkers'
import { ArrayMap } from '../dict'
import { isImportDeclaration, isVariableDeclaration } from './typeGuards'

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

export function extractIdsFromPattern(pattern: es.Pattern) {
  const identifiers: es.Identifier[] = []

  simple(pattern, {
    Identifier: (node: es.Identifier) => {
      identifiers.push(node)
    }
  })

  return identifiers
}

export function getIdsFromDeclaration(
  decl: es.Declaration,
  allowNull: true
): (es.Identifier | null)[]
export function getIdsFromDeclaration(decl: es.Declaration, allowNull?: false): es.Identifier[]
export function getIdsFromDeclaration(decl: es.Declaration, allowNull?: boolean) {
  const rawIds = isVariableDeclaration(decl)
    ? decl.declarations.flatMap(({ id }) => extractIdsFromPattern(id))
    : [decl.id]

  if (!allowNull) {
    rawIds.forEach(each => {
      assert(each !== null, 'Encountered a null identifier!')
    })
  }

  return rawIds
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
