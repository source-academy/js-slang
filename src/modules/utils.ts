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

/**
 * Create the module's context and load its tabs (if `loadTabs` is true)
 */
export async function initModuleContext(
  moduleName: string,
  context: Context,
  loadTabs: boolean,
  node?: Node
) {
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? loadModuleTabs(moduleName, node) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = loadModuleTabs(moduleName, node)
  }
}

/**
 * Create the module's context and load its tabs (if `loadTabs` is true)
 */
export async function initModuleContextAsync(
  moduleName: string,
  context: Context,
  loadTabs: boolean,
  node?: Node
) {
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? await loadModuleTabsAsync(moduleName, node) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = await loadModuleTabsAsync(moduleName, node)
  }
}

/**
 * Represents a loaded Source module
 */
export type ModuleInfo<T> = {
  /**
   * List of symbols exported by the module. This field is `null` if `checkImports` is `false`.
   */
  docs: Set<string> | null

  /**
   * `ImportDeclarations` that import from this module.
   */
  nodes: ImportDeclaration[]

  /**
   * Represents the loaded module. It can be the module's functions itself (see the ec-evaluator),
   * or just the module text (see the transpiler), or any other type.
   *
   * This field should not be null when the function returns.
   */
  content: T

  /**
   * The unique name given to this module. If `usedIdentifiers` is not provided, this field will be `null`.
   */
  namespaced: string | null
}

/**
 * Function that converts an `ImportSpecifier` into the given Transformed type.
 * It can be used as a `void` returning function as well, in case the specifiers
 * don't need to be transformed, just acted upon.
 * @example
 * ImportSpecifier(specifier, node, info) => {
 *  return create.constantDeclaration(
 *    spec.local.name,
 *    create.memberExpression(
 *      create.identifier(info.namespaced),
 *      spec.imported.name
 *    ),
 *  )
 * }
 */
export type SpecifierProcessor<Transformed, Content> = (
  spec: ImportDeclaration['specifiers'][0],
  moduleInfo: ModuleInfo<Content>,
  node: ImportDeclaration
) => Transformed

/**
 * Function to obtain the set of symbols exported by the given module
 */
type SymbolLoader<T> = (
  name: string,
  info: ModuleInfo<T>,
  node?: Node
) => Promise<Set<string> | null>

export type ImportSpecifierType =
  | 'ImportSpecifier'
  | 'ImportDefaultSpecifier'
  | 'ImportNamespaceSpecifier'

/**
 * This function is intended to unify how each of the different Source runners load imports. It handles
 * import checking (if `checkImports` is given as `true`), namespacing (if `usedIdentifiers` is provided),
 * loading the module's context (if `context` is not `null`), loading the module's tabs (if `loadTabs` is given as `true`) and the conversion
 * of import specifiers to the relevant type used by the runner.
 * @param nodes Nodes to transform
 * @param context Context to transform with, or `null`. Setting this to null prevents module contexts and tabs from being loaded.
 * @param loadTabs Set this to false to prevent tabs from being loaded even if a context is provided.
 * @param checkImports Pass true to enable checking for undefined imports, false to skip these checks
 * @param moduleLoader Function that takes the name of the module and returns its loaded representation.
 * @param symbolsLoader Function that takes a loaded module and returns a set containing its exported symbols. This is used for import checking
 * @param processors Functions for working with each type of import specifier.
 * @param usedIdentifiers Set containing identifiers already used in code. If null, namespacing is not conducted.
 * @returns The loaded modules, along with the transformed versions of the given nodes
 */
export async function transformImportNodesAsync<Transformed, LoadedModule>(
  nodes: ImportDeclaration[],
  context: Context | null,
  loadTabs: boolean,
  checkImports: boolean,
  moduleLoader: (name: string, node?: Node) => Promise<LoadedModule>,
  symbolsLoader: SymbolLoader<LoadedModule>,
  processors: Record<ImportSpecifierType, SpecifierProcessor<Transformed, LoadedModule>>,
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
      // First time we are loading this module
      res[moduleName] = {
        docs: null,
        nodes: [],
        content: null as any,
        namespaced: null
      }
      let loadPromise = internalLoader(moduleName, node).then(content => {
        res[moduleName].content = content
      })

      if (checkImports) {
        // symbolsLoader must run after internalLoader finishes loading as it may need the
        // loaded module.
        loadPromise = loadPromise.then(() => {
          symbolsLoader(moduleName, res[moduleName], node).then(docs => {
            res[moduleName].docs = docs
          })
        })
      }
      promises.push(loadPromise)
    }

    res[moduleName].nodes.push(node)

    // Collate all the identifiers introduced by specifiers to prevent collisions when
    // the import declaration has aliases, e.g import { show as __MODULE__ } from 'rune';
    if (usedIdentifiers) {
      node.specifiers.forEach(spec => usedIdentifiers.add(spec.local.name))
    }
    return res
  }, {} as Record<string, ModuleInfo<LoadedModule>>)

  // Wait for all module and symbol loading to finish
  await Promise.all(promises)

  return Object.entries(moduleInfos).reduce((res, [moduleName, info]) => {
    // Now for each module, we give it a unique namespaced id
    const namespaced = usedIdentifiers ? getUniqueId(usedIdentifiers, '__MODULE__') : null
    info.namespaced = namespaced

    if (checkImports && info.docs === null) {
      console.warn(`Failed to load documentation for ${moduleName}, skipping typechecking`)
    }

    if (info.content === null) {
      throw new Error(`${moduleName} was not loaded properly. This should never happen`)
    }

    return {
      ...res,
      [moduleName]: {
        content: info.nodes.flatMap(node =>
          node.specifiers.flatMap(spec => {
            if (checkImports && info.docs) {
              // Conduct import checking if checkImports is true and the symbols were
              // successfully loaded (not null)
              switch (spec.type) {
                case 'ImportSpecifier': {
                  if (!info.docs.has(spec.imported.name))
                    throw new UndefinedImportError(spec.imported.name, moduleName, spec)
                  break
                }
                case 'ImportDefaultSpecifier': {
                  if (!info.docs.has('default'))
                    throw new UndefinedDefaultImportError(moduleName, spec)
                  break
                }
                case 'ImportNamespaceSpecifier': {
                  if (info.docs.size === 0)
                    throw new UndefinedNamespaceImportError(moduleName, spec)
                  break
                }
              }
            }
            // Finally, transform that specifier into the form needed
            // by the runner
            return processors[spec.type](spec, info, node)
          })
        ),
        info
      }
    }
  }, {} as Record<string, { info: ModuleInfo<LoadedModule>; content: Transformed[] }>)
}
