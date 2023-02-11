import { JSSLANG_PROPERTIES } from '../constants'
import { PotentialInfiniteLoopError } from '../errors/timeoutErrors'
import {
  BINARY_PRIMITIVES,
  EXTERNAL_PRIMITIVES,
  INTERNAL_FUNCTIONS,
  NULLARY_PRIMITIVES,
  UNARY_PRIMITIVES,
  VARARGS_NUM_ARGS
} from '../stdlib/vm.prelude'
import { Context } from '../types'
import { locationDummyNode } from '../utils/astCreator'
import { stringify } from '../utils/stringify'
import OpCodes from './opcodes'
import { Address, Instruction, Program, SVMFunction } from './svml-compiler'
import { RoundRobinScheduler, Scheduler, ThreadId } from './svml-scheduler'
import { getName } from './util'

const LDCI_VALUE_OFFSET = 1
const LDCF32_VALUE_OFFSET = 1
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
const CALLT_NUM_ARGS_OFFSET = 1
const CALLP_ID_OFFSET = 1
const CALLP_NUM_ARGS_OFFSET = 2
const CALLTP_ID_OFFSET = 1
const CALLTP_NUM_ARGS_OFFSET = 2
const CALLV_ID_OFFSET = 1
const CALLV_NUM_ARGS_OFFSET = 2
const CALLTV_ID_OFFSET = 1
const CALLTV_NUM_ARGS_OFFSET = 2
const NEWC_ADDR_OFFSET = 1
const ADDR_FUNC_INDEX_OFFSET = 0
const NEWENV_NUM_ARGS_OFFSET = 1
const NEWCP_ID_OFFSET = 1
const NEWCV_ID_OFFSET = 1

// VIRTUAL MACHINE

// "registers" are the global variables of our machine.
// These contain primitive values (numbers or boolean
// values) or arrays of primitive values

// PROG contains the entire SVML JSON formatted program
let PROG: Program
// FUNC contains the function array, for easier access
let FUNC: SVMFunction[]
// INTERNAL is the function array for internal functions
const INTERNAL: [string, OpCodes, number, boolean][] = INTERNAL_FUNCTIONS
const INTERNAL_OPCODE_SLOT = 1
const INTERNAL_NUM_ARGS_SLOT = 2
const INTERNAL_HAS_RETURN_VAL_SLOT = 3

// GLOBAL_ENV is the env that contains all the primitive functions
let GLOBAL_ENV = -1
// HEAP is array containing all dynamically allocated data structures
let HEAP: any[] = []
// next free slot in heap
let FREE = 0
// temporary value, used by PUSH and POP; initially a dummy value
let RES = -Infinity

// THREAD STATE

// P contains the instructions to be executed in the current function call
let P: Instruction[]
// PC is program counter: index of the next instruction in P
let PC = 0
// ENV is address of current environment in HEAP; initially a dummy value
let ENV = -1
// OS is address of current operand stack in HEAP; initially a dummy value
let OS = -Infinity
// RTS contains the call stack
let RTS: any[] = []
// top index of RTS stack
let TOP_RTS = -1

/**
 * when executing concurrent code
 */
// TO is timeout counter: how many instructions are left for a thread to run
let TO = 0

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
let J: any = 0
let K: any = 0

function show_executing(s: string) {
  let str = ''
  str += '--- RUN ---' + s + '\n'
  str += 'PC :' + PC + '\n'
  str += 'instr:' + getName(P[PC][INS_OPCODE_OFFSET])
  return str
}

// for debugging: show all registers
export function show_registers(s: string, isShowExecuting = true) {
  let str = ''
  if (isShowExecuting) {
    str = show_executing(s) + '\n'
  }
  str += '--- REGISTERS ---' + s + '\n'
  str += 'RES:' + RES + '\n'
  str += 'A  :' + A + '\n'
  str += 'B  :' + B + '\n'
  str += 'C  :' + C + '\n'
  str += 'D  :' + D + '\n'
  str += 'E  :' + E + '\n'
  str += 'F  :' + F + '\n'
  str += 'G  :' + G + '\n'
  str += 'H  :' + H + '\n'
  str += 'I  :' + I + '\n'
  str += 'OS :' + OS + '\n'
  str += 'ENV:' + ENV + '\n'
  str += 'RTS:' + RTS + '\n'
  str += 'TOP_RTS:' + TOP_RTS + '\n'
  str += 'TO:' + TO + '\n'
  str += 'scheduler_state:' + scheduler_state_string() + '\n'
  return str
}

