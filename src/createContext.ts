// Variable determining chapter of Source is contained in this file.

import { GLOBAL, JSSLANG_PROPERTIES } from './constants';
import { call_with_current_continuation } from './cse-machine/continuations';
import Heap from './cse-machine/heap';
import { GeneralRuntimeError } from './errors/base';
import { InvalidParameterTypeError } from './errors/rttcErrors';
import { Chapter, Variant, type LanguageOptions } from './langs';
import { createEmptyModuleContexts } from './modules/utils';
import * as list from './stdlib/list';
import { list_to_vector } from './stdlib/list';
import { listPrelude } from './stdlib/list.prelude';
import { localImportPrelude } from './stdlib/localImport.prelude';
import * as misc from './stdlib/misc';
import * as parser from './stdlib/parser';
import * as stream from './stdlib/stream';
import { streamPrelude } from './stdlib/stream.prelude';
import { createTypeEnvironment, tForAll, tVar } from './typeChecker/utils';
import type { Context, CustomBuiltIns, Environment, NativeStorage, Value } from './types';
import * as operators from './utils/operators';
import { stringify } from './utils/stringify';

export class EnvTree {
  private _root: EnvTreeNode | null = null;
  private map = new Map<Environment, EnvTreeNode>();

  get root(): EnvTreeNode | null {
    return this._root;
  }

  public insert(environment: Environment): void {
    const tailEnvironment = environment.tail;
    if (tailEnvironment === null) {
      if (this._root === null) {
        this._root = new EnvTreeNode(environment, null);
        this.map.set(environment, this._root);
      }
    } else {
      const parentNode = this.map.get(tailEnvironment);
      if (parentNode) {
        const childNode = new EnvTreeNode(environment, parentNode);
        parentNode.addChild(childNode);
        this.map.set(environment, childNode);
      }
    }
  }

  public getTreeNode(environment: Environment): EnvTreeNode | undefined {
    return this.map.get(environment);
  }
}

export class EnvTreeNode {
  private _children: EnvTreeNode[] = [];

  constructor(
    readonly environment: Environment,
    public parent: EnvTreeNode | null,
  ) {}

  get children(): EnvTreeNode[] {
    return this._children;
  }

  public resetChildren(newChildren: EnvTreeNode[]): void {
    this.clearChildren();
    this.addChildren(newChildren);
    newChildren.forEach(c => (c.parent = this));
  }

  private clearChildren(): void {
    this._children = [];
  }

  private addChildren(newChildren: EnvTreeNode[]): void {
    this._children.push(...newChildren);
  }

  public addChild(newChild: EnvTreeNode): EnvTreeNode {
    this._children.push(newChild);
    return newChild;
  }
}

const createEmptyRuntime = () => ({
  break: false,
  debuggerOn: true,
  isRunning: false,
  environmentTree: new EnvTree(),
  environments: [],
  value: undefined,
  nodes: [],
  control: null,
  stash: null,
  objectCount: 0,
  envSteps: -1,
  envStepsTotal: 0,
  breakpointSteps: [],
  changepointSteps: [],
});

const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: {
    it: (function* (): any {
      return;
    })(),
  },
});

export const createGlobalEnvironment = (): Environment => ({
  tail: null,
  name: 'global',
  head: {},
  heap: new Heap(),
  id: '-1',
});

const createNativeStorage = (): NativeStorage => ({
  builtins: new Map(),
  previousProgramsIdentifiers: new Set(),
  operators: new Map(Object.entries(operators)),
  maxExecTime: JSSLANG_PROPERTIES.maxExecTime,
  evaller: null,
  loadedModules: {},
  loadedModuleTypes: {},
});

export const createEmptyContext = <T>(
  chapter: Chapter,
  variant: Variant = Variant.DEFAULT,
  languageOptions: LanguageOptions = {},
  externalSymbols: string[],
  externalContext?: T,
): Context<T> => {
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    pendingStreamFnStack: [],
    streamLineage: new Map<string, string[]>(),
    debugger: createEmptyDebugger(),
    nativeStorage: createNativeStorage(),
    executionMethod: 'auto',
    variant,
    languageOptions,
    moduleContexts: createEmptyModuleContexts(),
    unTypecheckedCode: [],
    typeEnvironment: createTypeEnvironment(chapter),
    previousPrograms: [],
    shouldIncreaseEvaluationTimeout: false,
  };
};

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime();
  }
  if (!context.runtime.environments) {
    context.runtime.environments = [];
  }
  if (!context.runtime.environmentTree) {
    context.runtime.environmentTree = new EnvTree();
  }
  if (context.runtime.environments.length === 0) {
    const globalEnvironment = createGlobalEnvironment();
    context.runtime.environments.push(globalEnvironment);
    context.runtime.environmentTree.insert(globalEnvironment);
  }
};

