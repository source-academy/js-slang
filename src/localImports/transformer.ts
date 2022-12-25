import es from 'estree'

import {
  createFunctionDeclaration,
  createIdentifier,
  createListCallExpression,
  createLiteral,
  createPairCallExpression
} from './constructors'
import { isDeclaration, isDirective, isModuleDeclaration, isStatement } from './typeGuards'

const getExportedName = (node: es.Declaration): string | null => {
  switch (node.type) {
    case 'FunctionDeclaration':
      // node.id is null when a function declaration is a part of the export default function statement.
      if (node.id === null) {
        return null
      }
      return node.id.name
    case 'VariableDeclaration':
      const id = node.declarations[0].id
      // In Source, variable names are Identifiers.
      if (id.type !== 'Identifier') {
        throw new Error(`Expected variable name to be an Identifier, but was ${id.type} instead.`)
      }
      return id.name
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
      const exportedName = getExportedName(node.declaration)
      if (exportedName === null) {
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

const getDefaultExportName = (nodes: es.ModuleDeclaration[]): string | null => {
  let defaultExportName: string | null = null
  nodes.forEach((node: es.ModuleDeclaration): void => {
    // Only ExportDefaultDeclaration nodes specify the default export.
    if (node.type !== 'ExportDefaultDeclaration') {
      return
    }
    if (isDeclaration(node.declaration)) {
      const exportedName = getExportedName(node.declaration)
      if (exportedName === null) {
        return
      }
      if (defaultExportName !== null) {
        // This should never occur because multiple default exports should have
        // been caught by the Acorn parser when parsing into an AST.
        throw new Error('Encountered multiple default exports!')
      }
      defaultExportName = exportedName
    } else {
      // TODO: Handle expressions.
    }
  })
  return defaultExportName
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
  const defaultExportName = getDefaultExportName(moduleDeclarations)
  const exportedNames = getExportedNames(moduleDeclarations)

  const defaultExport = defaultExportName
    ? createIdentifier(defaultExportName)
    : createLiteral(null)
  const namedExports = createListCallExpression(createReturnListArguments(exportedNames))
  const returnStatement: es.ReturnStatement = {
    type: 'ReturnStatement',
    argument: createPairCallExpression(defaultExport, namedExports)
  }

  const programStatements = removeModuleDeclarations(removeDirectives(program.body))
  const iifeBody = [...programStatements, returnStatement]

  return createFunctionDeclaration(iifeIdentifier, [], iifeBody)
}