// register that says if machine is running
let RUNNING = true

const NORMAL = 0
const DIV_ERROR = 1
const TYPE_ERROR = 2
const NUM_ARGS_ERROR = 3
const CALL_NON_FUNCTION_ERROR = 4

let ERROR_MSG_ARGS: any[] = []

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
// 1: size = 7
// 2: offset of first child from the tag: 6 (only environment)
// 3: offset of last child from the tag: 6
// 4: type of function (normal, primitive, internal)
// 5: index = index of function in program function array
// 6: environment

const CLOSURE_TAG = -103
const CLOSURE_SIZE = 7
const CLOSURE_NORMAL_TYPE = 0
// not necessary right now due to the way primitives are handled
// const CLOSURE_PRIMITIVE_TYPE = 1
const CLOSURE_INTERNAL_TYPE = 2
const CLOSURE_TYPE_SLOT = 4
const CLOSURE_FUNC_INDEX_SLOT = 5
const CLOSURE_ENV_SLOT = 6

// changes A, B, E, F
// expects index of function in FUNC / INTERNAL in A
// expects type of function in B
export function NEW_FUNCTION() {
  E = A
  F = B
  A = CLOSURE_TAG
  B = CLOSURE_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + CLOSURE_TYPE_SLOT] = F
  HEAP[RES + CLOSURE_FUNC_INDEX_SLOT] = E
  HEAP[RES + CLOSURE_ENV_SLOT] = ENV
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

// changes A, B, expects current PC, ENV, OS, P, TOP_RTS in their registers
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

// expects number of env entries in A, previous env in B
// changes A, B, C
function NEW_ENVIRONMENT() {
  C = A
  D = B
  A = ENV_TAG
  B = C + 5
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 5
  HEAP[RES + LAST_CHILD_SLOT] = 4 + C
  HEAP[RES + PREVIOUS_ENV_SLOT] = D
}

// expect operands to check equality for in C and D
// return result as boolean literal in A
function CHECK_EQUAL() {
  A = C === D // same reference (for arrays and normal functions)
  B = HEAP[C + TAG_SLOT] === HEAP[D + TAG_SLOT] // check same type
  E = HEAP[C + TAG_SLOT] === UNDEFINED_TAG
  A = A || (B && E) // check undefined
  E = HEAP[C + TAG_SLOT] === NULL_TAG
  A = A || (B && E) // check null

  E = HEAP[C + TAG_SLOT] === CLOSURE_TAG // check functions
  if (B && E) {
    // if internal, compare index
    E = HEAP[C + CLOSURE_TYPE_SLOT] === HEAP[D + CLOSURE_TYPE_SLOT]
    E = E && HEAP[C + CLOSURE_FUNC_INDEX_SLOT] === HEAP[D + CLOSURE_FUNC_INDEX_SLOT]
    A = A || E
  }

  E = HEAP[C + TAG_SLOT] === NUMBER_TAG
  E = E || HEAP[C + TAG_SLOT] === STRING_TAG
  E = E || HEAP[C + TAG_SLOT] === BOOL_TAG
  E = E && B // check same type and has boxed value
  C = HEAP[C + BOXED_VALUE_SLOT]
  D = HEAP[D + BOXED_VALUE_SLOT]
  E = E && C === D
  A = A || E
}

const NORMAL_CALL = 0
const TAIL_CALL = 1
const PRIMITIVE_CALL = 2
const PRIMITIVE_TAIL_CALL = 3
const INTERNAL_CALL = 4
const INTERNAL_TAIL_CALL = 5

