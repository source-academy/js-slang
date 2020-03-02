import { recursive } from 'acorn-walk/dist/walk'
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
function updateFunction(index: number, stackSize: number, ins: Instruction[]) {
  const f = SVMFunctions[index]
  f[0] = stackSize
  f[3] = ins
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

type CompileTask = [es.BlockStatement | es.Program, Address, Array<Map<string, EnvEntry>>]
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
  functionAddress: Address,
  indexTable: Array<Map<string, EnvEntry>>
): CompileTask {
  return [body, functionAddress, indexTable]
}
function toCompileTaskBody(toCompileTask: CompileTask): es.BlockStatement | es.Program {
  return toCompileTask[0]
}
function toCompileTaskFunctionAddress(toCompileTask: CompileTask): Address {
  return toCompileTask[1]
}
function toCompileTaskIndexTable(toCompileTask: CompileTask): Array<Map<string, EnvEntry>> {
  return toCompileTask[2]
}

// indexTable keeps track of environment addresses
// assigned to names
function makeEmptyIndexTable(): Array<Map<string, EnvEntry>> {
  return []
}
function extendIndexTable(indexTable: Array<Map<string, EnvEntry>>, names: Map<string, EnvEntry>) {
  return indexTable.concat([names])
}
function indexOf(indexTable: Array<Map<string, EnvEntry>>, name: string) {
  for (let i = indexTable.length - 1; i >= 0; i--) {
    if (indexTable[i].has(name)) {
      const envLevel = indexTable.length - 1 - i
      const { index, isVar } = indexTable[i].get(name)!
      return { envLevel, index, isVar }
    }
  }
  throw Error('name not found: ' + name)
}

// a small complication: the toplevel function
// needs to return the value of the last statement
let toplevel = true

function continueToCompile() {
  while (toCompile.length !== 0) {
    const nextToCompile = popToCompile()
    const functionAddress = toCompileTaskFunctionAddress(nextToCompile)
    const indexTable = toCompileTaskIndexTable(nextToCompile)
    const body = toCompileTaskBody(nextToCompile)
    const { maxStackSize } = compile(body, indexTable, true)

    const functionIndex = functionAddress[0]
    updateFunction(functionIndex, maxStackSize, functionCode)
    functionCode = []
    toplevel = false
  }
}
interface EnvEntry {
  index: number
  isVar: boolean
}

// extracts all name declarations within a function, and renames all shadowed names
// if parent scope has name, rename to name_line_col
// then recursively rename identifiers in ast if no same scope declaration
// (check for variable, function declaration in each block. Check for params in each function call)
// for any duplicates, rename recursively within scope
// recurse for any blocks
function localNames(baseNode: es.BlockStatement | es.Program, names: Map<string, EnvEntry>) {
  // get all declared names of current scope and keep track of names to rename
  const namesToRename = new Map<string, string>()
  for (const stmt of baseNode.body) {
    if (stmt.type === 'VariableDeclaration') {
      const node = stmt as es.VariableDeclaration
      let name = (node.declarations[0].id as es.Identifier).name
      if (names.has(name)) {
        const loc = node.loc!.start // should be present
        const oldName = name
        name = name + '_' + loc.line + '_' + loc.column
        namesToRename.set(oldName, name)
      }
      const isVar = node.kind === 'let'
      const index = names.size
      names.set(name, { index, isVar })
    } else if (stmt.type === 'FunctionDeclaration') {
      const node = stmt as es.FunctionDeclaration
      let name = (node.id as es.Identifier).name
      if (names.has(name)) {
        const loc = node.loc!.start // should be present
        const oldName = name
        name = name + '_' + loc.line + '_' + loc.column
        namesToRename.set(oldName, name)
      }
      const isVar = false
      const index = names.size
      names.set(name, { index, isVar })
    }
  }

  // rename all references within blocks if nested block does not redeclare name
  renameVariables(baseNode, namesToRename)

  // recurse for blocks
  for (const stmt of baseNode.body) {
    if (stmt.type === 'BlockStatement') {
      const node = stmt as es.BlockStatement
      localNames(node, names)
    } else if (stmt.type === 'IfStatement') {
      const { consequent, alternate } = stmt as es.IfStatement
      localNames(consequent as es.BlockStatement, names)
      // Source spec must have alternate
      localNames(alternate! as es.BlockStatement, names)
    }
  }
  return names
}