export function defineSymbol(context: Context, name: string, value: Value) {
  const globalEnvironment = context.runtime.environments[0];

  if (!(name in globalEnvironment.head)) {
    Object.defineProperty(globalEnvironment.head, name, {
      value,
      writable: false,
      enumerable: true,
    });
  }

  context.nativeStorage.builtins.set(name, value);
  const typeEnv = context.typeEnvironment[0];
  // if the global type env doesn't already have the imported symbol,
  // we set it to a type var T that can typecheck with anything.
  if (!typeEnv.declKindMap.has(name)) {
    typeEnv.typeMap.set(name, tForAll(tVar('T1')));
    typeEnv.declKindMap.set(name, 'const');
  }
}

// Defines a builtin in the given context
// If the builtin is a function, wrap it such that its toString hides the implementation
export function defineBuiltin(
  context: Context,
  name: string,
  value: Value,
  minArgsNeeded?: number,
) {
  function extractName(name: string): string {
    return name.split('(')[0].trim();
  }

  function extractParameters(name: string): string[] {
    // if the function has no () in its name, it has no parameters
    if (!name.includes('(')) {
      return [];
    }
    return name
      .split('(')[1]
      .split(')')[0]
      .split(',')
      .map(s => s.trim());
  }

  if (typeof value === 'function') {
    const funName = extractName(name);
    const funParameters = extractParameters(name);

    const wrapped = operators.wrap(
      value,
      `function ${name} {\n\t[implementation hidden]\n}`,
      minArgsNeeded,
      false,
    );

    // value.toString = () => repr;
    // value.minArgsNeeded = minArgsNeeded;
    value.funName = funName;
    value.funParameters = funParameters;
    Object.defineProperty(value, 'name', { value: funName });

    defineSymbol(context, funName, wrapped);
  } else {
    defineSymbol(context, name, value);
  }
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  ensureGlobalEnvironmentExist(context);

  externalSymbols.forEach(symbol => {
    defineSymbol(context, symbol, GLOBAL[symbol as keyof typeof GLOBAL]);
  });
};

/**
 * Imports builtins from standard and external libraries.
 */
