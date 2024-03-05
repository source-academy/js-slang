// Variable determining chapter of Source is contained in this file.

import { GLOBAL, JSSLANG_PROPERTIES } from './constants'
import { call_with_current_continuation } from './cse-machine/continuations'
import * as gpu_lib from './gpu/lib'
import { AsyncScheduler } from './schedulers'
import * as scheme_libs from './scm-slang/src/stdlib/source-scheme-library'
import { lazyListPrelude } from './stdlib/lazyList.prelude'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude'
import { localImportPrelude } from './stdlib/localImport.prelude'
import * as misc from './stdlib/misc'
import { nonDetPrelude } from './stdlib/non-det.prelude'
import * as parser from './stdlib/parser'
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
  envSteps: -1,
  envStepsTotal: 0,
  breakpointSteps: []
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

    if (context.variant === Variant.GPU) {
      defineBuiltin(context, '__clearKernelCache()', gpu_lib.__clearKernelCache)
      defineBuiltin(
        context,
        '__createKernelSource(shape, extern, localNames, output, fun, kernelId)',
        gpu_lib.__createKernelSource
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
        // Introduction to call/cc
        defineBuiltin(context, 'call$47$cc(f)', call_with_current_continuation)

      case Chapter.SCHEME_4:
        // Introduction to eval

        // Scheme apply
        defineBuiltin(context, 'apply(f, ...args)', scheme_libs.apply, 2)

      case Chapter.SCHEME_3:
        // Introduction to mutable values, streams

        // Scheme pair mutation
        defineBuiltin(context, 'set$45$car$33$(pair, val)', scheme_libs.set_carB)
        defineBuiltin(context, 'set$45$cdr$33$(pair, val)', scheme_libs.set_cdrB)

        // Scheme list mutation
        defineBuiltin(context, 'list$45$set$33$(xs, n, val)', scheme_libs.list_setB)
        //defineBuiltin(context, 'filter$33$(pred, xs)', scheme_libs.filterB);

        // Scheme promises
        defineBuiltin(context, 'promise$63$()', scheme_libs.promiseQ)
        defineBuiltin(context, 'force(p)', scheme_libs.force)

      case Chapter.SCHEME_2:
        // Scheme pairs
        defineBuiltin(context, 'cons(left, right)', scheme_libs.cons)
        defineBuiltin(context, 'pair$63$(val)', scheme_libs.pairQ)
        defineBuiltin(context, 'car(xs)', scheme_libs.car)
        defineBuiltin(context, 'cdr(xs)', scheme_libs.cdr)

        // Scheme lists
        defineBuiltin(context, 'make$45$list(n, val)', scheme_libs.make_list, 1)
        defineBuiltin(context, 'list(...values)', scheme_libs.list, 0)
        defineBuiltin(context, 'list$63$(val)', scheme_libs.listQ)
        defineBuiltin(context, 'null$63$(val)', scheme_libs.nullQ)
        defineBuiltin(context, 'length(xs)', scheme_libs.length)
        defineBuiltin(context, 'append(...xs)', scheme_libs.append, 0)
        defineBuiltin(context, 'reverse(xs)', scheme_libs.reverse)
        defineBuiltin(context, 'list$45$tail(xs, n)', scheme_libs.list_tail)
        defineBuiltin(context, 'list$45$ref(xs, n)', scheme_libs.list_ref)
        defineBuiltin(context, 'memq(item, xs)', scheme_libs.memq)
        defineBuiltin(context, 'memv(item, xs)', scheme_libs.memv)
        defineBuiltin(context, 'member(item, xs)', scheme_libs.member)
        defineBuiltin(context, 'assq(item, xs)', scheme_libs.assq)
        defineBuiltin(context, 'assv(item, xs)', scheme_libs.assv)
        defineBuiltin(context, 'assoc(item, xs)', scheme_libs.assoc)
        defineBuiltin(context, 'list$45$copy(xs)', scheme_libs.list_copy)
        defineBuiltin(context, 'map(f, ...xs)', scheme_libs.map, 1)
        defineBuiltin(context, 'filter(pred, xs)', scheme_libs.filter)
        defineBuiltin(context, 'fold(f, init, ...xs)', scheme_libs.fold, 2)
        defineBuiltin(context, 'fold$45$right(f, init, ...xs)', scheme_libs.fold_right, 2)
        defineBuiltin(context, 'reduce(f, rIdentity, xs)', scheme_libs.reduce)

        // Scheme cxrs

        // Probably can do this better.
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
        defineBuiltin(context, 'symbol$63$(val)', scheme_libs.symbolQ)
        defineBuiltin(context, 'symbol$61$63$(sym1, sym2)', scheme_libs.symbolEQ)
        defineBuiltin(context, 'symbol$45$$62$string(str)', scheme_libs.symbol_Gstring)
        defineBuiltin(context, 'string$45$$62$symbol(sym)', scheme_libs.string_Gsymbol)

        // Scheme strings
        defineBuiltin(context, 'string$45$$62$list(str)', scheme_libs.string_Glist)
        defineBuiltin(context, 'list$45$$62$string(xs)', scheme_libs.list_Gstring)

      case Chapter.SCHEME_1:
        // Display
        defineBuiltin(context, 'display(val)', display)
        defineBuiltin(context, 'newline()', scheme_libs.newline)

        // I/O
        defineBuiltin(context, 'read(str)', () => prompt(''))

        // Error
        defineBuiltin(context, 'error(str, prepend = undefined)', misc.error_message, 1)

        // Scheme truthy and falsy value evaluator
        defineBuiltin(context, '$36$true(val)', scheme_libs.$true)

        // Scheme equality predicates
        defineBuiltin(context, 'eq$63$(...vals)', scheme_libs.eqQ)
        defineBuiltin(context, 'eqv$63$(...vals)', scheme_libs.eqvQ)
        defineBuiltin(context, 'equal$63$(...vals)', scheme_libs.equalQ)

        // Scheme basic arithmetic
        defineBuiltin(context, '$43$(...vals)', scheme_libs.plus, 0)
        defineBuiltin(context, '$42$(...vals)', scheme_libs.multiply, 0)
        defineBuiltin(context, '$45$(...vals)', scheme_libs.minus, 1)
        defineBuiltin(context, '$47$(...vals)', scheme_libs.divide, 1)

        // Scheme comparison
        defineBuiltin(context, '$61$(...vals)', scheme_libs.E, 1)
        defineBuiltin(context, '$60$(...vals)', scheme_libs.L, 1)
        defineBuiltin(context, '$62$(...vals)', scheme_libs.G, 1)
        defineBuiltin(context, '$60$$61$(...vals)', scheme_libs.LE, 1)
        defineBuiltin(context, '$62$$61$(...vals)', scheme_libs.GE, 1)

        // Scheme math functions
        defineBuiltin(context, 'number$63$(val)', scheme_libs.numberQ)
        defineBuiltin(context, 'complex$63$(val)', scheme_libs.complexQ)
        defineBuiltin(context, 'real$63$(val)', scheme_libs.realQ)
        defineBuiltin(context, 'rational$63$(val)', scheme_libs.rationalQ)
        defineBuiltin(context, 'integer$63$(val)', scheme_libs.integerQ)
        defineBuiltin(context, 'exact$63$(val)', scheme_libs.exactQ)
        defineBuiltin(context, 'exact$45$integer$63$(val)', scheme_libs.exact_integerQ)
        defineBuiltin(context, 'zero$63$(val)', scheme_libs.zeroQ)
        defineBuiltin(context, 'positive$63$(val)', scheme_libs.positiveQ)
        defineBuiltin(context, 'negative$63$(val)', scheme_libs.negativeQ)
        defineBuiltin(context, 'odd$63$(val)', scheme_libs.oddQ)
        defineBuiltin(context, 'even$63$(val)', scheme_libs.evenQ)
        defineBuiltin(context, 'max(...vals)', scheme_libs.max, 0)
        defineBuiltin(context, 'min(...vals)', scheme_libs.min, 0)
        defineBuiltin(context, 'abs(val)', scheme_libs.abs)
        defineBuiltin(context, 'quotient(n, d)', scheme_libs.quotient)
        defineBuiltin(context, 'modulo(n, d)', scheme_libs.modulo)
        defineBuiltin(context, 'remainder(n, d)', scheme_libs.remainder)
        defineBuiltin(context, 'gcd(...vals)', scheme_libs.gcd, 0)
        defineBuiltin(context, 'lcm(...vals)', scheme_libs.lcm, 0)
        defineBuiltin(context, 'floor(val)', scheme_libs.floor)
        defineBuiltin(context, 'ceiling(val)', scheme_libs.ceiling)
        defineBuiltin(context, 'truncate(val)', scheme_libs.truncate)
        defineBuiltin(context, 'round(val)', scheme_libs.round)
        defineBuiltin(context, 'square(val)', scheme_libs.square)
        defineBuiltin(context, 'exact$45$integer$45$sqrt(val)', scheme_libs.exact_integer_sqrt)
        defineBuiltin(context, 'expt(base, exp)', scheme_libs.expt)
        defineBuiltin(context, 'number$45$$62$string(val)', scheme_libs.number_Gstring)

        // Scheme booleans
        defineBuiltin(context, 'boolean$63$(val)', scheme_libs.booleanQ)
        defineBuiltin(context, 'boolean$61$$63$(x, y)', scheme_libs.booleanEQ)
        defineBuiltin(context, 'and(...vals)', scheme_libs.and, 0)
        defineBuiltin(context, 'or(...vals)', scheme_libs.or, 0)
        defineBuiltin(context, 'not(val)', scheme_libs.not)

        // Scheme strings
        defineBuiltin(context, 'string$63$(val)', scheme_libs.stringQ)
        defineBuiltin(context, 'make$45$string(n, char)', scheme_libs.make_string, 1)
        defineBuiltin(context, 'string(...vals)', scheme_libs.string, 0)
        defineBuiltin(context, 'string$45$length(str)', scheme_libs.string_length)
        defineBuiltin(context, 'string$45$ref(str, k)', scheme_libs.string_ref)
        defineBuiltin(context, 'string$61$$63$(str1, str2)', scheme_libs.stringEQ)
        defineBuiltin(context, 'string$60$$63$(str1, str2)', scheme_libs.stringLQ)
        defineBuiltin(context, 'string$62$$63$(str1, str2)', scheme_libs.stringGQ)
        defineBuiltin(context, 'string$60$$61$$63$(str1, str2)', scheme_libs.stringLEQ)
        defineBuiltin(context, 'string$62$$61$$63$(str1, str2)', scheme_libs.stringGEQ)
        defineBuiltin(context, 'substring(str, start, end)', scheme_libs.substring, 2)
        defineBuiltin(context, 'string$45$append(...vals)', scheme_libs.string_append, 0)
        defineBuiltin(context, 'string$45$copy(str)', scheme_libs.string_copy)
        defineBuiltin(context, 'string$45$map(f, str)', scheme_libs.string_map)
        defineBuiltin(context, 'string$45$for$45$each(f, str)', scheme_libs.string_for_each)
        defineBuiltin(context, 'string$45$$62$number(str)', scheme_libs.string_Gnumber)

        // Scheme procedures
        defineBuiltin(context, 'procedure$63$(val)', scheme_libs.procedureQ)

        // Special values
        defineBuiltin(context, 'undefined', undefined)
        defineBuiltin(context, 'NaN', NaN)
        defineBuiltin(context, 'Infinity', Infinity)

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
      defineBuiltin(context, 'is_number(val)', misc.is_number)
      defineBuiltin(context, 'is_string(val)', misc.is_string)
      defineBuiltin(context, 'is_function(val)', misc.is_function)
      defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
      defineBuiltin(context, 'is_None(val)', misc.is_undefined)
      defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
      defineBuiltin(context, 'char_at(str, index)', misc.char_at)
      defineBuiltin(context, 'arity(f)', misc.arity)
      defineBuiltin(context, 'None', undefined)
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
