import mapValues from 'lodash/mapValues';
import type { Context } from '../../types';
import { wrap } from '../../utils/operators';
import { ModuleConnectionError, ModuleInternalError } from '../errors';
import type {
  ModuleDocumentation,
  LoadedBundle,
  ModulesManifest,
  PartialSourceModule,
  Importer,
  ModuleDeclarationWithSource,
  ManifestImporter,
} from '../moduleTypes';
import {
  defaultSourceBundleImporter,
  defaultDocsImporter,
  setModulesStaticURL as internalUrlSetter,
  defaultManifestImporter,
  defaultSourceTabImporter,
} from './importers';
import { getRequireProvider } from './requireProvider';

export function setModulesStaticURL(value: string) {
  internalUrlSetter(value);

  // Changing the backend url should clear the caches
  // TODO: Do we want to memoize based on backend url?
  memoizedLoadModuleDocsAsync.cache.clear();
  memoizedLoadModuleManifestAsync.reset();
}

// lodash's memoize function memoizes on errors. This is undesirable,
// so we have our own custom memoization that won't memoize on errors
function getManifestLoader() {
  let manifest: ModulesManifest | null = null;
  let storedImporter: ManifestImporter | undefined = undefined;

  async function func(importer: ManifestImporter = defaultManifestImporter) {
    if (storedImporter !== undefined) {
      if (storedImporter !== importer) {
        storedImporter = importer;
        manifest = null;
      }
    } else {
      storedImporter = importer;
    }

    if (manifest !== null) {
      return manifest;
    }

    ({ default: manifest } = await importer());

    return manifest;
  }

  func.reset = () => {
    manifest = null;
  };

  return func;
}

function getMemoizedDocsLoader() {
  const docs = new Map<string, ModuleDocumentation>();
  let storedImporter: Importer<ModuleDocumentation> | undefined = undefined;

  async function func(
    moduleName: string,
    throwOnError: true,
    importer?: Importer<ModuleDocumentation>,
  ): Promise<ModuleDocumentation>;
  async function func(
    moduleName: string,
    throwOnError?: false,
    importer?: Importer<ModuleDocumentation>,
  ): Promise<ModuleDocumentation | null>;
  async function func(
    moduleName: string,
    throwOnError?: boolean,
    importer: Importer<ModuleDocumentation> = defaultDocsImporter,
  ): Promise<ModuleDocumentation | null> {
    if (storedImporter === undefined) {
      storedImporter = importer;
    } else if (storedImporter !== importer) {
      storedImporter = importer;
      // Reset the cache if a different importer is used,
      docs.clear();
    }

    if (docs.has(moduleName)) {
      return docs.get(moduleName)!;
    }

    try {
      const { default: loadedDocs } = await importer(moduleName);
      docs.set(moduleName, loadedDocs);
      return loadedDocs;
    } catch (error) {
      if (throwOnError) throw error;
      console.warn(`Failed to load documentation for ${moduleName}:`, error);
      return null;
    }
  }

  func.cache = docs;
  return func;
}

export const memoizedLoadModuleManifestAsync = getManifestLoader();
export const memoizedLoadModuleDocsAsync = getMemoizedDocsLoader();

/**
 * Load all the tabs of the given names
 */
export async function loadModuleTabsAsync(
  tabs: string[],
  importer: Importer<PartialSourceModule> = defaultSourceTabImporter,
): Promise<any[]> {
  return Promise.all(
    tabs.map(async tabName => {
      const { default: result } = await importer(tabName);
      return result;
    }),
  );
}

/**
 * Load the bundle of the module of the given name using the provided bundle loading function
 *
 * @param node         Node that triggered the loading of the given bundle
 * @param bundleLoader Bundle loading function
 */
export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  importer: Importer<PartialSourceModule> = defaultSourceBundleImporter,
  node?: ModuleDeclarationWithSource,
): Promise<LoadedBundle> {
  try {
    const { default: partialBundle } = await importer(moduleName, node);
    const loadedBundle = partialBundle(getRequireProvider(context));

    return mapValues(loadedBundle, value => {
      if (typeof value !== 'function') return value;

      const name = value.name;
      return wrap(
        value as (...args: any[]) => any,
        false,
        `function ${name} {\n\t[Function from ${moduleName}\n\tImplementation hidden]\n}`,
        moduleName,
        name,
      );
    });
  } catch (error) {
    if (error instanceof ModuleConnectionError) throw error;
    console.error(`Internal error while loading module ${moduleName}:`, error);
    throw new ModuleInternalError(moduleName, error, node);
  }
}
