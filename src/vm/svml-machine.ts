import { OpCodes, PRIMITIVE_FUNCTION_NAMES } from './svml-compiler'
import { getName } from './util'

const LDCN_VALUE_OFFSET = 1
const LGCS_VALUE_OFFSET = 1
const NEWA_VALUE_OFFSET = 1

// VIRTUAL MACHINE

// "registers" are the global variables of our machine.
// These contain primitive values (numbers or boolean
// values) or arrays of primitive values

// P is an array that contains an SVML machine program:
// the op-codes of instructions and their arguments
let P: number[] = []
// PC is program counter: index of the next instruction
let PC = 0
// HEAP is array containing all dynamically allocated data structures
let HEAP: any[] = []
// next free slot in heap
let FREE = 0
// OS is address of current environment in HEAP; initially a dummy value
let ENV = -Infinity
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

function show_executing(s: string) {
  let str = ''
  str += '--- RUN ---' + s
  str += 'PC :' + PC.toString()
  str += 'instr:' + getName(P[PC])
  return str
}

// for debugging: show all registers
export function show_registers(s: string) {
  let str = ''
  str = show_executing(s)
  str += '--- REGISTERS ---'
  str += 'RES:' + RES.toString()
  str += 'A  :' + A.toString()
  str += 'B  :' + B.toString()
  str += 'C  :' + C.toString()
  str += 'D  :' + D.toString()
  str += 'E  :' + E.toString()
  str += 'F  :' + F.toString()
  str += 'G  :' + G.toString()
  str += 'H  :' + H.toString()
  str += 'OS :' + OS.toString()
  str += 'ENV:' + ENV.toString()
  str += 'RTS:' + RTS.toString()
  str += 'TOP_RTS:' + TOP_RTS.toString()
  return str
}

// register that says if machine is running
let RUNNING = true

const NORMAL = 0
const DIV_ERROR = 1
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
// 4: value

const ARRAY_TAG = -108
const ARRAY_SIZE = 5
const ARRAY_VALUE_SLOT = 4

function NEW_ARRAY() {
  C = A
  A = ARRAY_TAG
  B = ARRAY_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + ARRAY_VALUE_SLOT] = C
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

// expects max size in A
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
function PUSH_OS() {
  B = HEAP[OS + LAST_CHILD_SLOT] // address of current top of OS
  B = B + 1
  HEAP[OS + LAST_CHILD_SLOT] = B // update address of current top of OS
  HEAP[OS + B] = A
}

// POP puts the top-most value into RES
// uses B
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
// 4: stack size = max stack size needed for executing function body
// 5: address = address of function
// 6: environment
// 7: extension count = number of entries by which to extend env

const CLOSURE_TAG = -103
const CLOSURE_SIZE = 8
const CLOSURE_OS_SIZE_SLOT = 4
const CLOSURE_ADDRESS_SLOT = 5
const CLOSURE_ENV_SLOT = 6
const CLOSURE_ENV_EXTENSION_COUNT_SLOT = 7

// expects stack size in A, address in B, environment extension count in C
function NEW_CLOSURE() {
  E = A
  F = B
  A = CLOSURE_TAG
  B = CLOSURE_SIZE
  NEW()
  A = E
  B = F
  HEAP[RES + FIRST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + CLOSURE_OS_SIZE_SLOT] = A
  HEAP[RES + CLOSURE_ADDRESS_SLOT] = B
  HEAP[RES + CLOSURE_ENV_SLOT] = ENV
  HEAP[RES + CLOSURE_ENV_EXTENSION_COUNT_SLOT] = C
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

const RTS_FRAME_TAG = -104
const RTS_FRAME_SIZE = 7
const RTS_FRAME_PC_SLOT = 4
const RTS_FRAME_ENV_SLOT = 5
const RTS_FRAME_OS_SLOT = 6

// expects current PC, ENV, OS in their registers
function NEW_RTS_FRAME() {
  A = RTS_FRAME_TAG
  B = RTS_FRAME_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = RTS_FRAME_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = RTS_FRAME_OS_SLOT
  HEAP[RES + RTS_FRAME_PC_SLOT] = PC + 2 // next instruction!
  HEAP[RES + RTS_FRAME_ENV_SLOT] = ENV
  HEAP[RES + RTS_FRAME_OS_SLOT] = OS
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
// Indicates no previous environment
const PREVIOUS_ENV_SLOT = 4

// expects number of env entries in A, previous env in D
// changes B, C
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

const M: Array<() => void> = []

M[OpCodes.NOP] = () => undefined

M[OpCodes.LGCI] = () => {
  A = P[PC + LDCN_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.LGCF64] = () => {
  A = P[PC + LDCN_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 2
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
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCS] = () => {
  A = P[PC + LGCS_VALUE_OFFSET]
  NEW_STRING()
  A = RES
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.POPG] = () => {
  POP_OS()
  PC = PC + 1
}

M[OpCodes.ADDG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] + A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
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

M[OpCodes.LTG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] < A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GTG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] > A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LEG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] <= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GEG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] >= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.EQG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] === A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWA] = () => {
  A = P[PC + NEWA_VALUE_OFFSET]
  NEW_ARRAY()
  A = RES
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.LDLG] = () => {
  C = ENV
  A = HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC + 1]]
  PUSH_OS()
  PC = PC + 3
}

