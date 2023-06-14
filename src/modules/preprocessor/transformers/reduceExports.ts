import { extractIdsFromPattern } from '../../../utils/ast/astUtils'
import { isSourceImport } from '../../../utils/ast/typeGuards'
import type * as es from '../../../utils/ast/types'

export default function reduceExports(programs: Record<string, es.Program>, topoOrder: string[]) {
  const exportMap = topoOrder.reduce((res, moduleName) => {
    const program = programs[moduleName]
    const exportedSymbols = new Map<string, { source: string; symbolName: string }>()

    program.body.forEach(node => {
      switch (node.type) {
        case 'ExportDefaultDeclaration': {
          exportedSymbols.set('default', { source: moduleName, symbolName: 'default' })
          break
        }
        case 'ExportNamedDeclaration': {
          if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
              node.declaration.declarations.forEach(({ id }) => {
                extractIdsFromPattern(id).forEach(({ name }) =>
                  exportedSymbols.set(name, { source: moduleName, symbolName: name })
                )
              })
              break
            }

            const { name } = node.declaration.id!
            exportedSymbols.set(name, { source: moduleName, symbolName: name })
          } else {
            node.specifiers.forEach(({ exported: { name }, local }) => {
              const source = (node.source?.value as string | null) ?? moduleName
              return exportedSymbols.set(name, { source, symbolName: local.name })
            })
          }
          break
        }
      }
    })

    return {
      ...res,
      [moduleName]: exportedSymbols
    }
  }, {} as Record<string, Map<string, { source: string; symbolName: string }>>)

  function resolveSymbol(source: string, desiredSymbol: string): [string, string] {
    let symbolName: string
    let newSource: string
    ;({ source: newSource, symbolName } = exportMap[source].get(desiredSymbol)!)
    if (isSourceImport(source) || newSource === source) return [newSource, symbolName]
    ;[newSource, symbolName] = resolveSymbol(newSource, symbolName)
    exportMap[source].set(desiredSymbol, { source: newSource, symbolName })
    return [newSource, symbolName]
  }

  return Object.entries(programs).reduce((res, [filePath, program]) => {
    const newBody = program.body.reduce((body, node) => {
      switch (node.type) {
        case 'ExportNamedDeclaration': {
          if (!node.source) return [...body, node]

          const newDecls = node.specifiers.map(spec => {
            const source = node.source!.value as string
            const [newSource, newSymbol] = resolveSymbol(source, spec.local.name)
            const newDecl: es.ExportNamedDeclarationWithSource = {
              type: 'ExportNamedDeclaration',
              declaration: null,
              source: {
                type: 'Literal',
                value: newSource
              },
              specifiers: [
                {
                  type: 'ExportSpecifier',
                  exported: spec.exported,
                  local: {
                    type: 'Identifier',
                    name: newSymbol
                  }
                }
              ]
            }
            return newDecl
          })
          return [...body, ...newDecls]
        }
        case 'ImportDeclaration': {
          const source = node.source.value as string
          const decls = node.specifiers.map(spec => {
            if (spec.type === 'ImportNamespaceSpecifier')
              throw new Error('ImportNamespaceSpecifier Not supported!')

            const desiredSymbol =
              spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported.name
            const [newSource, newSymbol] = resolveSymbol(source, desiredSymbol)
            const newDecl: es.ImportDeclaration = {
              type: 'ImportDeclaration',
              source: {
                type: 'Literal',
                value: newSource
              },
              specifiers: [
                {
                  type: 'ImportSpecifier',
                  imported: {
                    type: 'Identifier',
                    name: newSymbol
                  },
                  local: spec.local
                }
              ]
            }
            return newDecl
          })
          return [...body, ...decls]
        }
        default:
          return [...body, node]
      }
    }, [] as es.Program['body'])

    return {
      ...res,
      [filePath]: {
        ...program,
        body: newBody
      }
    }
  }, {} as Record<string, es.Program>)
}
