import es from 'estree'

import {
  createFunctionDeclaration,
  createIdentifier,
  createListCallExpression,
  createLiteral,
  createPairCallExpression
} from './constructors'

// It is necessary to write this type guard like this as the 'type' of both
// 'Directive' & 'ExpressionStatement' is 'ExpressionStatement'.
//
// export interface Directive extends BaseNode {
//   type: "ExpressionStatement";
//   expression: Literal;
//   directive: string;
// }
//
// export interface ExpressionStatement extends BaseStatement {
//   type: "ExpressionStatement";
//   expression: Expression;
// }
//
// As such, we check whether the 'directive' property exists on the object
// instead in order to differentiate between the two.
const isDirective = (node: es.Node): node is es.Directive => {
  return 'directive' in node
}

const isModuleDeclaration = (node: es.Node): node is es.ModuleDeclaration => {
  return [
    'ImportDeclaration',
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
    'ExportAllDeclaration'
  ].includes(node.type)
}

const isStatement = (
  node: es.Directive | es.Statement | es.ModuleDeclaration
): node is es.Statement => {
  return !isDirective(node) && !isModuleDeclaration(node)
}

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
    switch (node.type) {
      case 'ExportNamedDeclaration':
        if (node.declaration) {
          const exportedName = getExportedName(node.declaration)
          if (exportedName === null) {
            break
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
        break
    }
  })
  return exportedNameToIdentifierMap
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
    }
  })
  return statements
}

export const transformImportedFile = (
  program: es.Program,
  iifeIdentifier: string
): es.FunctionDeclaration => {
  const moduleDeclarations = program.body.filter(isModuleDeclaration)
  const exportedNames = getExportedNames(moduleDeclarations)

  // TODO: Handle default exports.
  const defaultExport = createLiteral(null)
  const namedExports = createListCallExpression(createReturnListArguments(exportedNames))
  const returnStatement: es.ReturnStatement = {
    type: 'ReturnStatement',
    argument: createPairCallExpression(defaultExport, namedExports)
  }

  const programStatements = removeModuleDeclarations(removeDirectives(program.body))
  const iifeBody = [...programStatements, returnStatement]

  return createFunctionDeclaration(iifeIdentifier, [], iifeBody)
}
