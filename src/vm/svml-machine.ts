import { Program, Instruction, SVMFunction, Address } from './svml-compiler'
import { getName } from './util'
import OpCodes from './opcodes'
import {
  NULLARY_PRIMITIVES,
  UNARY_PRIMITIVES,
  BINARY_PRIMITIVES,
  EXTERNAL_PRIMITIVES
} from '../stdlib/vm.prelude'
import { Context } from '../types'
import { GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE, GLOBAL } from '../constants'

const LDCI_VALUE_OFFSET = 1
const LDCF64_VALUE_OFFSET = 1
const LGCS_VALUE_OFFSET = 1
const FUNC_MAX_STACK_SIZE_OFFSET = 0
const FUNC_ENV_SIZE_OFFSET = 1
const FUNC_NUM_ARGS_OFFSET = 2
const FUNC_CODE_OFFSET = 3
const INS_OPCODE_OFFSET = 0
const BR_OFFSET = 1
const LD_ST_INDEX_OFFSET = 1
const LD_ST_ENV_OFFSET = 2
const CALL_NUM_ARGS_OFFSET = 1
const CALLP_ID_OFFSET = 1
const CALLP_NUM_ARGS_OFFSET = 2
const NEWC_ADDR_OFFSET = 1
const ADDR_FUNC_INDEX_OFFSET = 0
const NEWENV_NUM_ARGS_OFFSET = 1
const VARARGS_NUM_ARGS = -1

// VIRTUAL MACHINE

// "registers" are the global variables of our machine.
// These contain primitive values (numbers or boolean
// values) or arrays of primitive values

// P is an array that contains an SVML machine program:
// the op-codes of instructions and their arguments
let PROG: Program
let ENTRY: Instruction[] // use array reference to keep track of entry function
let FUNC: SVMFunction[]
let P: Instruction[]
let GLOBAL_ENV = -1
// PC is program counter: index of the next instruction
let PC = 0
// HEAP is array containing all dynamically allocated data structures
let HEAP: any[] = []
// next free slot in heap
let FREE = 0
// OS is address of current environment in HEAP; initially a dummy value
let ENV = -1
// OS is address of current operand stack in HEAP; initially a dummy value
let OS = -Infinity
// temporary value, used by PUSH and POP; initially a dummy value
let RES = -Infinity

// some general-purpose registers
let A: any = 0
let B: any = 0
let C: any = 0
let D: any = 0
let E: any = 0
let F: any = 0
let G: any = 0
let H: any = 0
let I: any = 0

function show_executing(s: string) {
  let str = ''
  str += '--- RUN ---' + s + '\n'
  str += 'PC :' + PC.toString() + '\n'
  str += 'instr:' + getName(P[PC][INS_OPCODE_OFFSET])
  return str
}

// for debugging: show all registers
export function show_registers(s: string) {
  let str = ''
  str = show_executing(s) + '\n'
  str += '--- REGISTERS ---' + '\n'
  str += 'RES:' + RES.toString() + '\n'
  str += 'A  :' + A.toString() + '\n'
  str += 'B  :' + B.toString() + '\n'
  str += 'C  :' + C.toString() + '\n'
  str += 'D  :' + D.toString() + '\n'
  str += 'E  :' + E.toString() + '\n'
  str += 'F  :' + F.toString() + '\n'
  str += 'G  :' + G.toString() + '\n'
  str += 'H  :' + H.toString() + '\n'
  str += 'OS :' + OS.toString() + '\n'
  str += 'ENV:' + ENV.toString() + '\n'
  str += 'RTS:' + RTS.toString() + '\n'
  str += 'TOP_RTS:' + TOP_RTS.toString()
  return str
}

// register that says if machine is running
let RUNNING = true

const NORMAL = 0
const DIV_ERROR = 1
const TYPE_ERROR = 2
// TODO unused
// const OUT_OF_MEMORY_ERROR = 2; // not used yet: memory currently unbounded

let STATE = NORMAL

// general node layout
const TAG_SLOT = 0
const SIZE_SLOT = 1
const FIRST_CHILD_SLOT = 2
const LAST_CHILD_SLOT = 3

