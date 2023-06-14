import * as path from 'path'

import {
  accessExportFunctionName,
  defaultExportLookupName
} from '../../../stdlib/localImport.prelude'
import assert from '../../../utils/assert'
import { processExportDefaultDeclaration } from '../../../utils/ast/astUtils'
import {
  isDeclaration,
  isDirective,
  isModuleDeclaration,
  isSourceImport,
  isStatement
} from '../../../utils/ast/typeGuards'
import type * as es from '../../../utils/ast/types'
import {
  createCallExpression,
  createFunctionDeclaration,
  createIdentifier,
  createLiteral,
  createReturnStatement
} from '../constructors/baseConstructors'
import {
  createImportedNameDeclaration,
  createListCallExpression,
  createPairCallExpression
} from '../constructors/contextSpecificConstructors'
import {
  transformFilePathToValidFunctionName,
  transformFunctionNameToInvokedFunctionResultVariableName
} from '../filePaths'

export const getInvokedFunctionResultVariableNameToImportSpecifiersMap = (
  nodes: es.ModuleDeclaration[],
  currentDirPath: string
): Record<string, (es.ImportSpecifiers | es.ExportSpecifier)[]> => {
  const invokedFunctionResultVariableNameToImportSpecifierMap: Record<
    string,
    (es.ImportSpecifiers | es.ExportSpecifier)[]
  > = {}
  nodes.forEach((node: es.ModuleDeclaration): void => {
    switch (node.type) {
      case 'ExportNamedDeclaration': {
        if (!node.source) return
        break
      }
      case 'ImportDeclaration':
        break
      default:
        return
    }

    const importSource = node.source!.value
    assert(
      typeof importSource === 'string',
      `Encountered an ${node.type} node with a non-string source. This should never occur.`
    )

    // Only handle import declarations for non-Source modules.
    if (isSourceImport(importSource)) {
      return
    }

    // Different import sources can refer to the same file. For example,
    // both './b.js' & '../dir/b.js' can refer to the same file if the
    // current file path is '/dir/a.js'. To ensure that every file is
    // processed only once, we resolve the import source against the
    // current file path to get the absolute file path of the file to
    // be imported. Since the absolute file path is guaranteed to be
    // unique, it is also the canonical file path.
    const importFilePath = path.resolve(currentDirPath, importSource)

    // Even though we limit the chars that can appear in Source file
    // paths, some chars in file paths (such as '/') cannot be used
    // in function names. As such, we substitute illegal chars with
    // legal ones in a manner that gives us a bijective mapping from
    // file paths to function names.
    const importFunctionName = transformFilePathToValidFunctionName(importFilePath)

    // In the top-level environment of the resulting program, for every
    // imported file, we will end up with two different names; one for
    // the function declaration, and another for the variable holding
    // the result of invoking the function. The former is represented
    // by 'importFunctionName', while the latter is represented by
    // 'invokedFunctionResultVariableName'. Since multiple files can
    // import the same file, yet we only want the code in each file to
    // be evaluated a single time (and share the same state), we need to
    // evaluate the transformed functions (of imported files) only once
    // in the top-level environment of the resulting program, then pass
    // the result (the exported names) into other transformed functions.
    // Having the two different names helps us to achieve this objective.
    const invokedFunctionResultVariableName =
      transformFunctionNameToInvokedFunctionResultVariableName(importFunctionName)

    // If this is the file ImportDeclaration node for the canonical
    // file path, instantiate the entry in the map.
    if (
      invokedFunctionResultVariableNameToImportSpecifierMap[invokedFunctionResultVariableName] ===
      undefined
    ) {
      invokedFunctionResultVariableNameToImportSpecifierMap[invokedFunctionResultVariableName] = []
    }
    invokedFunctionResultVariableNameToImportSpecifierMap[invokedFunctionResultVariableName].push(
      ...node.specifiers
    )
  })

  return invokedFunctionResultVariableNameToImportSpecifierMap
}

