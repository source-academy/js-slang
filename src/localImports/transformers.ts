import es from 'estree'

import { ancestor } from '../utils/walkers'
import {
  createFunctionDeclaration,
  createListCallExpression,
  createLiteral,
  createPairCallExpression,
  createReturnStatement
} from './constructors'
import { transformFilePathToValidFunctionName } from './filePaths'
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

export const transformImportedFile = (
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
export const removeExports = (program: es.Program): void => {
  ancestor(program, {
    // TODO: Handle other export AST nodes.
    ExportNamedDeclaration(
      node: es.ExportNamedDeclaration,
      _state: es.Node[],
      ancestors: es.Node[]
    ) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
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
    ExportDefaultDeclaration(
      node: es.ExportDefaultDeclaration,
      _state: es.Node[],
      ancestors: es.Node[]
    ) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
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

/**
 * Returns whether a string is a file path. We define a file
 * path to be any string containing the '/' character.
 *
 * @param value The value of the string.
 */
const isFilePath = (value: string): boolean => {
  return value.includes('/')
}

/**
 * Returns whether a module name refers to a Source module.
 * We define a Source module name to be any string that is not
 * a file path.
 *
 * Source module import:           `import { x } from "module";`
 * Local (relative) module import: `import { x } from "./module";`
 * Local (absolute) module import: `import { x } from "/dir/dir2/module";`
 *
 * @param moduleName The name of the module.
 */
export const isSourceModule = (moduleName: string): boolean => {
  return !isFilePath(moduleName)
}

/**
 * Removes all non-Source module import-related nodes from the AST.
 *
 * All import-related nodes which are not removed in the pre-processing
 * step will be treated by the Source modules loader as a Source module.
 * If a Source module by the same name does not exist, the program
 * evaluation will error out. As such, this function removes all
 * import-related AST nodes which the Source module loader does not
 * support, as well as ImportDeclaration nodes for local module imports.
 *
 * The definition of whether a module is a local module or a Source
 * module depends on the implementation of the `isSourceModule` function.
 *
 * @param program The AST which should be stripped of non-Source module
 *                import-related nodes.
 */
export const removeNonSourceModuleImports = (program: es.Program): void => {
  // First pass: remove all import AST nodes which are unused by Source modules.
  ancestor(program, {
    ImportSpecifier(_node: es.ImportSpecifier, _state: es.Node[], _ancestors: es.Node[]): void {
      // Nothing to do here since ImportSpecifier nodes are used by Source modules.
    },
    ImportDefaultSpecifier(
      node: es.ImportDefaultSpecifier,
      _state: es.Node[],
      ancestors: es.Node[]
    ): void {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ImportDefaultSpecifier node must be an ImportDeclaration node.
      if (parent.type !== 'ImportDeclaration') {
        return
      }
      const nodeIndex = parent.specifiers.findIndex(n => n === node)
      // Remove the ImportDefaultSpecifier node in its parent node's array of specifiers.
      // This is because Source modules do not support default imports.
      parent.specifiers.splice(nodeIndex, 1)
    },
    ImportNamespaceSpecifier(
      node: es.ImportNamespaceSpecifier,
      _state: es.Node[],
      ancestors: es.Node[]
    ): void {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ImportNamespaceSpecifier node must be an ImportDeclaration node.
      if (parent.type !== 'ImportDeclaration') {
        return
      }
      const nodeIndex = parent.specifiers.findIndex(n => n === node)
      // Remove the ImportNamespaceSpecifier node in its parent node's array of specifiers.
      // This is because Source modules do not support namespace imports.
      parent.specifiers.splice(nodeIndex, 1)
    }
  })

  // Operate on a copy of the Program node's body to prevent the walk from missing ImportDeclaration nodes.
  const programBody = [...program.body]
  const removeImportDeclaration = (node: es.ImportDeclaration, ancestors: es.Node[]): void => {
    // The ancestors array contains the current node, meaning that the
    // parent node is the second last node of the array.
    const parent = ancestors[ancestors.length - 2]
    // The parent node of an ImportDeclaration node must be a Program node.
    if (parent.type !== 'Program') {
      return
    }
    const nodeIndex = programBody.findIndex(n => n === node)
    // Remove the ImportDeclaration node in its parent node's body.
    programBody.splice(nodeIndex, 1)
  }
  // Second pass: remove all ImportDeclaration nodes for non-Source modules, or that do not
  // have any specifiers (thus being functionally useless).
  ancestor(program, {
    ImportDeclaration(node: es.ImportDeclaration, _state: es.Node[], ancestors: es.Node[]): void {
      // Module names must always be strings in Source.
      if (typeof node.source.value !== 'string') {
        return
      }
      // ImportDeclaration nodes without any specifiers are functionally useless and are thus removed.
      if (node.specifiers.length === 0) {
        removeImportDeclaration(node, ancestors)
        return
      }
      // Non-Source modules should already have been handled in the pre-processing step and are no
      // longer needed. They must be removed to avoid being treated as Source modules.
      if (!isSourceModule(node.source.value)) {
        removeImportDeclaration(node, ancestors)
      }
    }
  })
  program.body = programBody
}
