/*
	This file contains definitions of some interfaces and classes that are used in Source (such as
	error-related classes).
*/
import type es from 'estree'
import type { Representation } from './alt-langs/mapper'
import type { EnvTree } from './createContext'
import type Heap from './cse-machine/heap'
import type { Control, Stash, Transformers } from './cse-machine/interpreter'
import type { SourceError } from './errors/base'
import type { Chapter, LanguageOptions, Variant } from './langs'
import type { ModuleFunctions } from './modules/moduleTypes'

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

export type ExecutionMethod = 'native' | 'auto' | 'cse-machine'

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

  /** Stream Visualisation */
  firstStreamPairCreated: Boolean

  streamFnArr: string[]

  streamLineage: Map<string, string[]>

  pendingStreamFnId?: string

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
   * Describes the language processor to be used for evaluation
   */
  executionMethod: ExecutionMethod

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

export interface ModuleContext {
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

export interface Frame {
  [name: string]: any
}
export type Value = any

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

/**
 * Represents an evaluation that resulted in an error
 */
export interface Error {
  status: 'error'
  context: Context
}

/**
 * Represents an evaluation that finished successfully
 */
export interface Finished {
  status: 'finished'
  context: Context
  value: Value
  representation?: Representation // if the returned value needs a unique representation,
  // (for example if the language used is not JS),
  // the display of the result will use the representation
  // field instead
}

/**
 * Represents an evaluation that has been suspended. Only possible when the `cse-machine`
 * is being used.
 */
export interface SuspendedCseEval {
  status: 'suspended-cse-eval'
  context: Context
}

/**
 * Represents the result of an evaluation
 */
export type Result = Finished | Error | SuspendedCseEval

/**
 * StatementSequence: A sequence of statements not surrounded by braces.
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

export type {
  Address as SVMAddress,
  Argument as SVMArgument,
  SVMFunction,
  Instruction as SVMInstruction,
  Offset as SVMOffset,
  Program as SVMProgram
} from './vm/svml-compiler'

export type ContiguousArrayElementExpression = Exclude<es.ArrayExpression['elements'][0], null>

export type ContiguousArrayElements = ContiguousArrayElementExpression[]

// =======================================
// Types used in type checker for type inference/type error checker for Source Typed variant
// =======================================

export type PrimitiveType = 'boolean' | 'null' | 'number' | 'string' | 'undefined'

export type TSAllowedTypes = 'any' | 'void'

export const disallowedTypes = ['bigint', 'never', 'object', 'symbol', 'unknown'] as const

export type TSDisallowedTypes = (typeof disallowedTypes)[number]

// All types recognised by type parser as basic types
export type TSBasicType = PrimitiveType | TSAllowedTypes | TSDisallowedTypes

// Types for nodes used in type inference
export type NodeWithInferredType<T extends Node> = InferredType & T

export type FuncDeclWithInferredTypeAnnotation = NodeWithInferredType<es.FunctionDeclaration> &
  TypedFuncDecl

export type InferredType = Untypable | Typed | NotYetTyped

export interface TypedFuncDecl {
  functionInferredType?: Type
}

export interface Untypable {
  typability?: 'Untypable'
  inferredType?: Type
}

export interface NotYetTyped {
  typability?: 'NotYetTyped'
  inferredType?: Type
}

export interface Typed {
  typability?: 'Typed'
  inferredType?: Type
}

// Constraints used in type inference
export type Constraint = 'none' | 'addable'

// Types used by both type inferencer and Source Typed
export type Type =
  | Primitive
  | Variable
  | FunctionType
  | List
  | Pair
  | SArray
  | UnionType
  | LiteralType

export interface Primitive {
  kind: 'primitive'
  name: PrimitiveType | TSAllowedTypes
  // Value is needed for Source Typed type error checker due to existence of literal types
  value?: string | number | boolean
}

// In Source Typed, Variable type is used for
// 1. Type parameters
// 2. Type references of generic types with type arguments
export interface Variable {
  kind: 'variable'
  name: string
  constraint: Constraint
  // Used in Source Typed variant to store type arguments of generic types
  typeArgs?: Type[]
}

// cannot name Function, conflicts with TS
export interface FunctionType {
  kind: 'function'
  parameterTypes: Type[]
  returnType: Type
}
export interface List {
  kind: 'list'
  elementType: Type
  // Used in Source Typed variants to check for type mismatches against pairs
  typeAsPair?: Pair
}

export interface Pair {
  kind: 'pair'
  headType: Type
  tailType: Type
}
export interface SArray {
  kind: 'array'
  elementType: Type
}

// Union types and literal types are only used in Source Typed for typechecking
export interface UnionType {
  kind: 'union'
  types: Type[]
}

export interface LiteralType {
  kind: 'literal'
  value: string | number | boolean
}

export type BindableType = Type | ForAll | PredicateType

// In Source Typed, ForAll type is used for generic types
export interface ForAll {
  kind: 'forall'
  polyType: Type
  // Used in Source Typed variant to store type parameters of generic types
  typeParams?: Variable[]
}

export interface PredicateType {
  kind: 'predicate'
  ifTrueType: Type | ForAll
}

export type PredicateTest = {
  node: NodeWithInferredType<es.CallExpression>
  ifTrueType: Type | ForAll
  argVarName: string
}

/**
 * Each element in the TypeEnvironment array represents a different scope
 * (e.g. first element is the global scope, last element is the closest).
 * Within each scope, variable types/declaration kinds, as well as type aliases, are stored.
 */
export type TypeEnvironment = {
  typeMap: Map<string, BindableType>
  declKindMap: Map<string, AllowedDeclarations>
  typeAliasMap: Map<string, Type | ForAll>
}[]

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

/**
 * Utility type for selecting extracting the specific Node type when provided
 * the type string.
 */
export type NodeTypeToNode<T extends Node['type']> = Extract<Node, { type: T }>