const getExportExpressions = (
  nodes: es.ModuleDeclaration[],
  invokedFunctionResultVariableNameToImportSpecifierMap: Record<
    string,
    (es.ImportSpecifiers | es.ExportSpecifier)[]
  >
) => {
  const exportExpressions: Record<string, es.Expression> = {}

  for (const node of nodes) {
    switch (node.type) {
      case 'ExportNamedDeclaration': {
        if (node.declaration) {
          let identifier: es.Identifier
          if (node.declaration.type === 'VariableDeclaration') {
            const {
              declarations: [{ id }]
            } = node.declaration
            identifier = id as es.Identifier
          } else {
            identifier = node.declaration.id!
          }
          exportExpressions[identifier.name] = identifier
        } else if (!node.source) {
          node.specifiers.forEach(({ exported: { name }, local }) => {
            exportExpressions[name] = local
          })
        }
        break
      }
      case 'ExportDefaultDeclaration': {
        exportExpressions[defaultExportLookupName] = processExportDefaultDeclaration(node, {
          ClassDeclaration: ({ id }) => id,
          FunctionDeclaration: ({ id }) => id,
          Expression: expr => expr
        })
        break
      }
    }
  }

  for (const [source, nodes] of Object.entries(
    invokedFunctionResultVariableNameToImportSpecifierMap
  )) {
    for (const node of nodes) {
      if (node.type !== 'ExportSpecifier') continue

      const {
        exported: { name: exportName },
        local: { name: localName }
      } = node
      exportExpressions[exportName] = createCallExpression(accessExportFunctionName, [
        createIdentifier(source),
        createLiteral(localName)
      ])
    }
  }

  return exportExpressions
}

export const createAccessImportStatements = (
  invokedFunctionResultVariableNameToImportSpecifiersMap: Record<
    string,
    (es.ImportSpecifiers | es.ExportSpecifier)[]
  >
): es.VariableDeclaration[] => {
  const importDeclarations: es.VariableDeclaration[] = []
  for (const [invokedFunctionResultVariableName, importSpecifiers] of Object.entries(
    invokedFunctionResultVariableNameToImportSpecifiersMap
  )) {
    importSpecifiers.forEach(importSpecifier => {
      let importDeclaration
      switch (importSpecifier.type) {
        case 'ImportSpecifier':
          importDeclaration = createImportedNameDeclaration(
            invokedFunctionResultVariableName,
            importSpecifier.local,
            importSpecifier.imported.name
          )
          break
        case 'ImportDefaultSpecifier':
          importDeclaration = createImportedNameDeclaration(
            invokedFunctionResultVariableName,
            importSpecifier.local,
            defaultExportLookupName
          )
          break
        case 'ImportNamespaceSpecifier':
          // In order to support namespace imports, Source would need to first support objects.
          throw new Error('Namespace imports are not supported.')
        case 'ExportSpecifier':
          return
      }
      importDeclarations.push(importDeclaration)
    })
  }
  return importDeclarations
}

const createReturnListArguments = (
  exportedNameToIdentifierMap: Record<string, es.Expression>
): Array<es.Expression | es.SpreadElement> => {
  return Object.entries(exportedNameToIdentifierMap).map(
    ([exportedName, expr]: [string, es.Identifier]): es.SimpleCallExpression => {
      const head = createLiteral(exportedName)
      const tail = expr
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

/**
 * Transforms the given program into a function declaration. This is done
 * so that every imported module has its own scope (since functions have
 * their own scope).
 *
 * @param program         The program to be transformed.
 * @param currentFilePath The file path of the current program.
 */
export const transformProgramToFunctionDeclaration = (
  program: es.Program,
  currentFilePath: string
): es.FunctionDeclarationWithId => {
  const moduleDeclarations = program.body.filter(isModuleDeclaration)
  const currentDirPath = path.resolve(currentFilePath, '..')

  // Create variables to hold the imported statements.
  const invokedFunctionResultVariableNameToImportSpecifiersMap =
    getInvokedFunctionResultVariableNameToImportSpecifiersMap(moduleDeclarations, currentDirPath)

  const accessImportStatements = createAccessImportStatements(
    invokedFunctionResultVariableNameToImportSpecifiersMap
  )

  // Create the return value of all exports for the function.
  const { [defaultExportLookupName]: defaultExport, ...exportExpressions } = getExportExpressions(
    moduleDeclarations,
    invokedFunctionResultVariableNameToImportSpecifiersMap
  )
  const namedExports = createListCallExpression(createReturnListArguments(exportExpressions))
  const returnStatement = createReturnStatement(
    createPairCallExpression(defaultExport ?? createLiteral(null), namedExports)
  )

  // Assemble the function body.
  const programStatements = removeModuleDeclarations(removeDirectives(program.body))
  const functionBody = [...accessImportStatements, ...programStatements, returnStatement]

  // Determine the function name based on the absolute file path.
  const functionName = transformFilePathToValidFunctionName(currentFilePath)

  // Set the equivalent variable names of imported modules as the function parameters.
  const functionParams = Object.keys(invokedFunctionResultVariableNameToImportSpecifiersMap).map(
    createIdentifier
  )

  return createFunctionDeclaration(functionName, functionParams, functionBody)
}
