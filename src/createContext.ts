// Variable determining chapter of Source is contained in this file.

import { GLOBAL, JSSLANG_PROPERTIES } from './constants'
import * as gpu_lib from './gpu/lib'
import { isFullJSChapter } from './runner'
import { AsyncScheduler } from './schedulers'
import { lazyListPrelude } from './stdlib/lazyList.prelude'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude'
import * as misc from './stdlib/misc'
import { nonDetPrelude } from './stdlib/non-det.prelude'
import * as parser from './stdlib/parser'
import * as stream from './stdlib/stream'
import { streamPrelude } from './stdlib/stream.prelude'
import { createTypeEnvironment, tForAll, tVar } from './typeChecker/typeChecker'
import { Context, CustomBuiltIns, Environment, NativeStorage, Value, Variant } from './types'
import { makeWrapper } from './utils/makeWrapper'
import * as operators from './utils/operators'
import { stringify } from './utils/stringify'

export class LazyBuiltIn {
  func: (...arg0: any) => any
  evaluateArgs: boolean
  constructor(func: (...arg0: any) => any, evaluateArgs: boolean) {
    this.func = func
    this.evaluateArgs = evaluateArgs
  }
}

export class EnvTree {
  private _root: EnvTreeNode | null = null
  private map = new Map<Environment, EnvTreeNode>()

  get root(): EnvTreeNode | null {
    return this._root
  }

  public insert(environment: Environment): void {
    const tailEnvironment = environment.tail
    if (tailEnvironment === null) {
      if (this._root === null) {
        this._root = new EnvTreeNode(environment, null)
        this.map.set(environment, this._root)
      }
    } else {
      const parentNode = this.map.get(tailEnvironment)
      if (parentNode) {
        const childNode = new EnvTreeNode(environment, parentNode)
        parentNode.addChild(childNode)
        this.map.set(environment, childNode)
      }
    }
  }

  public getTreeNode(environment: Environment): EnvTreeNode | undefined {
    return this.map.get(environment)
  }
}

export class EnvTreeNode {
  private _children: EnvTreeNode[] = []

  constructor(readonly environment: Environment, public parent: EnvTreeNode | null) {}

  get children(): EnvTreeNode[] {
    return this._children
  }

  public resetChildren(newChildren: EnvTreeNode[]): void {
    this.clearChildren()
    this.addChildren(newChildren)
    newChildren.forEach(c => (c.parent = this))
  }

  private clearChildren(): void {
    this._children = []
  }

  private addChildren(newChildren: EnvTreeNode[]): void {
    this._children.push(...newChildren)
  }

  public addChild(newChild: EnvTreeNode): EnvTreeNode {
    this._children.push(newChild)
    return newChild
  }
}

const createEmptyRuntime = () => ({
  break: false,
  debuggerOn: true,
  isRunning: false,
  environmentTree: new EnvTree(),
  environments: [],
  value: undefined,
  nodes: []
})

const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: {
    it: (function* (): any {
      return
    })(),
    scheduler: new AsyncScheduler()
  }
})

export const createGlobalEnvironment = (): Environment => ({
  tail: null,
  name: 'global',
  head: {},
  id: '-1'
})

const createNativeStorage = (): NativeStorage => ({
  builtins: new Map(),
  previousProgramsIdentifiers: new Set(),
  operators: new Map(Object.entries(operators)),
  gpu: new Map(Object.entries(gpu_lib)),
  maxExecTime: JSSLANG_PROPERTIES.maxExecTime,
  evaller: null
})

export const createEmptyContext = <T>(
  chapter: number,
  variant: Variant = 'default',
  externalSymbols: string[],
  externalContext?: T,
  moduleParams?: any
): Context<T> => {
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    moduleParams,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    nativeStorage: createNativeStorage(),
    executionMethod: 'auto',
    variant,
    unTypecheckedCode: [],
    typeEnvironment: createTypeEnvironment(chapter),
    previousCode: []
  }
}

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime()
  }
  if (!context.runtime.environments) {
    context.runtime.environments = []
  }
  if (!context.runtime.environmentTree) {
    context.runtime.environmentTree = new EnvTree()
  }
  if (context.runtime.environments.length === 0) {
    const globalEnvironment = createGlobalEnvironment()
    context.runtime.environments.push(globalEnvironment)
    context.runtime.environmentTree.insert(globalEnvironment)
  }
}

export const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalEnvironment = context.runtime.environments[0]
  Object.defineProperty(globalEnvironment.head, name, {
    value,
    writable: false,
    enumerable: true
  })
  context.nativeStorage.builtins.set(name, value)
  const typeEnv = context.typeEnvironment[0]
  // if the global type env doesn't already have the imported symbol,
  // we set it to a type var T that can typecheck with anything.
  if (!typeEnv.declKindMap.has(name)) {
    typeEnv.typeMap.set(name, tForAll(tVar('T1')))
    typeEnv.declKindMap.set(name, 'const')
  }
}

