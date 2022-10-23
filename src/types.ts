/*
	This file contains definitions of some interfaces and classes that are used in Source (such as
	error-related classes).
*/

/* tslint:disable:max-classes-per-file */

import { SourceLocation } from 'acorn'
import * as es from 'estree'

import { EnvTree } from './createContext'

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
  SYNTAX = 'Syntax',
  TYPE = 'Type',
  RUNTIME = 'Runtime'
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

export interface Rule<T extends es.Node> {
  name: string
  disableOn?: number
  checkers: {
    [name: string]: (node: T, ancestors: es.Node[]) => SourceError[]
  }
}

export interface Comment {
  type: 'Line' | 'Block'
  value: string
  start: number
  end: number
  loc: SourceLocation | undefined
}

export type ExecutionMethod = 'native' | 'interpreter' | 'auto'

export enum Chapter {
  SOURCE_1 = 1,
  SOURCE_2 = 2,
  SOURCE_3 = 3,
  SOURCE_4 = 4,
  FULL_JS = -1,
  HTML = -2,
  LIBRARY_PARSER = 100
}

export enum Variant {
  DEFAULT = 'default',
  TYPED = 'typed',
  NATIVE = 'native',
  WASM = 'wasm',
  LAZY = 'lazy',
  NON_DET = 'non-det',
  CONCURRENT = 'concurrent',
  GPU = 'gpu'
}

export interface Language {
  chapter: Chapter
  variant: Variant
}

export type ValueWrapper = LetWrapper | ConstWrapper

export interface LetWrapper {
  kind: 'let'
  getValue: () => Value
  assignNewValue: <T>(newValue: T) => T
}

export interface ConstWrapper {
  kind: 'const'
  getValue: () => Value
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
}

export interface Context<T = any> {
  /** The source version used */
  chapter: Chapter

  /** The external symbols that exist in the Context. */
  externalSymbols: string[]

  /** All the errors gathered */
  errors: SourceError[]

  /** Runtime Sepecific state */
  runtime: {
    break: boolean
    debuggerOn: boolean
    isRunning: boolean
    environmentTree: EnvTree
    environments: Environment[]
    nodes: es.Node[]
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
   * Code previously executed in this context
   */
  previousCode: string[]
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
  id: string
  name: string
  tail: Environment | null
  callExpression?: es.CallExpression
  head: Frame
  thisContext?: Value
}

export interface Thunk {
  value: any
  isMemoized: boolean
  f: () => any
}

export interface Error {
  status: 'error'
}

export interface Finished {
  status: 'finished'
  context: Context
  value: Value
}

export interface Suspended {
  status: 'suspended'
  it: IterableIterator<Value>
  scheduler: Scheduler
  context: Context
}

export type SuspendedNonDet = Omit<Suspended, 'status'> & { status: 'suspended-non-det' } & {
  value: Value
}

export type Result = Suspended | SuspendedNonDet | Finished | Error

export interface Scheduler {
  run(it: IterableIterator<Value>, context: Context): Promise<Result>
}

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

export type substituterNodes = es.Node | BlockExpression

export {
  Instruction as SVMInstruction,
  Program as SVMProgram,
  Address as SVMAddress,
  Argument as SVMArgument,
  Offset as SVMOffset,
  SVMFunction
} from './vm/svml-compiler'

export type ContiguousArrayElementExpression = Exclude<es.ArrayExpression['elements'][0], null>

export type ContiguousArrayElements = ContiguousArrayElementExpression[]

/** Types used in type inference / Source Typed variant type error checker **/

export enum PrimitiveType {
  ANY = 'any',
  BOOLEAN = 'boolean',
  NULL = 'null',
  NUMBER = 'number',
  STRING = 'string',
  UNDEFINED = 'undefined',
  UNKNOWN = 'unknown',
  VOID = 'void'
}

export enum TSTypeAnnotationType {
  TSAnnotationType = 'TSAnnotationType',
  TSFunctionType = 'TSFunctionType',
  TSUnionType = 'TSUnionType',
  TSAnyKeyword = 'TSAnyKeyword',
  TSBooleanKeyword = 'TSBooleanKeyword',
  TSNullKeyword = 'TSNullKeyword',
  TSNumberKeyword = 'TSNumberKeyword',
  TSStringKeyword = 'TSStringKeyword',
  TSUndefinedKeyword = 'TSUndefinedKeyword',
  TSUnknownKeyword = 'TSUnknownKeyword',
  TSVoidKeyword = 'TSVoidKeyword'
}

// Types for parsed TS node used in Source Typed variants
export type NodeWithDeclaredTypeAnnotation<T extends es.Node> = DeclaredTypeAnnotation & T

export type DeclaredTypeAnnotation = {
  typeAnnotation?: AnnotationTypeNode
  returnType?: AnnotationTypeNode
}

export interface BaseTypeNode extends es.BaseNode {
  type: TSTypeAnnotationType
}

export interface AnnotationTypeNode extends BaseTypeNode {
  type: TSTypeAnnotationType.TSAnnotationType
  typeAnnotation: BaseTypeNode | FunctionTypeNode
}

export interface FunctionTypeNode extends BaseTypeNode {
  type: TSTypeAnnotationType.TSFunctionType
  parameters: NodeWithDeclaredTypeAnnotation<es.Identifier>[]
  typeAnnotation: AnnotationTypeNode
}

export interface UnionTypeNode extends BaseTypeNode {
  type: TSTypeAnnotationType.TSUnionType
  types: BaseTypeNode[]
}

// Types for nodes used in type inference
export type NodeWithInferredTypeAnnotation<T extends es.Node> = InferredTypeAnnotation & T

export type FuncDeclWithInferredTypeAnnotation =
  NodeWithInferredTypeAnnotation<es.FunctionDeclaration> & TypedFuncDecl

export type InferredTypeAnnotation = Untypable | Typed | NotYetTyped

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

export type Type = Primitive | Variable | FunctionType | List | Pair | SArray | UnionType
export type Constraint = 'none' | 'addable'

export interface Primitive {
  kind: 'primitive'
  name: PrimitiveType
}

export interface Variable {
  kind: 'variable'
  name: string
  constraint: Constraint
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

// Union type is only used in typed variants for typechecking
export interface UnionType {
  kind: 'union'
  types: Type[]
}

export type BindableType = Type | ForAll | PredicateType

export interface ForAll {
  kind: 'forall'
  polyType: Type
}

export interface PredicateType {
  kind: 'predicate'
  ifTrueType: Type | ForAll
}

/**
 * Stores the type/declaration type of variables.
 * The array distinguishes between the different scopes in the program
 * (e.g. first element is the global scope, last element is the closest).
 */
export type TypeEnvironment = {
  typeMap: Map<string, BindableType>
  declKindMap: Map<string, AllowedDeclarations>
}[]

export type PredicateTest = {
  node: NodeWithInferredTypeAnnotation<es.CallExpression>
  ifTrueType: Type | ForAll
  argVarName: string
}
