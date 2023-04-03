import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../constants'
import { ConstAssignment, UndefinedVariable } from '../errors/errors'
import { parse } from '../parser/parser'
import {
  CONSTANT_PRIMITIVES,
  generatePrimitiveFunctionCode,
  INTERNAL_FUNCTIONS,
  PRIMITIVE_FUNCTION_NAMES,
  vmPrelude
} from '../stdlib/vm.prelude'
import { Context, ContiguousArrayElements } from '../types'
import * as create from '../utils/astCreator'
import { recursive, simple } from '../utils/walkers'
import OpCodes from './opcodes'

const VALID_UNARY_OPERATORS = new Map([
  ['!', OpCodes.NOTG],
  ['-', OpCodes.NEGG]
])
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
  ['===', OpCodes.EQG],
  ['!==', OpCodes.NEQG]
])

export type Offset = number // instructions to skip
export type Address = [
  number, // function index
  number? // instruction index within function; optional
]
export type Instruction = [
  number, // opcode
  Argument?,
  Argument?
]
export type Argument = number | boolean | string | Offset | Address
export type SVMFunction = [
  number, // stack size
  number, // environment size
  number, // number of arguments
  Instruction[] // code
]
export type Program = [
  number, // index of entry point function
  SVMFunction[]
]

// Array of function headers in the compiled program
let SVMFunctions: SVMFunction[] = []
function updateFunction(index: number, stackSize: number, ins: Instruction[]) {
  const f = SVMFunctions[index]
  f[0] = stackSize
  f[3] = ins
}

// Individual function's machine code
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

type CompileTask = [es.BlockStatement | es.Program, Address, Map<string, EnvEntry>[]]
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
  indexTable: Map<string, EnvEntry>[]
): CompileTask {
  return [body, functionAddress, indexTable]
}
function toCompileTaskBody(toCompileTask: CompileTask): es.BlockStatement | es.Program {
  return toCompileTask[0]
}
function toCompileTaskFunctionAddress(toCompileTask: CompileTask): Address {
  return toCompileTask[1]
}
function toCompileTaskIndexTable(toCompileTask: CompileTask): Map<string, EnvEntry>[] {
  return toCompileTask[2]
}

// indexTable keeps track of environment addresses
// assigned to names
function makeEmptyIndexTable(): Map<string, EnvEntry>[] {
  return []
}
function makeIndexTableWithPrimitivesAndInternals(
  vmInternalFunctions?: string[]
): Map<string, EnvEntry>[] {
  const names = new Map<string, EnvEntry>()
  for (let i = 0; i < PRIMITIVE_FUNCTION_NAMES.length; i++) {
    const name = PRIMITIVE_FUNCTION_NAMES[i]
    names.set(name, { index: i, isVar: false, type: 'primitive' })
  }
  if (vmInternalFunctions) {
    for (let i = 0; i < vmInternalFunctions.length; i++) {
      const name = vmInternalFunctions[i]
      names.set(name, { index: i, isVar: false, type: 'internal' })
    }
  }
  return extendIndexTable(makeEmptyIndexTable(), names)
}
function extendIndexTable(indexTable: Map<string, EnvEntry>[], names: Map<string, EnvEntry>) {
  return indexTable.concat([names])
}
function indexOf(indexTable: Map<string, EnvEntry>[], node: es.Identifier) {
  const name = node.name
  for (let i = indexTable.length - 1; i >= 0; i--) {
    if (indexTable[i].has(name)) {
      const envLevel = indexTable.length - 1 - i
      const { index, isVar, type } = indexTable[i].get(name)!
      return { envLevel, index, isVar, type }
    }
  }
  throw new UndefinedVariable(name, node)
}

// a small complication: the toplevel function
// needs to return the value of the last statement
let toplevel = true

const toplevelReturnNodes = new Set([
  'Literal',
  'UnaryExpression',
  'BinaryExpression',
  'CallExpression',
  'Identifier',
  'ArrayExpression',
  'LogicalExpression',
  'MemberExpression',
  'AssignmentExpression',
  'ArrowFunctionExpression',
  'IfStatement',
  'VariableDeclaration'
])

