import * as es from 'estree'
import { Context } from '../types'
import * as create from '../utils/astCreator'

// OP-CODES

// op-codes of machine instructions, used by compiler
// and machine

export enum OpCodes {
  START = 0,
  LDCN = 1, // followed by: number
  LDCB = 2, // followed by: boolean
  LDCU = 3,
  PLUS = 4,
  MINUS = 5,
  TIMES = 6,
  EQUAL = 7,
  LESS = 8,
  GREATER = 9,
  LEQ = 10,
  GEQ = 11,
  NOT = 12,
  DIV = 13,
  POP = 14,
  ASSIGN = 15, // followed by: index of value in environment
  JOF = 16, // followed by: jump address
  GOTO = 17, // followed by: jump address
  LDF = 18, // followed by: maxStackSize, address, env extensn count
  CALL = 19,
  LD = 20, // followed by: index of value in environment
  RTN = 21,
  DONE = 22
}

// some auxiliary constants
// to keep track of the inline data

// TODO unused
// const LDF_MAX_OS_SIZE_OFFSET = 1
// const LDF_ADDRESS_OFFSET = 2
// const LDF_ENV_EXTENSION_COUNT_OFFSET = 3
// const LDCN_VALUE_OFFSET = 1
// const LDCB_VALUE_OFFSET = 1

// printing opcodes for debugging

const OPCODES_STR = {
  [OpCodes.START]: 'START  ',
  [OpCodes.LDCN]: 'LDCN   ',
  [OpCodes.LDCB]: 'LDCB   ',
  [OpCodes.LDCU]: 'LDCU   ',
  [OpCodes.PLUS]: 'PLUS   ',
  [OpCodes.MINUS]: 'MINUS  ',
  [OpCodes.TIMES]: 'TIMES  ',
  [OpCodes.EQUAL]: 'EQUAL  ',
  [OpCodes.LESS]: 'LESS   ',
  [OpCodes.GREATER]: 'GREATER',
  [OpCodes.LEQ]: 'LEQ    ',
  [OpCodes.GEQ]: 'GEQ    ',
  [OpCodes.NOT]: 'NOT    ',
  [OpCodes.DIV]: 'DIV    ',
  [OpCodes.POP]: 'POP    ',
  [OpCodes.ASSIGN]: 'ASSIGN ',
  [OpCodes.JOF]: 'JOF    ',
  [OpCodes.GOTO]: 'GOTO   ',
  [OpCodes.LDF]: 'LDF    ',
  [OpCodes.CALL]: 'CALL   ',
  [OpCodes.LD]: 'LD     ',
  [OpCodes.RTN]: 'RTN    ',
  [OpCodes.DONE]: 'DONE   '
}

const VALID_UNARY_OPERATORS = new Map([['!', OpCodes.NOT]])
const VALID_BINARY_OPERATORS = new Map([
  ['+', OpCodes.PLUS],
  ['-', OpCodes.MINUS],
  ['*', OpCodes.TIMES],
  ['/', OpCodes.DIV],
  ['===', OpCodes.EQUAL],
  ['<', OpCodes.LESS],
  ['>', OpCodes.GREATER],
  ['<=', OpCodes.LEQ],
  ['>=', OpCodes.GEQ]
])

// get name of opcode for debugging
export function getName(op: number) {
  return OPCODES_STR[op] // need to add guard in case op does not exist
}

// pretty-print the program
export function printProgram(P: number[]) {
  let programStr = ''
  let i = 0
  while (i < P.length) {
    let s = i.toString()
    const op = P[i]
    s += ': ' + getName(P[i])
    i++
    if (
      op === OpCodes.LDCN ||
      op === OpCodes.LDCB ||
      op === OpCodes.GOTO ||
      op === OpCodes.JOF ||
      op === OpCodes.ASSIGN ||
      op === OpCodes.LDF ||
      op === OpCodes.LD ||
      op === OpCodes.CALL
    ) {
      s += ' ' + P[i].toString()
      i++
    }
    if (op === OpCodes.LDF) {
      s += ' ' + P[i].toString() + ' ' + P[i + 1].toString()
      i += 2
    }
    programStr += s + '\n'
  }
  window.console.log(programStr)
}

// COMPILER FROM PARSED SOURCE PROGRAM (ESTREE AST) TO SECD INSTRUCTIONS

