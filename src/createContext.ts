// Variable determining chapter of Source is contained in this file.

import { GLOBAL, GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE } from './constants'
import { AsyncScheduler } from './schedulers'
import { listPrelude } from './stdlib/list.prelude'
import { nonDetPrelude } from './stdlib/non-det.prelude'
import * as misc from './stdlib/misc'
import { streamPrelude } from './stdlib/stream.prelude'
import { Context, CustomBuiltIns, Value, Variant } from './types'
import * as operators from './utils/operators'
import * as gpu_lib from './gpu/lib'
// import { importBuiltins as importLazyBuiltins } from './lazy-builtins'
import { importBuiltins as importEagerBuiltins } from './eager-builtins'

const createEmptyRuntime = () => ({
  break: false,
  debuggerOn: true,
  isRunning: false,
  environments: [],
  value: undefined,
  nodes: []
})

const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: {
    it: (function*(): any {
      return
    })(),
    scheduler: new AsyncScheduler()
  }
})

const createGlobalEnvironment = () => ({
  tail: null,
  name: 'global',
  head: {}
})

export const createEmptyContext = <T>(
  chapter: number,
  variant: Variant = 'default',
  externalSymbols: string[],
  externalContext?: T
): Context<T> => {
  if (!Array.isArray(GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE])) {
    GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE] = []
  }
  const length = GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE].push({
    globals: { variables: new Map(), previousScope: null },
    operators: new Map(Object.entries(operators)),
    gpu: new Map(Object.entries(gpu_lib))
  })
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    contextId: length - 1,
    executionMethod: 'auto',
    variant
  }
}

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime()
  }
  if (!context.runtime.environments) {
    context.runtime.environments = []
  }
  if (context.runtime.environments.length === 0) {
    context.runtime.environments.push(createGlobalEnvironment())
  }
}

export const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalEnvironment = context.runtime.environments[0]
  Object.defineProperty(globalEnvironment.head, name, {
    value,
    writable: false,
    enumerable: true
  })
  GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE][context.contextId].globals.variables.set(name, {
    kind: 'const',
    getValue: () => value
  })
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
  // if (context.variant === 'lazy') {
  //   importLazyBuiltins(context, externalBuiltIns)
  // } else {
  importEagerBuiltins(context, externalBuiltIns)
  // }
}

function importPrelude(context: Context) {
  let prelude = ''
  if (context.chapter >= 2) {
    prelude += listPrelude
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
  visualiseList: (v: Value) => {
    throw new Error('List visualizer is not enabled')
  }
}

const createContext = <T>(
  chapter = 1,
  variant: Variant = 'default',
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns
) => {
  const context = createEmptyContext(chapter, variant, externalSymbols, externalContext)

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
