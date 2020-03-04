import { recursive } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import * as create from '../utils/astCreator'

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
  LDPG = 48, // index in env, index of parent relative to current env
  LDPF = 49, // index in env, index of parent relative to current env
  LDPB = 50, // index in env, index of parent relative to current env
  STPG = 51, // index in env, index of parent relative to current env
  STPB = 52, // index in env, index of parent relative to current env
  STPF = 53, // index in env, index of parent relative to current env
  LDAG = 54,
  LDAB = 55,
  LDAF = 56,
  STAG = 57,
  STAB = 58,
  STAF = 59,
  BRT = 60, // Offset
  BRF = 61, // Offset
  BR = 62, // Offset
  JMP = 63, // Address
  CALL = 64, // number of arguments
  CALLT = 65, // number of arguments
  CALLP = 66, // id of primitive function, number of arguments
  CALLTP = 67, // id of primitive function, number of arguments
  CALLV = 68, // id of vm-internal function, number of arguments
  CALLTV = 69, // id of vm-internal function, number of arguments
  RETG = 70,
  RETF = 71,
  RETB = 72,
  RETU = 73,
  RETN = 74,
  DUP = 75
}

const VALID_UNARY_OPERATORS = new Map([['!', OpCodes.NOTG]])
const VALID_BINARY_OPERATORS = new Map([
  ['+', OpCodes.ADDG],
  ['-', OpCodes.SUBG],
  ['*', OpCodes.MULG],
  ['/', OpCodes.DIVG],
  ['%', OpCodes.MODG],
  ['<', OpCodes.LTG],
  ['>', OpCodes.GTG],
  ['<=', OpCodes.LEG],
  ['>=', OpCodes.GEG],
  ['===', OpCodes.EQG]
])

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
export type Program = [
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

  // recurse for blocks. Need to manually add all cases to recurse
  for (const stmt of baseNode.body) {
    if (stmt.type === 'BlockStatement') {
      const node = stmt as es.BlockStatement
      localNames(node, names)
    } else if (stmt.type === 'IfStatement') {
      const { consequent, alternate } = stmt as es.IfStatement
      localNames(consequent as es.BlockStatement, names)
      // Source spec must have alternate
      localNames(alternate! as es.BlockStatement, names)
    } else if (stmt.type === 'WhileStatement') {
      const node = stmt as es.WhileStatement
      localNames(node.body as es.BlockStatement, names)
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
      if (node.type === 'FunctionDeclaration') {
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
      c(
        node.body,
        inactive,
        node.type === 'ArrowFunctionExpression' && node.expression ? 'Expression' : 'Statement'
      )
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

// break and continue need to know how much to offset for the branch
// instruction. When compiling the individual instruction, that info
// is not available, so need to keep track of the break and continue
// instruction's index to update the offset when the compiler finishes
// compiling the loop
const breakTracker: number[][] = []
const continueTracker: number[][] = []

function compileArguments(exprs: es.Node[], indexTable: Array<Map<string, EnvEntry>>) {
  let maxStackSize = 0
  for (let i = 0; i < exprs.length; i++) {
    const { maxStackSize: curExpSize } = compile(exprs[i], indexTable, false)
    maxStackSize = Math.max(i + curExpSize, maxStackSize)
  }
  return maxStackSize
}

function compileStatements(
  statements: es.Node[],
  indexTable: Array<Map<string, EnvEntry>>,
  insertFlag: boolean
) {
  let maxStackSize = 0
  for (let i = 0; i < statements.length; i++) {
    const { maxStackSize: curExprSize } = compile(
      statements[i],
      indexTable,
      i === statements.length - 1 ? insertFlag : false
    )
    if (i !== statements.length - 1) {
      addNullaryInstruction(OpCodes.POPG)
    }
    maxStackSize = Math.max(maxStackSize, curExprSize)
  }
  return { maxStackSize, insertFlag: false }
}

// each compiler should return a maxStackSize
const compilers = {
  Program(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.Program
    return compileStatements(node.body, indexTable, insertFlag)
  },

  BlockStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.BlockStatement
    return compileStatements(node.body, indexTable, insertFlag)
  },

  ExpressionStatement(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    node = node as es.ExpressionStatement
    return compile(node.expression, indexTable, insertFlag)
  },

  IfStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    const { test, consequent, alternate } = node as es.IfStatement
    const { maxStackSize: m1 } = compile(test, indexTable, false)
    addUnaryInstruction(OpCodes.BRF, NaN)
    const BRFIndex = functionCode.length - 1
    const { maxStackSize: m2 } = compile(consequent, indexTable, false)
    addUnaryInstruction(OpCodes.BR, NaN)
    const BRIndex = functionCode.length - 1
    functionCode[BRFIndex][1] = functionCode.length - BRFIndex
    // source spec: must have alternate
    const { maxStackSize: m3 } = compile(alternate!, indexTable, false)
    functionCode[BRIndex][1] = functionCode.length - BRIndex
    const maxStackSize = Math.max(m1, m2, m3)
    return { maxStackSize, insertFlag }
  },

  FunctionDeclaration(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    node = node as es.FunctionDeclaration
    return compile(
      create.constantDeclaration(
        (node.id as es.Identifier).name,
        create.arrowFunctionExpression(node.params, node.body)
      ),
      indexTable,
      insertFlag
    )
  },

  VariableDeclaration(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    // only supports const / let
    node = node as es.VariableDeclaration
    if (node.kind === 'const' || node.kind === 'let') {
      // assumes left side can only be name
      // source spec: only 1 declaration at a time
      const id = node.declarations[0].id as es.Identifier
      const name = id.name
      const { envLevel, index } = indexOf(indexTable, name)
      const { maxStackSize } = compile(
        node.declarations[0].init as es.Expression,
        indexTable,
        false
      )
      if (envLevel === 0) {
        addUnaryInstruction(OpCodes.STLG, index)
      } else {
        addBinaryInstruction(OpCodes.STPG, index, envLevel)
      }
      addNullaryInstruction(OpCodes.LGCU)
      return { maxStackSize, insertFlag }
    }
    throw Error('Invalid declaration')
  },

  // handled by insertFlag in compile function
  ReturnStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.ReturnStatement
    const { maxStackSize } = compile(node.argument as es.Expression, indexTable, false)
    return { maxStackSize, insertFlag }
  },

  // TODO: differentiate primitive functions
  CallExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.CallExpression
    const { maxStackSize: maxStackOperator } = compile(node.callee, indexTable, false)
    const maxStackOperands = compileArguments(node.arguments, indexTable)
    addUnaryInstruction(OpCodes.CALL, node.arguments.length)
    return { maxStackSize: Math.max(maxStackOperator, maxStackOperands + 1), insertFlag }
  },

  UnaryExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.UnaryExpression
    if (VALID_UNARY_OPERATORS.has(node.operator)) {
      const opCode = VALID_UNARY_OPERATORS.get(node.operator) as number
      const { maxStackSize } = compile(node.argument, indexTable, false)
      addNullaryInstruction(opCode)
      return { maxStackSize, insertFlag }
    }
    throw Error('Unsupported unary operation')
  },

  BinaryExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.BinaryExpression
    if (VALID_BINARY_OPERATORS.has(node.operator)) {
      const opCode = VALID_BINARY_OPERATORS.get(node.operator) as number
      const { maxStackSize: m1 } = compile(node.left, indexTable, false)
      const { maxStackSize: m2 } = compile(node.right, indexTable, false)
      addNullaryInstruction(opCode)
      return { maxStackSize: Math.max(m1, 1 + m2), insertFlag }
    }
    throw Error('Unsupported operation')
  },

  LogicalExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.LogicalExpression
    if (node.operator === '&&') {
      const { maxStackSize } = compile(
        create.conditionalExpression(node.left, node.right, create.literal(false)),
        indexTable,
        false
      )
      return { maxStackSize, insertFlag }
    } else if (node.operator === '||') {
      const { maxStackSize } = compile(
        create.conditionalExpression(node.left, create.literal(true), node.right),
        indexTable,
        false
      )
      return { maxStackSize, insertFlag }
    }
    throw Error('Unsupported logical operator')
  },

  ConditionalExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    const { test, consequent, alternate } = node as es.IfStatement
    const { maxStackSize: m1 } = compile(test, indexTable, false)
    addUnaryInstruction(OpCodes.BRF, NaN)
    const BRFIndex = functionCode.length - 1
    const { maxStackSize: m2 } = compile(consequent, indexTable, insertFlag)
    let BRIndex = NaN
    if (!insertFlag) {
      addUnaryInstruction(OpCodes.BR, NaN)
      BRIndex = functionCode.length - 1
    }
    functionCode[BRFIndex][1] = functionCode.length - BRFIndex
    const { maxStackSize: m3 } = compile(alternate!, indexTable, insertFlag)
    if (!insertFlag) {
      functionCode[BRIndex][1] = functionCode.length - BRIndex
    }
    const maxStackSize = Math.max(m1, m2, m3)
    return { maxStackSize, insertFlag: false }
  },

  ArrowFunctionExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    node = node as es.ArrowFunctionExpression
    // node.body is either a block statement or a single node to return
    const bodyNode =
      node.body.type === 'BlockStatement'
        ? node.body
        : create.blockStatement([create.returnStatement(node.body)])
    const names = new Map<string, EnvEntry>()
    for (let param of node.params) {
      param = param as es.Identifier
      const index = names.size
      names.set(param.name, { index, isVar: true })
    }
    localNames(bodyNode, names)
    const extendedIndexTable = extendIndexTable(indexTable, names)

    const newSVMFunction: SVMFunction = [NaN, names.size, node.params.length, []]
    const functionIndex = SVMFunctions.length
    SVMFunctions.push(newSVMFunction)
    pushToCompile(makeToCompileTask(bodyNode, [functionIndex], extendedIndexTable))

    return { maxStackSize: 1, insertFlag }
  },

  Identifier(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.Identifier

    // undefined
    if (node.name === 'undefined') {
      addNullaryInstruction(OpCodes.LGCU)
    } else {
      const { envLevel, index } = indexOf(indexTable, node.name)
      if (envLevel === 0) {
        addUnaryInstruction(OpCodes.LDLG, index)
      } else {
        addBinaryInstruction(OpCodes.LDPG, index, envLevel)
      }
    }
    return { maxStackSize: 1, insertFlag }
  },

  // string, boolean, number or null
  Literal(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.Literal
    const value = node.value
    if (value === null) {
      addNullaryInstruction(OpCodes.LGCN)
    } else {
      switch (typeof value) {
        case 'boolean':
          if (value) {
            addNullaryInstruction(OpCodes.LGCB1)
          } else {
            addNullaryInstruction(OpCodes.LGCB0)
          }
          break
        case 'number': // need to adjust depending on target
          if (Number.isInteger(value)) {
            addUnaryInstruction(OpCodes.LGCI, value)
          } else {
            addUnaryInstruction(OpCodes.LGCF64, value)
          }
          break
        case 'string':
          addUnaryInstruction(OpCodes.LGCS, value)
          break
        default:
          throw Error('Unsupported literal')
      }
    }
    return { maxStackSize: 1, insertFlag }
  },

  // array declarations
  ArrayExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.ArrayExpression
    addNullaryInstruction(OpCodes.NEWA)
    const elements = node.elements
    let maxStackSize = 1
    for (let i = 0; i < elements.length; i++) {
      addNullaryInstruction(OpCodes.DUP)
      addUnaryInstruction(OpCodes.LGCI, i)
      // special case when element wasnt specified
      // i.e. [,]. Treat as undefined element
      if (elements[i] === null) {
        continue
      }
      const { maxStackSize: m1 } = compile(elements[i], indexTable, false)
      addNullaryInstruction(OpCodes.STAG)
      maxStackSize = Math.max(1 + 2 + m1, maxStackSize)
    }
    return { maxStackSize, insertFlag }
  },

  AssignmentExpression(
    node: es.Node,
    indexTable: Array<Map<string, EnvEntry>>,
    insertFlag: boolean
  ) {
    node = node as es.AssignmentExpression
    if (node.left.type === 'Identifier') {
      const { envLevel, index, isVar } = indexOf(indexTable, node.left.name)
      if (!isVar) {
        throw Error('Tried to assign value to constant: ' + node.left.name)
      }
      const { maxStackSize } = compile(node.right, indexTable, false)
      if (envLevel === 0) {
        addUnaryInstruction(OpCodes.STLG, index)
      } else {
        addBinaryInstruction(OpCodes.STPG, index, envLevel)
      }
      addNullaryInstruction(OpCodes.LGCU)
      return { maxStackSize, insertFlag }
    } else if (node.left.type === 'MemberExpression' && node.left.computed === true) {
      // case for a[0] = 1
      const { maxStackSize: m1 } = compile(node.left.object, indexTable, false)
      const { maxStackSize: m2 } = compile(node.left.property, indexTable, false)
      const { maxStackSize: m3 } = compile(node.right, indexTable, false)
      addNullaryInstruction(OpCodes.STAG)
      addNullaryInstruction(OpCodes.LGCU)
      return { maxStackSize: Math.max(m1, 1 + m2, 2 + m3), insertFlag }
    }
    // property assignments are not supported
    throw Error('Invalid Assignment')
  },

  ForStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  WhileStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.WhileStatement
    const condIndex = functionCode.length
    const { maxStackSize: m1 } = compile(node.test, indexTable, false)
    addUnaryInstruction(OpCodes.BRF, NaN)
    const BRFIndex = functionCode.length - 1
    breakTracker.push([] as number[])
    continueTracker.push([])
    const { maxStackSize: m2 } = compile(node.body, indexTable, false)
    const endLoopIndex = functionCode.length
    addUnaryInstruction(OpCodes.BR, condIndex - endLoopIndex)
    functionCode[BRFIndex][1] = functionCode.length - BRFIndex

    // update BR instructions within loop
    const breaks = breakTracker.pop()!
    const continues = continueTracker.pop()!
    for (const b of breaks) {
      functionCode[b][1] = functionCode.length - b
    }
    for (const c of continues) {
      functionCode[c][1] = condIndex - c
    }
    return { maxStackSize: Math.max(m1, m2), insertFlag }
  },

  BreakStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    // keep track of break instruction
    breakTracker[breakTracker.length - 1].push(functionCode.length)
    addUnaryInstruction(OpCodes.BR, NaN)
    return { maxStackSize: 0, insertFlag }
  },

  ContinueStatement(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    // keep track of continue instruction
    continueTracker[continueTracker.length - 1].push(functionCode.length)
    addUnaryInstruction(OpCodes.BR, NaN)
    return { maxStackSize: 0, insertFlag }
  },

  ObjectExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  MemberExpression(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    node = node as es.MemberExpression
    if (node.computed) {
      const { maxStackSize: m1 } = compile(node.object, indexTable, false)
      const { maxStackSize: m2 } = compile(node.property, indexTable, false)
      addNullaryInstruction(OpCodes.LDAG)
      return { maxStackSize: Math.max(m1, 1 + m2), insertFlag }
    }
    // properties are not supported
    throw Error('Unsupported operation')
  },

  Property(node: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
    throw Error('Unsupported operation')
  }
}

