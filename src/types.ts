/*
	This file contains definitions of some interfaces and classes that are used in Source (such as
	error-related classes).
*/

/* tslint:disable:max-classes-per-file */

import * as es from 'estree'

import { EnvTree } from './createContext'
import Heap from './cse-machine/heap'
import type { Control, Stash, Transformers } from './cse-machine/types'
import type { SourceError } from './errors/errorBase'
import type { Chapter, LanguageOptions, Variant } from './langs'
import type { ModuleFunctions } from './modules/moduleTypes'
import type { TypeEnvironment } from './typeChecker/types'
import type { Node } from './utils/ast/node'

/**
 * Defines functions that act as built-ins, but might rely on
 * different implementations. e.g display() in a web application.
 */
export interface CustomBuiltIns {
  rawDisplay: (value: Value, str: string, externalContext: any) => Value
  prompt: (value: Value, str: string, externalContext: any) => string | null
  alert: (value: Value, str: string, externalContext: any) => void
  /* Used for list visualisation. See #12 */
  visualiseList: (list: any, externalContext: any) => void
}

export interface NativeStorage {
  builtins: Map<string, Value>
  previousProgramsIdentifiers: Set<string>
  operators: Map<string, (...operands: Value[]) => Value>
  maxExecTime: number
  evaller: null | ((program: string) => Value)
  /*
  the first time evaller is used, it must be used directly like `eval(code)` to inherit
  surrounding scope, so we cannot set evaller to `eval` directly. subsequent assignments to evaller will
  close in the surrounding values, so no problem
   */
  loadedModules: Record<string, ModuleFunctions>
  loadedModuleTypes: Record<string, Record<string, string>>
}

export interface Context<T = any> {
  /** The source version used */
  chapter: Chapter

  /** The external symbols that exist in the Context. */
  externalSymbols: string[]

  /** All the errors gathered */
  errors: SourceError[]

  /** Runtime Specific state */
  runtime: {
    transformers?: Transformers
    break: boolean
    debuggerOn: boolean
    isRunning: boolean
    environmentTree: EnvTree
    environments: Environment[]
    nodes: Node[]
    control: Control | null
    stash: Stash | null
    objectCount: number
    envStepsTotal: number
    breakpointSteps: number[]
    changepointSteps: number[]
  }

  numberOfOuterEnvironments: number

  prelude: string | null

  /** the state of the debugger */
  debugger: {
    /** External observers watching this context */
    status: boolean
    state: {
      it: IterableIterator<T>
    }
  }

  /**
   * Used for storing external properties.
   * For e.g, this can be used to store some application-related
   * context for use in your own built-in functions (like `display(a)`)
   */
  externalContext?: T

  /**
   * Used for storing the native context and other values
   */
  nativeStorage: NativeStorage

  /**
   * Describes the strategy / paradigm to be used for evaluation
   * Examples: concurrent
   */
  variant: Variant

  /**
   * Describes the custom language option to be used for evaluation
   */
  languageOptions: LanguageOptions

  /**
   * Contains the evaluated code that has not yet been typechecked.
   */
  unTypecheckedCode: string[]
  typeEnvironment: TypeEnvironment

  /**
   * Storage container for module specific information and state
   */
  moduleContexts: {
    [name: string]: ModuleContext
  }

  /**
   * Programs previously executed in this context
   */
  previousPrograms: es.Program[]

  /**
   * Whether the evaluation timeout should be increased
   */
  shouldIncreaseEvaluationTimeout: boolean
}

export type ModuleContext = {
  state: null | any
  tabs: null | any[]
}

// tslint:disable:no-any
export interface Frame {
  [name: string]: any
}
export type Value = any
export interface Environment {
  readonly id: string
  name: string
  tail: Environment | null
  callExpression?: es.CallExpression
  head: Frame
  heap: Heap
  thisContext?: Value
}



export {
  Instruction as SVMInstruction,
  Program as SVMProgram,
  Address as SVMAddress,
  Argument as SVMArgument,
  Offset as SVMOffset,
  SVMFunction
} from './vm/svml-compiler'

/**
 * Helper type to recursively make properties that are also objects
 * partial
 *
 * By default, `Partial<Array<T>>` is equivalent to `Array<T | undefined>`. For this type, `Array<T>` will be
 * transformed to Array<Partial<T>> instead
 */
export type RecursivePartial<T> =
  T extends Array<any>
    ? Array<RecursivePartial<T[number]>>
    : T extends Record<any, any>
      ? Partial<{
          [K in keyof T]: RecursivePartial<T[K]>
        }>
      : T

export type NodeTypeToNode<T extends Node['type']> = Extract<Node, { type: T }>
