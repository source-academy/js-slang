import es from 'estree'

import {
  createFunctionDeclaration,
  createListCallExpression,
  createLiteral,
  createPairCallExpression,
  createReturnStatement
} from '../constructors'
import { transformFilePathToValidFunctionName } from '../filePaths'
import { isDeclaration, isDirective, isModuleDeclaration, isStatement } from '../typeGuards'

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

const getExportedNameToIdentifierMap = (
  nodes: es.ModuleDeclaration[]
): Record<string, es.Identifier> => {
  const exportedNameToIdentifierMap: Record<string, es.Identifier> = {}
  nodes.forEach((node: es.ModuleDeclaration): void => {
    // Only ExportNamedDeclaration nodes specify exported names.
    if (node.type !== 'ExportNamedDeclaration') {
      return
    }
    if (node.declaration) {
      const identifier = getIdentifier(node.declaration)
      if (identifier === null) {
        return
      }
      // When an ExportNamedDeclaration node has a declaration, the
      // identifier is the same as the exported name (i.e., no renaming).
      const exportedName = identifier.name
      exportedNameToIdentifierMap[exportedName] = identifier
    } else {
      // When an ExportNamedDeclaration node does not have a declaration,
      // it contains a list of names to export, i.e., export { a, b as c, d };.
      // Exported names can be renamed using the 'as' keyword. As such, the
      // exported names and their corresponding identifiers might be different.
      node.specifiers.forEach((node: es.ExportSpecifier): void => {
        const exportedName = node.exported.name
        const identifier = node.local
        exportedNameToIdentifierMap[exportedName] = identifier
      })
    }
  })
  return exportedNameToIdentifierMap
}

const getDefaultExportExpression = (
  nodes: es.ModuleDeclaration[],
  exportedNameToIdentifierMap: Partial<Record<string, es.Identifier>>
): es.Expression | null => {
  let defaultExport: es.Expression | null = null

  // Handle default exports which are parsed as ExportNamedDeclaration AST nodes.
  // 'export { name as default };' is equivalent to 'export default name;' but
  // is represented by an ExportNamedDeclaration node instead of an
  // ExportedDefaultDeclaration node.
  //
  // NOTE: If there is a named export representing the default export, its entry
  // in the map must be removed to prevent it from being treated as a named export.
  if (exportedNameToIdentifierMap['default'] !== undefined) {
    defaultExport = exportedNameToIdentifierMap['default']
    delete exportedNameToIdentifierMap['default']
  }

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
  exportedNameToIdentifierMap: Record<string, es.Identifier>
): Array<es.Expression | es.SpreadElement> => {
  return Object.entries(exportedNameToIdentifierMap).map(
    ([exportedName, identifier]: [string, es.Identifier]): es.SimpleCallExpression => {
      const head = createLiteral(exportedName)
      const tail = identifier
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
    // If there are declaration nodes that are child nodes of the
    // ModuleDeclaration nodes, we add them to the processed statements
    // array so that the declarations are still part of the resulting
    // program.
    switch (node.type) {
      case 'ImportDeclaration':
        break
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

export const transformProgramToIIFE = (
  program: es.Program,
  currentFileName: string
): es.FunctionDeclaration => {
  const moduleDeclarations = program.body.filter(isModuleDeclaration)
  const exportedNameToIdentifierMap = getExportedNameToIdentifierMap(moduleDeclarations)
  const defaultExportExpression = getDefaultExportExpression(
    moduleDeclarations,
    exportedNameToIdentifierMap
  )

  const defaultExport = defaultExportExpression ?? createLiteral(null)
  const namedExports = createListCallExpression(
    createReturnListArguments(exportedNameToIdentifierMap)
  )
  const returnStatement = createReturnStatement(
    createPairCallExpression(defaultExport, namedExports)
  )

  const programStatements = removeModuleDeclarations(removeDirectives(program.body))
  const iifeBody = [...programStatements, returnStatement]

  const functionName = transformFilePathToValidFunctionName(currentFileName)
  return createFunctionDeclaration(functionName, [], iifeBody)
}