function compile(expr: es.Node, indexTable: Array<Map<string, EnvEntry>>, insertFlag: boolean) {
  const compiler = compilers[expr.type]
  if (!compiler) {
    throw Error('Unsupported operation')
  }
  const { maxStackSize: temp, insertFlag: newInsertFlag } = compiler(expr, indexTable, insertFlag)
  let maxStackSize = temp

  // TODO: Tail call
  if (newInsertFlag) {
    if (expr.type === 'ReturnStatement') {
      addNullaryInstruction(OpCodes.RETG)
    } else if (
      toplevel &&
      (expr.type === 'Literal' ||
        expr.type === 'UnaryExpression' ||
        expr.type === 'BinaryExpression' ||
        expr.type === 'CallExpression' ||
        (expr.type === 'Identifier' && expr.name === 'undefined'))
    ) {
      addNullaryInstruction(OpCodes.RETG)
    } else if (
      expr.type === 'Program' ||
      expr.type === 'ExpressionStatement' ||
      expr.type === 'BlockStatement'
    ) {
      // do nothing
    } else {
      maxStackSize += 1
      addNullaryInstruction(OpCodes.LGCU)
      addNullaryInstruction(OpCodes.RETG)
    }
  }

  return { maxStackSize, insertFlag: newInsertFlag }
}

export function compileToIns(program: es.Program): Program {
  // reset variables
  SVMFunctions = []
  functionCode = []
  toCompile = []
  toplevel = true

  const locals = localNames(program, new Map<string, EnvEntry>())
  const topFunction: SVMFunction = [NaN, locals.size, 0, []]
  const topFunctionIndex = SVMFunctions.length
  SVMFunctions.push(topFunction)

  const extendedTable = extendIndexTable(makeEmptyIndexTable(), locals)
  pushToCompile(makeToCompileTask(program, [topFunctionIndex], extendedTable))
  continueToCompile()
  return [topFunctionIndex, SVMFunctions]
}
