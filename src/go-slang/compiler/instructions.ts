import { EnvironmentPos } from '../environment/environment'
import * as Token from '../tokens/tokens'

export enum InstType {
  DONE,
  LDC,
  LD,
  UNOP,
  BINOP,
  JOF,
  GOTO,
  ITER_END,
  FOR_END,
  CALL,
  ASSIGN,
  POP,
  LDF,
  ENTER_SCOPE,
  EXIT_SCOPE,
  RESET,
  GO,
  GO_DEST,
  SEND,
  CONT,
  BREAK
}

export interface Instruction {
  getType(): InstType
  stringRep(): string
}

export class DoneInstruction implements Instruction {
  getType(): InstType {
    return InstType.DONE
  }

  stringRep(): string {
    return 'DONE'
  }
}

export class BasicLitInstruction implements Instruction {
  value: number | string
  tokenType: Token.token

  constructor(type: Token.token, value: number | string) {
    this.tokenType = type
    this.value = value
  }

  getType(): InstType {
    return InstType.LDC
  }

  stringRep(): string {
    return `LDC ${this.value === undefined ? 'undefined' : this.value}`
  }
}

export class IdentInstruction implements Instruction {
  sym: string
  pos: EnvironmentPos

  constructor(sym: string, pos: EnvironmentPos) {
    this.sym = sym
    this.pos = pos
  }

  getType(): InstType {
    return InstType.LD
  }

  stringRep(): string {
    return `LD ${this.sym}`
  }
}

export class UnOpInstruction implements Instruction {
  op: Token.token

  constructor(op: Token.token) {
    this.op = op
  }

  getType(): InstType {
    return InstType.UNOP
  }

  stringRep(): string {
    return `UNOP ${this.op.toString()}`
  }
}

export class BinOpInstruction implements Instruction {
  op: Token.token

  constructor(op: Token.token) {
    this.op = op
  }

  getType(): InstType {
    return InstType.BINOP
  }

  stringRep(): string {
    return `BINOP ${this.op.toString()}`
  }
}

export class JumpOnFalseInstruction implements Instruction {
  dest: number

  setJumpDest(dest: number) {
    this.dest = dest
  }

  getType(): InstType {
    return InstType.JOF
  }

  stringRep(): string {
    return `JOF ${this.dest}`
  }
}

export class GotoInstruction implements Instruction {
  dest: number

  setGotoDest(dest: number) {
    this.dest = dest
  }

  getType(): InstType {
    return InstType.GOTO
  }

  stringRep(): string {
    return `GOTO ${this.dest}`
  }
}

export class IterEndInstruction implements Instruction {
  getType(): InstType {
    return InstType.ITER_END
  }

  stringRep(): string {
    return 'ITER_END'
  }
}

export class ForEndInstruction implements Instruction {
  getType(): InstType {
    return InstType.FOR_END
  }

  stringRep(): string {
    return 'FOR_END'
  }
}

export class CallInstruction implements Instruction {
  arity: number

  constructor(arity: number) {
    this.arity = arity
  }

  getType(): InstType {
    return InstType.CALL
  }

  stringRep(): string {
    return `CALL ${this.arity}`
  }
}

export class AssignInstruction implements Instruction {
  pos: EnvironmentPos

  constructor(pos: EnvironmentPos) {
    this.pos = pos
  }

  getType(): InstType {
    return InstType.ASSIGN
  }

  stringRep(): string {
    return `ASSIGN (${this.pos.env_offset}, ${this.pos.frame_offset})`
  }
}

export class PopInstruction implements Instruction {
  getType(): InstType {
    return InstType.POP
  }

  stringRep(): string {
    return 'POP'
  }
}

export class LoadFunctionInstruction implements Instruction {
  arity: number
  addr: number

  constructor(arity: number, addr: number) {
    this.arity = arity
    this.addr = addr
  }

  getType(): InstType {
    return InstType.LDF
  }

  stringRep(): string {
    return `LF ${this.arity} @ ${this.addr}`
  }
}

export class EnterScopeInstruction implements Instruction {
  varCount: number

  constructor(varCnt: number) {
    this.varCount = varCnt
  }

  getType(): InstType {
    return InstType.ENTER_SCOPE
  }

  stringRep(): string {
    return 'ENTER_SCOPE'
  }
}

export class ExitScopeInstruction implements Instruction {
  getType(): InstType {
    return InstType.EXIT_SCOPE
  }

  stringRep(): string {
    return 'EXIT_SCOPE'
  }
}

export class ResetInstruction implements Instruction {
  getType(): InstType {
    return InstType.RESET
  }

  stringRep(): string {
    return 'RESET'
  }
}

export class GoInstruction implements Instruction {
  arity: number
  constructor(arity: number) {
    this.arity = arity
  }

  getType(): InstType {
    return InstType.GO
  }

  stringRep(): string {
    return `GO ${this.arity}`
  }
}

export class DestroyGoroutineInstruction implements Instruction {
  getType(): InstType {
    return InstType.GO_DEST
  }

  stringRep(): string {
    return 'DESTROY_GOROUTINE'
  }
}

export class SendInstruction implements Instruction {
  getType(): InstType {
    return InstType.SEND
  }

  stringRep(): string {
    return 'SEND'
  }
}

export class ContinueInstruction implements Instruction {
  getType(): InstType {
    return InstType.CONT
  }

  stringRep(): string {
    return 'CONTINUE'
  }
}

export class BreakInstruction implements Instruction {
  getType(): InstType {
    return InstType.BREAK
  }

  stringRep(): string {
    return 'BREAK'
  }
}