// NEW expects tag in A and size in B
function NEW() {
  HEAP[FREE + TAG_SLOT] = A
  HEAP[FREE + SIZE_SLOT] = B
  RES = FREE
  FREE = FREE + B
}

// boxed nodes
const BOXED_VALUE_SLOT = 4

// number nodes layout
//
// 0: tag  = -100
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value

const NUMBER_TAG = -100
const NUMBER_SIZE = 5
const NUMBER_VALUE_SLOT = 4

// changes A, B, C, expects number in A
function NEW_NUMBER() {
  C = A
  A = NUMBER_TAG
  B = NUMBER_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + NUMBER_VALUE_SLOT] = C
}

// bool nodes layout
//
// 0: tag  = -101
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value

const BOOL_TAG = -101
const BOOL_SIZE = 5
const BOOL_VALUE_SLOT = 4

// changes A, B, C, expects boolean value in A
function NEW_BOOL() {
  C = A
  A = BOOL_TAG
  B = BOOL_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + BOOL_VALUE_SLOT] = C
}

// string nodes layout
//
// 0: tag  = -107
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value

const STRING_TAG = -107
const STRING_SIZE = 5
const STRING_VALUE_SLOT = 4

// changes A, B, C, expects string literal in A
function NEW_STRING() {
  C = A
  A = STRING_TAG
  B = STRING_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + STRING_VALUE_SLOT] = C
}

// array nodes layout
//
// 0: tag  = -108
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value (JS array, each element is the address of the element's node in the heap)
// 5: current size of array (largest index assigned)

const ARRAY_TAG = -108
const ARRAY_SIZE = 6
const ARRAY_VALUE_SLOT = 4
const ARRAY_SIZE_SLOT = 5

// changes A, B
function NEW_ARRAY() {
  A = ARRAY_TAG
  B = ARRAY_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + ARRAY_VALUE_SLOT] = []
  HEAP[RES + ARRAY_SIZE_SLOT] = 0
}

// undefined nodes layout
//
// 0: tag  = -106
// 1: size = 4
// 2: offset of first child from the tag: 5 (no children)
// 3: offset of last child from the tag: 4 (must be less than first)

const UNDEFINED_TAG = -106
const UNDEFINED_SIZE = 4

function NEW_UNDEFINED() {
  A = UNDEFINED_TAG
  B = UNDEFINED_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 5
  HEAP[RES + LAST_CHILD_SLOT] = 4 // no children
}

// null nodes layout
//
// 0: tag  = -109
// 1: size = 4
// 2: offset of first child from the tag: 5 (no children)
// 3: offset of last child from the tag: 4 (must be less than first)

const NULL_TAG = -109
const NULL_SIZE = 4

// changes A, B.
function NEW_NULL() {
  A = NULL_TAG
  B = NULL_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 5
  HEAP[RES + LAST_CHILD_SLOT] = 4 // no children
}

// operandstack nodes layout
//
// 0: tag  = -105
// 1: size = maximal number of entries + 4
// 2: first child slot = 4
// 3: last child slot = current top of stack; initially 3 (empty stack)
// 4: first entry
// 5: second entry
// ...

const OS_TAG = -105

// changes A, B, C, expects max size in A
function NEW_OS() {
  C = A
  A = OS_TAG
  B = C + 4
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 4
  // operand stack initially empty
  HEAP[RES + LAST_CHILD_SLOT] = 3
}

// PUSH and POP are convenient subroutines that operate on
// the operand stack OS
// PUSH expects its argument in A
// changes B
function PUSH_OS() {
  B = HEAP[OS + LAST_CHILD_SLOT] // address of current top of OS
  B = B + 1
  HEAP[OS + LAST_CHILD_SLOT] = B // update address of current top of OS
  HEAP[OS + B] = A
}

// POP puts the top-most value into RES
// changes B
function POP_OS() {
  B = HEAP[OS + LAST_CHILD_SLOT] // address of current top of OS
  HEAP[OS + LAST_CHILD_SLOT] = B - 1 // update address of current top of OS
  RES = HEAP[OS + B]
}

// closure nodes layout
//
// 0: tag  = -103
// 1: size = 8
// 2: offset of first child from the tag: 6 (only environment)
// 3: offset of last child from the tag: 6
// 4: index = index of function in program function array
// 5: environment

