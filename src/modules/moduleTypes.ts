import type es from 'estree';
import type { Chapter } from '../langs';
import type { RequireProvider } from './loader/requireProvider';
import type { ImportAnalysisOptions } from './preprocessor/analyzer';
import type { LinkerOptions } from './preprocessor/linker';

export type ModuleDeclarationWithSource =
  | es.ImportDeclaration
  | es.ExportNamedDeclaration
  | es.ExportAllDeclaration;

/**
 * Represents the meta information for a Source module
 */
export interface ModuleInfo {
  name: string;
  tabs: string[];
  version?: string;
  requires?: Chapter;
  node?: ModuleDeclarationWithSource;
}

/**
 * Represents the main modules manifest that contains a ModuleInfo for each
 * Source module that exists
 */
export interface ModulesManifest {
  [module: string]: Omit<ModuleInfo, 'name'>;
}

export type PartialSourceModule = (require: RequireProvider) => LoadedBundle;

export type LoadedBundle = {
  [name: string]: any;
};

export interface FunctionDocumentation {
  kind: 'function';
  retType: string;
  description: string;
  params: [name: string, type: string][];
}

export interface VariableDocumentation {
  kind: 'variable';
  type: string;
  description: string;
}

export interface UnknownDocumentation {
  kind: 'unknown';
}

export const unknownDocs: UnknownDocumentation = { kind: 'unknown' };

export type ModuleDocsEntry = FunctionDocumentation | VariableDocumentation | UnknownDocumentation;

export interface ModuleDocumentation {
  [name: string]: ModuleDocsEntry;
};

export type Importer<T = object> = (
  name: string,
  node?: ModuleDeclarationWithSource,
) => Promise<{ default: T }>;

export type ManifestImporter = () => Promise<{ default: ModulesManifest }>;

export interface ImportLoadingOptions {
  /**
   * Set to `true` to load tabs when loading a module
   */
  loadTabs: boolean;

  sourceBundleImporter: Importer<PartialSourceModule>;
  sourceTabImporter: Importer<PartialSourceModule>;
  docsImporter: Importer<ModuleDocumentation>;
}

export type ImportOptions = ImportLoadingOptions & ImportAnalysisOptions & LinkerOptions;

export type SourceFiles = Partial<Record<string, string>>;
export type FileGetter = (p: string) => Promise<string | undefined>;

/**
 * Represents a module context, which is used to store the state of a module and the tabs that it has loaded
 * within the evaluation context
 */
export interface ModuleContext<TState = any> {
  /**
   * Whatever state the module wishes to store. If the state is set to `null`, it means that the module has not
   * been loaded yet.
   */
  state: null | TState;

  /**
   * The tabs that the module has loaded. If the tabs are set to `null`, it means that the module has not tried to
   * load its tabs yet.
   *
   * This array will be empty if the module does not have any tabs to load
   */
  tabs: null | any[];
}
