/* tslint:disable:interface-functionName max-classes-per-file */

import { SourceLocation } from 'acorn'
import * as es from 'estree'

import { closureToJS } from './interop'

/**
 * Defines functions that act as built-ins, but might rely on
 * different implementations. e.g display() in a web application.
 */
export interface CustomBuiltIns {
  display: (value: Value, externalContext: any) => void,
  prompt: (value: Value, externalContext: any) => string | null,
  alert: (value: Value, externalContext: any) => void,
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
    [name: string]: (node: T, ancestors: [es.Node]) => SourceError[]
  }
}

// tslint:disable-next-line:no-namespace
export namespace CFG {
  // tslint:disable-next-line:no-shadowed-variable
  export interface Scope {
    name: string
    parent?: Scope
    entry?: Vertex
    exits: Vertex[]
    node?: es.Node
    proof?: es.Node
    type: Type
    env: {
      [name: string]: Sym
    }
  }

  export interface Vertex {
    id: string
    node: es.Node
    scope?: Scope
    usages: Sym[]
  }

  export interface Sym {
    name: string
    defined?: boolean
    definedAt?: es.SourceLocation
    type: Type
    proof?: es.Node
  }

  export interface Type {
    name: 'number' | 'string' | 'boolean' | 'function' | 'undefined' | 'any'
    params?: Type[]
    returnType?: Type
  }

  export type EdgeLabel = 'next' | 'alternate' | 'consequent'

  export interface Edge {
    type: EdgeLabel
    to: Vertex
  }
}

export interface Comment {
  type: 'Line' | 'Block'
  value: string
  start: number
  end: number
  loc: SourceLocation | undefined
}

export interface TypeError extends SourceError {
  expected: CFG.Type[]
  got: CFG.Type
  proof?: es.Node
}

export interface Context<T = any> {
  /** The source version used */
  chapter: number

  /** The external symbols that exist in the Context. */
  externalSymbols: string[]

  /** All the errors gathered */
  errors: SourceError[]

  /** CFG Specific State */
  cfg: {
    nodes: { [id: string]: CFG.Vertex }
    edges: { [from: string]: CFG.Edge[] }
    scopes: CFG.Scope[]
  }

  /** Runtime Sepecific state */
  runtime: {
    isRunning: boolean
    frames: Frame[]
    nodes: es.Node[]
  }

  /**
   * Used for storing external properties.
   * For e.g, this can be used to store some application-related
   * context for use in your own built-in functions (like `display(a)`)
   */
  externalContext?: T
}

// tslint:disable:no-any
export interface Environment {
  [name: string]: any
}
export type Value = any
// tslint:enable:no-any

export interface Frame {
  name: string
  parent: Frame | null
  callExpression?: es.CallExpression
  environment: Environment
  thisContext?: Value
}

class Callable extends Function {
  constructor(f: any) {
    super();
    return Object.setPrototypeOf(f, new.target.prototype);
  }
}

/**
 * Models function value in the interpreter environment.
 */
export class Closure extends Callable {
  /** Keep track how many lambdas are created */
  private static lambdaCtr = 0

  /** Unique ID defined for anonymous closure */
  public functionName: string

  /** Fake closure function */
  // tslint:disable-next-line:ban-types
  public fun: Function

  /** The original node that created this Closure **/
  public originalNode: es.Function

  constructor(public node: es.FunctionExpression, public frame: Frame, context: Context) {
    super(function (this: any, ...args: any[]) {
      return funJS.apply(this, args)
    })
    this.originalNode = node
    try {
      if (this.node.id) {
        this.functionName = this.node.id.name
      }
    } catch (e) {
      this.functionName = `Anonymous${++Closure.lambdaCtr}`
    }
    const funJS = closureToJS(this, context, this.functionName)
    this.fun = funJS
  }

  static makeFromArrowFunction(node: es.ArrowFunctionExpression, frame: Frame, context: Context) {
    function isExpressionBody(body: es.BlockStatement | es.Expression): body is es.Expression {
      return body.type !== 'BlockStatement'
    }

    let closure = null
    if (isExpressionBody(node.body)) {
      closure = new Closure(<es.FunctionExpression> {
        type: 'FunctionExpression',
        loc: node.loc,
        id: null,
        params: node.params,
        body: <es.BlockStatement> {
          type: 'BlockStatement',
          loc: node.body.loc,
          body: [{
            type: 'ReturnStatement',
            loc: node.body.loc,
            argument: node.body
          }]
        }
      }, frame, context)
    } else {
      closure = new Closure(<es.FunctionExpression> {
        type: 'FunctionExpression',
        loc: node.loc,
        id: null,
        params: node.params,
        body: node.body
      }, frame, context)
    }

    // Set the closure's nod to point back at the original one
    closure.originalNode = node

    return closure
  }
}

export interface Error {
  status: 'error'
}

export interface Finished {
  status: 'finished'
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