M[OpCodes.STLG] = () => {
  POP_OS()
  B = P[PC + 2] // index of env to lookup
  C = ENV
  HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC + 1]] = RES
  PC = PC + 3
}

M[OpCodes.LDPG] = () => {
  B = P[PC + 2] // index of env to lookup
  C = ENV
  for (; B > 0; B = B - 1) {
    C = HEAP[C + PREVIOUS_ENV_SLOT]
  }
  A = HEAP[C + HEAP[C + FIRST_CHILD_SLOT] + P[PC + 1]]
  PUSH_OS()
  PC = PC + 3
}

M[OpCodes.STPG] = () => {
  POP_OS()
  PUSH_OS()
}

M[OpCodes.LDAG] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + ARRAY_VALUE_SLOT][A]
  PUSH_OS()
  PC = PC + 3
}

M[OpCodes.STAG] = () => {
  POP_OS()
  B = HEAP[RES + BOXED_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  HEAP[RES + ARRAY_VALUE_SLOT][A] = B
  PC = PC + 3
}

M[OpCodes.BRT] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  if (A) {
    PC = PC + 1 + P[PC + 1]
  } else {
    PC = PC + 2
  }
}

M[OpCodes.BRF] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  if (!A) {
    PC = PC + 1 + P[PC + 1]
  } else {
    PC = PC + 2
  }
}

M[OpCodes.BR] = () => {
  PC = PC + 1 + P[PC + 1]
}

M[OpCodes.JMP] = () => {
  PC = P[PC + 1]
}

M[OpCodes.CALL] = () => {
  G = P[PC + 1] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]
  // prep for EXTEND
  A = HEAP[F + CLOSURE_ENV_SLOT]
  // A is now env to be extended
  H = HEAP[A + LAST_CHILD_SLOT]
  // H is now offset of last child slot
  B = HEAP[F + CLOSURE_ENV_EXTENSION_COUNT_SLOT]
  // B is now the environment extension count
  EXTEND() // after this, RES is new env
  E = RES
  H = E + H + G
  // H is now address where last argument goes in new env
  for (C = H; C > H - G; C = C - 1) {
    POP_OS() // now RES has the address of the next arg
    HEAP[C] = RES // copy argument into new env
  }
  POP_OS() // closure is on top of OS; pop it as not needed
  NEW_RTS_FRAME() // saves PC+2, ENV, OS
  A = RES
  PUSH_RTS()
  PC = HEAP[F + CLOSURE_ADDRESS_SLOT]
  A = HEAP[F + CLOSURE_OS_SIZE_SLOT] // closure stack size
  NEW_OS() // uses B and C
  OS = RES
  ENV = E
}

M[OpCodes.CALLP] = () => {
  F = PRIMITIVE_FUNCTION_NAMES[P[PC + 1]] // lets keep primitiveCall string in F
  G = P[PC + 2] // lets keep number of arguments in G
  // TODO
}

M[OpCodes.RETG] = () => {
  POP_RTS()
  H = RES
  PC = HEAP[H + RTS_FRAME_PC_SLOT]
  ENV = HEAP[H + RTS_FRAME_ENV_SLOT]
  POP_OS()
  A = RES
  OS = HEAP[H + RTS_FRAME_OS_SLOT]
  PUSH_OS()
}

M[OpCodes.DUP] = () => {
  POP_OS()
  A = RES
  PUSH_OS()
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWENV] = () => {
  G = P[PC + 1] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]
  // prep for EXTEND
  A = HEAP[F + CLOSURE_ENV_SLOT]
  // A is now env to be extended
  H = HEAP[A + LAST_CHILD_SLOT]
  // H is now offset of last child slot
  B = HEAP[F + CLOSURE_ENV_EXTENSION_COUNT_SLOT]
  // B is now the environment extension count
  EXTEND() // after this, RES is new env
  E = RES
  H = E + H + G
  // H is now address where last argument goes in new env
  for (C = H; C > H - G; C = C - 1) {
    POP_OS() // now RES has the address of the next arg
    HEAP[C] = RES // copy argument into new env
  }
  POP_OS() // closure is on top of OS; pop it as not needed
  NEW_RTS_FRAME() // saves PC+2, ENV, OS
  A = RES
  PUSH_RTS()
  PC = HEAP[F + CLOSURE_ADDRESS_SLOT]
  A = HEAP[F + CLOSURE_OS_SIZE_SLOT] // closure stack size
  NEW_OS() // uses B and C
  OS = RES
  ENV = E
}

M[OpCodes.POPENV] = () => {
  POP_RTS()
  H = RES
  PC = HEAP[H + RTS_FRAME_PC_SLOT]
  ENV = HEAP[H + RTS_FRAME_ENV_SLOT]
  OS = HEAP[H + RTS_FRAME_OS_SLOT]
}

function run(): any {
  while (RUNNING) {
    // show_registers("run loop");
    // show_heap("run loop");
    if (M[P[PC]] === undefined) {
      throw Error('unknown op-code: ' + P[PC])
    } else {
      M[P[PC]]()
    }
  }
  if (STATE === DIV_ERROR) {
    POP_OS()
    throw Error('execution aborted: ' + RES)
  } else {
    POP_OS()
    show_heap_value(RES)
    return HEAP[RES]
  }
}

export function runWithP(p: number[]): any {
  P = p
  PC = 0
  HEAP = []
  FREE = 0
  ENV = -Infinity
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

  return run()
}