const CLOSURE_TAG = -103
const CLOSURE_SIZE = 6
const CLOSURE_FUNC_INDEX_SLOT = 4
const CLOSURE_ENV_SLOT = 5

// changes A, B, E, expects index of function in program function array in A
export function NEW_CLOSURE() {
  E = A
  A = CLOSURE_TAG
  B = CLOSURE_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + CLOSURE_FUNC_INDEX_SLOT] = E
  HEAP[RES + CLOSURE_ENV_SLOT] = ENV
}

// expects closure in A, environment in B
export function SET_CLOSURE_ENV() {
  HEAP[A + CLOSURE_ENV_SLOT] = B
}

// stackframe nodes layout
//
// 0: tag  = -104
// 1: size = 7
// 2: offset of first child from the tag: 5 (environment)
// 3: offset of last child from the tag: 6 (operand stack)
// 4: program counter = return address
// 5: environment
// 6: operand stack
// 7: current function code array

const RTS_FRAME_TAG = -104
const RTS_FRAME_SIZE = 8
const RTS_FRAME_PC_SLOT = 4
const RTS_FRAME_ENV_SLOT = 5
const RTS_FRAME_OS_SLOT = 6
const RTS_FRAME_FUNC_INS_SLOT = 7

// changes A, B, expects current PC, ENV, OS in their registers
function NEW_RTS_FRAME() {
  A = RTS_FRAME_TAG
  B = RTS_FRAME_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = RTS_FRAME_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = RTS_FRAME_OS_SLOT
  HEAP[RES + RTS_FRAME_PC_SLOT] = PC + 1 // next instruction!
  HEAP[RES + RTS_FRAME_ENV_SLOT] = ENV
  HEAP[RES + RTS_FRAME_OS_SLOT] = OS
  HEAP[RES + RTS_FRAME_FUNC_INS_SLOT] = P
}

let RTS: any[] = []
let TOP_RTS = -1

// expects stack frame in A
function PUSH_RTS() {
  TOP_RTS = TOP_RTS + 1
  RTS[TOP_RTS] = A
}

// places stack frame into RES
function POP_RTS() {
  RES = RTS[TOP_RTS]
  TOP_RTS = TOP_RTS - 1
}

// environment nodes layout
//
// 0: tag  = -102
// 1: size = number of entries + 5
// 2: first child = 5
// 3: last child
// 4: previous env
// 5: first entry
// 6: second entry
// ...

const ENV_TAG = -102
// Indicates previous environment
const PREVIOUS_ENV_SLOT = 4
const NIL = -1

// expects number of env entries in A, previous env in D
// changes A, B, C
function NEW_ENVIRONMENT() {
  C = A
  A = ENV_TAG
  B = C + 5
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 5
  HEAP[RES + LAST_CHILD_SLOT] = 4 + C
  HEAP[RES + PREVIOUS_ENV_SLOT] = D
}

// expects env in A, by-how-many in B
// changes A, B, C, D
function EXTEND() {
  D = A
  A = B
  NEW_ENVIRONMENT()
}

// debugging: show current heap
function is_node_tag(x: number) {
  return x !== undefined && x <= -100 && x >= -110
}
function node_kind(x: number) {
  return x === NUMBER_TAG
    ? 'number'
    : x === BOOL_TAG
    ? 'bool'
    : x === CLOSURE_TAG
    ? 'closure'
    : x === RTS_FRAME_TAG
    ? 'RTS frame'
    : x === OS_TAG
    ? 'OS'
    : x === ENV_TAG
    ? 'environment'
    : x === UNDEFINED_TAG
    ? 'undefined'
    : x === NULL_TAG
    ? 'null'
    : x === STRING_TAG
    ? 'string'
    : x === ARRAY_TAG
    ? 'array'
    : ' (unknown node kind)'
}
export function show_heap(s: string) {
  const len = HEAP.length
  let i = 0
  let str = ''
  str += '--- HEAP --- ' + s
  while (i < len) {
    str +=
      i.toString() +
      ': ' +
      HEAP[i].toString() + // TODO is_number(HEAP[i]) &&
      (is_node_tag(HEAP[i]) ? ' (' + node_kind(HEAP[i]) + ')' : '')
    i = i + 1
  }
  return str
}

