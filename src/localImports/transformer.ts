import es from 'estree'

import { ancestor } from '../utils/walkers'
import {
  createFunctionDeclaration,
  createIdentifier,
  createListCallExpression,
  createLiteral,
  createPairCallExpression,
  createReturnStatement
} from './constructors'
import { isDeclaration, isDirective, isModuleDeclaration, isStatement } from './typeGuards'

const getIdentifier = (node: es.Declaration): es.Identifier | null => {
  switch (node.type) {
    case 'FunctionDeclaration':
      if (node.id === null) {
        throw new Error(
          'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
        )
      }
      return node.id
    case 'VariableDeclaration':
      const id = node.declarations[0].id
      // In Source, variable names are Identifiers.
      if (id.type !== 'Identifier') {
        throw new Error(`Expected variable name to be an Identifier, but was ${id.type} instead.`)
      }
      return id
    case 'ClassDeclaration':
      throw new Error('Exporting of class is not supported.')
  }
}

const getExportedNames = (nodes: es.ModuleDeclaration[]): Record<string, string> => {
  const exportedNameToIdentifierMap: Record<string, string> = {}
  nodes.forEach((node: es.ModuleDeclaration): void => {
    // Only ExportNamedDeclaration nodes specify exported names.
    if (node.type !== 'ExportNamedDeclaration') {
      return
    }
    if (node.declaration) {
      const exportedName = getIdentifier(node.declaration)?.name
      if (exportedName === undefined) {
        return
      }
      // When an ExportNamedDeclaration node has a declaration, the
      // identifier is the same as the exported name (i.e., no renaming).
      const identifier = exportedName
      exportedNameToIdentifierMap[exportedName] = identifier
    } else {
      // When an ExportNamedDeclaration node does not have a declaration,
      // it contains a list of names to export, i.e., export { a, b as c, d };.
      // Exported names can be renamed using the 'as' keyword. As such, the
      // exported names and their corresponding identifiers might be different.
      node.specifiers.forEach((node: es.ExportSpecifier): void => {
        const exportedName = node.exported.name
        const identifier = node.local.name
        exportedNameToIdentifierMap[exportedName] = identifier
      })
    }
  })
  return exportedNameToIdentifierMap
}

const getDefaultExportExpression = (nodes: es.ModuleDeclaration[]): es.Expression | null => {
  let defaultExport: es.Expression | null = null
  nodes.forEach((node: es.ModuleDeclaration): void => {
    // Only ExportDefaultDeclaration nodes specify the default export.
    if (node.type !== 'ExportDefaultDeclaration') {
      return
    }
    if (defaultExport !== null) {
      // This should never occur because multiple default exports should have
      // been caught by the Acorn parser when parsing into an AST.
      throw new Error('Encountered multiple default exports!')
    }
    if (isDeclaration(node.declaration)) {
      const identifier = getIdentifier(node.declaration)
      if (identifier === null) {
        return
      }
      // When an ExportDefaultDeclaration node has a declaration, the
      // identifier is the same as the exported name (i.e., no renaming).
      defaultExport = identifier
    } else {
      // When an ExportDefaultDeclaration node does not have a declaration,
      // it has an expression.
      defaultExport = node.declaration
    }
  })
  return defaultExport
}

const createReturnListArguments = (
  exportedNameToIdentifierMap: Record<string, string>
): Array<es.Expression | es.SpreadElement> => {
  return Object.entries(exportedNameToIdentifierMap).map(
    ([exportedName, identifier]: [string, string]) => {
      const head = createLiteral(exportedName)
      const tail = createIdentifier(identifier)
      return createPairCallExpression(head, tail)
    }
  )
}

const removeDirectives = (
  nodes: Array<es.Directive | es.Statement | es.ModuleDeclaration>
): Array<es.Statement | es.ModuleDeclaration> => {
  return nodes.filter(
    (
      node: es.Directive | es.Statement | es.ModuleDeclaration
    ): node is es.Statement | es.ModuleDeclaration => !isDirective(node)
  )
}

const removeModuleDeclarations = (
  nodes: Array<es.Statement | es.ModuleDeclaration>
): es.Statement[] => {
  const statements: es.Statement[] = []
  nodes.forEach((node: es.Statement | es.ModuleDeclaration): void => {
    if (isStatement(node)) {
      statements.push(node)
      return
    }
    switch (node.type) {
      case 'ExportNamedDeclaration':
        if (node.declaration) {
          statements.push(node.declaration)
        }
        break
      case 'ExportDefaultDeclaration':
        if (isDeclaration(node.declaration)) {
          statements.push(node.declaration)
        }
        break
      case 'ExportAllDeclaration':
        throw new Error('Not implemented yet.')
    }
  })
  return statements
}

export const transformImportedFile = (
  program: es.Program,
  iifeIdentifier: string
): es.FunctionDeclaration => {
  const moduleDeclarations = program.body.filter(isModuleDeclaration)
  const defaultExportExpression = getDefaultExportExpression(moduleDeclarations)
  const exportedNames = getExportedNames(moduleDeclarations)

  const defaultExport = defaultExportExpression ?? createLiteral(null)
  const namedExports = createListCallExpression(createReturnListArguments(exportedNames))
  const returnStatement = createReturnStatement(
    createPairCallExpression(defaultExport, namedExports)
  )

  const programStatements = removeModuleDeclarations(removeDirectives(program.body))
  const iifeBody = [...programStatements, returnStatement]

  return createFunctionDeclaration(iifeIdentifier, [], iifeBody)
}

/**
 * Removes all export-related nodes from the AST.
 *
 * Export-related AST nodes are only needed in the local imports pre-processing
 * step to determine which functions/variables/expressions should be made
 * available to other files/modules. After which, they have no functional effect
 * on program evaluation.
 *
 * @param program The AST which should be stripped of export-related nodes.
 */
export function removeExports(program: es.Program): void {
  ancestor(program, {
    // TODO: Handle other export AST nodes.
    ExportNamedDeclaration(node: es.ExportNamedDeclaration, ancestors: es.Node[]) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.`
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ExportNamedDeclaration node must be a Program node.
      if (parent.type !== 'Program') {
        return
      }
      const nodeIndex = parent.body.findIndex(n => n === node)
      if (node.declaration) {
        // If the ExportNamedDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        parent.body[nodeIndex] = node.declaration
      } else {
        // Otherwise, remove the ExportNamedDeclaration node in its parent node's body.
        parent.body.splice(nodeIndex, 1)
      }
    },
    ExportDefaultDeclaration(node: es.ExportDefaultDeclaration, ancestors: es.Node[]) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.`
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ExportNamedDeclaration node must be a Program node.
      if (parent.type !== 'Program') {
        return
      }
      const nodeIndex = parent.body.findIndex(n => n === node)
      // 'node.declaration' can be either a Declaration or an Expression.
      if (isDeclaration(node.declaration)) {
        // If the ExportDefaultDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        parent.body[nodeIndex] = node.declaration
      } else {
        // Otherwise, the ExportDefaultDeclaration node contains a statement.
        // Remove the ExportDefaultDeclaration node in its parent node's body.
        parent.body.splice(nodeIndex, 1)
      }
    }
  })
}
