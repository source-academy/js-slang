// Variable determining chapter of Source is contained in this file.

import * as scheme_libs from './alt-langs/scheme/scm-slang/src/stdlib/source-scheme-library'
import {
  scheme1Prelude,
  scheme2Prelude,
  scheme3Prelude,
  scheme4Prelude,
  schemeFullPrelude
} from './stdlib/scheme.prelude'
import { GLOBAL, JSSLANG_PROPERTIES } from './constants'
import { call_with_current_continuation } from './cse-machine/continuations'
import Heap from './cse-machine/heap'
import * as gpu_lib from './gpu/lib'
import { AsyncScheduler } from './schedulers'
import { lazyListPrelude } from './stdlib/lazyList.prelude'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude'
import { localImportPrelude } from './stdlib/localImport.prelude'
import * as misc from './stdlib/misc'
import { nonDetPrelude } from './stdlib/non-det.prelude'
import * as parser from './stdlib/parser'
import * as pylib from './stdlib/pylib'
import * as stream from './stdlib/stream'
import { streamPrelude } from './stdlib/stream.prelude'
import { createTypeEnvironment, tForAll, tVar } from './typeChecker/utils'
import {
  Chapter,
  Context,
  CustomBuiltIns,
  Environment,
  NativeStorage,
  Value,
  Variant
} from './types'
import { makeWrapper } from './utils/makeWrapper'
import * as operators from './utils/operators'
import { stringify } from './utils/stringify'
import { schemeVisualise } from './alt-langs/scheme/scheme-mapper'
import { cset_apply, cset_eval } from './cse-machine/scheme-macros'
import { Transformers } from './cse-machine/interpreter'

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
  nodes: [],
  control: null,
  stash: null,
  transformers: new Transformers(),
  objectCount: 0,
  envSteps: -1,
  envStepsTotal: 0,
  breakpointSteps: [],
  changepointSteps: []
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
  heap: new Heap(),
  id: '-1'
})

const createNativeStorage = (): NativeStorage => ({
  builtins: new Map(),
  previousProgramsIdentifiers: new Set(),
  operators: new Map(Object.entries(operators)),
  gpu: new Map(Object.entries(gpu_lib)),
  maxExecTime: JSSLANG_PROPERTIES.maxExecTime,
  evaller: null,
  loadedModules: {},
  loadedModuleTypes: {}
})