function show_heap_value(address: number) {
  return (
    'result: heap node of type = ' +
    node_kind(HEAP[address]) +
    ', value = ' +
    HEAP[address + NUMBER_VALUE_SLOT]
  )
}

// SVMLa implementation

// We implement our machine with an array M that
// contains subroutines. Each subroutine implements
// a machine instruction, using a nullary function.
// The machine can then index into M using the op-codes
// of the machine instructions. To be implementable on
// common hardware, the subroutines have the
// following structure:
// * they have no parameters
// * they do not return any results
// * they do not have local variables
// * they do not call other functions except the
//   subroutines PUSH and POP
// * each line is very simple, for example an array access
// Ideally, each line can be implemented directly with a
// machine instruction of a real computer. In that case,
// the subroutines could become machine language macros,
// and the compiler could generate real machine code.

const M: (() => void)[] = []

M[OpCodes.NOP] = () => undefined

M[OpCodes.LGCI] = () => {
  A = P[PC][LDCI_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCF64] = () => {
  A = P[PC][LDCF64_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCB0] = () => {
  A = false
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCB1] = () => {
  A = true
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCU] = () => {
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCN] = () => {
  NEW_NULL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCS] = () => {
  A = P[PC][LGCS_VALUE_OFFSET]
  NEW_STRING()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.POPG] = () => {
  POP_OS()
  PC = PC + 1
}

// type check here as we need to know whether number or string
M[OpCodes.ADDG] = () => {
  POP_OS()
  A = RES
  POP_OS()
  B = RES
  C = HEAP[A + TAG_SLOT] === HEAP[B + TAG_SLOT]
  D = HEAP[A + TAG_SLOT] === NUMBER_TAG
  F = C && D
  if (F) {
    A = HEAP[A + NUMBER_VALUE_SLOT]
    A = A + HEAP[B + NUMBER_VALUE_SLOT]
    NEW_NUMBER()
  }
  E = HEAP[A + TAG_SLOT] === STRING_TAG
  F = C && E
  if (F) {
    A = HEAP[A + STRING_VALUE_SLOT]
    A = A + HEAP[B + STRING_VALUE_SLOT]
    NEW_STRING()
  }
  A = RES
  PUSH_OS()
  PC = PC + 1
  G = D || E
  G = !(G && C)
  if (G) {
    STATE = TYPE_ERROR
    RUNNING = false
  }
}

M[OpCodes.SUBG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] - A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.MULG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] * A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.DIVG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  E = A
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] / A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
  E = E === 0
  if (E) {
    STATE = DIV_ERROR
  }
  if (E) {
    RUNNING = false
  }
}

M[OpCodes.MODG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] % A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NOTG] = () => {
  POP_OS()
  A = !HEAP[RES + BOOL_VALUE_SLOT]
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

// for comparisons, assume both string or both nums
M[OpCodes.LTG] = () => {
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT] < A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GTG] = () => {
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT] > A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LEG] = () => {
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT] <= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GEG] = () => {
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + BOXED_VALUE_SLOT] >= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

// check type here as undefined and null need to be differentiated by nodes
// unless if we add one more slot to undefined and null
M[OpCodes.EQG] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  A = C === D // same reference (for arrays and functions)
  B = HEAP[C + TAG_SLOT] === HEAP[D + TAG_SLOT] // check same type
  E = HEAP[C + TAG_SLOT] === UNDEFINED_TAG
  A = A || (B && E) // check undefined
  E = HEAP[C + TAG_SLOT] === NULL_TAG
  A = A || (B && E) // check null

  E = HEAP[C + TAG_SLOT] === NUMBER_TAG
  E = E || HEAP[C + TAG_SLOT] === STRING_TAG
  E = E || HEAP[C + TAG_SLOT] === BOOL_TAG
  E = E && B // check same type and has boxed value
  C = HEAP[C + BOXED_VALUE_SLOT]
  D = HEAP[D + BOXED_VALUE_SLOT]
  E = E && C === D
  A = A || E
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWC] = () => {
  A = (P[PC][NEWC_ADDR_OFFSET] as Address)[ADDR_FUNC_INDEX_OFFSET]
  NEW_CLOSURE()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWA] = () => {
  NEW_ARRAY()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LDLG] = () => {
  C = ENV
  A = HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC][LD_ST_INDEX_OFFSET]]
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.STLG] = () => {
  POP_OS()
  C = ENV
  HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC][LD_ST_INDEX_OFFSET]] = RES
  PC = PC + 1
}

