import * as es from 'estree'

export enum OpCodes {
  NOP = 0,
  LDCI = 1, // integer
  LGCI = 2, // integer
  LDCF32 = 3, // 32-bit float
  LGCF32 = 4, // 32-bit float
  LDCF64 = 5, // 64-bit float
  LGCF64 = 6, // 64-bit float
  LDCB0 = 7,
  LDCB1 = 8,
  LGCB0 = 9,
  LGCB1 = 10,
  LGCU = 11,
  LGCN = 12,
  LGCS = 13, // string
  POPG = 14,
  POPB = 15,
  POPF = 16,
  ADDG = 17,
  ADDF = 18,
  SUBG = 19,
  SUBF = 20,
  MULG = 21,
  MULF = 22,
  DIVG = 23,
  DIVF = 24,
  MODG = 25,
  MODF = 26,
  NOTG = 27,
  NOTB = 28,
  LTG = 29,
  LTF = 30,
  GTG = 31,
  GTF = 32,
  LEG = 33,
  LEF = 34,
  GEG = 35,
  GEF = 36,
  EQG = 37,
  EQF = 38,
  EQB = 39,
  NEWC = 40, // Address of function
  NEWA = 41,
  LDLG = 42, // index in current env
  LDLF = 43, // index in current env
  LDLB = 44, // index in current env
  STLG = 45, // index in current env
  STLB = 46, // index in current env
  STLF = 47, // index in current env
  LDPG = 48, // index in current env, index of parent relative to current env
  LDPF = 49, // index in current env, index of parent relative to current env
  LDPB = 50, // index in current env, index of parent relative to current env
  STPG = 51, // index in current env, index of parent relative to current env
  STPB = 52, // index in current env, index of parent relative to current env
  STPF = 53, // index in current env, index of parent relative to current env
  LDAG = 54,
  LDAB = 55,
  LDAF = 56,
  STAG = 57,
  STAB = 58,
  STAF = 59,
  BRT = 60, // Offset
  BR = 61, // Offset
  JMP = 62, // Address
  CALL = 63, // number of arguments
  CALLT = 64, // number of arguments
  CALLP = 65, // id of primitive function, number of arguments
  CALLTP = 66, // id of primitive function, number of arguments
  CALLV = 67, // id of vm-internal function, number of arguments
  CALLTV = 68, // id of vm-internal function, number of arguments
  RETG = 69,
  RETF = 70,
  RETB = 71,
  RETU = 72,
  RETN = 73
}

type Offset = number // instructions to skip
type Address = [
  number, // function index
  number? // instruction index within function; optional
]
type Instruction = [
  number, // opcode
  Argument?,
  Argument?
]
type Argument = number | boolean | string | Offset | Address
type SVMFunction = [
  number, // stack size
  number, // environment size
  number, // number of arguments
  Instruction[] // code
]
type Program = [
  number, // index of entry point function
  SVMFunction[]
]

let SVMFunctions: SVMFunction[] = []

function addFunction(f: SVMFunction) {
  SVMFunctions.push(f)
}

let functionCode: Instruction[] = []

// three insert functions (nullary, unary, binary)
function addNullaryInstruction(opCode: number) {
  const ins: Instruction = [opCode]
  functionCode.push(ins)
}

function addUnaryInstruction(opCode: number, arg1: Argument) {
  const ins: Instruction = [opCode, arg1]
  functionCode.push(ins)
}

function addBinaryInstruction(opCode: number, arg1: Argument, arg2: Argument) {
  const ins: Instruction = [opCode, arg1, arg2]
  functionCode.push(ins)
}

type CompileTask = [es.BlockStatement | es.Program, number, number, EnvName[][]]
// toCompile stack keeps track of remaining compiler work:
// these are function bodies that still need to be compiled
let toCompile: CompileTask[] = []
function popToCompile(): CompileTask {
  const next = toCompile.pop()
  if (!next) {
    throw Error('Unable to compile')
  }
  return next
}
function pushToCompile(task: CompileTask) {
  toCompile.push(task)
}