export function importBuiltins(context: Context, externalBuiltIns: Partial<CustomBuiltIns> = {}) {
  ensureGlobalEnvironmentExist(context);
  const rawDisplay = (v: Value, ...s: string[]) =>
    (externalBuiltIns.rawDisplay ?? defaultBuiltIns.rawDisplay)(v, s[0], context.externalContext);

  const display = (v: Value, ...s: string[]) => {
    if (s.length === 1 && s[0] !== undefined && typeof s[0] !== 'string') {
      throw new InvalidParameterTypeError('string', s[0], display.name, 'second argument');
    }

    rawDisplay(stringify(v), s[0]);
    return v;
  };

  const display_list = (v: Value, ...s: string[]) => {
    if (s.length === 1 && s[0] !== undefined && typeof s[0] !== 'string') {
      throw new InvalidParameterTypeError('string', s[0], display_list.name, 'second argument');
    }
    return list.rawDisplayList(display, v, s[0]);
  };

  const prompt = (v: Value) => {
    const start = Date.now();
    const promptResult = (externalBuiltIns.prompt ?? defaultBuiltIns.prompt)(
      v,
      '',
      context.externalContext,
    );
    context.nativeStorage.maxExecTime += Date.now() - start;
    return promptResult;
  };
  const alert = (v: Value) => {
    const start = Date.now();
    (externalBuiltIns.alert ?? defaultBuiltIns.alert)(v, '', context.externalContext);
    context.nativeStorage.maxExecTime += Date.now() - start;
  };
  const visualise_list = (...v: Value[]) => {
    (externalBuiltIns.visualiseList ?? defaultBuiltIns.visualiseList)(v, context.externalContext);
    return v[0];
  };

  if (context.chapter >= 1) {
    defineBuiltin(context, 'get_time()', misc.get_time);
    defineBuiltin(context, 'display(val, prepend = undefined)', display, 1);
    defineBuiltin(context, 'raw_display(str, prepend = undefined)', rawDisplay, 1);
    defineBuiltin(context, 'stringify(val, indent = 2, maxLineLength = 80)', stringify, 1);
    defineBuiltin(context, 'error(str, prepend = undefined)', misc.error_message, 1);
    defineBuiltin(context, 'prompt(str)', prompt);
    defineBuiltin(context, 'is_number(val)', misc.is_number);
    defineBuiltin(context, 'is_string(val)', misc.is_string);
    defineBuiltin(context, 'is_function(val)', misc.is_function);
    defineBuiltin(context, 'is_boolean(val)', misc.is_boolean);
    defineBuiltin(context, 'is_undefined(val)', misc.is_undefined);
    defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int);
    defineBuiltin(context, 'char_at(str, index)', misc.char_at);
    defineBuiltin(context, 'arity(f)', misc.arity);
    defineBuiltin(context, 'undefined', undefined);
    defineBuiltin(context, 'NaN', NaN);
    defineBuiltin(context, 'Infinity', Infinity);
    // Define all Math libraries
    const mathLibraryNames = Object.getOwnPropertyNames(Math);
    // Short param names for stringified version of math functions
    const parameterNames = [...'abcdefghijklmnopqrstuvwxyz'];
    for (const name of mathLibraryNames) {
      const value = Math[name as keyof typeof Math];
      if (typeof value === 'function') {
        let paramString: string;
        let minArgsNeeded = undefined;
        if (name === 'max' || name === 'min') {
          paramString = '...values';
          minArgsNeeded = 0;
        } else {
          paramString = parameterNames.slice(0, value.length).join(', ');
        }
        defineBuiltin(context, `math_${name}(${paramString})`, value, minArgsNeeded);
      } else {
        defineBuiltin(context, `math_${name}`, value);
      }
    }
  }

  if (context.chapter >= 2) {
    // List library
    defineBuiltin(context, 'pair(left, right)', list.pair);
    defineBuiltin(context, 'is_pair(val)', list.is_pair);
    defineBuiltin(context, 'head(xs)', list.head);
    defineBuiltin(context, 'tail(xs)', list.tail);
    defineBuiltin(context, 'is_null(val)', list.is_null);
    defineBuiltin(context, 'list(...values)', list.list, 0);
    defineBuiltin(context, 'draw_data(...xs)', visualise_list, 1);
    defineBuiltin(context, 'display_list(val, prepend = undefined)', display_list, 0);
    defineBuiltin(context, 'is_list(val)', list.is_list);
  }

  if (context.chapter >= 3) {
    defineBuiltin(context, 'set_head(xs, val)', list.set_head);
    defineBuiltin(context, 'set_tail(xs, val)', list.set_tail);
    defineBuiltin(context, 'array_length(arr)', misc.array_length);
    defineBuiltin(context, 'is_array(val)', misc.is_array);

    // Stream library
    defineBuiltin(context, 'stream(...values)', stream.stream, 0);
  }

  if (context.chapter >= 4) {
    defineBuiltin(context, 'parse(program_string)', (str: string) =>
      parser.parse(str, createContext(context.chapter)),
    );
    defineBuiltin(context, 'tokenize(program_string)', (str: string) =>
      parser.tokenize(str, createContext(context.chapter), true),
    );
    defineBuiltin(
      context,
      'apply_in_underlying_javascript(fun, args)',
      (fun: Function, args: Value) => fun.apply(fun, list_to_vector(args)),
    );

    // Continuations for explicit-control variant
    if (context.chapter >= 4) {
      defineBuiltin(
        context,
        'call_cc(f)',
        context.variant === Variant.EXPLICIT_CONTROL
          ? call_with_current_continuation
          : (_f: any) => {
              throw new Error('call_cc is only available in Explicit-Control variant');
            },
      );
    }
  }

  if (context.chapter === Chapter.LIBRARY_PARSER) {
    defineBuiltin(context, 'is_object(val)', misc.is_object);
    defineBuiltin(context, 'is_NaN(val)', misc.is_NaN);
    defineBuiltin(context, 'has_own_property(obj, prop)', misc.has_own_property);
    defineBuiltin(context, 'alert(val)', alert);
    defineBuiltin(context, 'timed(fun)', (f: Function) =>
      misc.timed(
        context,
        f,
        context.externalContext,
        externalBuiltIns.rawDisplay ?? defaultBuiltIns.rawDisplay,
      ),
    );
  }
}

function importPrelude(context: Context) {
  let prelude = '';
  if (context.chapter >= 2) {
    prelude += listPrelude;
    prelude += localImportPrelude;
  }
  if (context.chapter >= 3) {
    prelude += streamPrelude;
  }

  if (prelude !== '') {
    context.prelude = prelude;
  }
}

export const defaultBuiltIns: CustomBuiltIns = {
  rawDisplay: misc.rawDisplay,
  // See issue #5
  prompt: misc.rawDisplay,
  // See issue #11
  alert: misc.rawDisplay,
  visualiseList: (_v: Value) => {
    throw new GeneralRuntimeError('List visualizer is not enabled');
  },
};

const createContext = <T>(
  chapter: Chapter = Chapter.SOURCE_1,
  variant: Variant = Variant.DEFAULT,
  languageOptions: LanguageOptions = {},
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: Partial<CustomBuiltIns> = {},
): Context => {
  if (chapter === Chapter.FULL_JS || chapter === Chapter.FULL_TS) {
    // fullJS will include all builtins and preludes of source 4
    return {
      ...createContext(
        Chapter.SOURCE_4,
        variant,
        languageOptions,
        externalSymbols,
        externalContext,
        externalBuiltIns,
      ),
      chapter,
    } as Context;
  }

  const context = createEmptyContext(
    chapter,
    variant,
    languageOptions,
    externalSymbols,
    externalContext,
  );

  importBuiltins(context, externalBuiltIns);
  importPrelude(context);
  importExternalSymbols(context, externalSymbols);

  return context;
};

export default createContext;