function continueToCompile() {
  while (toCompile.length !== 0) {
    const nextToCompile = popToCompile()
    const functionAddress = toCompileTaskFunctionAddress(nextToCompile)
    const indexTable = toCompileTaskIndexTable(nextToCompile)
    const body = toCompileTaskBody(nextToCompile) as taggedBlockStatement
    body.isFunctionBlock = true
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
  type?: 'primitive' | 'internal' // for functions
}

// extracts all name declarations within a function or block,
// renaming every declaration if rename is true.
// if rename is true, rename to name_line_col and recursively rename identifiers in ast if no same scope declaration
// (check for variable, function declaration in each block. Check for params in each function call)
// for any duplicates, rename recursively within scope
// recurse for any blocks with rename = true
function extractAndRenameNames(
  baseNode: es.BlockStatement | es.Program,
  names: Map<string, EnvEntry>,
  rename: boolean = true
) {
  // get all declared names of current scope and keep track of names to rename
  const namesToRename = new Map<string, string>()
  for (const stmt of baseNode.body) {
    if (stmt.type === 'VariableDeclaration') {
      const node = stmt as es.VariableDeclaration
      let name = (node.declarations[0].id as es.Identifier).name
      if (rename) {
        const loc = (node.loc ?? UNKNOWN_LOCATION).start
        const oldName = name
        do {
          name = `${name}-${loc.line}-${loc.column}`
        } while (names.has(name))
        namesToRename.set(oldName, name)
      }
      const isVar = node.kind === 'let'
      const index = names.size
      names.set(name, { index, isVar })
    } else if (stmt.type === 'FunctionDeclaration') {
      const node = stmt
      if (node.id === null) {
        throw new Error(
          'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
        )
      }
      let name = node.id.name
      if (rename) {
        const loc = (node.loc ?? UNKNOWN_LOCATION).start
        const oldName = name
        do {
          name = `${name}-${loc.line}-${loc.column}`
        } while (names.has(name))
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
      extractAndRenameNames(node, names, true)
    }
    if (stmt.type === 'IfStatement') {
      let nextAlt = stmt as es.IfStatement | es.BlockStatement
      while (nextAlt.type === 'IfStatement') {
        // if else if...
        const { consequent, alternate } = nextAlt as es.IfStatement
        extractAndRenameNames(consequent as es.BlockStatement, names, true)
        // Source spec must have alternate
        nextAlt = alternate as es.IfStatement | es.BlockStatement
      }
      extractAndRenameNames(nextAlt as es.BlockStatement, names, true)
    }
    if (stmt.type === 'WhileStatement') {
      extractAndRenameNames(stmt.body as es.BlockStatement, names, true)
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
  if (namesToRename.size === 0) return
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
    VariablePattern(node: es.Identifier, inactive, _c) {
      // for declarations
      const name = node.name
      if (inactive.has(name)) {
        return
      }
      if (namesToRename.has(name)) {
        node.name = namesToRename.get(name)!
      }
    },
    Identifier(node: es.Identifier, inactive, _c) {
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
      c(node.test, inactive)
      let nextAlt = node as es.IfStatement | es.BlockStatement
      while (nextAlt.type === 'IfStatement') {
        const { consequent, alternate } = nextAlt
        recurseBlock(consequent as es.BlockStatement, inactive, c)
        c(nextAlt.test, inactive)
        nextAlt = alternate as es.IfStatement | es.BlockStatement
      }
      recurseBlock(nextAlt! as es.BlockStatement, inactive, c)
    },
    Function(node: es.Function, inactive, c) {
      if (node.type === 'FunctionDeclaration') {
        if (node.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        c(node.id, inactive)
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
    },
    WhileStatement(node: es.WhileStatement, inactive, c) {
      c(node.test, inactive)
      recurseBlock(node.body as es.BlockStatement, inactive, c)
    }
  })
}

function getLocalsInScope(node: es.BlockStatement | es.Program) {
  const locals = new Set<string>()
  for (const stmt of node.body) {
    if (stmt.type === 'VariableDeclaration') {
      const name = (stmt.declarations[0].id as es.Identifier).name
      locals.add(name)
    } else if (stmt.type === 'FunctionDeclaration') {
      if (stmt.id === null) {
        throw new Error(
          'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
        )
      }
      const name = stmt.id.name
      locals.add(name)
    }
  }
  return locals
}

function compileArguments(exprs: es.Node[], indexTable: Map<string, EnvEntry>[]) {
  let maxStackSize = 0
  for (let i = 0; i < exprs.length; i++) {
    const { maxStackSize: curExpSize } = compile(exprs[i], indexTable, false)
    maxStackSize = Math.max(i + curExpSize, maxStackSize)
  }
  return maxStackSize
}

// tuple of loop type, breaks, continues and continueDestinationIndex
// break and continue need to know how much to offset for the branch
// instruction. When compiling the individual instruction, that info
// is not available, so need to keep track of the break and continue
// instruction's index to update the offset when the compiler finishes
// compiling the loop. We need to keep track of continue destination as
// a for loop needs to know where the assignment instructions are.
// This works because of the way a for loop is transformed to a while loop.
// If the loop is a for loop, the last statement in the while loop block
// is always the assignment expression
let loopTracker: ['for' | 'while', number[], number[], number][] = []
const LOOP_TYPE = 0
const BREAK_INDEX = 1
const CONT_INDEX = 2
const CONT_DEST_INDEX = 3

type taggedWhileStatement = es.WhileStatement & { isFor?: boolean }

// tag loop blocks when compiling. Untagged (i.e. undefined) would mean
// the block is not a loop block.
// for loop blocks, need to ensure the last statement is also popped to prevent
// stack overflow. also note that compileStatements for loop blocks will always
// have insertFlag: false
// need to detect function blocks due to compilation issues with empty blocks.
// compiler does not know when to return
type taggedBlockStatement = (es.Program | es.BlockStatement) & {
  isLoopBlock?: boolean
  isFunctionBlock?: boolean
}

// used to compile block bodies
function compileStatements(
  node: taggedBlockStatement,
  indexTable: Map<string, EnvEntry>[],
  insertFlag: boolean
) {
  const statements = node.body
  let maxStackSize = 0
  for (let i = 0; i < statements.length; i++) {
    if (
      node.isLoopBlock &&
      i === statements.length - 1 &&
      loopTracker[loopTracker.length - 1][LOOP_TYPE] === 'for'
    ) {
      loopTracker[loopTracker.length - 1][CONT_DEST_INDEX] = functionCode.length
    }
    const { maxStackSize: curExprSize } = compile(
      statements[i],
      indexTable,
      i === statements.length - 1 ? insertFlag : false
    )
    if (i !== statements.length - 1 || node.isLoopBlock) {
      addNullaryInstruction(OpCodes.POPG)
    }
    maxStackSize = Math.max(maxStackSize, curExprSize)
  }
  if (statements.length === 0 && !node.isLoopBlock) {
    addNullaryInstruction(OpCodes.LGCU)
    if (insertFlag || node.isFunctionBlock) {
      addNullaryInstruction(OpCodes.RETG)
    }
    maxStackSize++
  }
  return { maxStackSize, insertFlag: false }
}

// each compiler should return a maxStackSize
const compilers = {
  // wrapper
  Program(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.Program
    return compileStatements(node, indexTable, insertFlag)
  },

  // wrapper
  BlockStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.BlockStatement
    return compileStatements(node, indexTable, insertFlag)
  },

  // wrapper
  ExpressionStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.ExpressionStatement
    return compile(node.expression, indexTable, insertFlag)
  },

  IfStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
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

  // wrapper, compile as an arrow function expression instead
  FunctionDeclaration(
    node: es.FunctionDeclaration,
    indexTable: Map<string, EnvEntry>[],
    insertFlag: boolean
  ) {
    if (node.id === null) {
      throw new Error(
        'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
      )
    }
    return compile(
      create.constantDeclaration(
        node.id.name,
        create.arrowFunctionExpression(node.params, node.body)
      ),
      indexTable,
      insertFlag
    )
  },

  VariableDeclaration(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    // only supports const / let
    node = node as es.VariableDeclaration
    if (node.kind === 'const' || node.kind === 'let') {
      // assumes left side can only be name
      // source spec: only 1 declaration at a time
      const id = node.declarations[0].id as es.Identifier
      const { envLevel, index } = indexOf(indexTable, id)
      const { maxStackSize } = compile(
        node.declarations[0].init as es.Expression,
        indexTable,
        false
      )
      if (envLevel === 0) {
        addUnaryInstruction(OpCodes.STLG, index)
      } else {
        // this should never happen
        addBinaryInstruction(OpCodes.STPG, index, envLevel)
      }
      addNullaryInstruction(OpCodes.LGCU)
      return { maxStackSize, insertFlag }
    }
    throw Error('Invalid declaration')
  },

  // handled by insertFlag in compile function
  ReturnStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], _insertFlag: boolean) {
    node = node as es.ReturnStatement
    if (loopTracker.length > 0) {
      throw Error('return not allowed in loops')
    }
    const { maxStackSize } = compile(node.argument as es.Expression, indexTable, false, true)
    return { maxStackSize, insertFlag: true }
  },

  // Three types of calls, normal function calls declared by the Source program,
  // primitive function calls that are predefined, and internal calls.
  // We differentiate them with callType.
  CallExpression(
    node: es.Node,
    indexTable: Map<string, EnvEntry>[],
    insertFlag: boolean,
    isTailCallPosition: boolean = false
  ) {
    node = node as es.CallExpression
    let maxStackOperator = 0
    let callType: 'normal' | 'primitive' | 'internal' = 'normal'
    let callValue: any = NaN
    if (node.callee.type === 'Identifier') {
      const callee = node.callee as es.Identifier
      const { envLevel, index, type } = indexOf(indexTable, callee)
      if (type === 'primitive' || type === 'internal') {
        callType = type
        callValue = index
      } else if (envLevel === 0) {
        addUnaryInstruction(OpCodes.LDLG, index)
      } else {
        addBinaryInstruction(OpCodes.LDPG, index, envLevel)
      }
    } else {
      ;({ maxStackSize: maxStackOperator } = compile(node.callee, indexTable, false))
    }

    let maxStackOperands = compileArguments(node.arguments, indexTable)

    if (callType === 'primitive') {
      addBinaryInstruction(
        isTailCallPosition ? OpCodes.CALLTP : OpCodes.CALLP,
        callValue,
        node.arguments.length
      )
    } else if (callType === 'internal') {
      addBinaryInstruction(
        isTailCallPosition ? OpCodes.CALLTV : OpCodes.CALLV,
        callValue,
        node.arguments.length
      )
    } else {
      // normal call. only normal function calls have the function on the stack
      addUnaryInstruction(isTailCallPosition ? OpCodes.CALLT : OpCodes.CALL, node.arguments.length)
      maxStackOperands++
    }
    // need at least 1 stack slot for the return value!
    return { maxStackSize: Math.max(maxStackOperator, maxStackOperands, 1), insertFlag }
  },

  UnaryExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.UnaryExpression
    if (VALID_UNARY_OPERATORS.has(node.operator)) {
      const opCode = VALID_UNARY_OPERATORS.get(node.operator) as number
      const { maxStackSize } = compile(node.argument, indexTable, false)
      addNullaryInstruction(opCode)
      return { maxStackSize, insertFlag }
    }
    throw Error('Unsupported operation')
  },

  BinaryExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
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

  // convert logical expressions to conditional expressions
  LogicalExpression(
    node: es.Node,
    indexTable: Map<string, EnvEntry>[],
    insertFlag: boolean,
    isTailCallPosition: boolean = false
  ) {
    node = node as es.LogicalExpression
    if (node.operator === '&&') {
      const { maxStackSize } = compile(
        create.conditionalExpression(node.left, node.right, create.literal(false)),
        indexTable,
        false,
        isTailCallPosition
      )
      return { maxStackSize, insertFlag }
    } else if (node.operator === '||') {
      const { maxStackSize } = compile(
        create.conditionalExpression(node.left, create.literal(true), node.right),
        indexTable,
        false,
        isTailCallPosition
      )
      return { maxStackSize, insertFlag }
    }
    throw Error('Unsupported operation')
  },

  ConditionalExpression(
    node: es.Node,
    indexTable: Map<string, EnvEntry>[],
    insertFlag: boolean,
    isTailCallPosition: boolean = false
  ) {
    const { test, consequent, alternate } = node as es.ConditionalExpression
    const { maxStackSize: m1 } = compile(test, indexTable, false)
    addUnaryInstruction(OpCodes.BRF, NaN)
    const BRFIndex = functionCode.length - 1
    const { maxStackSize: m2 } = compile(consequent, indexTable, insertFlag, isTailCallPosition)
    let BRIndex = NaN
    if (!insertFlag) {
      addUnaryInstruction(OpCodes.BR, NaN)
      BRIndex = functionCode.length - 1
    }
    functionCode[BRFIndex][1] = functionCode.length - BRFIndex
    const { maxStackSize: m3 } = compile(alternate!, indexTable, insertFlag, isTailCallPosition)
    if (!insertFlag) {
      functionCode[BRIndex][1] = functionCode.length - BRIndex
    }
    const maxStackSize = Math.max(m1, m2, m3)
    return { maxStackSize, insertFlag: false }
  },

  ArrowFunctionExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
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
    extractAndRenameNames(bodyNode, names)
    const extendedIndexTable = extendIndexTable(indexTable, names)

    const newSVMFunction: SVMFunction = [NaN, names.size, node.params.length, []]
    const functionIndex = SVMFunctions.length
    SVMFunctions.push(newSVMFunction)
    pushToCompile(makeToCompileTask(bodyNode, [functionIndex], extendedIndexTable))

    addUnaryInstruction(OpCodes.NEWC, [functionIndex])

    return { maxStackSize: 1, insertFlag }
  },

  Identifier(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.Identifier

    let envLevel
    let index
    let type
    try {
      ;({ envLevel, index, type } = indexOf(indexTable, node))
      if (type === 'primitive') {
        addUnaryInstruction(OpCodes.NEWCP, index)
      } else if (type === 'internal') {
        addUnaryInstruction(OpCodes.NEWCV, index)
      } else if (envLevel === 0) {
        addUnaryInstruction(OpCodes.LDLG, index)
      } else {
        addBinaryInstruction(OpCodes.LDPG, index, envLevel)
      }
    } catch (error) {
      // only possible to have UndefinedVariable error
      const matches = CONSTANT_PRIMITIVES.filter(f => f[0] === error.name)
      if (matches.length === 0) {
        throw error
      }
      if (typeof matches[0][1] === 'number') {
        // for NaN and Infinity
        addUnaryInstruction(OpCodes.LGCF32, matches[0][1])
      } else if (matches[0][1] === undefined) {
        addNullaryInstruction(OpCodes.LGCU)
      } else {
        throw Error('Unknown primitive constant')
      }
    }
    return { maxStackSize: 1, insertFlag }
  },

  // string, boolean, number or null
  Literal(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
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
          // LGCI takes a signed 32-bit integer operand (hence the range)
          if (Number.isInteger(value) && -2_147_483_648 <= value && value <= 2_147_483_647) {
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
  ArrayExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.ArrayExpression
    addNullaryInstruction(OpCodes.NEWA)
    const elements = node.elements as ContiguousArrayElements
    let maxStackSize = 1
    for (let i = 0; i < elements.length; i++) {
      // special case when element wasnt specified
      // i.e. [,]. Treat as undefined element
      if (elements[i] === null) {
        continue
      }
      // keep the array in the stack
      addNullaryInstruction(OpCodes.DUP)
      addUnaryInstruction(OpCodes.LGCI, i)
      const { maxStackSize: m1 } = compile(elements[i], indexTable, false)
      addNullaryInstruction(OpCodes.STAG)
      maxStackSize = Math.max(1 + 2 + m1, maxStackSize)
    }
    return { maxStackSize, insertFlag }
  },

  AssignmentExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as es.AssignmentExpression
    if (node.left.type === 'Identifier') {
      const { envLevel, index, isVar } = indexOf(indexTable, node.left)
      if (!isVar) {
        throw new ConstAssignment(node.left, node.left.name)
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
      // case for array member assignment
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

  ForStatement(_node: es.Node, _indexTable: Map<string, EnvEntry>[], _insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  // Loops need to have their own environment due to closures
  WhileStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    node = node as taggedWhileStatement
    const isFor = (node as taggedWhileStatement).isFor
    const condIndex = functionCode.length
    const { maxStackSize: m1 } = compile(node.test, indexTable, false)
    addUnaryInstruction(OpCodes.BRF, NaN)
    const BRFIndex = functionCode.length - 1
    loopTracker.push([isFor ? 'for' : 'while', [], [], NaN])

    // Add environment for loop and run in new environment
    const locals = extractAndRenameNames(node.body as es.BlockStatement, new Map())
    addUnaryInstruction(OpCodes.NEWENV, locals.size)
    const extendedIndexTable = extendIndexTable(indexTable, locals)
    const body = node.body as taggedBlockStatement
    body.isLoopBlock = true
    const { maxStackSize: m2 } = compile(body, extendedIndexTable, false)
    if (!isFor) {
      // for while loops, the `continue` statement should branch here
      loopTracker[loopTracker.length - 1][CONT_DEST_INDEX] = functionCode.length
    }
    addNullaryInstruction(OpCodes.POPENV)
    const endLoopIndex = functionCode.length
    addUnaryInstruction(OpCodes.BR, condIndex - endLoopIndex)
    functionCode[BRFIndex][1] = functionCode.length - BRFIndex

    // update BR instructions within loop
    const curLoop = loopTracker.pop()!
    for (const b of curLoop[BREAK_INDEX]) {
      functionCode[b][1] = functionCode.length - b
    }
    for (const c of curLoop[CONT_INDEX]) {
      functionCode[c][1] = curLoop[CONT_DEST_INDEX] - c
    }
    addNullaryInstruction(OpCodes.LGCU)
    return { maxStackSize: Math.max(m1, m2), insertFlag }
  },

  BreakStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    // keep track of break instruction
    addNullaryInstruction(OpCodes.POPENV)
    loopTracker[loopTracker.length - 1][BREAK_INDEX].push(functionCode.length)
    addUnaryInstruction(OpCodes.BR, NaN)
    return { maxStackSize: 0, insertFlag }
  },

  ContinueStatement(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
    // keep track of continue instruction
    // no need to POPENV as continue will go to the end of the while loop
    loopTracker[loopTracker.length - 1][CONT_INDEX].push(functionCode.length)
    addUnaryInstruction(OpCodes.BR, NaN)
    return { maxStackSize: 0, insertFlag }
  },

  ObjectExpression(_node: es.Node, _indexTable: Map<string, EnvEntry>[], _insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  MemberExpression(node: es.Node, indexTable: Map<string, EnvEntry>[], insertFlag: boolean) {
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

  Property(_node: es.Node, _indexTable: Map<string, EnvEntry>[], _insertFlag: boolean) {
    throw Error('Unsupported operation')
  },

  DebuggerStatement(_node: es.Node, _indexTable: Map<string, EnvEntry>[], _insertFlag: boolean) {
    throw Error('Unsupported operation')
  }
}

function compile(
  expr: es.Node,
  indexTable: Map<string, EnvEntry>[],
  insertFlag: boolean,
  isTailCallPosition: boolean = false
) {
  const compiler = compilers[expr.type]
  if (!compiler) {
    throw Error('Unsupported operation')
  }
  const { maxStackSize: temp, insertFlag: newInsertFlag } = compiler(
    expr,
    indexTable,
    insertFlag,
    isTailCallPosition
  )
  let maxStackSize = temp

  // insertFlag decides whether we need to introduce a RETG instruction. For some functions
  // where return is not specified, there is an implicit "return undefined", which we do here.
  // Source programs should return the last evaluated statement, which is what toplevel handles.
  // TODO: Don't emit an unnecessary RETG after a tail call. (This is harmless, but wastes an instruction.)
  // (There are unnecessary RETG for many cases at the top level)
  // TODO: Source programs should return last evaluated statement.
  if (newInsertFlag) {
    if (expr.type === 'ReturnStatement') {
      addNullaryInstruction(OpCodes.RETG)
    } else if (toplevel && toplevelReturnNodes.has(expr.type)) {
      // conditional expressions already handled
      addNullaryInstruction(OpCodes.RETG)
    } else if (
      expr.type === 'Program' ||
      expr.type === 'ExpressionStatement' ||
      expr.type === 'BlockStatement' ||
      expr.type === 'FunctionDeclaration'
    ) {
      // do nothing for wrapper nodes
    } else {
      maxStackSize += 1
      addNullaryInstruction(OpCodes.LGCU)
      addNullaryInstruction(OpCodes.RETG)
    }
  }

  return { maxStackSize, insertFlag: newInsertFlag }
}

export function compileForConcurrent(program: es.Program, context: Context) {
  // assume vmPrelude is always a correct program
  const prelude = compilePreludeToIns(parse(vmPrelude, context)!)
  generatePrimitiveFunctionCode(prelude)
  const vmInternalFunctions = INTERNAL_FUNCTIONS.map(([name]) => name)

  return compileToIns(program, prelude, vmInternalFunctions)
}

export function compilePreludeToIns(program: es.Program): Program {
  // reset variables
  SVMFunctions = []
  functionCode = []
  toCompile = []
  loopTracker = []
  toplevel = true

  transformForLoopsToWhileLoops(program)
  // don't rename names at the top level, because we need them for linking
  const locals = extractAndRenameNames(program, new Map<string, EnvEntry>(), false)
  const topFunction: SVMFunction = [NaN, locals.size, 0, []]
  const topFunctionIndex = 0 // GE + # primitive func
  SVMFunctions[topFunctionIndex] = topFunction

  const extendedTable = extendIndexTable(makeIndexTableWithPrimitivesAndInternals(), locals)
  pushToCompile(makeToCompileTask(program, [topFunctionIndex], extendedTable))
  continueToCompile()
  return [0, SVMFunctions]
}

export function compileToIns(
  program: es.Program,
  prelude?: Program,
  vmInternalFunctions?: string[]
): Program {
  // reset variables
  SVMFunctions = []
  functionCode = []
  toCompile = []
  loopTracker = []
  toplevel = true

  transformForLoopsToWhileLoops(program)
  insertEmptyElseBlocks(program)
  const locals = extractAndRenameNames(program, new Map<string, EnvEntry>())
  const topFunction: SVMFunction = [NaN, locals.size, 0, []]
  if (prelude) {
    SVMFunctions.push(...prelude[1])
  }
  const topFunctionIndex = prelude ? PRIMITIVE_FUNCTION_NAMES.length + 1 : 0 // GE + # primitive func
  SVMFunctions[topFunctionIndex] = topFunction

  const extendedTable = extendIndexTable(
    makeIndexTableWithPrimitivesAndInternals(vmInternalFunctions),
    locals
  )
  pushToCompile(makeToCompileTask(program, [topFunctionIndex], extendedTable))
  continueToCompile()
  return [0, SVMFunctions]
}

// transform according to Source 3 spec. Refer to spec for the way of transformation
function transformForLoopsToWhileLoops(program: es.Program) {
  simple(program, {
    ForStatement(node) {
      const { test, body, init, update } = node as es.ForStatement
      let forLoopBody = body
      // Source spec: init must be present
      if (init!.type === 'VariableDeclaration') {
        const loopVarName = ((init as es.VariableDeclaration).declarations[0].id as es.Identifier)
          .name
        // loc is used for renaming. It doesn't matter if we use the same location, as the
        // renaming function will notice that they are the same, and rename it further so that
        // there aren't any clashes.
        const loc = init!.loc
        const copyOfLoopVarName = 'copy-of-' + loopVarName
        const innerBlock = create.blockStatement([
          create.constantDeclaration(loopVarName, create.identifier(copyOfLoopVarName), loc),
          body
        ])
        forLoopBody = create.blockStatement([
          create.constantDeclaration(copyOfLoopVarName, create.identifier(loopVarName), loc),
          innerBlock
        ])
      }
      const assignment1 =
        init && init.type === 'VariableDeclaration'
          ? init
          : create.expressionStatement(init as es.Expression)
      const assignment2 = create.expressionStatement(update!)
      const newLoopBody = create.blockStatement([forLoopBody, assignment2])
      const newLoop = create.whileStatement(newLoopBody, test!) as taggedWhileStatement
      newLoop.isFor = true
      const newBlockBody = [assignment1, newLoop]
      node = node as es.BlockStatement
      node.body = newBlockBody
      node.type = 'BlockStatement'
    }
  })
}

function insertEmptyElseBlocks(program: es.Program) {
  simple(program, {
    IfStatement(node: es.IfStatement) {
      node.alternate ??= {
        type: 'BlockStatement',
        body: []
      }
    }
  })
}
