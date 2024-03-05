import type es from 'estree'
import { partition } from 'lodash'

import * as create from '../../../utils/ast/astCreator'
import { getModuleDeclarationSource } from '../../../utils/ast/helpers'
import { isImportDeclaration } from '../../../utils/ast/typeGuards'
import Dict from '../../../utils/dict'
import { isSourceModule } from '../../utils'

type ImportRecord = {
  regularSpecifiers: Dict<string, Set<string>>
  defaultSpecifiers: Set<string>
  namespaces: Set<string>
}

/**
 * Collates import declarations from each module and creates corresponding combined
 * import declarations. Will also filter out non-Source module imports
 */
export default function hoistAndMergeImports(program: es.Program) {
  const [importDeclarations, nonImportDeclarations] = partition(program.body, isImportDeclaration)

  const importRecords = new Dict<string, ImportRecord>()

  importDeclarations.forEach(decl => {
    const source = getModuleDeclarationSource(decl)
    if (!isSourceModule(source)) return
    // Non-Source module imports should have already been dealt with at this point
    // so we only need to be concerned with Source module imports

    const { namespaces, regularSpecifiers, defaultSpecifiers } = importRecords.setdefault(source, {
      regularSpecifiers: new Dict(),
      defaultSpecifiers: new Set(),
      namespaces: new Set()
    })

    decl.specifiers.forEach(spec => {
      const declaredName = spec.local.name

      switch (spec.type) {
        case 'ImportNamespaceSpecifier': {
          namespaces.add(declaredName)
          break
        }
        case 'ImportDefaultSpecifier': {
          defaultSpecifiers.add(declaredName)
          break
        }
        case 'ImportSpecifier': {
          const importedName = spec.imported.name
          regularSpecifiers.setdefault(importedName, new Set()).add(declaredName)
          break
        }
      }
    })
  })

  const combinedImports = importRecords.flatMap(
    (source, { regularSpecifiers, defaultSpecifiers, namespaces }) => {
      const declarations: es.ImportDeclaration[] = []
      namespaces.forEach(name => {
        declarations.push(create.importDeclaration(source, [create.importNamespaceSpecifier(name)]))
      })

      const specifiers: (es.ImportSpecifier | es.ImportDefaultSpecifier)[] = []
      regularSpecifiers.forEach((importedName, localNames) => {
        localNames.forEach(name => {
          specifiers.push(create.importSpecifier(importedName, name))
        })
      })

      if (defaultSpecifiers.size > 0) {
        const [first, ...others] = defaultSpecifiers

        // We can combine only one default specifier with regular import specifiers
        // Insert it at the front of the array because when acorn parses the AST
        // its usually the first specifier. When we compare ASTs in tests
        // the specifier will then be in the right place
        specifiers.unshift(create.importDefaultSpecifier(first))

        // If there is more than 1 default specifier,
        // then we need to create a separate declaration for each
        // since one ImportDeclaration cannot have multiple ImportDefaultSpecifiers
        others.forEach(localName => {
          declarations.push(
            create.importDeclaration(source, [create.importDefaultSpecifier(localName)])
          )
        })
      }

      // Ensures that every module will at least have one ImportDeclaration
      // associated with it, preserving side effect imports
      if (specifiers.length > 0 || declarations.length === 0) {
        declarations.push(create.importDeclaration(source, specifiers))
      }
      return declarations
    }
  )

  program.body = [...combinedImports, ...nonImportDeclarations]
}