// expect number of arguments in G, closure (index for internal) in F,
// type of call in J
// currently only checks number of arguments for variadic functions
// uses A,B,C,D,E,F,G,H,I,J,K
function FUNCTION_CALL() {
  if (
    J === INTERNAL_CALL ||
    J === INTERNAL_TAIL_CALL ||
    ((J === NORMAL_CALL || J === TAIL_CALL) &&
      HEAP[F + CLOSURE_TYPE_SLOT] === CLOSURE_INTERNAL_TYPE)
  ) {
    if (J === NORMAL_CALL || J === TAIL_CALL) {
      F = HEAP[F + CLOSURE_FUNC_INDEX_SLOT]
    }
    INTERNAL_FUNCTION_CALL()
  } else {
    // prep for new environment
    B = HEAP[F + CLOSURE_ENV_SLOT]
    // A is now env to be extended
    H = HEAP[F + CLOSURE_FUNC_INDEX_SLOT]
    H = FUNC[H]
    // H is now the function header of the function to call
    I = H[FUNC_NUM_ARGS_OFFSET]
    A = H[FUNC_ENV_SIZE_OFFSET]
    // A is now the environment extension count
    NEW_ENVIRONMENT() // after this, RES is new env
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
    } else if (I === G) {
      D = E + HEAP[E + FIRST_CHILD_SLOT] + G - 1
      // D is now address where last argument goes in new env
      for (C = D; C > D - G; C = C - 1) {
        POP_OS() // now RES has the address of the next arg
        HEAP[C] = RES // copy argument into new env
      }
    } else {
      STATE = NUM_ARGS_ERROR
      ERROR_MSG_ARGS[0] = I
      ERROR_MSG_ARGS[1] = G
      RUNNING = false
    }

    if (J === NORMAL_CALL || J === TAIL_CALL) {
      POP_OS() // closure is on top of OS; pop it as not needed
    }
    if (J === NORMAL_CALL || J === PRIMITIVE_CALL) {
      // normal calls need to push to RTS
      NEW_RTS_FRAME() // saves PC+1, ENV, OS, P
      A = RES
      PUSH_RTS()
    }
    PC = 0
    P = H[FUNC_CODE_OFFSET]
    A = H[FUNC_MAX_STACK_SIZE_OFFSET]
    NEW_OS()
    OS = RES
    ENV = E
  }
}

// expects type of call in J, internal function id in F
// number of arguments in G
// actually no difference between tail and normal
function INTERNAL_FUNCTION_CALL() {
  F = INTERNAL[F]
  K = F // save the internal function
  if (K[INTERNAL_NUM_ARGS_SLOT] !== VARARGS_NUM_ARGS && K[INTERNAL_NUM_ARGS_SLOT] !== G) {
    STATE = NUM_ARGS_ERROR
    ERROR_MSG_ARGS[0] = K[INTERNAL_NUM_ARGS_SLOT]
    ERROR_MSG_ARGS[1] = G
    RUNNING = false
  } else {
    M[K[INTERNAL_OPCODE_SLOT]]() // call subroutine directly

    if (K[INTERNAL_HAS_RETURN_VAL_SLOT]) {
      // pop return value if present
      POP_OS()
      D = RES
    } else {
      NEW_UNDEFINED()
      D = RES
    }
    if (J === NORMAL_CALL || J === TAIL_CALL) {
      POP_OS() // pop closure
    }
    A = D
    PUSH_OS() // push return value back
    PC = PC + 1
  }
}

type Thread = [
  number, // OS
  number, // ENV
  number, // PC
  Instruction[], // P
  any[], // RTS
  number // TOP_RTS
]

let scheduler: Scheduler = new RoundRobinScheduler()
const threads: Map<ThreadId, Thread> = new Map()
let currentThreadId: ThreadId = -1

// Initialize the scheduler (do this before running code)
function INIT_SCHEDULER() {
  scheduler = new RoundRobinScheduler()
  threads.clear()
}

// Schedule new thread for later execution using the thread state currently in VM
// You will want to pop another thread, restore thread state, etc.
// after calling this, as the current thread state should not be running
function NEW_THREAD() {
  const newId = scheduler.newThread()
  threads.set(newId, [OS, ENV, PC, P, RTS, TOP_RTS])
}

