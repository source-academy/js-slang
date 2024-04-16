import * as Token from './tokens/tokens'

enum InstType {
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

export class Instruction {
  tag: InstType

  constructor(tag: InstType) {
    this.tag = tag
  }
}

export class DoneInstruction extends Instruction {
  constructor() {
    super(InstType.DONE)
  }
}

export class BasicLitInstruction extends Instruction {
  value?: number | string
  type: Token.token

  constructor(type: Token.token, value: number | string | undefined) {
    super(InstType.LDC)
    this.type = type
    this.value = value
  }
}

export class IdentInstruction extends Instruction {
  sym: string
  pos: EnvironmentPos

  constructor(sym: string, pos: EnvironmentPos) {
    super(InstType.LD)
    this.sym = sym
    this.pos = pos
  }
}

export class UnOpInstruction extends Instruction {
  op: Token.token

  constructor(op: Token.token) {
    super(InstType.UNOP)
    this.op = op
  }
}

export class BinOpInstruction extends Instruction {
  op: Token.token

  constructor(op: Token.token) {
    super(InstType.BINOP)
    this.op = op
  }
}

export class JumpOnFalseInstruction extends Instruction {
  dest: number

  constructor() {
    super(InstType.JOF)
  }

  setJumpDest(dest: number) {
    this.dest = dest
  }
}

export class GotoInstruction extends Instruction {
  dest: number

  constructor() {
    super(InstType.GOTO)
  }

  setGotoDest(dest: number) {
    this.dest = dest
  }
}

export class IterEndInstruction extends Instruction {
  constructor() {
    super(InstType.ITER_END)
  }
}

export class ForEndInstruction extends Instruction {
  constructor() {
    super(InstType.FOR_END)
  }
}

export class CallInstruction extends Instruction {
  arity: number

  constructor(arity: number) {
    super(InstType.CALL)
    this.arity = arity
  }
}

export class AssignInstruction extends Instruction {
  pos: EnvironmentPos

  constructor(pos: EnvironmentPos) {
    super(InstType.ASSIGN)
    this.pos = pos
  }
}

export class PopInstruction extends Instruction {
  constructor() {
    super(InstType.POP)
  }
}

export class LoadFunctionInstruction extends Instruction {
  arity: number
  addr: number

  constructor(arity: number, addr: number) {
    super(InstType.LDF)
    this.arity = arity
    this.addr = addr
  }
}

export class EnterScopeInstruction extends Instruction {
  varCount: number

  constructor(varCnt: number) {
    super(InstType.ENTER_SCOPE)
    this.varCount = varCnt
  }
}

export class ExitScopeInstruction extends Instruction {
  constructor() {
    super(InstType.EXIT_SCOPE)
  }
}

export class ResetInstruction extends Instruction {
  constructor() {
    super(InstType.RESET)
  }
}

export class GoInstruction extends Instruction {
  arity: number
  constructor(arity: number) {
    super(InstType.GO)
    this.arity = arity
  }
}

export class DestroyGoroutineInstruction extends Instruction {
  constructor() {
    super(InstType.GO_DEST)
  }
}

export class SendInstruction extends Instruction {
  constructor() {
    super(InstType.SEND)
  }
}

export class ContinueInstruction extends Instruction {
  constructor() {
    super(InstType.CONT)
  }
}

export class BreakInstruction extends Instruction {
  constructor() {
    super(InstType.BREAK)
  }
}