M[OpCodes.LDPG] = () => {
  B = P[PC][LD_ST_ENV_OFFSET] // index of env to lookup
  C = ENV
  for (; B > 0; B = B - 1) {
    C = HEAP[C + PREVIOUS_ENV_SLOT]
  }
  A = HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC][LD_ST_INDEX_OFFSET]]
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.STPG] = () => {
  POP_OS()
  B = P[PC][LD_ST_ENV_OFFSET] // index of env to lookup
  C = ENV
  for (; B > 0; B = B - 1) {
    C = HEAP[C + PREVIOUS_ENV_SLOT]
  }
  HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC][LD_ST_INDEX_OFFSET]] = RES
  PC = PC + 1
}

M[OpCodes.LDAG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + ARRAY_VALUE_SLOT][A]
  if (A === undefined) {
    NEW_UNDEFINED()
    A = RES
  }
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.STAG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] // index
  POP_OS()
  HEAP[RES + ARRAY_VALUE_SLOT][A] = D

  // update array size
  D = HEAP[RES + ARRAY_SIZE_SLOT]
  if (D < A) {
    D = A
  }
  HEAP[RES + ARRAY_SIZE_SLOT] = D
  PC = PC + 1
}

M[OpCodes.BRT] = () => {
  POP_OS()
  A = HEAP[RES + BOOL_VALUE_SLOT]
  if (A) {
    PC = PC + (P[PC][BR_OFFSET] as number)
  } else {
    PC = PC + 1
  }
}

M[OpCodes.BRF] = () => {
  POP_OS()
  A = HEAP[RES + BOOL_VALUE_SLOT]
  if (!A) {
    PC = PC + (P[PC][BR_OFFSET] as number)
  } else {
    PC = PC + 1
  }
}

M[OpCodes.BR] = () => {
  PC = PC + (P[PC][BR_OFFSET] as number)
}

// currently does not properly check number of arguments
// only checks to account for vardic
M[OpCodes.CALL] = () => {
  G = P[PC][CALL_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]
  // prep for EXTEND
  A = HEAP[F + CLOSURE_ENV_SLOT]
  // A is now env to be extended
  H = HEAP[F + CLOSURE_FUNC_INDEX_SLOT]
  H = FUNC[H]
  // H is now the function header of the function to call
  B = H[FUNC_ENV_SIZE_OFFSET]
  // B is now the environment extension count
  EXTEND() // after this, RES is new env
  E = RES
  D = E + HEAP[E + FIRST_CHILD_SLOT] + G - 1
  // D is now address where last argument goes in new env
  for (C = D; C > D - G; C = C - 1) {
    POP_OS() // now RES has the address of the next arg
    HEAP[C] = RES // copy argument into new env
  }
  POP_OS() // closure is on top of OS; pop it as not needed
  NEW_RTS_FRAME() // saves PC+1, ENV, OS, P
  A = RES
  PUSH_RTS()
  PC = 0
  P = H[FUNC_CODE_OFFSET]
  A = H[FUNC_MAX_STACK_SIZE_OFFSET]
  NEW_OS()
  OS = RES
  ENV = E
}

