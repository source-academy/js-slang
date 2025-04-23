import type es from 'estree'

import assert from '../assert'
import { simple } from '../walkers'
import { ArrayMap } from '../dict'
import { isIdentifier, isImportDeclaration, isVariableDeclaration } from './typeGuards'

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

export function getSourceVariableDeclaration(decl: es.VariableDeclaration) {
  assert(
    decl.declarations.length === 1,
    'Variable Declarations in Source should only have 1 declarator!'
  )

  const [declaration] = decl.declarations
  assert(
    isIdentifier(declaration.id),
    'Variable Declarations in Source should be declared using an Identifier!'
  )

  assert(!!declaration.init, 'Variable declarations in Source must be initialized!')

  return {
    id: declaration.id,
    init: declaration.init,
    loc: declaration.loc
  }
}

export const getImportedName = (
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier
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

export const speciferToString = (
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier
) => {
  switch (spec.type) {
    case 'ImportSpecifier': {
      if (spec.imported.name === spec.local.name) {
        return spec.imported.name
      }
      return `${spec.imported.name} as ${spec.local.name}`
    }
    case 'ImportDefaultSpecifier':
      return `default as ${spec.local.name}`
    case 'ExportSpecifier': {
      if (spec.local.name === spec.exported.name) {
        return spec.local.name
      }
      return `${spec.local.name} as ${spec.exported.name}`
    }
  }
}
