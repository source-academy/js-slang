import { ImportDeclaration, Node } from 'estree'

import { Context } from '..'
import { getUniqueId } from '../utils/uniqueIds'
import {
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from './errors'
import { loadModuleTabs } from './moduleLoader'
import { loadModuleTabsAsync } from './moduleLoaderAsync'

export async function initModuleContext(
  moduleName: string,
  context: Context,
  loadTabs: boolean,
  node?: Node
) {
  if (!(moduleName in context)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? loadModuleTabs(moduleName, node) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = loadModuleTabs(moduleName, node)
  }
}

export async function initModuleContextAsync(
  moduleName: string,
  context: Context,
  loadTabs: boolean,
  node?: Node
) {
  if (!(moduleName in context)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? await loadModuleTabsAsync(moduleName, node) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = await loadModuleTabsAsync(moduleName, node)
  }
}

export type ModuleInfo<T> = {
  docs: Set<string> | null
  nodes: ImportDeclaration[]
  content: T | null
  namespaced: string | null
}

export type SpecifierProcessor<Transformed, Content> = (
  spec: ImportDeclaration['specifiers'][0],
  node: ImportDeclaration,
  moduleInfo: ModuleInfo<Content>
) => Transformed

type SymbolLoader<T> = (
  name: string,
  info: ModuleInfo<T>,
  node?: Node
) => Promise<Set<string> | null> | Set<string> | null

export type ImportSpecifierType =
  | 'ImportSpecifier'
  | 'ImportDefaultSpecifier'
  | 'ImportNamespaceSpecifier'

export async function reduceImportNodesAsync<Transformed, Content>(
  nodes: ImportDeclaration[],
  context: Context | null,
  loadTabs: boolean,
  checkImports: boolean,
  moduleLoader: (name: string, node?: Node) => Promise<Content>,
  symbolsLoader: SymbolLoader<Content>,
  processors: Record<ImportSpecifierType, SpecifierProcessor<Transformed, Content>>,
  usedIdentifiers?: Set<string>
) {
  const internalLoader = async (name: string, node?: Node) => {
    // Make sure that module contexts are initialized before
    // loading the bundles
    if (context) {
      await initModuleContextAsync(name, context, loadTabs, node)
    }

    return moduleLoader(name, node)
  }

  const promises: Promise<void>[] = []
  const moduleInfos = nodes.reduce((res, node) => {
    const moduleName = node.source.value
    if (typeof moduleName !== 'string') {
      throw new Error(
        `Expected ImportDeclaration to have a source of type string, got ${moduleName}`
      )
    }

    if (!(moduleName in res)) {
      promises.push(
        internalLoader(moduleName, node).then(content => {
          res[moduleName].content = content
        })
      )

      if (checkImports) {
        const docsResult = symbolsLoader(moduleName, res[moduleName], node)
        if (docsResult instanceof Promise) {
          promises.push(
            docsResult.then(docs => {
              res[moduleName].docs = docs
            })
          )
        } else {
          res[moduleName].docs = docsResult
        }
      }
      res[moduleName] = {
        docs: null,
        nodes: [],
        content: null,
        namespaced: null
      }
    }

    res[moduleName].nodes.push(node)
    node.specifiers.forEach(spec => usedIdentifiers?.add(spec.local.name))
    return res
  }, {} as Record<string, ModuleInfo<Content>>)

  await Promise.all(promises)

  return Object.entries(moduleInfos).reduce((res, [moduleName, info]) => {
    const namespaced = usedIdentifiers ? getUniqueId(usedIdentifiers, '__MODULE__') : null
    info.namespaced = namespaced

    if (checkImports && info.docs === null) {
      console.warn(`Failed to load documentation for ${moduleName}, skipping typechecking`)
    }
    return {
      ...res,
      [moduleName]: {
        content: info.nodes.flatMap(node =>
          node.specifiers.flatMap(spec => {
            if (checkImports && info.docs) {
              switch (spec.type) {
                case 'ImportSpecifier': {
                  if (!info.docs.has(spec.imported.name))
                    throw new UndefinedImportError(spec.imported.name, moduleName, node)
                  break
                }
                case 'ImportDefaultSpecifier': {
                  if (!info.docs.has('default'))
                    throw new UndefinedDefaultImportError(moduleName, node)
                  break
                }
                case 'ImportNamespaceSpecifier': {
                  if (info.docs.size === 0)
                    throw new UndefinedNamespaceImportError(moduleName, node)
                  break
                }
              }
            }
            return processors[spec.type](spec, node, info)
          })
        ),
        info
      }
    }
  }, {} as Record<string, { info: ModuleInfo<Content>; content: Transformed[] }>)
}
