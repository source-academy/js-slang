import es from 'estree'

import { accessExportFunctionName } from '../../stdlib/localImport.prelude'
import {
  createCallExpression,
  createIdentifier,
  createLiteral,
  createVariableDeclaration,
  createVariableDeclarator
} from './baseConstructors'

export const createPairCallExpression = (
  head: es.Expression | es.SpreadElement,
  tail: es.Expression | es.SpreadElement
): es.SimpleCallExpression => {
  return createCallExpression('pair', [head, tail])
}

export const createListCallExpression = (
  listElements: Array<es.Expression | es.SpreadElement>
): es.SimpleCallExpression => {
  return createCallExpression('list', listElements)
}

/**
 * Constructs the AST equivalent of:
 * const importedName = __access_export__(functionName, lookupName);
 *
 * @param functionName The name of the transformed IIFE to import from.
 * @param importedName The name of the import.
 * @param lookupName   The name to lookup in the transformed IIFE.
 */
export const createImportedNameDeclaration = (
  functionName: string,
  importedName: es.Identifier,
  lookupName: string
): es.VariableDeclaration => {
  const callExpression = createCallExpression(accessExportFunctionName, [
    createIdentifier(functionName),
    createLiteral(lookupName)
  ])
  const variableDeclarator = createVariableDeclarator(importedName, callExpression)
  return createVariableDeclaration([variableDeclarator], 'const')
}
