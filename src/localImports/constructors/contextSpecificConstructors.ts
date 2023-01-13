import es from 'estree'

import { accessExportFunctionName } from '../../stdlib/localImport.prelude'
import {
  createCallExpression,
  createIdentifier,
  createLiteral,
  createVariableDeclaration,
  createVariableDeclarator
} from './baseConstructors'

/**
 * Constructs a call to the `pair` function.
 *
 * @param head The head of the pair.
 * @param tail The tail of the pair.
 */
export const createPairCallExpression = (
  head: es.Expression | es.SpreadElement,
  tail: es.Expression | es.SpreadElement
): es.SimpleCallExpression => {
  return createCallExpression('pair', [head, tail])
}

/**
 * Constructs a call to the `list` function.
 *
 * @param listElements The elements of the list.
 */
export const createListCallExpression = (
  listElements: Array<es.Expression | es.SpreadElement>
): es.SimpleCallExpression => {
  return createCallExpression('list', listElements)
}

/**
 * Constructs the AST equivalent of:
 * const importedName = __access_export__(functionName, lookupName);
 *
 * @param functionName The name of the transformed function declaration to import from.
 * @param importedName The name of the import.
 * @param lookupName   The name to lookup in the transformed function declaration.
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

/**
 * Constructs the AST equivalent of:
 * const variableName = functionName(...functionArgs);
 *
 * @param functionName The name of the transformed function declaration to invoke.
 * @param variableName The name of the variable holding the result of the function invocation.
 * @param functionArgs The arguments to be passed when invoking the function.
 */
export const createInvokedFunctionResultVariableDeclaration = (
  functionName: string,
  variableName: string,
  functionArgs: es.Identifier[]
): es.VariableDeclaration => {
  const callExpression = createCallExpression(functionName, functionArgs)
  const variableDeclarator = createVariableDeclarator(
    createIdentifier(variableName),
    callExpression
  )
  return createVariableDeclaration([variableDeclarator], 'const')
}

/**
 * Clones the import specifier, but only the properties
 * that are part of its ESTree AST type. This is useful for
 * stripping out extraneous information on the import
 * specifier AST nodes (such as the location information
 * that the Acorn parser adds).
 *
 * @param importSpecifier The import specifier to be cloned.
 */
export const cloneAndStripImportSpecifier = (
  importSpecifier: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier
): es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier => {
  switch (importSpecifier.type) {
    case 'ImportSpecifier':
      return {
        type: 'ImportSpecifier',
        local: createIdentifier(importSpecifier.local.name),
        imported: createIdentifier(importSpecifier.imported.name)
      }
    case 'ImportDefaultSpecifier':
      return {
        type: 'ImportDefaultSpecifier',
        local: createIdentifier(importSpecifier.local.name)
      }
    case 'ImportNamespaceSpecifier':
      return {
        type: 'ImportNamespaceSpecifier',
        local: createIdentifier(importSpecifier.local.name)
      }
  }
}