export const createEmptyContext = <T>(
  chapter: Chapter,
  variant: Variant = Variant.DEFAULT,
  externalSymbols: string[],
  externalContext?: T
): Context<T> => {
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    nativeStorage: createNativeStorage(),
    executionMethod: 'auto',
    variant,
    moduleContexts: {},
    unTypecheckedCode: [],
    typeEnvironment: createTypeEnvironment(chapter),
    previousPrograms: [],
    shouldIncreaseEvaluationTimeout: false
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
  name: string, // enforce minArgsNeeded
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
  function extractName(name: string): string {
    return name.split('(')[0].trim()
  }

  function extractParameters(name: string): string[] {
    // if the function has no () in its name, it has no parameters
    if (!name.includes('(')) {
      return []
    }
    return name
      .split('(')[1]
      .split(')')[0]
      .split(',')
      .map(s => s.trim())
  }

  if (typeof value === 'function') {
    const funName = extractName(name)
    const funParameters = extractParameters(name)
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    value.toString = () => repr
    value.minArgsNeeded = minArgsNeeded
    value.funName = funName
    value.funParameters = funParameters

    defineSymbol(context, funName, value)
  } else if (value instanceof LazyBuiltIn) {
    const wrapped = (...args: any) => value.func(...args)
    const funName = extractName(name)
    const funParameters = extractParameters(name)
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    wrapped.toString = () => repr
    wrapped.funName = funName
    wrapped.funParameters = funParameters
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

    if (context.variant === Variant.LAZY) {
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

    if (context.variant === Variant.GPU) {
      defineBuiltin(context, '__clearKernelCache()', gpu_lib.__clearKernelCache)
      defineBuiltin(
        context,
        '__createKernelSource(shape, extern, localNames, output, fun, kernelId)',
        gpu_lib.__createKernelSource
      )
    }

    // Continuations for explicit-control variant
    if (context.chapter >= 4) {
      defineBuiltin(
        context,
        'call_cc(f)',
        context.variant === Variant.EXPLICIT_CONTROL
          ? call_with_current_continuation
          : (f: any) => {
              throw new Error('call_cc is only available in Explicit-Control variant')
            }
      )
    }
  }

  if (context.chapter === Chapter.LIBRARY_PARSER) {
    defineBuiltin(context, 'is_object(val)', misc.is_object)
    defineBuiltin(context, 'is_NaN(val)', misc.is_NaN)
    defineBuiltin(context, 'has_own_property(obj, prop)', misc.has_own_property)
    defineBuiltin(context, 'alert(val)', alert)
    // tslint:disable-next-line:ban-types
    defineBuiltin(context, 'timed(fun)', (f: Function) =>
      misc.timed(context, f, context.externalContext, externalBuiltIns.rawDisplay)
    )
  }

  if (context.variant === Variant.LAZY) {
    defineBuiltin(context, 'wrapLazyCallee(f)', new LazyBuiltIn(operators.wrapLazyCallee, true))
    defineBuiltin(context, 'makeLazyFunction(f)', new LazyBuiltIn(operators.makeLazyFunction, true))
    defineBuiltin(context, 'forceIt(val)', new LazyBuiltIn(operators.forceIt, true))
    defineBuiltin(context, 'delayIt(xs)', new LazyBuiltIn(operators.delayIt, true))
  }

  if (context.chapter <= +Chapter.SCHEME_1 && context.chapter >= +Chapter.FULL_SCHEME) {
    switch (context.chapter) {
      case Chapter.FULL_SCHEME:
        // Introduction to eval
        // eval metaprocedure
        defineBuiltin(context, '$scheme_ZXZhbA$61$$61$(xs)', cset_eval)

      case Chapter.SCHEME_4:
        // Introduction to call/cc
        defineBuiltin(context, 'call$47$cc(f)', call_with_current_continuation)

      case Chapter.SCHEME_3:
        // Introduction to mutable values, streams

        // Scheme pair mutation
        defineBuiltin(context, 'set$45$car$33$(pair, val)', scheme_libs.set$45$car$33$)
        defineBuiltin(context, 'set$45$cdr$33$(pair, val)', scheme_libs.set$45$cdr$33$)

        // Scheme list mutation
        defineBuiltin(context, 'list$45$set$33$(xs, n, val)', scheme_libs.list$45$set$33$)
        //defineBuiltin(context, 'filter$33$(pred, xs)', scheme_libs.filterB);

        // Scheme promises
        defineBuiltin(context, 'make$45$promise(thunk)', scheme_libs.make$45$promise)
        defineBuiltin(context, 'promise$63$(p)', scheme_libs.promise$63$)
        defineBuiltin(context, 'force(p)', scheme_libs.force)

        // Scheme vectors
        defineBuiltin(context, 'vector(...vals)', scheme_libs.vector, 0)
        defineBuiltin(context, 'make$45$vector(n, val)', scheme_libs.make$45$vector, 1)

        defineBuiltin(context, 'vector$63$(v)', scheme_libs.vector$63$)

        defineBuiltin(context, 'vector$45$length(v)', scheme_libs.vector$45$length)
        defineBuiltin(context, 'vector$45$empty$63$(v)', scheme_libs.vector$45$empty$63$)

        defineBuiltin(context, 'vector$45$ref(v, k)', scheme_libs.vector$45$ref)

        defineBuiltin(context, 'vector$45$set$33$(v, k, val)', scheme_libs.vector$45$set$33$)
        defineBuiltin(
          context,
          'vector$45$fill$33$(v, val, start, end)',
          scheme_libs.vector$45$fill$33$,
          2
        )
        defineBuiltin(context, 'list$45$$62$vector(xs)', scheme_libs.list$45$$62$vector)

      case Chapter.SCHEME_2:
        // Scheme pairs
        defineBuiltin(context, 'cons(left, right)', scheme_libs.cons)
        defineBuiltin(context, 'xcons(right, left)', scheme_libs.xcons)
        defineBuiltin(context, 'pair$63$(val)', scheme_libs.pair$63$)
        defineBuiltin(context, 'not$45$pair$63$(val)', scheme_libs.not$45$pair$63$)
        defineBuiltin(context, 'car(xs)', scheme_libs.car)
        defineBuiltin(context, 'cdr(xs)', scheme_libs.cdr)

        // Scheme lists
        defineBuiltin(context, 'list(...vals)', scheme_libs.list, 0)
        defineBuiltin(context, 'list$42$(...vals)', scheme_libs.list$42$, 1)
        defineBuiltin(context, 'cons$42$(...vals)', scheme_libs.cons$42$, 1)
        defineBuiltin(context, 'circular$45$list(...vals)', scheme_libs.circular$45$list, 0)
        defineBuiltin(context, 'make$45$list(n, val)', scheme_libs.make$45$list, 1)

        defineBuiltin(context, 'circular$45$list$63$(val)', scheme_libs.circular$45$list$63$)
        defineBuiltin(context, 'proper$45$list$63$(val)', scheme_libs.proper$45$list$63$)
        defineBuiltin(context, 'dotted$45$list$63$(val)', scheme_libs.dotted$45$list$63$)
        defineBuiltin(context, 'null$63$(val)', scheme_libs.null$63$)
        defineBuiltin(context, 'null$45$list$63$(val)', scheme_libs.null$45$list$63$)
        defineBuiltin(context, 'list$63$(val)', scheme_libs.list$63$)

        defineBuiltin(context, 'list$45$tabulate(n, f)', scheme_libs.list$45$tabulate)
        defineBuiltin(context, 'list$45$tail(xs, n)', scheme_libs.list$45$tail)
        defineBuiltin(context, 'list$45$ref(xs, k)', scheme_libs.list$45$ref)
        defineBuiltin(context, 'last(xs)', scheme_libs.last)
        defineBuiltin(context, 'last$45$pair(xs)', scheme_libs.last$45$pair)

        defineBuiltin(context, 'first(xs)', scheme_libs.first)
        defineBuiltin(context, 'second(xs)', scheme_libs.second)
        defineBuiltin(context, 'third(xs)', scheme_libs.third)
        defineBuiltin(context, 'fourth(xs)', scheme_libs.fourth)
        defineBuiltin(context, 'fifth(xs)', scheme_libs.fifth)
        defineBuiltin(context, 'sixth(xs)', scheme_libs.sixth)
        defineBuiltin(context, 'seventh(xs)', scheme_libs.seventh)
        defineBuiltin(context, 'eighth(xs)', scheme_libs.eighth)
        defineBuiltin(context, 'ninth(xs)', scheme_libs.ninth)
        defineBuiltin(context, 'tenth(xs)', scheme_libs.tenth)

        // some of these functions will be represented
        // using the preludes
        // defineBuiltin(context, 'filter(pred, xs)', scheme_libs.filter)
        defineBuiltin(context, 'r7rs$45$map(f, ...xss)', scheme_libs.map, 2)
        defineBuiltin(context, 'r7rs$45$fold(f, init, ...xss)', scheme_libs.fold, 3)
        defineBuiltin(
          context,
          'r7rs$45$fold$45$right(f, init, ...xss)',
          scheme_libs.fold$45$right,
          3
        )
        defineBuiltin(context, 'r7rs$45$fold$45$left(f, init, ...xss)', scheme_libs.fold$45$left, 3)
        //defineBuiltin(context, 'reduce(f, ridentity, xs)', scheme_libs.reduce)
        //defineBuiltin(context, 'reduce$45$right(f, ridentity, xs)', scheme_libs.reduce$45$right)
        //defineBuiltin(context, 'reduce$45$left(f, ridentity, xs)', scheme_libs.reduce$45$left)

        defineBuiltin(context, 'any(xs)', scheme_libs.any)
        defineBuiltin(context, 'list$45$copy(xs)', scheme_libs.list$45$copy)
        defineBuiltin(context, 'length(xs)', scheme_libs.length)
        defineBuiltin(context, 'length$43$(xs)', scheme_libs.length$43$)
        defineBuiltin(context, 'r7rs$45$append(...xss)', scheme_libs.append, 0)
        defineBuiltin(context, 'concatenate(xss)', scheme_libs.concatenate)
        defineBuiltin(context, 'reverse(xs)', scheme_libs.reverse)
        defineBuiltin(context, 'take(xs, n)', scheme_libs.take)
        defineBuiltin(context, 'take$45$right(xs, n)', scheme_libs.take$45$right)
        defineBuiltin(context, 'drop(xs, n)', scheme_libs.drop)
        defineBuiltin(context, 'drop$45$right(xs, n)', scheme_libs.drop$45$right)

        defineBuiltin(context, 'list$61$(eq$45$pred, ...xss)', scheme_libs.list$61$, 1)

        /*
        defineBuiltin(context, 'memq(item, xs)', scheme_libs.memq)
        defineBuiltin(context, 'memv(item, xs)', scheme_libs.memv)
        defineBuiltin(context, 'member(item, xs)', scheme_libs.member)
        defineBuiltin(context, 'assq(item, xs)', scheme_libs.assq)
        defineBuiltin(context, 'assv(item, xs)', scheme_libs.assv)
        defineBuiltin(context, 'assoc(item, xs)', scheme_libs.assoc)
        */

        // Scheme cxrs

        defineBuiltin(context, 'caar(xs)', scheme_libs.caar)
        defineBuiltin(context, 'cadr(xs)', scheme_libs.cadr)
        defineBuiltin(context, 'cdar(xs)', scheme_libs.cdar)
        defineBuiltin(context, 'cddr(xs)', scheme_libs.cddr)
        defineBuiltin(context, 'caaar(xs)', scheme_libs.caaar)
        defineBuiltin(context, 'caadr(xs)', scheme_libs.caadr)
        defineBuiltin(context, 'cadar(xs)', scheme_libs.cadar)
        defineBuiltin(context, 'caddr(xs)', scheme_libs.caddr)
        defineBuiltin(context, 'cdaar(xs)', scheme_libs.cdaar)
        defineBuiltin(context, 'cdadr(xs)', scheme_libs.cdadr)
        defineBuiltin(context, 'cddar(xs)', scheme_libs.cddar)
        defineBuiltin(context, 'cdddr(xs)', scheme_libs.cdddr)
        defineBuiltin(context, 'caaaar(xs)', scheme_libs.caaaar)
        defineBuiltin(context, 'caaadr(xs)', scheme_libs.caaadr)
        defineBuiltin(context, 'caadar(xs)', scheme_libs.caadar)
        defineBuiltin(context, 'caaddr(xs)', scheme_libs.caaddr)
        defineBuiltin(context, 'cadaar(xs)', scheme_libs.cadaar)
        defineBuiltin(context, 'cadadr(xs)', scheme_libs.cadadr)
        defineBuiltin(context, 'caddar(xs)', scheme_libs.caddar)
        defineBuiltin(context, 'cadddr(xs)', scheme_libs.cadddr)
        defineBuiltin(context, 'cdaaar(xs)', scheme_libs.cdaaar)
        defineBuiltin(context, 'cdaadr(xs)', scheme_libs.cdaadr)
        defineBuiltin(context, 'cdadar(xs)', scheme_libs.cdadar)
        defineBuiltin(context, 'cdaddr(xs)', scheme_libs.cdaddr)
        defineBuiltin(context, 'cddaar(xs)', scheme_libs.cddaar)
        defineBuiltin(context, 'cddadr(xs)', scheme_libs.cddadr)
        defineBuiltin(context, 'cdddar(xs)', scheme_libs.cdddar)
        defineBuiltin(context, 'cddddr(xs)', scheme_libs.cddddr)

        // Scheme symbols

        defineBuiltin(context, 'symbol$63$(val)', scheme_libs.symbol$63$)
        defineBuiltin(context, 'symbol$61$$63$(sym1, sym2)', scheme_libs.symbol$61$$63$)
        //defineBuiltin(context, 'symbol$45$$62$string(str)', scheme_libs.symbol$45$$62$string)
        defineBuiltin(context, 'string$45$$62$symbol(sym)', scheme_libs.string$45$$62$symbol)

        // Scheme strings
        defineBuiltin(context, 'string$45$$62$list(str)', scheme_libs.string$45$$62$list)
        defineBuiltin(context, 'list$45$$62$string(xs)', scheme_libs.list$45$$62$string)

        // Scheme apply is needed here to help in the definition of the Scheme Prelude.
        defineBuiltin(context, 'apply(f, ...args)', cset_apply, 2)

      case Chapter.SCHEME_1:
        // Display
        defineBuiltin(
          context,
          'display(val, prepend = undefined)',
          (val: any, ...str: string[]) => display(schemeVisualise(val), ...str),
          1
        )
        defineBuiltin(context, 'newline()', () => display(''))

        // I/O
        defineBuiltin(context, 'read(str)', () => prompt(''))

        // Error
        defineBuiltin(context, 'error(str, prepend = undefined)', misc.error_message, 1)

        // Scheme truthy and falsy value evaluator
        defineBuiltin(context, 'truthy(val)', scheme_libs.truthy)

        // Scheme conversion from vector to list, defined here as
        // it is used to support variadic functions
        defineBuiltin(context, 'vector$45$$62$list(v)', scheme_libs.vector$45$$62$list)

        // Scheme function to build numbers
        defineBuiltin(context, 'make_number(n)', scheme_libs.make_number)

        // Scheme equality predicates

        defineBuiltin(context, 'eq$63$(...vals)', scheme_libs.eq$63$)
        defineBuiltin(context, 'eqv$63$(...vals)', scheme_libs.eqv$63$)
        defineBuiltin(context, 'equal$63$(...vals)', scheme_libs.equal$63$)

        // Scheme basic arithmetic
        defineBuiltin(context, '$43$(...vals)', scheme_libs.$43$, 0)
        defineBuiltin(context, '$42$(...vals)', scheme_libs.$42$, 0)
        defineBuiltin(context, '$45$(...vals)', scheme_libs.$45$, 1)
        defineBuiltin(context, '$47$(...vals)', scheme_libs.$47$, 1)

        // Scheme comparison
        defineBuiltin(context, '$61$(...vals)', scheme_libs.$61$, 2)
        defineBuiltin(context, '$60$(...vals)', scheme_libs.$60$, 2)
        defineBuiltin(context, '$62$(...vals)', scheme_libs.$62$, 2)
        defineBuiltin(context, '$60$$61$(...vals)', scheme_libs.$60$$61$, 2)
        defineBuiltin(context, '$62$$61$(...vals)', scheme_libs.$62$$61$, 2)

        // Scheme math functions
        defineBuiltin(context, 'number$63$(val)', scheme_libs.number$63$)
        defineBuiltin(context, 'complex$63$(val)', scheme_libs.complex$63$)
        defineBuiltin(context, 'real$63$(val)', scheme_libs.real$63$)
        defineBuiltin(context, 'rational$63$(val)', scheme_libs.rational$63$)
        defineBuiltin(context, 'integer$63$(val)', scheme_libs.integer$63$)
        defineBuiltin(context, 'exact$63$(val)', scheme_libs.exact$63$)
        defineBuiltin(context, 'inexact$63$(val)', scheme_libs.inexact$63$)
        //defineBuiltin(context, 'exact$45$integer$63$(val)', scheme_libs.exact_integerQ)
        defineBuiltin(context, 'zero$63$(val)', scheme_libs.zero$63$)
        defineBuiltin(context, 'infinity$63$(val)', scheme_libs.infinity$63$)
        defineBuiltin(context, 'nan$63$(val)', scheme_libs.nan$63$)
        defineBuiltin(context, 'negative$63$(val)', scheme_libs.negative$63$)
        defineBuiltin(context, 'odd$63$(val)', scheme_libs.odd$63$)
        defineBuiltin(context, 'even$63$(val)', scheme_libs.even$63$)
        defineBuiltin(context, 'max(...vals)', scheme_libs.max, 0)
        defineBuiltin(context, 'min(...vals)', scheme_libs.min, 0)
        defineBuiltin(context, 'abs(val)', scheme_libs.abs)

        defineBuiltin(context, 'numerator(val)', scheme_libs.numerator)
        defineBuiltin(context, 'denominator(val)', scheme_libs.denominator)

        defineBuiltin(context, 'quotient(n, d)', scheme_libs.quotient)
        defineBuiltin(context, 'modulo(n, d)', scheme_libs.modulo)
        defineBuiltin(context, 'remainder(n, d)', scheme_libs.remainder)
        defineBuiltin(context, 'gcd(...vals)', scheme_libs.gcd, 0)
        defineBuiltin(context, 'lcm(...vals)', scheme_libs.lcm, 0)
        defineBuiltin(context, 'square(val)', scheme_libs.square)
        defineBuiltin(context, 'floor(val)', scheme_libs.floor)
        defineBuiltin(context, 'ceiling(val)', scheme_libs.ceiling)
        defineBuiltin(context, 'truncate(val)', scheme_libs.truncate)
        defineBuiltin(context, 'round(val)', scheme_libs.round)
        defineBuiltin(context, 'sqrt(val)', scheme_libs.sqrt)
        defineBuiltin(context, 'expt(base, exp)', scheme_libs.expt)
        defineBuiltin(context, 'exp(val)', scheme_libs.exp)
        defineBuiltin(context, 'log(val)', scheme_libs.log)
        defineBuiltin(context, 'sqrt(val)', scheme_libs.sqrt)
        defineBuiltin(context, 'sin(val)', scheme_libs.sin)
        defineBuiltin(context, 'cos(val)', scheme_libs.cos)
        defineBuiltin(context, 'tan(val)', scheme_libs.tan)
        defineBuiltin(context, 'asin(val)', scheme_libs.asin)
        defineBuiltin(context, 'acos(val)', scheme_libs.acos)
        defineBuiltin(context, 'atan(n, m)', scheme_libs.atan, 1)

        defineBuiltin(context, 'make$45$rectangular(real, imag)', scheme_libs.make$45$rectangular)
        defineBuiltin(context, 'make$45$polar(mag, ang)', scheme_libs.make$45$polar)
        defineBuiltin(context, 'real$45$part(val)', scheme_libs.real$45$part)
        defineBuiltin(context, 'imag$45$part(val)', scheme_libs.imag$45$part)
        defineBuiltin(context, 'magnitude(val)', scheme_libs.magnitude)
        defineBuiltin(context, 'angle(val)', scheme_libs.angle)

        defineBuiltin(context, 'math$45$pi', scheme_libs.PI)
        defineBuiltin(context, 'math$45$e', scheme_libs.E)

        defineBuiltin(context, 'number$45$$62$string(val)', scheme_libs.number$45$$62$string)

        // special values for scm-slang

        // Scheme booleans
        defineBuiltin(context, 'boolean$63$(val)', scheme_libs.boolean$63$)
        defineBuiltin(context, 'boolean$61$$63$(x, y)', scheme_libs.boolean$61$$63$)
        defineBuiltin(context, 'and(...vals)', scheme_libs.and, 0)
        defineBuiltin(context, 'or(...vals)', scheme_libs.or, 0)
        defineBuiltin(context, 'not(val)', scheme_libs.not)

        // Scheme strings

        defineBuiltin(context, 'string$63$(val)', scheme_libs.string$63$)
        defineBuiltin(context, 'make$45$string(n, char)', scheme_libs.make$45$string, 1)
        defineBuiltin(context, 'string(...vals)', scheme_libs.string, 0)
        defineBuiltin(context, 'string$45$length(str)', scheme_libs.string$45$length)
        defineBuiltin(context, 'string$45$ref(str, k)', scheme_libs.string$45$ref)
        defineBuiltin(context, 'string$61$$63$(str1, str2)', scheme_libs.string$61$$63$)
        defineBuiltin(context, 'string$60$$63$(str1, str2)', scheme_libs.string$60$$63$)
        defineBuiltin(context, 'string$62$$63$(str1, str2)', scheme_libs.string$62$$63$)
        defineBuiltin(context, 'string$60$$61$$63$(str1, str2)', scheme_libs.string$60$$61$$63$)
        defineBuiltin(context, 'string$62$$61$$63$(str1, str2)', scheme_libs.string$62$$61$$63$)
        defineBuiltin(context, 'substring(str, start, end)', scheme_libs.substring, 2)
        defineBuiltin(context, 'string$45$append(...vals)', scheme_libs.string$45$append, 0)
        defineBuiltin(context, 'string$45$copy(str)', scheme_libs.string$45$copy)
        defineBuiltin(context, 'string$45$map(f, str)', scheme_libs.string$45$map)
        defineBuiltin(context, 'string$45$for$45$each(f, str)', scheme_libs.string$45$for$45$each)
        defineBuiltin(context, 'string$45$$62$number(str)', scheme_libs.string$45$$62$number)

        // Scheme procedures
        defineBuiltin(context, 'procedure$63$(val)', scheme_libs.procedure$63$)
        defineBuiltin(context, 'compose(...fns)', scheme_libs.compose, 0)

        // Special values
        defineBuiltin(context, 'undefined', undefined)
        break
      default:
      //should be unreachable
    }
  }

  if (context.chapter <= Chapter.PYTHON_1 && context.chapter >= Chapter.PYTHON_1) {
    if (context.chapter == Chapter.PYTHON_1) {
      // Display
      defineBuiltin(context, 'get_time()', misc.get_time)
      defineBuiltin(context, 'print(val)', display, 1)
      defineBuiltin(context, 'raw_print(str)', rawDisplay, 1)
      defineBuiltin(context, 'str(val)', (val: any) => stringify(val, 2, 80), 1)
      defineBuiltin(context, 'error(str)', misc.error_message, 1)
      defineBuiltin(context, 'prompt(str)', prompt)
      defineBuiltin(context, 'is_float(val)', pylib.is_float)
      defineBuiltin(context, 'is_int(val)', pylib.is_int)
      defineBuiltin(context, 'is_string(val)', misc.is_string)
      defineBuiltin(context, 'is_function(val)', misc.is_function)
      defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
      defineBuiltin(context, 'is_None(val)', list.is_null)
      defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
      defineBuiltin(context, 'char_at(str, index)', misc.char_at)
      defineBuiltin(context, 'arity(f)', misc.arity)
      defineBuiltin(context, 'None', null)

      // Binary operators
      defineBuiltin(context, '__py_adder(x, y)', pylib.__py_adder)
      defineBuiltin(context, '__py_minuser(x, y)', pylib.__py_minuser)
      defineBuiltin(context, '__py_multiplier(x, y)', pylib.__py_multiplier)
      defineBuiltin(context, '__py_divider(x, y)', pylib.__py_divider)
      defineBuiltin(context, '__py_modder(x, y)', pylib.__py_modder)
      defineBuiltin(context, '__py_powerer(x, y)', pylib.__py_powerer)
      defineBuiltin(context, '__py_floorer(x, y)', pylib.__py_floorer)

      // Unary operator +
      defineBuiltin(context, '__py_unary_plus(x)', pylib.__py_unary_plus)

      // Math Library
      defineBuiltin(context, 'math_abs(x)', pylib.math_abs)
      defineBuiltin(context, 'math_acos(x)', pylib.math_acos)
      defineBuiltin(context, 'math_acosh(x)', pylib.math_acosh)
      defineBuiltin(context, 'math_asin(x)', pylib.math_asin)
      defineBuiltin(context, 'math_asinh(x)', pylib.math_asinh)
      defineBuiltin(context, 'math_atan(x)', pylib.math_atan)
      defineBuiltin(context, 'math_atan2(x)', pylib.math_atan2)
      defineBuiltin(context, 'math_atanh(x)', pylib.math_atanh)
      defineBuiltin(context, 'math_cbrt(x)', pylib.math_cbrt)
      defineBuiltin(context, 'math_ceil(x)', pylib.math_ceil)
      defineBuiltin(context, 'math_clz32(x)', pylib.math_clz32)
      defineBuiltin(context, 'math_cos(x)', pylib.math_cos)
      defineBuiltin(context, 'math_cosh(x)', pylib.math_cosh)
      defineBuiltin(context, 'math_exp(x)', pylib.math_exp)
      defineBuiltin(context, 'math_expm1(x)', pylib.math_expm1)
      defineBuiltin(context, 'math_floor(x)', pylib.math_floor)
      defineBuiltin(context, 'math_fround(x)', pylib.math_fround)
      defineBuiltin(context, 'math_hypot(...values)', pylib.math_hypot)
      defineBuiltin(context, 'math_imul(x, y)', pylib.math_imul)
      defineBuiltin(context, 'math_log(x)', pylib.math_log)
      defineBuiltin(context, 'math_log1p(x)', pylib.math_log1p)
      defineBuiltin(context, 'math_log2(x)', pylib.math_log2)
      defineBuiltin(context, 'math_log10(x)', pylib.math_log10)
      defineBuiltin(context, 'math_max(...values)', pylib.math_max)
      defineBuiltin(context, 'math_min(...values)', pylib.math_min)
      defineBuiltin(context, 'math_pow(base, exponent)', pylib.math_pow)
      defineBuiltin(context, 'math_random()', pylib.math_random)
      defineBuiltin(context, 'math_round(x)', pylib.math_round)
      defineBuiltin(context, 'math_sign(x)', pylib.math_sign)
      defineBuiltin(context, 'math_sin(x)', pylib.math_sin)
      defineBuiltin(context, 'math_sinh(x)', pylib.math_sinh)
      defineBuiltin(context, 'math_sqrt(x)', pylib.math_sqrt)
      defineBuiltin(context, 'math_tan(x)', pylib.math_tan)
      defineBuiltin(context, 'math_tanh(x)', pylib.math_tanh)
      defineBuiltin(context, 'math_trunc(x)', pylib.math_trunc)

      // Math constants
      defineBuiltin(context, 'math_e', Math.E)
      defineBuiltin(context, 'math_inf', Infinity)
      defineBuiltin(context, 'math_nan', NaN)
      defineBuiltin(context, 'math_pi', Math.PI)
      defineBuiltin(context, 'math_tau', Math.PI * 2)
    }
  }
}

function importPrelude(context: Context) {
  let prelude = ''
  if (context.chapter >= 2) {
    prelude += context.variant === Variant.LAZY ? lazyListPrelude : listPrelude
    prelude += localImportPrelude
  }
  if (context.chapter >= 3) {
    prelude += streamPrelude
  }

  if (context.variant === Variant.NON_DET) {
    prelude += nonDetPrelude
  }

  if (context.chapter <= +Chapter.SCHEME_1 && context.chapter >= +Chapter.FULL_SCHEME) {
    // Scheme preludes
    // scheme 1 is the "highest" scheme chapter, so we can just check if it's less than or equal to scheme 1
    if (context.chapter <= +Chapter.SCHEME_1) {
      prelude += scheme1Prelude
    }
    if (context.chapter <= +Chapter.SCHEME_2) {
      prelude += scheme2Prelude
    }
    if (context.chapter <= +Chapter.SCHEME_3) {
      prelude += scheme3Prelude
    }
    if (context.chapter <= +Chapter.SCHEME_4) {
      prelude += scheme4Prelude
    }
    if (context.chapter <= +Chapter.FULL_SCHEME) {
      prelude += schemeFullPrelude
    }
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
  visualiseList: (_v: Value) => {
    throw new Error('List visualizer is not enabled')
  }
}

const createContext = <T>(
  chapter: Chapter = Chapter.SOURCE_1,
  variant: Variant = Variant.DEFAULT,
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns
): Context => {
  if (chapter === Chapter.FULL_JS || chapter === Chapter.FULL_TS) {
    // fullJS will include all builtins and preludes of source 4
    return {
      ...createContext(
        Chapter.SOURCE_4,
        variant,
        externalSymbols,
        externalContext,
        externalBuiltIns
      ),
      chapter
    } as Context
  }
  const context = createEmptyContext(chapter, variant, externalSymbols, externalContext)

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
