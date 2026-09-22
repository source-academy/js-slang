import { ModuleLoaderRunnerPlugin } from '@sourceacademy/runner-module-loader';

import type {
  Importer,
  LoadedBundle,
  ManifestImporter,
  ModuleInfo,
  ModulesManifest,
  PartialSourceModule,
} from '../../modules/moduleTypes';

import { moduleToSource } from './moduleInterop';
import type { SourceDataHandler } from './SourceDataHandler';

/**
 * The legacy pipeline resolves a module *name* to metadata (`ModuleInfo` — its tabs, required
 * chapter) via a manifest fetched over HTTP (`resolveFile` in `src/modules/preprocessor/resolver.ts`,
 * `toPath in manifest`) before it ever reaches a bundle importer — so overriding only
 * `sourceBundleImporter` is not enough; without a working manifest fetch, `resolveFile` never even
 * recognizes a module name as importable and throws before `createConductorBundleImporter` is called
 * at all.
 *
 * Conductor has no equivalent static manifest of valid module names to fetch instead, so this
 * manifest treats *every* queried name as a valid, metadata-free module (`{ tabs: [] }`, no chapter
 * gate) via a `Proxy` — deferring the real validation to where it actually belongs, module loading
 * itself: an unknown module name fails when `ModuleLoaderRunnerPlugin.requestModule` rejects for it,
 * not earlier and not here.
 */
const permissiveManifest: ModulesManifest = new Proxy(
  {},
  {
    has: () => true,
    get: (): Omit<ModuleInfo, 'name'> => ({ tabs: [] }),
  },
);

export const conductorManifestImporter: ManifestImporter = () =>
  Promise.resolve({ default: permissiveManifest });

/**
 * A `sourceBundleImporter` (see `IOptions.importOptions`) backed by a Conductor module plugin
 * instead of the legacy pipeline's HTTP fetch. `preprocessFileImports` (`src/modules/preprocessor`)
 * already does everything *around* fetching a bundle — parsing the import graph, checking a
 * requested name is actually exported, chapter gating, bundling multiple files — all of which this
 * reuses unmodified; only *where the bundle's own exports come from* changes. See
 * source-academy/js-slang#2081's design doc for why this is the chosen integration point rather than
 * building a parallel pipeline.
 *
 * `PartialSourceModule` (`(require: RequireProvider) => LoadedBundle`) is shaped for the *legacy*
 * loader, whose bundles are plain JS modules built against `require('js-slang')`
 * (`src/modules/loader/requireProvider.ts`) — exposing js-slang's own internals to module code. A
 * Conductor module gets none of that: its exports arrive over `IDataHandler`, with no access to the
 * host language's guts (source-academy/js-slang#2062). So the factory this returns simply ignores the
 * `require` it's handed — there is nothing in it a Conductor module needs — and returns the bundle
 * this importer already finished building.
 *
 * `dh` is one `SourceDataHandler`, shared with the evaluator's own `ModuleLoaderRunnerPlugin`
 * registration — see `SourceEvaluator.ts`. It must be the *same* instance: every `TypedValue`
 * received here was allocated in that handler's own identifier tables, and a *different*
 * `SourceDataHandler` would reject them as dangling.
 */
export function createConductorBundleImporter(
  dh: SourceDataHandler,
): Importer<PartialSourceModule> {
  return async moduleName => {
    if (!ModuleLoaderRunnerPlugin.instance) {
      throw new Error(
        `Cannot import "${moduleName}": no module loader is registered on this evaluator.`,
      );
    }

    const modulePlugin = await ModuleLoaderRunnerPlugin.instance.requestModule(moduleName);

    const loadedBundle: LoadedBundle = {};
    for (const { symbol, value } of modulePlugin.exports) {
      loadedBundle[symbol] = await moduleToSource(dh, value, symbol);
    }

    return { default: () => loadedBundle };
  };
}
