import type es from 'estree'

import type { List } from '../stdlib/list'
import type { Environment, Value } from '../types'
import * as ast from '../utils/ast/astCreator'
import type { Node, StatementSequence } from '../utils/ast/node'
import type Closure from './closure'
import type { SchemeControlItems } from './scheme-macros'
import { Stack } from './stack'
import { hasDeclarations, isBlockStatement, isEnvDependent, isNode } from './utils'

export enum InstrType {
  RESET = 'Reset',
  WHILE = 'While',
  FOR = 'For',
  ASSIGNMENT = 'Assignment',
  UNARY_OP = 'UnaryOperation',
  BINARY_OP = 'BinaryOperation',
  POP = 'Pop',
  APPLICATION = 'Application',
  BRANCH = 'Branch',
  ENVIRONMENT = 'Environment',
  ARRAY_LITERAL = 'ArrayLiteral',
  ARRAY_ACCESS = 'ArrayAccess',
  ARRAY_ASSIGNMENT = 'ArrayAssignment',
  ARRAY_LENGTH = 'ArrayLength',
  MARKER = 'Marker',
  CONTINUE = 'Continue',
  CONTINUE_MARKER = 'ContinueMarker',
  BREAK = 'Break',
  BREAK_MARKER = 'BreakMarker',
  SPREAD = 'Spread'
}

interface BaseInstr<T extends InstrType = InstrType, U extends Node = Node> {
  instrType: T
  srcNode: U
  isEnvDependent?: boolean
}

export interface WhileInstr extends BaseInstr<InstrType.WHILE> {
  test: es.Expression
  body: es.Statement
}

export interface ForInstr extends BaseInstr<InstrType.FOR> {
  init: es.VariableDeclaration | es.Expression
  test: es.Expression
  update: es.Expression
  body: es.Statement
}

export interface DeclAssmtInstr extends BaseInstr<InstrType.ASSIGNMENT, es.VariableDeclaration> {
  symbol: string
  constant: boolean
  declaration: true
}

export interface RegularAssmtInstr
  extends BaseInstr<InstrType.ASSIGNMENT, es.AssignmentExpression> {
  declaration: false
  symbol: string
}

export type AssmtInstr = DeclAssmtInstr | RegularAssmtInstr

export interface UnOpInstr extends BaseInstr<InstrType.UNARY_OP, es.UnaryExpression> {
  symbol: es.UnaryOperator
}

export interface BinOpInstr extends BaseInstr<InstrType.BINARY_OP> {
  symbol: es.BinaryOperator
}

export interface AppInstr extends BaseInstr<InstrType.APPLICATION, es.CallExpression> {
  numOfArgs: number
}

export interface BranchInstr extends BaseInstr<InstrType.BRANCH> {
  consequent: es.Expression | es.Statement
  alternate: es.Expression | es.Statement | null | undefined
}

export interface EnvInstr extends BaseInstr<InstrType.ENVIRONMENT> {
  env: Environment
  transformers: Transformers
}

export interface ArrLitInstr extends BaseInstr<InstrType.ARRAY_LITERAL> {
  arity: number
}

export type Instr =
  | AppInstr
  | ArrLitInstr
  | AssmtInstr
  | BaseInstr
  | BinOpInstr
  | BranchInstr
  | EnvInstr
  | ForInstr
  | UnOpInstr
  | WhileInstr

/**
 * Utility type for extracting the correspodning instruction type given its
 * InstrType
 */
export type InstrTypeToInstr<T extends InstrType> =
  Extract<Instr, { instrType: T }> extends never ? BaseInstr : Extract<Instr, { instrType: T }>

export type ControlItem = (Node | Instr | SchemeControlItems) & {
  isEnvDependent?: boolean
}

// Every array also has the properties `id` and `environment` for use in the frontend CSE Machine
export type EnvArray = any[] & {
  readonly id: string
  environment: Environment
}

// Objects in the heap can only store arrays or closures
export type HeapObject = EnvArray | Closure

// Special class that cannot be found on the stash so is safe to be used
// as an indicator of a breakpoint from running the CSE machine
export class CSEBreak {}

// Special value that cannot be found on the stash so is safe to be used
// as an indicator of an error from running the CSE machine
export class CseError {
  constructor(public readonly error: any) {}
}

/**
 * The T component is a dictionary of mappings from syntax names to
 * their corresponding syntax rule transformers (patterns).
 *
 * Similar to the E component, there is a matching
 * "T" environment tree that is used to store the transformers.
 * as such, we need to track the transformers and update them with the environment.
 */

// a single pattern stored within the patterns component
// may have several transformers attributed to it.
export class Transformer {
  literals: string[]
  pattern: List
  template: List

  constructor(literals: string[], pattern: List, template: List) {
    this.literals = literals
    this.pattern = pattern
    this.template = template
  }
}

export class Transformers {
  private parent: Transformers | null
  private items: Map<string, Transformer[]>
  public constructor(parent?: Transformers) {
    this.parent = parent || null
    this.items = new Map<string, Transformer[]>()
  }

  // only call this if you are sure that the pattern exists.
  public getPattern(name: string): Transformer[] {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return this.items.get(name) as Transformer[]
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.getPattern(name)
    }
    // should not get here. use this properly.
    throw new Error(`Pattern ${name} not found in transformers`)
  }

  public hasPattern(name: string): boolean {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return true
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.hasPattern(name)
    }
    return false
  }

  public addPattern(name: string, item: Transformer[]): void {
    this.items.set(name, item)
  }
}
/**
 * The stash is a list of values that stores intermediate results.
 */

export class Stash extends Stack<Value> {
  public constructor() {
    super()
  }

  public copy(): Stash {
    const newStash = new Stash()
    const stackCopy = super.getStack()
    newStash.push(...stackCopy)
    return newStash
  }
}

/**
 * The control is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */

export class Control extends Stack<ControlItem> {
  private numEnvDependentItems: number
  public constructor(program?: es.Program | StatementSequence) {
    super()
    this.numEnvDependentItems = 0
    // Load program into control stack
    if (program) this.push(program)
  }

  public canAvoidEnvInstr(): boolean {
    return this.numEnvDependentItems === 0
  }

  // For testing purposes
  public getNumEnvDependentItems(): number {
    return this.numEnvDependentItems
  }

  public pop(): ControlItem | undefined {
    const item = super.pop()
    if (item !== undefined && isEnvDependent(item)) {
      this.numEnvDependentItems--
    }
    return item
  }

  public push(...items: ControlItem[]): void {
    const itemsNew: ControlItem[] = Control.simplifyBlocksWithoutDeclarations(...items)
    itemsNew.forEach((item: ControlItem) => {
      if (isEnvDependent(item)) {
        this.numEnvDependentItems++
      }
    })
    super.push(...itemsNew)
  }

  /**
   * Before pushing block statements on the control stack, we check if the block statement has any declarations.
   * If not, the block is converted to a StatementSequence.
   * @param items The items being pushed on the control.
   * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
   * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
   */
  private static simplifyBlocksWithoutDeclarations(...items: ControlItem[]): ControlItem[] {
    const itemsNew: ControlItem[] = []
    items.forEach(item => {
      if (isNode(item) && isBlockStatement(item) && !hasDeclarations(item)) {
        // Push block body as statement sequence
        const seq = ast.statementSequence(item.body, item.loc)
        itemsNew.push(seq)
      } else {
        itemsNew.push(item)
      }
    })
    return itemsNew
  }

  public copy(): Control {
    const newControl = new Control()
    const stackCopy = super.getStack()
    newControl.push(...stackCopy)
    return newControl
  }
}