// rename variables if nested scope does not redeclare names
// redeclaration occurs on VariableDeclaration and FunctionDeclaration
function renameVariables(
  baseNode: es.BlockStatement | es.Program,
  namesToRename: Map<string, string>
) {
  let baseScope = true

  function recurseBlock(
    node: es.BlockStatement,
    inactive: Set<string>,
    c: (node: es.Node, state: Set<string>) => void
  ) {
    // get names in current scope
    const locals = getLocalsInScope(node)
    // add names to state
    const oldActive = new Set(inactive)
    for (const name of locals) {
      inactive.add(name)
    }
    // recurse
    for (const stmt of node.body) {
      c(stmt, inactive)
    }
    // reset state to normal
    for (const name of locals) {
      if (oldActive.has(name)) {
        continue
      }
      inactive.delete(name) // delete if not in old scope
    }
  }

  recursive(baseNode, new Set<string>(), {
    VariablePattern(node: es.Identifier, inactive, c) {
      // for declarations
      const name = node.name
      if (inactive.has(name)) {
        return
      }
      if (namesToRename.has(name)) {
        node.name = namesToRename.get(name)!
      }
    },
    Identifier(node: es.Identifier, inactive, c) {
      // for lone references
      const name = node.name
      if (inactive.has(name)) {
        return
      }
      if (namesToRename.has(name)) {
        node.name = namesToRename.get(name)!
      }
    },
    BlockStatement(node: es.BlockStatement, inactive, c) {
      if (baseScope) {
        baseScope = false
        for (const stmt of node.body) {
          c(stmt, inactive)
        }
      } else {
        recurseBlock(node, inactive, c)
      }
    },
    IfStatement(node: es.IfStatement, inactive, c) {
      const { consequent, alternate } = node
      recurseBlock(consequent as es.BlockStatement, inactive, c)
      recurseBlock(alternate! as es.BlockStatement, inactive, c)
    },
    Function(node: es.Function, inactive, c) {
      if ('id' in node) {
        c(node.id!, inactive)
      }
      const oldActive = new Set(inactive)
      const locals = new Set<string>()
      for (const param of node.params) {
        const id = param as es.Identifier
        locals.add(id.name)
      }
      for (const name of locals) {
        inactive.add(name)
      }
      c(node.body, inactive, 'expression' in node ? 'Expression' : 'Statement')
      for (const name of locals) {
        if (oldActive.has(name)) {
          continue
        }
        inactive.delete(name) // delete if not in old scope
      }
    }
  })
}

function getLocalsInScope(node: es.BlockStatement | es.Program) {
  const locals = new Set<string>()
  for (const stmt of node.body) {
    if (stmt.type === 'VariableDeclaration') {
      const stmtNode = stmt as es.VariableDeclaration
      const name = (stmtNode.declarations[0].id as es.Identifier).name
      locals.add(name)
    } else if (stmt.type === 'FunctionDeclaration') {
      const stmtNode = stmt as es.FunctionDeclaration
      const name = (stmtNode.id as es.Identifier).name
      locals.add(name)
    }
  }
  return locals
}

function compileArguments(exprs: es.Node[], indexTable: Array<Map<string, EnvEntry>>) {
  let maxStackSize = 0
  for (let i = 0; i < exprs.length; i++) {
    const { maxStackSize: curExpSize } = compile(exprs[i], indexTable, false)
    maxStackSize = Math.max(i + curExpSize, maxStackSize)
  }
  return maxStackSize
}

// function compileStatements(statements: es.Node[], indexTable: Map<string,EnvEntry>[], insertFlag: boolean) {}

// each compiler should return a maxStackSize
const compilers = {
  Program(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BlockStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ExpressionStatement(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    throw Error('Unsupported operation')
  },

  IfStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  VariableDeclaration(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    throw Error('Unsupported operation')
  },

  ReturnStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  CallExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  UnaryExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BinaryExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  LogicalExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ConditionalExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    throw Error('Unsupported operation')
  },

  ArrowFunctionExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    throw Error('Unsupported operation')
  },

  Identifier(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  Literal(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ArrayExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  AssignmentExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    throw Error('Unsupported operation')
  },

  ForStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  WhileStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  BreakStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ContinueStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  ObjectExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  MemberExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  Property(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  }
}

function compile(expr: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
  return { maxStackSize: 0, insertFlag }
}

export function compileToIns(program: es.Program): Program {
  // reset variables
  SVMFunctions = []
  functionCode = []
  toCompile = []
  toplevel = true

  const locals = localNames(program, new Map<string, EnvEntry>())
  const topFunction: SVMFunction = [NaN, locals.size, 0, []]
  SVMFunctions.push(topFunction)
  const topFunctionIndex = SVMFunctions.length

  const extendedTable = extendIndexTable(makeEmptyIndexTable(), locals)
  pushToCompile(makeToCompileTask(program, [topFunctionIndex], extendedTable))
  continueToCompile()
  return [topFunctionIndex, SVMFunctions]
}
