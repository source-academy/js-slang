import type es from 'estree'

import assert from '../assert'
import { ArrayMap } from '../dict'
import {
  isDeclaration,
  isIdentifier,
  isImportDeclaration,
  isVariableDeclaration
} from './typeGuards'

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
 * Extracts all the identifiers being declared by a VariableDeclaration
 */
export function extractDeclarations(decl: es.VariableDeclaration) {
  function recurser(pattern: es.Pattern): es.Identifier[] {
    switch (pattern.type) {
      case 'ArrayPattern':
        return pattern.elements.flatMap(recurser)
      case 'AssignmentPattern':
        return recurser(pattern.left)
      case 'Identifier':
        return [pattern]
      case 'ObjectPattern':
        return pattern.properties.flatMap(prop => {
          if (prop.type === 'Property') {
            return recurser(prop.value)
          }
          return recurser(prop)
        })
      case 'RestElement':
        return recurser(pattern.argument)
      default:
        throw new Error(`Should not encounter a ${pattern.type} in ${extractDeclarations.name}`)
    }
  }

  return decl.declarations.flatMap(({ id }) => recurser(id))
}

export function getIdsFromDeclaration(
  decl: es.Declaration,
  allowNull: true
): (es.Identifier | null)[]
export function getIdsFromDeclaration(decl: es.Declaration, allowNull?: false): es.Identifier[]
export function getIdsFromDeclaration(decl: es.Declaration, allowNull?: boolean) {
  const rawIds = isVariableDeclaration(decl) ? extractDeclarations(decl) : [decl.id]

  if (!allowNull) {
    rawIds.forEach(each => {
      assert(each !== null, 'Encountered a null identifier!')
    })
  }

  return rawIds
}

/**
 * Since Variable declarations in Source programs must be initialized and are guaranteed to only
 * have 1 declarator, this function unwraps variable declarations and its single declarator
 * into its id and init
 */
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

type BlockBody = (es.Program | es.BlockStatement)['body'][number]
type BlocKBodyWithoutDeclarations = Exclude<BlockBody, es.Declaration>

/**
 * Returns true if the array of statements doesn't contain any declarations
 */
export function hasNoDeclarations(stmt: BlockBody[]): stmt is BlocKBodyWithoutDeclarations[] {
  return !stmt.some(isDeclaration)
}

type BlockBodyWithoutImports = Exclude<BlockBody, es.ImportDeclaration>
/**
 * Returns true if the array of statements doesn't contain any import declarations
 */
export function hasNoImportDeclarations(stmt: BlockBody[]): stmt is BlockBodyWithoutImports[] {
  return !stmt.some(isImportDeclaration)
}

/**
 * Filters out all import declarations from a program, and sorts them by
 * the module they import from
 */
export function filterImportDeclarations({
  body
}: es.Program): [ArrayMap<string, es.ImportDeclaration>, BlockBodyWithoutImports[]] {
  return body.reduce<[ArrayMap<string, es.ImportDeclaration>, BlockBodyWithoutImports[]]>(
    ([importNodes, otherNodes], node) => {
      if (!isImportDeclaration(node)) return [importNodes, [...otherNodes, node]]

      const moduleName = getModuleDeclarationSource(node)
      importNodes.add(moduleName, node)
      return [importNodes, otherNodes]
    },
    [new ArrayMap(), []]
  )
}
