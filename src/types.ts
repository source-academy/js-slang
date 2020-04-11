/*
	This file contains definitions of some interfaces and classes that are used in Source (such as
	error-related classes).
*/

/* tslint:disable:max-classes-per-file */

import { SourceLocation } from 'acorn'
import * as es from 'estree'

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

export interface Context<T = any> {
  /** The source version used */
  chapter: number

  /** The external symbols that exist in the Context. */
  externalSymbols: string[]

  /** All the errors gathered */
  errors: SourceError[]

  /** Runtime Sepecific state */
  runtime: {
    break: boolean
    debuggerOn: boolean
    isRunning: boolean
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
   * Used for storing id of the context to be referenced by native
   */
  contextId: number

  executionMethod: ExecutionMethod
}

// tslint:disable:no-any
export interface Frame {
  [name: string]: any
}
export type Value = any
// tslint:enable:no-any

export type AllowedDeclarations = 'const' | 'let'

export interface Environment {
  name: string
  tail: Environment | null
  callExpression?: es.CallExpression
  head: Frame
  thisContext?: Value
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

export type Result = Suspended | Finished | Error

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

export type TypeAnnotatedNode<T extends es.Node> = TypeAnnotation & T

export type TypeAnnotation = Untypable | Typedd | NotYetTyped

export interface Untypable {
  typability?: 'Untypable'
  inferredType?: Type
}

export interface NotYetTyped {
  typability?: 'NotYetTyped'
  inferredType?: Type
}

export interface Typedd {
  typability?: 'Typed'
  inferredType?: Type
}

export type Type = Primitive | Variable | FunctionType | List

export interface Primitive {
  kind: 'primitive'
  name: 'number' | 'boolean' | 'string' | 'null' | 'integer' | 'undefined'
}

export interface Variable {
  kind: 'variable'
  name: string
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