export function defineBuiltin(
  context: Context,
  name: `${string}${'=' | '...'}${string}`, // enforce minArgsNeeded
  value: Value,
  minArgsNeeded: number
): void
export function defineBuiltin(
  context: Context,
  name: string,
  value: Value,
  minArgsNeeded?: number
): void
// Defines a builtin in the given context
// If the builtin is a function, wrap it such that its toString hides the implementation
export function defineBuiltin(
  context: Context,
  name: string,
  value: Value,
  minArgsNeeded: undefined | number = undefined
) {
  if (typeof value === 'function') {
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    value.toString = () => repr
    value.minArgsNeeded = minArgsNeeded

    defineSymbol(context, funName, value)
  } else if (value instanceof LazyBuiltIn) {
    const wrapped = (...args: any) => value.func(...args)
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    wrapped.toString = () => repr
    makeWrapper(value.func, wrapped)
    defineSymbol(context, funName, new LazyBuiltIn(wrapped, value.evaluateArgs))
  } else {
    defineSymbol(context, name, value)
  }
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  ensureGlobalEnvironmentExist(context)

  externalSymbols.forEach(symbol => {
    defineSymbol(context, symbol, GLOBAL[symbol])
  })
}

/**
 * Imports builtins from standard and external libraries.
 */
export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  ensureGlobalEnvironmentExist(context)
  const rawDisplay = (v: Value, ...s: string[]) =>
    externalBuiltIns.rawDisplay(v, s[0], context.externalContext)
  const display = (v: Value, ...s: string[]) => {
    if (s.length === 1 && s[0] !== undefined && typeof s[0] !== 'string') {
      throw new TypeError('display expects the second argument to be a string')
    }
    return rawDisplay(stringify(v), s[0]), v
  }
  const displayList = (v: Value, ...s: string[]) => {
    if (s.length === 1 && s[0] !== undefined && typeof s[0] !== 'string') {
      throw new TypeError('display_list expects the second argument to be a string')
    }
    return list.rawDisplayList(display, v, s[0])
  }
  const prompt = (v: Value) => {
    const start = Date.now()
    const promptResult = externalBuiltIns.prompt(v, '', context.externalContext)
    context.nativeStorage.maxExecTime += Date.now() - start
    return promptResult
  }
  const alert = (v: Value) => {
    const start = Date.now()
    externalBuiltIns.alert(v, '', context.externalContext)
    context.nativeStorage.maxExecTime += Date.now() - start
  }
  const visualiseList = (...v: Value) => {
    externalBuiltIns.visualiseList(v, context.externalContext)
    return v[0]
  }

  if (context.chapter >= 1) {
    defineBuiltin(context, 'get_time()', misc.get_time)
    defineBuiltin(context, 'display(val, prepend = undefined)', display, 1)
    defineBuiltin(context, 'raw_display(str, prepend = undefined)', rawDisplay, 1)
    defineBuiltin(context, 'stringify(val, indent = 2, maxLineLength = 80)', stringify, 1)
    defineBuiltin(context, 'error(str, prepend = undefined)', misc.error_message, 1)
    defineBuiltin(context, 'prompt(str)', prompt)
    defineBuiltin(context, 'is_number(val)', misc.is_number)
    defineBuiltin(context, 'is_string(val)', misc.is_string)
    defineBuiltin(context, 'is_function(val)', misc.is_function)
    defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
    defineBuiltin(context, 'is_undefined(val)', misc.is_undefined)
    defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
    defineBuiltin(context, 'char_at(str, index)', misc.char_at)
    defineBuiltin(context, 'arity(f)', misc.arity)
    defineBuiltin(context, 'undefined', undefined)
    defineBuiltin(context, 'NaN', NaN)
    defineBuiltin(context, 'Infinity', Infinity)
    // Define all Math libraries
    const mathLibraryNames = Object.getOwnPropertyNames(Math)
    // Short param names for stringified version of math functions
    const parameterNames = [...'abcdefghijklmnopqrstuvwxyz']
    for (const name of mathLibraryNames) {
      const value = Math[name]
      if (typeof value === 'function') {
        let paramString: string
        let minArgsNeeded = undefined
        if (name === 'max' || name === 'min') {
          paramString = '...values'
          minArgsNeeded = 0
        } else {
          paramString = parameterNames.slice(0, value.length).join(', ')
        }
        defineBuiltin(context, `math_${name}(${paramString})`, value, minArgsNeeded)
      } else {
        defineBuiltin(context, `math_${name}`, value)
      }
    }
  }

  if (context.chapter >= 2) {
    // List library

    if (context.variant === 'lazy') {
      defineBuiltin(context, 'pair(left, right)', new LazyBuiltIn(list.pair, false))
      defineBuiltin(context, 'list(...values)', new LazyBuiltIn(list.list, false), 0)
      defineBuiltin(context, 'is_pair(val)', new LazyBuiltIn(list.is_pair, true))
      defineBuiltin(context, 'head(xs)', new LazyBuiltIn(list.head, true))
      defineBuiltin(context, 'tail(xs)', new LazyBuiltIn(list.tail, true))
      defineBuiltin(context, 'is_null(val)', new LazyBuiltIn(list.is_null, true))
      defineBuiltin(context, 'draw_data(...xs)', new LazyBuiltIn(visualiseList, true), 1)
      defineBuiltin(context, 'is_list(val)', new LazyBuiltIn(list.is_list, true))
    } else {
      defineBuiltin(context, 'pair(left, right)', list.pair)
      defineBuiltin(context, 'is_pair(val)', list.is_pair)
      defineBuiltin(context, 'head(xs)', list.head)
      defineBuiltin(context, 'tail(xs)', list.tail)
      defineBuiltin(context, 'is_null(val)', list.is_null)
      defineBuiltin(context, 'list(...values)', list.list, 0)
      defineBuiltin(context, 'draw_data(...xs)', visualiseList, 1)
      defineBuiltin(context, 'display_list(val, prepend = undefined)', displayList, 0)
      defineBuiltin(context, 'is_list(val)', list.is_list)
    }
  }

  if (context.chapter >= 3) {
    defineBuiltin(context, 'set_head(xs, val)', list.set_head)
    defineBuiltin(context, 'set_tail(xs, val)', list.set_tail)
    defineBuiltin(context, 'array_length(arr)', misc.array_length)
    defineBuiltin(context, 'is_array(val)', misc.is_array)

    // Stream library
    defineBuiltin(context, 'stream_tail(stream)', stream.stream_tail)
    defineBuiltin(context, 'stream(...values)', stream.stream, 0)
  }

  if (context.chapter >= 4) {
    defineBuiltin(context, 'parse(program_string)', (str: string) =>
      parser.parse(str, createContext(context.chapter))
    )
    defineBuiltin(context, 'tokenize(program_string)', (str: string) =>
      parser.tokenize(str, createContext(context.chapter))
    )
    defineBuiltin(
      context,
      'apply_in_underlying_javascript(fun, args)',
      // tslint:disable-next-line:ban-types
      (fun: Function, args: Value) => fun.apply(fun, list_to_vector(args))
    )

    if (context.variant === 'gpu') {
      defineBuiltin(context, '__clearKernelCache()', gpu_lib.__clearKernelCache)
      defineBuiltin(
        context,
        '__createKernelSource(shape, extern, localNames, output, fun, kernelId)',
        gpu_lib.__createKernelSource
      )
    }
  }

  if (context.chapter >= 100) {
    defineBuiltin(context, 'is_object(val)', misc.is_object)
    defineBuiltin(context, 'is_NaN(val)', misc.is_NaN)
    defineBuiltin(context, 'has_own_property(obj, prop)', misc.has_own_property)
    defineBuiltin(context, 'alert(val)', alert)
    // tslint:disable-next-line:ban-types
    defineBuiltin(context, 'timed(fun)', (f: Function) =>
      misc.timed(context, f, context.externalContext, externalBuiltIns.rawDisplay)
    )
  }

  if (context.variant === 'lazy') {
    defineBuiltin(context, 'wrapLazyCallee(f)', new LazyBuiltIn(operators.wrapLazyCallee, true))
    defineBuiltin(context, 'makeLazyFunction(f)', new LazyBuiltIn(operators.makeLazyFunction, true))
    defineBuiltin(context, 'forceIt(val)', new LazyBuiltIn(operators.forceIt, true))
    defineBuiltin(context, 'delayIt(xs)', new LazyBuiltIn(operators.delayIt, true))
  }
}

function importPrelude(context: Context) {
  let prelude = ''
  if (context.chapter >= 2) {
    prelude += context.variant === 'lazy' ? lazyListPrelude : listPrelude
  }
  if (context.chapter >= 3) {
    prelude += streamPrelude
  }

  if (context.variant === 'non-det') {
    prelude += nonDetPrelude
  }

  if (prelude !== '') {
    context.prelude = prelude
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  rawDisplay: misc.rawDisplay,
  // See issue #5
  prompt: misc.rawDisplay,
  // See issue #11
  alert: misc.rawDisplay,
  // TODO: 'v' is defined but never used
  visualiseList: (v: Value) => {
    throw new Error('List visualizer is not enabled')
  }
}

const createContext = <T>(
  chapter = 1,
  variant: Variant = 'default',
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns,
  moduleParams?: any
): Context => {
  if (isFullJSChapter(chapter)) {
    // fullJS will include all builtins and preludes of source 4
    return {
      ...createContext(
        4,
        variant,
        externalSymbols,
        externalContext,
        externalBuiltIns,
        moduleParams
      ),
      chapter: -1
    } as Context
  }

  const context = createEmptyContext(
    chapter,
    variant,
    externalSymbols,
    externalContext,
    moduleParams
  )

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
