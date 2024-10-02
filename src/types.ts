/*
	This file contains definitions of some interfaces and classes that are used in Source (such as
	error-related classes).
*/

/* tslint:disable:max-classes-per-file */

import { SourceLocation } from 'acorn'
import type es from 'estree'

import { EnvTree } from './createContext'
import Heap from './cse-machine/heap'
import { Control, Stash } from './cse-machine/interpreter'
import type { ModuleFunctions } from './modules/moduleTypes'
import { Representation } from './alt-langs/mapper'
import { TypeEnvironment } from './typeChecker/types'

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

export enum ErrorType {
  IMPORT = 'Import',
  RUNTIME = 'Runtime',
  SYNTAX = 'Syntax',
  TYPE = 'Type'
}

export enum ErrorSeverity {
  WARNING = 'Warning',
  ERROR = 'Error'
}

// any and all errors ultimately implement this interface. as such, changes to this will affect every type of error.
export interface SourceError {
  type: ErrorType
  severity: ErrorSeverity
  location: es.SourceLocation
  explain(): string
  elaborate(): string
}

export interface Comment {
  type: 'Line' | 'Block'
  value: string
  start: number
  end: number
  loc: SourceLocation | undefined
}

export type ExecutionMethod = 'native' | 'auto' | 'cse-machine' | 'stepper'

export enum Chapter {
  SOURCE_1 = 1,
  SOURCE_2 = 2,
  SOURCE_3 = 3,
  SOURCE_4 = 4,
  FULL_JS = -1,
  HTML = -2,
  FULL_TS = -3,
  PYTHON_1 = -4,
  PYTHON_2 = -5,
  PYTHON_3 = -6,
  PYTHON_4 = -7,
  FULL_PYTHON = -8,
  SCHEME_1 = -9,
  SCHEME_2 = -10,
  SCHEME_3 = -11,
  SCHEME_4 = -12,
  FULL_SCHEME = -13,
  FULL_C = -14,
  FULL_JAVA = -15,
  LIBRARY_PARSER = 100
}

export enum Variant {
  DEFAULT = 'default',
  TYPED = 'typed',
  NATIVE = 'native',
  WASM = 'wasm',
  CONCURRENT = 'concurrent',
  GPU = 'gpu',
  EXPLICIT_CONTROL = 'explicit-control'
}

export interface Language {
  chapter: Chapter
  variant: Variant
}

export interface NativeStorage {
  builtins: Map<string, Value>
  previousProgramsIdentifiers: Set<string>
  operators: Map<string, (...operands: Value[]) => Value>
  gpu: Map<string, (...operands: Value[]) => Value>
  maxExecTime: number
  evaller: null | ((program: string) => Value)
  /*
  the first time evaller is used, it must be used directly like `eval(code)` to inherit
  surrounding scope, so we cannot set evaller to `eval` directly. subsequent assignments to evaller will
  close in the surrounding values, so no problem
   */
  loadedModules: Record<string, ModuleFunctions>
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
      scheduler: Scheduler
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
   * Describes the language processor to be used for evaluation
   */
  executionMethod: ExecutionMethod

  /**
   * Describes the strategy / paradigm to be used for evaluation
   * Examples: lazy, concurrent or nondeterministic
   */
  variant: Variant

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

export interface BlockFrame {
  type: string
  // loc refers to the block defined by every pair of curly braces
  loc?: es.SourceLocation | null
  // For certain type of BlockFrames, we also want to take into account
  // the code directly outside the curly braces as there
  // may be variables declared there as well, such as in function definitions or for loops
  enclosingLoc?: es.SourceLocation | null
  children: (DefinitionNode | BlockFrame)[]
}

export interface DefinitionNode {
  name: string
  type: string
  loc?: es.SourceLocation | null
}

// tslint:disable:no-any
export interface Frame {
  [name: string]: any
}
export type Value = any
// tslint:enable:no-any

export type AllowedDeclarations = 'const' | 'let'

export interface Environment {
  readonly id: string
  name: string
  tail: Environment | null
  callExpression?: es.CallExpression
  head: Frame
  heap: Heap
  thisContext?: Value
}

export interface Error {
  status: 'error'
}

export interface Finished {
  status: 'finished'
  context: Context
  value: Value
  representation?: Representation // if the returned value needs a unique representation,
  // (for example if the language used is not JS),
  // the display of the result will use the representation
  // field instead
}

export interface Suspended {
  status: 'suspended'
  it: IterableIterator<Value>
  scheduler: Scheduler
  context: Context
}

export interface SuspendedCseEval {
  status: 'suspended-cse-eval'
  context: Context
}

export type Result = Suspended | Finished | Error | SuspendedCseEval

export interface Scheduler {
  run(it: IterableIterator<Value>, context: Context): Promise<Result>
}

/**
 * StatementSequence : A sequence of statements not surrounded by braces.
 * It is *not* a block, and thus does not trigger environment creation when evaluated.
 *
 * The current ESTree specification does not have this node type, so we define it here.
 */
export interface StatementSequence extends es.BaseStatement {
  type: 'StatementSequence'
  body: Array<es.Statement>
  innerComments?: Array<Comment> | undefined
}

/**
 * js-slang's custom Node type - this should be used wherever es.Node is used.
 */
export type Node = { isEnvDependent?: boolean } & (
  | es.Node
  | StatementSequence
  | es.MaybeNamedClassDeclaration
  | es.MaybeNamedFunctionDeclaration
)
/*
	Although the ESTree specifications supposedly provide a Directive interface, the index file does not seem to export it.
	As such this interface was created here to fulfil the same purpose.
 */
export interface Directive extends es.ExpressionStatement {
  type: 'ExpressionStatement'
  expression: es.Literal
  directive: string
}

/** For use in the substituter, to differentiate between a function declaration in the expression position,
 * which has an id, as opposed to function expressions.
 */
export interface FunctionDeclarationExpression extends es.FunctionExpression {
  id: es.Identifier
  body: es.BlockStatement
}

/**
 * For use in the substituter: call expressions can be reduced into an expression if the block
 * only contains a single return statement; or a block, but has to be in the expression position.
 * This is NOT compliant with the ES specifications, just as an intermediate step during substitutions.
 */
export interface BlockExpression extends es.BaseExpression {
  type: 'BlockExpression'
  body: es.Statement[]
}

export type substituterNodes = Node | BlockExpression

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
export type RecursivePartial<T> = T extends Array<any>
  ? Array<RecursivePartial<T[number]>>
  : T extends Record<any, any>
  ? Partial<{
      [K in keyof T]: RecursivePartial<T[K]>
    }>
  : T

export type NodeTypeToNode<T extends Node['type']> = Extract<Node, { type: T }>
