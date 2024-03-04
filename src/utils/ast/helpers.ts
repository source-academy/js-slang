import type * as es from 'estree'

import assert from '../assert'
import { isImportDeclaration } from './typeGuards'

/**
 * Filters out all import declarations from a program, and sorts them by
 * the module they import from
 */
export function filterImportDeclarations({
  body
}: es.Program): [
  Record<string, es.ImportDeclaration[]>,
  Exclude<es.Program['body'][0], es.ImportDeclaration>[]
] {
  return body.reduce(
    ([importNodes, otherNodes], node) => {
      if (!isImportDeclaration(node)) return [importNodes, [...otherNodes, node]]

      const moduleName = node.source.value
      assert(
        typeof moduleName === 'string',
        `Expected import declaration to have source of type string, got ${moduleName}`
      )

      if (!(moduleName in importNodes)) {
        importNodes[moduleName] = []
      }

      importNodes[moduleName].push(node)
      return [importNodes, otherNodes]
    },
    [{}, []] as [
      Record<string, es.ImportDeclaration[]>,
      Exclude<es.Program['body'][0], es.ImportDeclaration>[]
    ]
  )
}