// to compile a function body, we need an index table
// to get the environment indices for each name
// (parameters, globals and locals)
// Each compile function returns the max operand stack
// size needed for running the code. When compilation of
// a function body is done, the function continueToCompile
// writes the max operand stack size and the address of the
// function body to the given addresses.
// must ensure body passed in is something that has an array of nodes
// Program or BlockStatement

function makeToCompileTask(
  body: es.BlockStatement | es.Program,
  maxStackSizeAddress: number,
  addressAddress: number,
  indexTable: EnvName[][]
): CompileTask {
  return [body, maxStackSizeAddress, addressAddress, indexTable]
}
function toCompileTaskBody(toCompileTask: CompileTask): es.BlockStatement | es.Program {
  return toCompileTask[0]
}
function toCompileTaskMaxStackSizeAddress(toCompileTask: CompileTask): number {
  return toCompileTask[1]
}
function toCompileTaskAddressAddress(toCompileTask: CompileTask): number {
  return toCompileTask[2]
}
function toCompileTaskIndexTable(toCompileTask: CompileTask): EnvName[][] {
  return toCompileTask[3]
}

// indexTable keeps track of environment addresses
// assigned to names
function makeEmptyIndexTable(): EnvName[][] {
  return []
}
function extendIndexTable(indexTable: EnvName[][], names: EnvName[]) {
  return indexTable.concat([names])
}
function indexOf(indexTable: EnvName[][], name: string) {
  for (let i = indexTable.length - 1; i >= 0; i--) {
    for (let j = 0; j < indexTable[i].length; j++) {
      const envName = indexTable[i][j]
      if (envName.name === name) {
        const envLevel = indexTable.length - 1 - i
        const index = j
        const isVar = envName.isVar
        return { envLevel, index, isVar }
      }
    }
  }
  throw Error('name not found: ' + name)
}

// a small complication: the toplevel function
// needs to return the value of the last statement
let toplevel = true

// function continueToCompile() {}

interface EnvName {
  name: string
  isVar: boolean
}
function localNames(stmts: es.Node | es.Node[]) {
  const names: EnvName[] = []
  if (Array.isArray(stmts)) {
    for (const stmt of stmts) {
      names.push(...localNames(stmt))
    }
  } else {
    if (stmts.type === 'VariableDeclaration') {
      const node = stmts as es.VariableDeclaration
      const name = (node.declarations[0].id as es.Identifier).name
      const isVar = node.kind === 'let'
      names.push({ name, isVar })
    } else if (stmts.type === 'FunctionDeclaration') {
      const node = stmts as es.FunctionDeclaration
      const name = (node.id as es.Identifier).name
      const isVar = false
      names.push({ name, isVar })
    }
  }
  return names
}

function compileArguments(exprs: es.Node[], indexTable: EnvName[][]) {
  let maxStackSize = 0
  for (let i = 0; i < exprs.length; i++) {
    const { maxStackSize: curExpSize } = compile(exprs[i], indexTable, false)
    maxStackSize = Math.max(i + curExpSize, maxStackSize)
  }
  return maxStackSize
}

// function compileStatements(statements: es.Node[], indexTable: EnvName[][], insertFlag: boolean) {}

// each compiler should return a maxStackSize
const compilers = {
  Program(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BlockStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ExpressionStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  IfStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  VariableDeclaration(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ReturnStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  CallExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  UnaryExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BinaryExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  LogicalExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ConditionalExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ArrowFunctionExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  Identifier(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  Literal(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ArrayExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  AssignmentExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ForStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  WhileStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BreakStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ContinueStatement(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ObjectExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  MemberExpression(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  Property(node: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
    throw Error('Unsupported operation')
  }
}

function compile(expr: es.Node, indexTable: EnvName[][], insertFlag: boolean) {
  return { maxStackSize: 0, insertFlag }
}

function compileToIns(program: es.Program): Program {
  // reset variables
  SVMFunctions = []
  functionCode = []
  toCompile = []
  toplevel = true

  const locals = localNames(program.body)
  const topFunction: SVMFunction = [NaN, locals.length, 0, []]
  SVMFunctions.push(topFunction)
  const topFunctionIndex = SVMFunctions.length

  return [topFunctionIndex, SVMFunctions]
}