// currently does not properly check number of arguments
// only checks to account for vardic
M[OpCodes.CALLP] = () => {
  G = P[PC][CALLP_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  F = P[PC][CALLP_ID_OFFSET] // lets keep primitiveCall Id in F
  F = HEAP[GLOBAL_ENV + HEAP[GLOBAL_ENV + FIRST_CHILD_SLOT] + F] // get closure

  // prep for EXTEND
  A = HEAP[F + CLOSURE_ENV_SLOT]
  // A is now env to be extended
  H = HEAP[F + CLOSURE_FUNC_INDEX_SLOT]
  H = FUNC[H]
  // H is now the function header of the function to call
  I = H[FUNC_NUM_ARGS_OFFSET]
  B = H[FUNC_ENV_SIZE_OFFSET]
  // B is now the environment extension count
  EXTEND() // after this, RES is new env
  E = RES

  // for varargs (-1), put all elements into an array. hacky implementation
  if (I === VARARGS_NUM_ARGS) {
    NEW_ARRAY()
    I = RES
    for (C = G - 1; C >= 0; C = C - 1) {
      POP_OS()
      HEAP[I + ARRAY_VALUE_SLOT][C] = RES
    }
    HEAP[I + ARRAY_SIZE_SLOT] = G // manually update array length
    D = E + HEAP[E + FIRST_CHILD_SLOT]
    HEAP[D] = I
  } else {
    D = E + HEAP[E + FIRST_CHILD_SLOT] + G - 1
    // D is now address where last argument goes in new env
    for (C = D; C > D - G; C = C - 1) {
      POP_OS() // now RES has the address of the next arg
      HEAP[C] = RES // copy argument into new env
    }
  }
  NEW_RTS_FRAME() // saves PC+1, ENV, OS, P
  A = RES
  PUSH_RTS()
  PC = 0
  P = H[FUNC_CODE_OFFSET]
  A = H[FUNC_MAX_STACK_SIZE_OFFSET]
  NEW_OS()
  OS = RES
  ENV = E
}

M[OpCodes.RETG] = () => {
  if (ENTRY === P) {
    // if entry point, then intercept return
    RUNNING = false
  } else {
    POP_RTS()
    H = RES
    PC = HEAP[H + RTS_FRAME_PC_SLOT]
    ENV = HEAP[H + RTS_FRAME_ENV_SLOT]
    P = HEAP[H + RTS_FRAME_FUNC_INS_SLOT]
    POP_OS()
    A = RES
    OS = HEAP[H + RTS_FRAME_OS_SLOT]
    PUSH_OS()
  }
}

M[OpCodes.DUP] = () => {
  POP_OS()
  A = RES
  PUSH_OS()
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWENV] = () => {
  A = ENV
  B = P[PC][NEWENV_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  EXTEND() // after this, RES is new env
  ENV = RES
  PC = PC + 1
}

M[OpCodes.POPENV] = () => {
  ENV = HEAP[ENV + PREVIOUS_ENV_SLOT] // restore to parent env
  PC = PC + 1
}

// all opcodes from here onwards are custom to this implementation (3.4)
M[OpCodes.ARRAY_LEN] = () => {
  POP_OS()
  A = HEAP[RES + ARRAY_SIZE_SLOT]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.DISPLAY] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  externalFunctions.get(OpCodes.DISPLAY)(convertToJsFormat(D), convertToJsFormat(C))
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

// only works with lists and numbers
M[OpCodes.DRAW_DATA] = () => {
  POP_OS()
  externalFunctions.get(OpCodes.DRAW_DATA)(convertToJsFormat(RES))
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.ERROR] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  externalFunctions.get(OpCodes.ERROR)(convertToJsFormat(D), convertToJsFormat(C))
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_ARRAY] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === ARRAY_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_BOOL] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === BOOL_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_FUNC] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === CLOSURE_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_NULL] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === NULL_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_NUMBER] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === NUMBER_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_STRING] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === STRING_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.IS_UNDEFINED] = () => {
  POP_OS()
  A = HEAP[RES + TAG_SLOT] === UNDEFINED_TAG
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.MATH_HYPOT] = () => {
  POP_OS()
  A = Math.hypot(...convertToJsFormat(RES))
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

addPrimitiveOpCodeHandlers()

function run(): any {
  // startup
  if (PC < 0) {
    D = FUNC[PROG[0]] // put function header in D
    A = D[FUNC_MAX_STACK_SIZE_OFFSET]
    NEW_OS()
    OS = RES
    A = D[FUNC_ENV_SIZE_OFFSET]
    D = NIL
    NEW_ENVIRONMENT()
    ENV = RES
    GLOBAL_ENV = ENV
    P = ENTRY
    PC = 0
  }

  while (RUNNING) {
    // show_registers("run loop");
    // show_heap("run loop");
    // show_executing('')
    if (M[P[PC][INS_OPCODE_OFFSET]] === undefined) {
      throw Error('unknown op-code: ' + P[PC][INS_OPCODE_OFFSET])
    } else {
      M[P[PC][INS_OPCODE_OFFSET]]()
    }
  }
  if (STATE === DIV_ERROR || STATE === TYPE_ERROR) {
    POP_OS()
    throw Error('execution aborted: ' + RES)
  } else {
    POP_OS()
    show_heap_value(RES)
    return convertToJsFormat(RES)
  }
}

function convertToJsFormat(node: number): any {
  const kind = node_kind(HEAP[node + TAG_SLOT])
  if (kind === 'undefined' || kind === 'closure') {
    return undefined
  }
  if (kind === 'null') {
    return null
  }
  if (kind === 'number' || kind === 'string' || kind === 'bool') {
    return HEAP[node + BOXED_VALUE_SLOT]
  }
  if (kind === 'array') {
    const arr: number[] = HEAP[node + BOXED_VALUE_SLOT]
    const res = []
    for (let i = 0; i < arr.length; i++) {
      res[i] = convertToJsFormat(arr[i])
    }
    return res
  }
}

// if program has primitive calls, prelude must be included.
// this implementation also assumes a correct program, and does not
// currently check for type correctness
// an incorrect program will have undefined behaviors
export function runWithP(p: Program, context: Context): any {
  PROG = p
  FUNC = PROG[1] // list of SVMFunctions
  ENTRY = FUNC[PROG[0]][FUNC_CODE_OFFSET]
  PC = -1
  HEAP = []
  FREE = 0
  GLOBAL_ENV = NIL
  ENV = NIL
  OS = -Infinity
  RES = -Infinity
  RTS = []
  TOP_RTS = -1
  STATE = NORMAL
  RUNNING = true

  A = 0
  B = 0
  C = 0
  D = 0
  E = 0
  F = 0
  G = 0
  H = 0
  I = 0

  // setup externalBuiltins
  // certain functions are imported from cadet-frontend
  // so import them first every time
  const externals = GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE][context.contextId].globals.variables
  EXTERNAL_PRIMITIVES.forEach(func => extractExternalBuiltin(func, externals))

  return run()
}

