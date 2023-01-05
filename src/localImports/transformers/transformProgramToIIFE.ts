import es from 'estree'
import * as path from 'path'

import {
  createFunctionDeclaration,
  createIdentifier,
  createListCallExpression,
  createLiteral,
  createPairCallExpression,
  createReturnStatement
} from '../constructors'
import { transformFilePathToValidFunctionName } from '../filePaths'
import { isDeclaration, isDirective, isModuleDeclaration, isStatement } from '../typeGuards'

const getFilePathToImportedNamesMap = (
  nodes: es.ModuleDeclaration[],
  currentFilePath: string
): Record<string, es.Identifier[]> => {
  const filePathToImportedNamesMap: Record<string, es.Identifier[]> = {}
  nodes.forEach((node: es.ModuleDeclaration): void => {
    // Only ImportDeclaration nodes specify imported names.
    if (node.type !== 'ImportDeclaration') {
      return
    }
    const importSource = node.source.value
    if (typeof importSource !== 'string') {
      throw new Error(
        'Encountered an ImportDeclaration node with a non-string source. This should never occur.'
      )
    }
    // Different import sources can refer to the same file. For example,
    // both './b.js' & '../dir/b.js' can refer to the same file if the
    // current file path is '/dir/a.js'. To ensure that every file is
    // processed only once, we resolve the import source against the
    // current file path to get the absolute file path of the file to
    // be imported. Since the absolute file path is guaranteed to be
    // unique, it is also the canonical file path.
    const importFilePath = path.resolve(currentFilePath, importSource)
    // Even though we limit the chars that can appear in Source file
    // paths, some chars in file paths (such as '/') cannot be used
    // in function names. As such, we substitute illegal chars with
    // legal ones in a manner that gives us a bijective mapping from
    // file paths to function names.
    const importFunctionName = transformFilePathToValidFunctionName(importFilePath)
    // If this is the file ImportDeclaration node for the canonical
    // file path, instantiate the entry in the map.
    if (filePathToImportedNamesMap[importFunctionName] === undefined) {
      filePathToImportedNamesMap[importFunctionName] = []
    }
    node.specifiers.forEach(
      (
        specifier: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier
      ): void => {
        switch (specifier.type) {
          case 'ImportSpecifier':
            filePathToImportedNamesMap[importFunctionName].push(specifier.imported)
            break
          case 'ImportDefaultSpecifier':
            throw new Error('Not implemented yet.')
          case 'ImportNamespaceSpecifier':
            throw new Error('Not implemented yet.')
        }
      }
    )
  })
  return filePathToImportedNamesMap
}

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
  const filePathToImportedNamesMap = getFilePathToImportedNamesMap(
    moduleDeclarations,
    currentFileName
  )
  const exportedNameToIdentifierMap = getExportedNameToIdentifierMap(moduleDeclarations)
  const defaultExportExpression = getDefaultExportExpression(
    moduleDeclarations,
    exportedNameToIdentifierMap
  )

  const iifeParams = Object.keys(filePathToImportedNamesMap).map(createIdentifier)

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
  return createFunctionDeclaration(functionName, iifeParams, iifeBody)
}