// Schedule current thread for later execution
// You will want to pop another thread, restore thread state, etc.
// after calling this, as the current thread state should not be running
function PAUSE_THREAD() {
  // Save state to threads map
  threads.set(currentThreadId, [OS, ENV, PC, P, RTS, TOP_RTS])

  // Pause thread in scheduler
  scheduler.pauseThread(currentThreadId)
}

function DELETE_CURRENT_THREAD() {
  // Clear state from threads map
  threads.delete(currentThreadId)

  // Delete thread from scheduler
  scheduler.deleteCurrentThread(currentThreadId)
  currentThreadId = -1
}

// Get thread from scheduler and run it
function RUN_THREAD() {
  ;[currentThreadId, TO] = scheduler.runThread()!

  // Load thread state
  ;[OS, ENV, PC, P, RTS, TOP_RTS] = threads.get(currentThreadId)!
}

// Returns the number of threads in the scheduler
function GET_NUM_IDLE_THREADS() {
  RES = scheduler.numIdle()
}

function scheduler_state_string() {
  return new Array(scheduler.idleThreads).toString()
}

// debugging: show current heap
function is_node_tag(x: number) {
  return x !== undefined && x <= -100 && x >= -110
}
function node_kind(x: number) {
  return x === NUMBER_TAG
    ? 'number'
    : x === BOOL_TAG
    ? 'boolean'
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
  str += '--- HEAP --- ' + s + '\n'
  while (i < len) {
    str +=
      i +
      ': ' +
      HEAP[i] + // TODO is_number(HEAP[i]) &&
      (is_node_tag(HEAP[i]) ? ' (' + node_kind(HEAP[i]) + ')' : '') +
      '\n'
    i = i + 1
  }
  return str
}

export function show_heap_value(address: number) {
  return (
    'result: heap node of type = ' +
    node_kind(HEAP[address]) +
    ', value = ' +
    HEAP[address + NUMBER_VALUE_SLOT]
  )
}

// SVML implementation

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
// There are some exceptions due to the need to support
// primitive functions or certain behavior

const M: (() => void)[] = []

M[OpCodes.NOP] = () => {
  PC = PC + 1
}

M[OpCodes.LGCI] = () => {
  A = P[PC][LDCI_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LGCF32] = () => {
  A = P[PC][LDCF32_VALUE_OFFSET]
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
  I = RES
  POP_OS()
  G = RES
  H = HEAP[I + TAG_SLOT] === HEAP[G + TAG_SLOT]
  D = HEAP[I + TAG_SLOT] === NUMBER_TAG
  F = H && D
  if (F) {
    A = HEAP[I + NUMBER_VALUE_SLOT]
    A = HEAP[G + NUMBER_VALUE_SLOT] + A
    NEW_NUMBER()
  }
  E = HEAP[I + TAG_SLOT] === STRING_TAG
  F = H && E
  if (F) {
    A = HEAP[I + STRING_VALUE_SLOT]
    A = HEAP[G + STRING_VALUE_SLOT] + A
    NEW_STRING()
  }
  A = RES
  PUSH_OS()
  PC = PC + 1
  J = D || E
  J = !(J && H)
  if (J) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'string and string or number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[G + TAG_SLOT])} and ${node_kind(HEAP[I + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '+'
    RUNNING = false
  }
}

M[OpCodes.SUBG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + NUMBER_VALUE_SLOT]
  A = HEAP[E + NUMBER_VALUE_SLOT] - A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '-'
    RUNNING = false
  }
}

M[OpCodes.MULG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + NUMBER_VALUE_SLOT]
  A = HEAP[E + NUMBER_VALUE_SLOT] * A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '*'
    RUNNING = false
  }
}

M[OpCodes.DIVG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + NUMBER_VALUE_SLOT]
  F = A
  A = HEAP[E + NUMBER_VALUE_SLOT] / A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '/'
    RUNNING = false
  }

  F = G && F === 0
  if (F) {
    STATE = DIV_ERROR
    RUNNING = false
  }
}

M[OpCodes.MODG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + NUMBER_VALUE_SLOT]
  A = HEAP[E + NUMBER_VALUE_SLOT] % A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = E && HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    RUNNING = false
  }
}