function addPrimitiveOpCodeHandlers() {
  function addNullaryHandler(opcode: number, f: () => number) {
    M[opcode] = () => {
      A = f()
      NEW_NUMBER()
      A = RES
      PUSH_OS()
      PC = PC + 1
    }
  }
  function addUnaryHandler(opcode: number, f: (x: number) => number) {
    M[opcode] = () => {
      POP_OS()
      A = HEAP[RES + NUMBER_VALUE_SLOT]
      A = f(A)
      NEW_NUMBER()
      A = RES
      PUSH_OS()
      PC = PC + 1
    }
  }
  // string as well due to parseInt. Only works due to current
  // representation of strings. Must change if the machine changes
  // to a more authentic representation of strings
  function addBinaryHandler(opcode: number, f: (x: number | string, y: number) => number) {
    M[opcode] = () => {
      POP_OS()
      C = HEAP[RES + NUMBER_VALUE_SLOT]
      POP_OS()
      D = HEAP[RES + BOXED_VALUE_SLOT]
      A = f(D, C)
      NEW_NUMBER()
      A = RES
      PUSH_OS()
      PC = PC + 1
    }
  }

  NULLARY_PRIMITIVES.forEach(func => {
    if (func[2]) addNullaryHandler(func[1], func[2])
  })
  UNARY_PRIMITIVES.forEach(func => {
    if (func[2]) addUnaryHandler(func[1], func[2])
  })
  BINARY_PRIMITIVES.concat([
    ['', OpCodes.MATH_MAX, Math.max], // only want the handler
    ['', OpCodes.MATH_MIN, Math.min]
  ]).forEach(func => {
    if (func[2]) addBinaryHandler(func[1], func[2])
  })
}

const externalFunctions = new Map<number, any>()
function extractExternalBuiltin(func: [string, number], externals: Map<string, any>) {
  const name = func[0]
  const opcode = func[1]
  externalFunctions.set(opcode, externals.get(name).getValue())
}
