import es from 'estree'

import { accessExportFunctionName } from '../../stdlib/localImport.prelude'
import {
  createCallExpression,
  createIdentifier,
  createLiteral,
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

export const createImportedNameDeclaration = (
  functionName: string,
  importedName: es.Identifier
): es.VariableDeclaration => {
  const callExpression = createCallExpression(accessExportFunctionName, [
    createIdentifier(functionName),
    createLiteral(importedName.name)
  ])
  const variableDeclarator = createVariableDeclarator(importedName, callExpression)
  return {
    type: 'VariableDeclaration',
    declarations: [variableDeclarator],
    kind: 'const'
  }
}