// compile AST to machine code
// return the machine code in an array
export function compileToIns(program: es.Program, context: Context) {
  // machineCode is array for machine instructions
  const machineCode: any[] = []

  // insertPointer keeps track of the next free place
  // in machineCode
  let insertPointer = 0

  // three insert functions (nullary, unary, binary instructions)
  function addNullaryInstruction(opCode: number) {
    machineCode[insertPointer] = opCode
    insertPointer++
  }
  // unary instructions have one argument (constant or address)
  function addUnaryInstruction(opCode: number, arg1: any) {
    machineCode[insertPointer] = opCode
    machineCode[insertPointer + 1] = arg1
    insertPointer += 2
  }
  // TODO unused
  // binary instructions have two arguments
  //   function addBinaryInstruction(opCode: number, arg1: any, arg2: any) {
  //     machineCode[insertPointer] = opCode
  //     machineCode[insertPointer + 1] = arg1
  //     machineCode[insertPointer + 2] = arg2
  //     insertPointer += 3
  //   }
  // ternary instructions have three arguments
  function addTernaryInstruction(opCode: number, arg1: any, arg2: any, arg3: any) {
    machineCode[insertPointer] = opCode
    machineCode[insertPointer + 1] = arg1
    machineCode[insertPointer + 2] = arg2
    machineCode[insertPointer + 3] = arg3
    insertPointer += 4
  }

  // toCompile stack keeps track of remaining compiler work:
  // these are function bodies that still need to be compiled
  const toCompile: any[] = []
  // TODO unused
  //   function no_moreToCompile() {
  //     return toCompile.length === 0
  //   }
  function popToCompile() {
    const next = toCompile.pop()
    return next
  }
  function pushToCompile(task: any) {
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

  function makeToCompileTask(
    functionBody: any,
    maxStackSizeAddress: number,
    addressAddress: number,
    indexTable: any
  ) {
    return [functionBody, maxStackSizeAddress, addressAddress, indexTable]
  }
  function toCompileTaskBody(toCompileTask: any) {
    return toCompileTask[0]
  }
  function toCompileTaskMaxStackSizeAddress(toCompileTask: any) {
    return toCompileTask[1]
  }
  function toCompileTaskAddressAddress(toCompileTask: any) {
    return toCompileTask[2]
  }
  function toCompileTaskIndexTable(toCompileTask: any) {
    return toCompileTask[3]
  }

  // indexTable keeps track of environment addresses
  // assigned to names
  function makeEmptyIndexTable(): string[] {
    return []
  }
  function extendIndexTable(indexTable: string[], names: string[]) {
    return indexTable.concat(names)
  }
  function indexOf(indexTable: string[], name: string) {
    const index = indexTable.lastIndexOf(name)
    if (index === -1) {
      throw Error('name not found: ' + name)
    }
    return index
  }

  // a small complication: the toplevel function
  // needs to return the value of the last statement
  let toplevel = true

  function continueToCompile() {
    while (toCompile.length !== 0) {
      const nextToCompile = popToCompile()
      const addressAddress = toCompileTaskAddressAddress(nextToCompile)
      machineCode[addressAddress] = insertPointer
      const indexTable = toCompileTaskIndexTable(nextToCompile)
      const maxStackSizeAddress = toCompileTaskMaxStackSizeAddress(nextToCompile)
      const body = toCompileTaskBody(nextToCompile)
      const { maxStackSize } = compile(body, indexTable, true)
      machineCode[maxStackSizeAddress] = maxStackSize
      toplevel = false
    }
  }

  function localNames(stmts: es.Node | es.Node[]) {
    const names: string[] = []
    if (Array.isArray(stmts)) {
      for (const stmt of stmts) {
        names.push(...localNames(stmt))
      }
    } else {
      if (stmts.type === 'VariableDeclaration') {
        const node = stmts as es.VariableDeclaration
        names.push((node.declarations[0].id as es.Identifier).name)
      } else if (stmts.type === 'FunctionDeclaration') {
        const node = stmts as es.FunctionDeclaration
        names.push((node.id as es.Identifier).name)
      }
    }
    return names
  }

  function compileArguments(exprs: es.Node[], indexTable: string[]) {
    let maxStackSize = 0
    for (let i = 0; i < exprs.length; i++) {
      const { maxStackSize: curExpSize } = compile(exprs[i], indexTable, false)
      maxStackSize = Math.max(i + curExpSize, maxStackSize)
    }
    return maxStackSize
  }

  function compileStatements(statements: es.Node[], indexTable: string[], insertFlag: boolean) {
    let maxStackSize = 0
    for (let i = 0; i < statements.length; i++) {
      const { maxStackSize: curExprSize } = compile(
        statements[i],
        indexTable,
        i === statements.length - 1 ? insertFlag : false
      )
      if (i !== statements.length - 1) {
        addNullaryInstruction(OpCodes.POP)
      }
      maxStackSize = Math.max(maxStackSize, curExprSize)
    }
    return { maxStackSize, insertFlag: false }
  }

  // each compiler should return a maxStackSize
  const compilers = {
    Program(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.Program
      return compileStatements(node.body, indexTable, insertFlag)
    },

    BlockStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.BlockStatement
      // in base vm, block isnt even considered, so just sidestepping it
      return compileStatements(node.body, indexTable, insertFlag)
    },

    ExpressionStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.ExpressionStatement
      const { maxStackSize } = compile(node.expression, indexTable, insertFlag)
      return { maxStackSize, insertFlag }
    },

    IfStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      // SEL
    },

    FunctionDeclaration(node: es.Node, indexTable: string[], insertFlag: boolean) {
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

    VariableDeclaration(node: es.Node, indexTable: string[], insertFlag: boolean) {
      // only supports const
      node = node as es.VariableDeclaration
      if (node.kind === 'const') {
        // assumes the left side can only be a name
        const identifier = (node.declarations[0].id as unknown) as es.Identifier
        const name = identifier.name
        const index = indexOf(indexTable, name)
        const { maxStackSize } = compile(
          node.declarations[0].init as es.Expression,
          indexTable,
          insertFlag
        )
        addUnaryInstruction(OpCodes.ASSIGN, index)
        addNullaryInstruction(OpCodes.LDCU)
        return { maxStackSize, insertFlag }
      } else {
        // assumes let
        const maxStackSize = 1
        return { maxStackSize, insertFlag }
      }
    },

    ReturnStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.ReturnStatement
      const { maxStackSize } = compile(node.argument as es.Expression, indexTable, false)
      return { maxStackSize, insertFlag }
    },

    CallExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.CallExpression
      const { maxStackSize: maxStackOperator } = compile(node.callee, indexTable, false)
      const maxStackOperands = compileArguments(node.arguments, indexTable)
      addUnaryInstruction(OpCodes.CALL, node.arguments.length)
      return { maxStackSize: Math.max(maxStackOperator, maxStackOperands + 1), insertFlag }
    },

    UnaryExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.UnaryExpression
      if (VALID_UNARY_OPERATORS.has(node.operator)) {
        const opCode = VALID_UNARY_OPERATORS.get(node.operator) as number
        // assumes !
        const { maxStackSize } = compile(node.argument, indexTable, false)
        addNullaryInstruction(opCode)
        return { maxStackSize, insertFlag }
      } else {
        // unsupported op
        throw Error('unsupported op')
      }
    },

    BinaryExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.BinaryExpression
      // assumes + - * / === !== < > <= >=
      if (VALID_BINARY_OPERATORS.has(node.operator)) {
        const opCode = VALID_BINARY_OPERATORS.get(node.operator) as number
        const { maxStackSize: m1 } = compile(node.left, indexTable, false)
        const { maxStackSize: m2 } = compile(node.right, indexTable, false)
        addNullaryInstruction(opCode)
        return { maxStackSize: Math.max(m1, 1 + m2), insertFlag }
      } else {
        // unsupported op
        throw Error('unsupported op')
      }
    },

    LogicalExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.LogicalExpression
      if (node.operator === '&&') {
        const { maxStackSize } = compile(
          create.conditionalExpression(node.left, node.right, create.literal(false)),
          indexTable,
          false
        )
        return { maxStackSize, insertFlag }
      } else {
        // ||
        const { maxStackSize } = compile(
          create.conditionalExpression(node.left, create.literal(true), node.right),
          indexTable,
          false
        )
        return { maxStackSize, insertFlag }
      }
    },

    ConditionalExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      const { test, consequent, alternate } = node as es.ConditionalExpression
      const { maxStackSize: m1 } = compile(test, indexTable, false)
      addUnaryInstruction(OpCodes.JOF, NaN)
      const JOFAddressAddress = insertPointer - 1
      const { maxStackSize: m2 } = compile(consequent, indexTable, insertFlag)
      let GOTOAddressAddress = NaN
      if (!insertFlag) {
        addUnaryInstruction(OpCodes.GOTO, NaN)
        GOTOAddressAddress = insertPointer - 1
      }
      machineCode[JOFAddressAddress] = insertPointer
      const { maxStackSize: m3 } = compile(alternate, indexTable, insertFlag)
      if (!insertFlag) {
        machineCode[GOTOAddressAddress] = insertPointer
      }
      const maxStackSize = Math.max(m1, m2, m3)
      return { maxStackSize, insertFlag: false }
    },

    ArrowFunctionExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.ArrowFunctionExpression
      // node.body is either a block statement which we can evaluate as statements, or a single node to return
      const bodyNode =
        node.body.type === 'BlockStatement' ? node.body : create.returnStatement(node.body)
      const names = localNames(bodyNode.type === 'BlockStatement' ? bodyNode.body : bodyNode)
      const parameters = node.params.map(id => (id as es.Identifier).name)
      const extendedIndexTable = extendIndexTable(indexTable, parameters.concat(names))
      addTernaryInstruction(OpCodes.LDF, NaN, NaN, names.length + parameters.length)
      const maxStackSizeAddress = insertPointer - 3
      const addressAddress = insertPointer - 2
      pushToCompile(
        makeToCompileTask(bodyNode, maxStackSizeAddress, addressAddress, extendedIndexTable)
      )
      return { maxStackSize: 1, insertFlag }
    },

    Identifier(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.Identifier

      // undefined is a special case
      if (node.name === 'undefined') {
        addNullaryInstruction(OpCodes.LDCU)
      } else {
        addUnaryInstruction(OpCodes.LD, indexOf(indexTable, node.name))
      }
      return { maxStackSize: 1, insertFlag }
    },

    Literal(node: es.Node, indexTable: string[], insertFlag: boolean) {
      node = node as es.Literal
      // currently only works with numbers and booleans, excludes strings, null and regexp
      const value = node.value
      if (value === true || value === false) {
        addUnaryInstruction(OpCodes.LDCB, value)
      } else {
        // assumes numeric
        addUnaryInstruction(OpCodes.LDCN, value)
      }
      return { maxStackSize: 1, insertFlag }
    },

    ArrayExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    AssignmentExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    ForStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    WhileStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    BreakStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    ContinueStatement(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    ObjectExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    MemberExpression(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    },

    Property(node: es.Node, indexTable: string[], insertFlag: boolean) {
      throw Error('Unsupported operation')
    }
  }

  function compile(expr: es.Node, indexTable: any[], insertFlag: boolean) {
    const compiler = compilers[expr.type]
    const { maxStackSize: temp, insertFlag: newInsertFlag } = compiler(expr, indexTable, insertFlag)
    let maxStackSize = temp // bypass tslint prefer-const

    // handling of return
    if (newInsertFlag) {
      if (expr.type === 'ReturnStatement') {
        addNullaryInstruction(OpCodes.RTN)
      } else if (
        toplevel &&
        (expr.type === 'Literal' ||
          expr.type === 'UnaryExpression' ||
          expr.type === 'BinaryExpression' ||
          expr.type === 'CallExpression' ||
          (expr.type === 'Identifier' && expr.name === 'undefined'))
      ) {
        addNullaryInstruction(OpCodes.RTN)
      } else if (expr.type === 'Program' || expr.type === 'ExpressionStatement') {
        // do nothing. sidestep the ast wrappers
      } else {
        addNullaryInstruction(OpCodes.LDCU)
        maxStackSize += 1
        addNullaryInstruction(OpCodes.RTN)
      }
    }
    return { maxStackSize, newInsertFlag }
  }

  addNullaryInstruction(OpCodes.START)
  const locals = localNames(program.body)
  addTernaryInstruction(OpCodes.LDF, NaN, NaN, locals.length)
  const LDFMaxStackSizeAddress = insertPointer - 3
  const LDFAddressAddress = insertPointer - 2
  addUnaryInstruction(OpCodes.CALL, 0)
  addNullaryInstruction(OpCodes.DONE)

  const programNamesIndexTable = extendIndexTable(makeEmptyIndexTable(), locals)
  pushToCompile(
    makeToCompileTask(program, LDFMaxStackSizeAddress, LDFAddressAddress, programNamesIndexTable)
  )
  continueToCompile()
  return machineCode
}