M[OpCodes.NEGG] = () => {
  POP_OS()
  D = RES
  A = -HEAP[D + NUMBER_VALUE_SLOT]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '-'
    RUNNING = false
  }
}

M[OpCodes.NOTG] = () => {
  POP_OS()
  D = RES
  A = !HEAP[D + BOOL_VALUE_SLOT]
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === BOOL_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'boolean'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '!'
    RUNNING = false
  }
}

// for comparisons, assume both string or both nums
M[OpCodes.LTG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + BOXED_VALUE_SLOT]
  A = HEAP[E + BOXED_VALUE_SLOT] < A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && (HEAP[D + TAG_SLOT] === NUMBER_TAG || HEAP[D + TAG_SLOT] === STRING_TAG)
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'string and string or number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '<'
    RUNNING = false
  }
}

M[OpCodes.GTG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + BOXED_VALUE_SLOT]
  A = HEAP[E + BOXED_VALUE_SLOT] > A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && (HEAP[D + TAG_SLOT] === NUMBER_TAG || HEAP[D + TAG_SLOT] === STRING_TAG)
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'string and string or number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '>'
    RUNNING = false
  }
}

M[OpCodes.LEG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + BOXED_VALUE_SLOT]
  A = HEAP[E + BOXED_VALUE_SLOT] <= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && (HEAP[D + TAG_SLOT] === NUMBER_TAG || HEAP[D + TAG_SLOT] === STRING_TAG)
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'string and string or number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '<='
    RUNNING = false
  }
}

M[OpCodes.GEG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[D + BOXED_VALUE_SLOT]
  A = HEAP[E + BOXED_VALUE_SLOT] >= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === HEAP[E + TAG_SLOT]
  G = G && (HEAP[D + TAG_SLOT] === NUMBER_TAG || HEAP[D + TAG_SLOT] === STRING_TAG)
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'string and string or number and number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])} and ${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = '>='
    RUNNING = false
  }
}

// check type here as undefined and null need to be differentiated by nodes
// unless if we add one more slot to undefined and null
M[OpCodes.EQG] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  CHECK_EQUAL()
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEQG] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  CHECK_EQUAL()
  A = !A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWC] = () => {
  A = (P[PC][NEWC_ADDR_OFFSET] as Address)[ADDR_FUNC_INDEX_OFFSET]
  B = CLOSURE_NORMAL_TYPE
  NEW_FUNCTION()
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
  D = RES
  POP_OS()
  E = RES
  G = HEAP[E + TAG_SLOT] === ARRAY_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'array'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'array access'
    RUNNING = false
    return
  }

  A = HEAP[D + NUMBER_VALUE_SLOT]
  A = HEAP[E + ARRAY_VALUE_SLOT][A]
  if (A === undefined) {
    NEW_UNDEFINED()
    A = RES
  }
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'array index'
    RUNNING = false
  }
}

M[OpCodes.STAG] = () => {
  POP_OS()
  D = RES
  POP_OS()
  E = RES
  A = HEAP[E + NUMBER_VALUE_SLOT] // index
  POP_OS()
  F = RES
  G = HEAP[F + TAG_SLOT] === ARRAY_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'array'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[F + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'array access'
    RUNNING = false
    return
  }
  HEAP[F + ARRAY_VALUE_SLOT][A] = D

  // update array size
  D = HEAP[F + ARRAY_SIZE_SLOT]
  if (D < A + 1) {
    D = A + 1
  }
  HEAP[F + ARRAY_SIZE_SLOT] = D
  PC = PC + 1

  G = HEAP[E + TAG_SLOT] === NUMBER_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'number'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[E + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'array index'
    RUNNING = false
  }
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

M[OpCodes.CALL] = () => {
  G = P[PC][CALL_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]

  E = HEAP[F + TAG_SLOT] === CLOSURE_TAG
  if (E) {
    J = NORMAL_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.CALLT] = () => {
  G = P[PC][CALLT_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]

  E = HEAP[F + TAG_SLOT] === CLOSURE_TAG
  if (E) {
    J = TAIL_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.CALLP] = () => {
  G = P[PC][CALLP_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  F = P[PC][CALLP_ID_OFFSET] // lets keep primitiveCall Id in F
  F = HEAP[GLOBAL_ENV + HEAP[GLOBAL_ENV + FIRST_CHILD_SLOT] + F] // get closure

  E = HEAP[F + TAG_SLOT] === CLOSURE_TAG
  if (E) {
    J = PRIMITIVE_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.CALLTP] = () => {
  G = P[PC][CALLTP_NUM_ARGS_OFFSET] // lets keep number of arguments in G
  F = P[PC][CALLTP_ID_OFFSET] // lets keep primitiveCall Id in F
  F = HEAP[GLOBAL_ENV + HEAP[GLOBAL_ENV + FIRST_CHILD_SLOT] + F] // get closure

  E = HEAP[F + TAG_SLOT] === CLOSURE_TAG
  if (E) {
    J = PRIMITIVE_TAIL_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.CALLV] = () => {
  G = P[PC][CALLV_NUM_ARGS_OFFSET]
  F = P[PC][CALLV_ID_OFFSET]

  E = F < INTERNAL_FUNCTIONS.length
  if (E) {
    J = INTERNAL_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.CALLTV] = () => {
  G = P[PC][CALLTV_NUM_ARGS_OFFSET]
  F = P[PC][CALLTV_ID_OFFSET]

  E = F < INTERNAL_FUNCTIONS.length
  if (E) {
    J = INTERNAL_TAIL_CALL
    FUNCTION_CALL()
  } else {
    STATE = CALL_NON_FUNCTION_ERROR
    ERROR_MSG_ARGS[0] = convertToJsFormat(F)
    RUNNING = false
  }
}

M[OpCodes.RETG] = () => {
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

M[OpCodes.DUP] = () => {
  POP_OS()
  A = RES
  PUSH_OS()
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWENV] = () => {
  B = ENV
  A = P[PC][NEWENV_NUM_ARGS_OFFSET] // lets keep number of arguments in A
  NEW_ENVIRONMENT() // after this, RES is new env
  ENV = RES
  PC = PC + 1
}

M[OpCodes.POPENV] = () => {
  ENV = HEAP[ENV + PREVIOUS_ENV_SLOT] // restore to parent env
  PC = PC + 1
}

// for now, we treat all primitive functions as normal functions
// until we find a way to deal with streams.
// problem with streams is that they create nullary functions, which
// will be called using CALL, and are considered normal functions by
// the compiler and machine
M[OpCodes.NEWCP] = () => {
  A = P[PC][NEWCP_ID_OFFSET]
  A = HEAP[GLOBAL_ENV + HEAP[GLOBAL_ENV + FIRST_CHILD_SLOT] + A]
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NEWCV] = () => {
  A = P[PC][NEWCV_ID_OFFSET]
  B = CLOSURE_INTERNAL_TYPE
  NEW_FUNCTION()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

// all opcodes from here onwards are custom to this implementation (3 Concurrent)
M[OpCodes.ARRAY_LEN] = () => {
  POP_OS()
  D = RES
  A = HEAP[D + ARRAY_SIZE_SLOT]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1

  G = HEAP[D + TAG_SLOT] === ARRAY_TAG
  if (!G) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'array'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'array_length'
    RUNNING = false
  }
}

M[OpCodes.DISPLAY] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  externalFunctions.get(OpCodes.DISPLAY)(convertToJsFormat(D), convertToJsFormat(C))
  A = D
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.DRAW_DATA] = () => {
  POP_OS()
  externalFunctions.get(OpCodes.DRAW_DATA)(...convertToJsFormat(RES))
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
  // terminates so don't do anything else
  // A = D
  // PUSH_OS()
  // PC = PC + 1
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

M[OpCodes.STRINGIFY] = () => {
  POP_OS()
  A = stringify(convertToJsFormat(RES))
  NEW_STRING()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.PROMPT] = () => {
  POP_OS()
  A = externalFunctions.get(OpCodes.PROMPT)(convertToJsFormat(RES))
  NEW_STRING()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.DISPLAY_LIST] = () => {
  POP_OS()
  C = RES
  POP_OS()
  D = RES
  externalFunctions.get(OpCodes.DISPLAY_LIST)(convertToJsFormat(D), convertToJsFormat(C))
  A = D
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.ARITY] = () => {
  POP_OS()
  D = RES
  G = HEAP[D + TAG_SLOT] === CLOSURE_TAG
  if (G) {
    H = HEAP[D + CLOSURE_FUNC_INDEX_SLOT]
    H = FUNC[H]
    A = H[FUNC_NUM_ARGS_OFFSET]
    if (A === VARARGS_NUM_ARGS) {
      A = 0
    }
    NEW_NUMBER()
    A = RES
    PUSH_OS()
    PC = PC + 1
  } else {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'closure'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'arity'
    RUNNING = false
  }
}

addPrimitiveOpCodeHandlers()

// Internal functions. They are called directly in internal function calls
// All internal functions should not use register J or K, and can find
// the number of arguments in G. They should also not increment PC.

// expects num args in G
M[OpCodes.EXECUTE] = () => {
  I = G
  E = OS // we need the values in OS, so store in E first
  G = [OS, ENV, PC, P, RTS, TOP_RTS] // store current state first
  // Keep track of registers first to restore present state after saving threads
  for (; I > 0; I = I - 1) {
    RTS = []
    TOP_RTS = -1
    OS = E
    POP_OS()
    H = RES // store closure in H
    F = HEAP[H + CLOSURE_FUNC_INDEX_SLOT]
    F = FUNC[F] // store function header in F
    A = F[FUNC_MAX_STACK_SIZE_OFFSET]
    NEW_OS()
    OS = RES
    A = F[FUNC_ENV_SIZE_OFFSET]
    B = HEAP[H + CLOSURE_ENV_SLOT]
    NEW_ENVIRONMENT()
    ENV = RES
    P = F[FUNC_CODE_OFFSET]
    // enqueue to thread queue
    PC = 0
    NEW_THREAD()
  }
  ;[OS, ENV, PC, P, RTS, TOP_RTS] = G // restore state
}

M[OpCodes.TEST_AND_SET] = () => {
  POP_OS()
  D = RES // array
  E = HEAP[D + TAG_SLOT] === ARRAY_TAG
  if (!E) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'array'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'test_and_set'
    RUNNING = false
  } else {
    E = HEAP[D + ARRAY_VALUE_SLOT][0] // get old boolean value
    A = true
    NEW_BOOL()
    HEAP[D + ARRAY_VALUE_SLOT][0] = RES
    A = E
    PUSH_OS() // push old value to os
  }
}

M[OpCodes.CLEAR] = () => {
  POP_OS()
  D = RES // array
  E = HEAP[D + TAG_SLOT] === ARRAY_TAG
  if (!E) {
    STATE = TYPE_ERROR
    ERROR_MSG_ARGS[0] = 'array'
    ERROR_MSG_ARGS[1] = `${node_kind(HEAP[D + TAG_SLOT])}`
    ERROR_MSG_ARGS[2] = 'clear'
    RUNNING = false
  } else {
    A = false
    NEW_BOOL()
    HEAP[D + ARRAY_VALUE_SLOT][0] = RES
  }
}

// called whenever the machine is first run
function INITIALIZE() {
  D = FUNC[PROG[0]] // put function header in D
  A = D[FUNC_MAX_STACK_SIZE_OFFSET]
  P = D[FUNC_CODE_OFFSET]
  NEW_OS()
  OS = RES
  A = D[FUNC_ENV_SIZE_OFFSET]
  B = NIL
  NEW_ENVIRONMENT()
  ENV = RES
  GLOBAL_ENV = ENV
  PC = 0
}

// called during concurrent execution
function RUN_INSTRUCTION() {
  if (TOP_RTS > -1 || P[PC][INS_OPCODE_OFFSET] !== OpCodes.RETG) {
    // execute normally
    if (M[P[PC][INS_OPCODE_OFFSET]] === undefined) {
      throw Error('unknown op-code: ' + P[PC][INS_OPCODE_OFFSET])
    }
    M[P[PC][INS_OPCODE_OFFSET]]()
    TO = TO - 1
  } else {
    // end of current thread, try to setup another thread
    DELETE_CURRENT_THREAD()
    GET_NUM_IDLE_THREADS()
    if (RES === 0) {
      // end if no more threads
      RUNNING = false
    } else {
      // setup next thread
      RUN_THREAD()
    }
  }
}

function TIMEOUT_THREAD() {
  // enqueue to thread queue
  PAUSE_THREAD()
  RUN_THREAD()
}

function run(): any {
  const MAX_TIME = JSSLANG_PROPERTIES.maxExecTime
  const startTime = Date.now()

  // startup
  INITIALIZE()

  while (RUNNING) {
    // infinite loop protection
    if (Date.now() - startTime > MAX_TIME) {
      throw new PotentialInfiniteLoopError(locationDummyNode(-1, -1, null), MAX_TIME)
    }

    if (TO > 0) {
      // show_registers("run loop");
      // show_heap("run loop");
      // show_executing('')
      RUN_INSTRUCTION()
    } else if (TO === 0) {
      // when exhausted time quanta
      TIMEOUT_THREAD()
    } else {
      throw Error('TO cannot be negative')
    }
  }

  // handle errors
  if (STATE !== NORMAL) {
    throw Error('execution aborted: ' + getErrorType())
  }

  POP_OS()
  // show_heap_value(RES)
  // return convertToJsFormat(RES)
  // Source 3 Concurrent programs do not return anything.
  return 'all threads terminated'
}

function getErrorType(): string {
  switch (STATE) {
    case DIV_ERROR:
      return 'division by 0'
    case TYPE_ERROR:
      // 0: expected types
      // 1: received types
      // 2: operator
      return `Expected ${ERROR_MSG_ARGS[0]}, got ${ERROR_MSG_ARGS[1]} for ${ERROR_MSG_ARGS[2]}.`
    case NUM_ARGS_ERROR:
      return `Expected ${ERROR_MSG_ARGS[0]} arguments, but got ${ERROR_MSG_ARGS[1]}.`
    case CALL_NON_FUNCTION_ERROR:
      return `calling non-function value ${ERROR_MSG_ARGS[0]}.`
    default:
      throw Error('invalid error type')
  }
}

function convertToJsFormat(node: number, refs?: Map<number, any>): any {
  if (refs !== undefined && refs.has(node)) {
    return refs.get(node)
  }
  const kind = node_kind(HEAP[node + TAG_SLOT])
  switch (kind) {
    case 'undefined':
      return undefined

    case 'null':
      return null

    case 'number':
    case 'string':
    case 'boolean':
      return HEAP[node + BOXED_VALUE_SLOT]

    case 'array': {
      if (refs === undefined) {
        refs = new Map<number, any>()
      }
      const arr: number[] = HEAP[node + BOXED_VALUE_SLOT]
      const res: any[] = []
      refs.set(node, res)
      for (let i = 0; i < arr.length; i++) {
        res[i] = convertToJsFormat(arr[i], refs)
      }
      return res
    }
    case 'closure':
      return '<Function>'
    default:
      throw Error('Encountered unexpressible type: ' + kind)
  }
}

// if program has primitive calls, prelude must be included.
// this implementation also assumes a correct program, and does not
// currently check for type correctness
// an incorrect program will have undefined behaviors
export function runWithProgram(p: Program, context: Context): any {
  PROG = p
  FUNC = PROG[1] // list of SVMFunctions
  P = []
  PC = -1
  HEAP = []
  FREE = 0
  GLOBAL_ENV = NIL
  ENV = NIL
  OS = -Infinity
  RES = -Infinity
  RTS = []
  TO = 0
  TOP_RTS = -1
  STATE = NORMAL
  RUNNING = true
  ERROR_MSG_ARGS = []

  INIT_SCHEDULER()

  A = 0
  B = 0
  C = 0
  D = 0
  E = 0
  F = 0
  G = 0
  H = 0
  I = 0
  J = 0
  K = 0

  // setup externalBuiltins
  // certain functions are imported from cadet-frontend
  // so import them first every time
  const externals = context.nativeStorage.builtins
  if (externals.size > 0) {
    EXTERNAL_PRIMITIVES.forEach(func => extractExternalBuiltin(func, externals))
  }

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
  externalFunctions.set(opcode, externals.get(name))
}
