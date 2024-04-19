import { EnvironmentPos, literal_keywords } from '../environment/environment'
import { builtin_keywords } from '../interpreter/builtins'
import { GoRoutineQueue } from '../interpreter/goroutine'
import {
  InvalidMemRequestedError,
  MemExhaustedError,
  MemOutOfBoundsError,
  InvalidChildIndexError,
  BadTagError,
  WaitGroupCounterOverflowError,
  NegativeWaitGroupCounterError,
  InvalidSemaphoreValueError,
  InvalidValTypeError
} from './errors'
import { HeapVal, ValType } from './heapVals'

const word_pow = 3
const word_size = 1 << word_pow
const mega = 20
const gc_offset = 7
const size_offset = 5

const FALSE_TAG = 0
const TRUE_TAG = 1
const NULL_TAG = 2
const UNASSIGNED_TAG = 3
const UNDEFINED_TAG = 4
const BLOCKFRAME_TAG = 5
const CALLFRAME_TAG = 6
const CLOSURE_TAG = 7
const FRAME_TAG = 8
const ENVIRONMENT_TAG = 9
const PAIR_TAG = 10
const BUILTIN_TAG = 11
const STRING_TAG = 12
// const INT8_TAG = 13
// const UINT8_TAG = 14
// const INT16_TAG = 15
const UINT16_TAG = 16
const INT32_TAG = 17
// const UINT32_TAG = 18 // for future use
// const INT64_TAG = 19; // for future use
// const UINT64_TAG = 20; // for future use
// const FLOAT32_TAG = 21 // for future use
// const FLOAT64_TAG = 22; // for future use
const CHANNEL_TAG = 23
const POINTER_TAG = 24
const SEMAPHORE_TAG = 25
const WAITGROUP_TAG = 26

const min_gc_size = 256 // do not trigger gc so long as size used <= 2 * min_gc_size

const WHITE = 0 // node not visited (yet)
const GRAY = 1 // node visited but children not fully mapped yet
const BLACK = 2 // node + children visited

// 1 byte tag, 4 bytes payload, 2 bytes children, 1 byte (allocated size + gc colour)

export class HeapBuffer {
  heap: ArrayBuffer
  view: DataView
  available: number[][]
  heap_pow: number
  size_last_gc: number
  curr_used: number
  grQueue: GoRoutineQueue
  true_pos: number
  false_pos: number
  nil_pos: number
  undefined_pos: number
  unassigned_pos: number

  constructor(byte_pow?: number) {
    // 1024 bytes should be enough at the very least
    if (byte_pow !== undefined && byte_pow < 10) {
      throw new Error(`byte power must be at least 10`)
    }
    this.heap_pow = byte_pow ?? mega
    this.heap = new ArrayBuffer(1 << (this.heap_pow + word_pow))
    this.view = new DataView(this.heap)
    this.available = []
    for (var i = 0; i <= this.heap_pow; ++i) {
      this.available[i] = []
    }
    this.available[this.heap_pow].push(0)
    // Invariant: All allocated and freed blocks must be marked with the correct block size at all times
    this.heap_set_byte_at_offset(0, gc_offset, this.heap_pow << 3)
    this.size_last_gc = min_gc_size // will not trigger gc if curr_used < 2 * size_last_gc
    this.curr_used = 0
    this.grQueue = new GoRoutineQueue()
    this.allocateLiteralValues()
  }

  public allocate(tag: number, size: number): number {
    if (size <= 0) {
      // ensures that size is a positive number
      throw new InvalidMemRequestedError()
    }
    if (this.curr_used >= 2 * Math.max(this.size_last_gc, min_gc_size)) {
      this.run_gc()
    }
    let address = this.findMemBlock(size)
    if (address === -1) {
      // memory not found, trigger gc
      this.run_gc()
      // try again
      address = this.findMemBlock(size)
    }
    if (address === -1) {
      // memory not found even after gc, throw error
      throw new MemExhaustedError()
    }
    this.view.setUint8(address * word_size, tag)
    return address
  }

  // returns available memory block if available, otherwise returns -1
  private findMemBlock(size: number): number {
    // size is the number of words requested
    let startPos = 0
    while (
      startPos <= this.heap_pow &&
      (1 << startPos < size || this.available[startPos].length == 0)
    ) {
      startPos += 1
    }
    if (startPos > this.heap_pow) {
      return -1
    }

    let currIdx = startPos
    const address = this.available[currIdx].pop() as number
    while (currIdx > 0 && size * 2 <= 1 << currIdx) {
      // we try to use the smallest unit required, cut out right half for future use
      currIdx--
      this.available[currIdx].push(address + (1 << currIdx))
      // all memory blocks, allocated or not, must be labelled with their size. this step
      // maintains the invariant, which is required for the mark-sweep algorithm to work
      this.heap_set_byte_at_offset(address + (1 << currIdx), gc_offset, currIdx << 3)
    }
    // for the 8th byte of the first word, first 5 bits encode the power of the memory block
    // size returned (e.g. 256 words -> 8), and the last 2 bits encode the node colour
    // (00 -> white, 01 -> gray, 10 -> black)
    // All newly allocated blocks will be coloured gray - this ensures that they will survive
    // the first gc cycle at least
    this.heap_set_byte_at_offset(address, gc_offset, (currIdx << 3) + GRAY)
    // set size
    this.heap_set_2_bytes_at_offset(address, size_offset, size)
    this.curr_used += 1 << currIdx
    return address
  }

  private run_gc() {
    // mark literals
    this.mark(this.true_pos, true)
    this.mark(this.false_pos, true)
    this.mark(this.nil_pos, true)
    this.mark(this.unassigned_pos, true)
    this.mark(this.undefined_pos, true)
    // mark roots of each goroutine
    console.log('GC Executed - No. of goroutines: %d', this.grQueue.size)
    console.log('Curr used: %d', this.curr_used)
    for (var thread of this.grQueue.goroutines) {
      if (thread !== undefined) {
        thread.OS.forEach(address => this.mark(address, true))
        this.mark(thread.ENV as number, true)
        thread.RTS.forEach(address => this.mark(address as number, true))
      }
    }
    let addr = 0
    const heapsize = 1 << this.heap_pow
    // find all gray non-child nodes and mark them as black
    for (addr; addr < heapsize; ) {
      const colour = this.heap_get_colour(addr)
      if (colour === GRAY) {
        this.mark(addr, true, true)
      }
      const allocSize = 1 << this.heap_get_allocated_size(addr)
      addr += allocSize
    }
    this.sweep()
    console.log('New curr used: %d', this.curr_used)
  }

  // needColour is used to indicate whether the current address needs to be coloured
  // the sweep algorithm will jump over the block if it sees black, hence children
  // nodes will not be uncoloured
  private mark(address: number, needColour: boolean, process_gray?: boolean) {
    const colour = this.heap_get_colour(address)
    if (colour === WHITE || (process_gray === true && colour === GRAY)) {
      const nodeTag = this.heap_get_tag(address)
      switch (nodeTag) {
        case STRING_TAG:
          if (needColour) {
            // do not iterate through children (which contain letters packed together)
            this.setColour(address, BLACK)
          }
          return
        case CHANNEL_TAG:
          // first 8 bytes of channel: 1 byte tag, 1 byte lock (test and set), 1 byte startIdx,
          // 1 byte channelSize, 1 byte empty, 2 bytes numChildren/channel capacity, 1 byte gc + colour
          const channelCap = this.heap_get_number_of_children(address)
          const startPos = this.heap_get_byte_at_offset(address, 2)
          const numItems = this.heap_get_byte_at_offset(address, 3)

          if (needColour) {
            this.setColour(address, GRAY)
          }
          // iterate through values in channel and mark them (especially if they are pointers; need to mark
          // the nodes they point to)
          for (let i = 0; i < numItems; ++i) {
            this.mark(address + 1 + ((startPos + i) % channelCap), false)
          }

          if (needColour) {
            this.setColour(address, BLACK)
          }
          break
        case POINTER_TAG:
          if (needColour) {
            this.setColour(address, GRAY)
          }
          const pointerAddress = this.heap_get_4_bytes_at_offset(address, 1)
          this.mark(pointerAddress, true)
          if (needColour) {
            this.setColour(address, BLACK)
          }
          break
        case ENVIRONMENT_TAG:
          this.setColour(address, GRAY)
          for (let i = 0; i < this.heap_get_number_of_children(address); ++i) {
            this.mark(this.heap_get_child(address, i), true)
          }
          this.setColour(address, BLACK)
          break
        case BLOCKFRAME_TAG:
          this.setColour(address, GRAY)
          this.mark(this.heap_get_4_bytes_at_offset(address, 1), true)
          this.setColour(address, BLACK)
          break
        default:
          if (needColour) {
            this.setColour(address, GRAY)
          }
          const numChildren = this.heap_get_number_of_children(address)
          for (let i = 0; i < numChildren; ++i) {
            this.mark(address + 1 + i, false)
          }
          if (needColour) {
            this.setColour(address, BLACK)
          }
      }
    }
  }

  private sweep() {
    // reset the freenode list
    for (var i = 0; i <= this.heap_pow; ++i) {
      this.available[i] = []
    }
    this.curr_used = 0
    let addr = 0
    const heapsize = 1 << this.heap_pow
    for (addr; addr < heapsize; ) {
      const colour = this.heap_get_colour(addr)
      const allocSize = this.heap_get_allocated_size(addr)
      if (colour === WHITE) {
        let currPow = allocSize
        let currAddr = addr
        // since we sweep from left to right, left buddy is the last entry for the current row if it is free
        while (currPow < this.heap_pow) {
          const buddy = currAddr ^ (1 << currPow)
          if (
            this.available[currPow].length > 0 &&
            this.available[currPow][this.available[currPow].length - 1] === buddy
          ) {
            currAddr = buddy
            this.available[currPow].pop()
            currPow++
          } else {
            break
          }
        }
        this.available[currPow].push(currAddr)
        // maintain invariant that the block size is correctly marked
        this.heap_set_byte_at_offset(currAddr, gc_offset, currPow << 3)
        addr = currAddr + (1 << currPow)
      } else {
        this.curr_used += 1 << allocSize
        this.setColour(addr, WHITE)
        addr += 1 << allocSize
      }
    }
    this.size_last_gc = this.curr_used
  }

  private setColour(address: number, colour: number) {
    const gcByte = this.heap_get_byte_at_offset(address, gc_offset)
    this.heap_set_byte_at_offset(address, gc_offset, (gcByte & 248) | colour)
  }

  private addressCheck(address: number) {
    if (address < 0 || address >= word_size << this.heap_pow) {
      throw new MemOutOfBoundsError()
    }
  }

  // address is word-based (i.e. increment of 1 -> increment of word_size in ArrayBuffer)
  private heap_get(address: number): number {
    this.addressCheck(address)
    return this.view.getFloat64(address * word_size)
  }

  private heap_set(address: number, value: number) {
    this.addressCheck(address)
    this.view.setFloat64(address * word_size, value)
  }

  private heap_get_number_of_children(address: number) {
    const numChildren = this.heap_get_size(address)
    return numChildren - 1
  }

  private heap_get_size(address: number): number {
    return this.heap_get_2_bytes_at_offset(address, size_offset)
  }

  private heap_get_allocated_size(address: number): number {
    // get first 5 bits
    return (this.heap_get_byte_at_offset(address, gc_offset) & 248) >> 3
  }

  private heap_get_colour(address: number): number {
    return this.heap_get_byte_at_offset(address, gc_offset) & 3
  }

  // child index starts at 0
  private heap_get_child(address: number, child_index: number): number {
    const numChildren = this.heap_get_number_of_children(address)
    if (child_index >= numChildren) {
      throw new InvalidChildIndexError(child_index, numChildren)
    }
    return this.heap_get(address + 1 + child_index)
  }

  public heap_set_child(address: number, child_index: number, value: number) {
    const numChildren = this.heap_get_number_of_children(address)
    if (child_index >= numChildren) {
      throw new InvalidChildIndexError(child_index, numChildren)
    }
    this.heap_set(address + 1 + child_index, value)
  }

  private heap_get_tag(address: number): number {
    this.addressCheck(address)
    return this.heap_get_byte_at_offset(address, 0)
  }

  private heap_set_byte_at_offset(address: number, offset: number, value: number) {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size) {
      throw new MemOutOfBoundsError()
    }
    this.view.setUint8(address * word_size + offset, value)
  }

  private heap_get_byte_at_offset(address: number, offset: number): number {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size) {
      throw new MemOutOfBoundsError()
    }
    return this.view.getUint8(address * word_size + offset)
  }

  private heap_set_2_bytes_at_offset(address: number, offset: number, value: number) {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 1) {
      throw new MemOutOfBoundsError()
    }
    this.view.setUint16(address * word_size + offset, value)
  }

  private heap_get_2_bytes_at_offset(address: number, offset: number): number {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 1) {
      throw new MemOutOfBoundsError()
    }
    return this.view.getUint16(address * word_size + offset)
  }

  private heap_set_4_bytes_at_offset(address: number, offset: number, value: number) {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 3) {
      throw new MemOutOfBoundsError()
    }
    this.view.setUint32(address * word_size + offset, value)
  }

  private heap_get_4_bytes_at_offset(address: number, offset: number): number {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 3) {
      throw new MemOutOfBoundsError()
    }
    return this.view.getUint32(address * word_size + offset)
  }

  private isFalse(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FALSE_TAG
  }

  private isTrue(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === TRUE_TAG
  }

  private isBoolean(address: number): boolean {
    return this.isTrue(address) || this.isFalse(address)
  }

  public isUnassigned(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UNASSIGNED_TAG
  }

  private isUndefined(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UNDEFINED_TAG
  }

  private allocateLiteralValues() {
    this.true_pos = this.allocate(TRUE_TAG, 1)
    this.false_pos = this.allocate(FALSE_TAG, 1)
    this.nil_pos = this.allocate(NULL_TAG, 1)
    this.unassigned_pos = this.allocate(UNASSIGNED_TAG, 1)
    this.undefined_pos = this.allocate(UNDEFINED_TAG, 1)
  }

  // builtin id encoded in second byte [1 byte tag, 1 byte id, 3 bytes unused,
  // 2 bytes #size, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_builtin(id: number): number {
    const address = this.allocate(BUILTIN_TAG, 1)
    this.heap_set_byte_at_offset(address, 1, id)
    return address
  }

  public heap_get_builtin_id(address: number): number {
    if (!this.isBuiltin(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(BUILTIN_TAG, tag)
    }
    return this.heap_get_byte_at_offset(address, 1)
  }

  public isBuiltin(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === BUILTIN_TAG
  }

  // closure
  // [1 byte tag, 4 bytes arity, 2 bytes #size, 1 byte gc + colour]
  // #size = 3
  // followed by pc and pointer to env
  public heap_allocate_Closure(arity: number, pc: number, envAddr: number): number {
    const address = this.allocate(CLOSURE_TAG, 3)
    this.heap_set_4_bytes_at_offset(address, 1, arity)
    this.heap_set_byte_at_offset(address + 1, 0, INT32_TAG)
    this.heap_set_4_bytes_at_offset(address + 1, 1, pc)
    this.heap_set_2_bytes_at_offset(address + 1, size_offset, 1)
    // we initialise value pointer ourselves to avoid additional allocation
    this.heap_set_byte_at_offset(address + 2, 0, POINTER_TAG)
    this.heap_set_4_bytes_at_offset(address + 2, 1, envAddr)
    this.heap_set_2_bytes_at_offset(address + 2, size_offset, 1)
    return address
  }

  public heap_get_Closure_arity(address: number): number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return this.heap_get_4_bytes_at_offset(address, 1)
  }

  public heap_get_Closure_pc(address: number): number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return this.getInt32(address + 1)
  }

  public heap_get_Closure_env(address: number): number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return this.getPointerAddress(address + 2)
  }

  public isClosure(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === CLOSURE_TAG
  }

  // block frame
  // [1 byte tag, 4 bytes env address, 2 bytes #size, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_Blockframe(envAddr: number): number {
    const addr = this.allocate(BLOCKFRAME_TAG, 1)
    this.heap_set_4_bytes_at_offset(addr, 1, envAddr)
    return addr
  }

  public heap_get_Blockframe_environment(address: number): number {
    if (!this.isBlockframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(BLOCKFRAME_TAG, tag)
    }
    return this.heap_get_4_bytes_at_offset(address, 1)
  }

  public isBlockframe(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === BLOCKFRAME_TAG
  }

  // callframe
  // [1 byte tag, 4 bytes pc, 2 bytes #size, 1 byte gc + colour]
  // #size = 2
  // followed by pointer to env
  public heap_allocate_Callframe(pc: number, envAddr: number): number {
    const address = this.allocate(CALLFRAME_TAG, 2)
    this.heap_set_4_bytes_at_offset(address, 1, pc)
    // we initialise value pointer ourselves to avoid additional allocation
    this.heap_set_byte_at_offset(address + 1, 0, POINTER_TAG)
    this.heap_set_4_bytes_at_offset(address + 1, 1, envAddr)
    this.heap_set_2_bytes_at_offset(address + 1, size_offset, 1)
    return address
  }

  public heap_get_Callframe_pc(address: number): number {
    if (!this.isCallframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CALLFRAME_TAG, tag)
    }
    return this.heap_get_4_bytes_at_offset(address, 1)
  }

  public heap_get_Callframe_env(address: number): number {
    if (!this.isCallframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CALLFRAME_TAG, tag)
    }
    return this.getPointerAddress(address + 1)
  }

  public isCallframe(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === CALLFRAME_TAG
  }

  // environment frame
  // [1 byte tag, 4 bytes unused, 2 bytes #size, 1 byte gc + colour]
  // followed by addresses of values
  public heap_allocate_Frame(numValues: number): number {
    const addr = this.allocate(FRAME_TAG, numValues + 1)
    for (let i = 0; i < numValues; ++i) {
      this.heap_set_frame_child(addr, i, this.unassigned_pos)
    }
    return addr
  }

  public heap_set_frame_child(addr : number, child : number, valAddr : number) {
    if (!this.isFrame(addr)) {
      const tag = this.heap_get_tag(addr)
      throw new BadTagError(FRAME_TAG, tag)
    }
    this.heap_set_byte_at_offset(addr + 1 + child, 0, POINTER_TAG)
    this.heap_set_4_bytes_at_offset(addr + 1 + child, 1, valAddr)
    this.heap_set_2_bytes_at_offset(addr + 1 + child, size_offset, 1)
  }

  public heap_Frame_display(address: number) {
    if (!this.isFrame(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(FRAME_TAG, tag)
    }
    console.log('Frame at %d:', address)
    const size = this.heap_get_number_of_children(address)
    console.log('Frame size: %d', size)
    for (let i = 0; i < size; ++i) {
      const addr = this.heap_get_4_bytes_at_offset(address + 1 + i, 1)
      const value = this.heap_get(addr)
      console.log("frame child pointer tag: %d", this.heap_get_tag(addr))
      console.log('%d: Value address: %d, Value: %d', i, addr, this.word_to_string(value))
    }
  }

  public isFrame(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FRAME_TAG
  }

  // environment
  // [1 byte tag, 4 bytes unused, 2 bytes #size, 1 byte gc + colour]
  // #size = number of frames + 1
  // followed by addresses of frames
  public heap_allocate_Environment(numFrames: number): number {
    const addr = this.allocate(ENVIRONMENT_TAG, numFrames + 1)
    return addr
  }

  public heap_get_Environment_value(envAddr: number, pos: EnvironmentPos): number {
    if (!this.isEnvironment(envAddr)) {
      const tag = this.heap_get_tag(envAddr)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const frame_addr = this.heap_get_child(envAddr, pos.env_offset)
    return this.getPointerAddress(frame_addr + 1 + pos.frame_offset)
  }

  public heap_set_Environment_value(envAddr: number, pos: EnvironmentPos, valAddr: number) {
    if (!this.isEnvironment(envAddr)) {
      const tag = this.heap_get_tag(envAddr)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const frame_addr = this.heap_get_child(envAddr, pos.env_offset)
    if (this.isPointer(valAddr)) {
      this.heap_set_child(frame_addr, pos.frame_offset, valAddr)
    } else {
      this.heap_set_byte_at_offset(frame_addr + 1 + pos.frame_offset, 0, POINTER_TAG)
      this.heap_set_4_bytes_at_offset(frame_addr + 1 + pos.frame_offset, 1, valAddr)
      this.heap_set_2_bytes_at_offset(frame_addr + 1 + pos.frame_offset, size_offset, 1)
    }
  }

  // extends given environment by new frame
  // creates a new environment bigger by 1 frame slot than the given environment
  // copy the frame addresses of given environment into the new environment
  // new frame appended at the end of the environment
  public heap_Environment_extend(frame_addr: number, env_addr: number): number {
    const old_size = this.heap_get_size(env_addr)
    const new_env = this.heap_allocate_Environment(old_size)
    let i = 0
    for (i; i < old_size - 1; ++i) {
      this.heap_set_child(new_env, i, this.heap_get_child(env_addr, i))
    }
    this.heap_set_child(new_env, i, frame_addr)
    return new_env
  }

  // for debugging
  public heap_Environment_display(address: number) {
    if (!this.isEnvironment(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const size = this.heap_get_number_of_children(address)
    console.log('Environment')
    console.log('Environment size: %d', size)
    for (let i = 0; i < size; ++i) {
      console.log('Frame %d:', i)
      const frame = this.heap_get_child(address, i)
      this.heap_Frame_display(frame)
    }
  }

  private isEnvironment(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === ENVIRONMENT_TAG
  }

  // pair
  // [1 byte tag, 4 bytes unused, 2 bytes #size, 1 byte gc + colour]
  // #size = 3
  // followed by head and tail addresses
  // pass in address of head and tail objects
  public heap_allocate_Pair(head_addr: number, tail_addr: number): number {
    const addr = this.allocate(PAIR_TAG, 3)
    // create pointers only if they aren't already pointers
    if (this.isPointer(head_addr)) {
      this.heap_set_child(addr, 0, head_addr)
    } else {
      this.heap_set_byte_at_offset(addr + 1, 0, POINTER_TAG)
      this.heap_set_4_bytes_at_offset(addr + 1, 1, head_addr)
      this.heap_set_2_bytes_at_offset(addr + 1, size_offset, 1)
    }
    if (this.isPointer(tail_addr)) {
      this.heap_set_child(addr, 1, tail_addr)
    } else {
      this.heap_set_byte_at_offset(addr + 2, 0, POINTER_TAG)
      this.heap_set_4_bytes_at_offset(addr + 2, 1, tail_addr)
      this.heap_set_2_bytes_at_offset(addr + 2, size_offset, 1)
    }
    return addr
  }

  private isPair(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === PAIR_TAG
  }

  // Uint16 can be used to represent char variables (utf-8)
  // [1 byte tag, 2 bytes unused, 2 byte uint16 value, 2 bytes #size, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_Uint16(val: number): number {
    const addr = this.allocate(UINT16_TAG, 1)
    this.heap_set_2_bytes_at_offset(addr, 3, val)
    return addr
  }

  public getUint16(address: number): number {
    if (!this.isUint16) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(UINT16_TAG, tag)
    }
    return this.heap_get_2_bytes_at_offset(address, 3)
  }

  private isUint16(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UINT16_TAG
  }

  // Int32 represents the standard int
  // [1 byte tag, 4 bytes int32 val, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Int32(val: number): number {
    const addr = this.allocate(INT32_TAG, 1)
    this.heap_set_4_bytes_at_offset(addr, 1, val)
    return addr
  }

  public getInt32(addr: number): number {
    if (!this.isInt32) {
      const tag = this.heap_get_tag(addr)
      throw new BadTagError(INT32_TAG, tag)
    }
    return this.heap_get_4_bytes_at_offset(addr, 1)
  }

  private isInt32(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === INT32_TAG
  }
  /*
  // Float32 represents the standard float
  // [1 byte tag, 4 bytes float32 val, 2 bytes #size, 1 byte gc + colour]
  // #size = 0
  public heap_allocate_Float32(val: number): number {
    const addr = this.allocate(FLOAT32_TAG, 1)
    // write directly to DataView to guarantee that 32 bits are written
    this.view.setFloat32(addr * word_size + 1, val)
    return addr
  }

  public getFloat32(addr: number): number {
    if (!this.isFloat32) {
      const tag = this.heap_get_tag(addr)
      throw new BadTagError(FLOAT32_TAG, tag)
    }
    return this.view.getFloat32(addr * word_size + 1)
  }

  private isFloat32(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FLOAT32_TAG
  }
*/

  // string
  // [1 byte tag, 4 bytes string length (include terminating character '\0'),
  // 2 bytes #size, 1 byte gc + colour]
  // characters are packed in every 2 bytes (utf-8) of the children nodes
  // #children = number of children nodes containing characters (include '\0')
  public heap_allocate_string(str: string): number {
    const addr = this.allocate(STRING_TAG, Math.floor((str.length + 4)) / 4 + 1)
    this.heap_set_4_bytes_at_offset(addr, 1, str.length + 1)
    for (let i = 0; i < str.length; ++i) {
      this.heap_set_2_bytes_at_offset(addr + 1 + Math.floor(i / 4), (i * 2) % 8, str.charCodeAt(i))
    }
    this.heap_set_2_bytes_at_offset(addr + 1 + Math.floor(str.length / 4), (str.length * 2) % 8, 0)
    return addr
  }

  public getString(address: number): string {
    if (!this.isString) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(STRING_TAG, tag)
    }
    const strlen = this.heap_get_4_bytes_at_offset(address, 1)
    const ascii_chars: number[] = []
    for (let i = 0; i < strlen - 1; ++i) {
      ascii_chars.push(this.heap_get_2_bytes_at_offset(address + 1 + Math.floor(i / 4), (i * 2) % 8))
    }
    const out = String.fromCharCode(...ascii_chars)
    return out
  }

  public isString(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === STRING_TAG
  }

  // pointer
  // [1 byte tag, 4 bytes address, 2 bytes #size, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_pointer(address: number): number {
    const pAddr = this.allocate(POINTER_TAG, 1)
    this.heap_set_4_bytes_at_offset(pAddr, 1, address)
    return pAddr
  }

  public isPointer(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === POINTER_TAG
  }

  public getPointerAddress(address: number): number {
    if (!this.isPointer(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(POINTER_TAG, tag)
    }
    return this.heap_get_4_bytes_at_offset(address, 1)
  }

  // wait group implemented as
  // [1 byte tag, 1 byte mutex lock, 3 bytes counter, 2 bytes #size, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_WaitGroup(): number {
    const addr = this.allocate(WAITGROUP_TAG, 1)
    // lock available (set to 1 to acquire)
    this.heap_set_byte_at_offset(addr, 1, 0)
    const otherBits = this.heap_get(addr) & ((1 << 64) - 1 - (((1 << 24) - 1) << 24))
    // set counter to 0
    this.heap_set(addr, otherBits)
    return addr
  }

  private getWaitgroupCounter(address: number): number {
    if (!this.isWaitGroup(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(WAITGROUP_TAG, tag)
    }
    const val = (this.heap_get(address) & (((1 << 24) - 1) << 24)) >> 24
    return val
  }

  // returns true if successfully incremented, false otherwise (i.e. TestAndSet)
  public incrementWaitGroup(address: number, val: number): boolean {
    this.addressCheck(address)
    const acquireLock = this.TestAndSet(address, 1, 1)
    if (!acquireLock) {
      return false // failed to acquire lock, blocked
    }
    const currVal = this.getWaitgroupCounter(address)
    if (val < 0 || currVal + val >= 1 >> 24) {
      throw new WaitGroupCounterOverflowError() // need to ensure that new counter can be written in 3 bytes
    }
    const newVal = currVal + val
    const otherBits = this.heap_get(address) & ((1 << 64) - 1 - (((1 << 24) - 1) << 24))
    this.heap_set(address, (otherBits + newVal) << 24)
    this.heap_set_byte_at_offset(address, 1, 0) // release lock
    return true
  }

  // returns true if successfully decremented, false otherwise (i.e. TestAndSet)
  public decrementWaitGroup(address: number): boolean {
    this.addressCheck(address)
    const acquireLock = this.TestAndSet(address, 1, 1)
    if (!acquireLock) {
      return false // failed to acquire lock, blocked
    }
    const currVal = this.getWaitgroupCounter(address)
    if (currVal <= 0) {
      throw new NegativeWaitGroupCounterError() // counter can never be negative
    }
    const otherBits = this.heap_get(address) & ((1 << 64) - 1 - (((1 << 24) - 1) << 24))
    this.heap_set(address, (otherBits + (currVal - 1)) << 24)
    this.heap_set_byte_at_offset(address, 1, 0) // release lock
    return true
  }

  // used to determine if goroutines blocked at
  public isWaitGroupCounterZero(address: number): boolean {
    return this.getWaitgroupCounter(address) === 0
  }

  private isWaitGroup(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === WAITGROUP_TAG
  }

  // semaphore
  // [1 byte tag, 4 bytes semaphore counter, 2 bytes #children, 1 byte gc + colour]
  // #size = 1
  public heap_allocate_Semaphore(val?: number): number {
    let initVal = 1 // default counter is 1 (binary semaphore) if unspecified
    if (val !== undefined) {
      // set semaphore's initial value to this value
      if (val >= 1 << 32 || val <= 0) {
        throw new InvalidSemaphoreValueError(val) // ensure that semaphore value is between 1 and 255 inclusive
      }
      initVal = val
    }
    const addr = this.allocate(SEMAPHORE_TAG, 1)
    this.heap_set_4_bytes_at_offset(addr, 1, initVal)
    return addr
  }

  // returns true if semaphore acquired, false otherwise
  public semaphoreWait(address: number): boolean {
    if (!this.isSemaphore(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(SEMAPHORE_TAG, tag)
    }
    const currCnt = this.heap_get_4_bytes_at_offset(address, 1)
    if (currCnt == 0) {
      return false
    }
    this.TestAndSetInt32(address, 1, currCnt - 1)
    return true
  }

  // releases semaphore
  public semaphoreSignal(address: number) {
    if (!this.isSemaphore(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(SEMAPHORE_TAG, tag)
    }
    const currCnt = this.heap_get_4_bytes_at_offset(address, 1)
    this.TestAndSetInt32(address, 1, currCnt + 1)
  }

  private isSemaphore(address: number): boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === SEMAPHORE_TAG
  }

  private TestAndSet(address: number, offset: number, val: number): boolean {
    this.addressCheck(address)
    const currVal = this.heap_get_byte_at_offset(address, offset)
    if (currVal === val) {
      return false // nothing to change
    }
    this.heap_set_byte_at_offset(address, offset, val)
    return true // successfully set byte
  }

  private TestAndSetInt32(address: number, offset: number, val: number): boolean {
    this.addressCheck(address)
    const currVal = this.heap_get_4_bytes_at_offset(address, offset)
    if (currVal === val) {
      return false // nothing to change
    }
    this.view.setInt32(address * word_size + offset, val)
    return true // successfully set byte
  }

  private word_to_string(word: number): string {
    const buf = new ArrayBuffer(8)
    const view = new DataView(buf)
    view.setFloat64(0, word)
    let binStr = ''
    for (let i = 0; i < 8; i++) {
      binStr += ('00000000' + view.getUint8(i).toString(2)).slice(-8) + ' '
    }
    return binStr
  }

  public allocate_literals_frame(): number {
    const frame = this.heap_allocate_Frame(literal_keywords.length)
    const literal_addr = [this.true_pos, this.false_pos, this.nil_pos, this.undefined_pos, this.unassigned_pos]
    for (let i = 0; i < 5; ++i) {
      this.heap_set_frame_child(frame, i, literal_addr[i])
    }
    return frame
  }

  public allocate_builtin_frame(): number {
    const frame = this.heap_allocate_Frame(builtin_keywords.length)
    for (let i = 0; i < builtin_keywords.length; ++i) {
      const addr = this.heap_allocate_builtin(i)
      this.heap_set_byte_at_offset(frame + 1 + i, 0, POINTER_TAG)
      this.heap_set_4_bytes_at_offset(frame + 1 + i, 1, addr)
      this.heap_set_2_bytes_at_offset(frame + 1 + i, size_offset, 1)
    }
    return frame
  }

  private addressToValType(address: number): ValType {
    switch (this.heap_get_tag(address)) {
      case INT32_TAG:
        return ValType.Int32
      case STRING_TAG:
        return ValType.String
      case TRUE_TAG:
        return ValType.Boolean
      case FALSE_TAG:
        return ValType.Boolean
      case UINT16_TAG:
        return ValType.Char
      case POINTER_TAG:
        return ValType.Pointer
      case UNASSIGNED_TAG:
        return ValType.Unassigned
      case UNDEFINED_TAG:
        return ValType.Undefined
      case BUILTIN_TAG:
        return ValType.Builtin
    }
    return ValType.Undefined
  }

  public addrToVal(address: number): HeapVal {
    switch (this.heap_get_tag(address)) {
      case INT32_TAG:
        return new HeapVal(this.getInt32(address), ValType.Int32)
      case STRING_TAG:
        return new HeapVal(this.getString(address), ValType.String)
      case TRUE_TAG:
        return new HeapVal(true, ValType.Boolean)
      case FALSE_TAG:
        return new HeapVal(false, ValType.Boolean)
      case UINT16_TAG:
        return new HeapVal(this.getUint16(address), ValType.Char)
      case POINTER_TAG:
        const pointerAddr = this.getPointerAddress(address)
        return new HeapVal(pointerAddr, this.addressToValType(pointerAddr))
      case UNASSIGNED_TAG:
        return new HeapVal(0, ValType.Unassigned)
      case UNDEFINED_TAG:
        return new HeapVal(0, ValType.Undefined)
      case BUILTIN_TAG:
        return new HeapVal(this.heap_get_builtin_id(address), ValType.Builtin)
    }
    return new HeapVal(0, ValType.Undefined)
  }

  public valToAddr(val: HeapVal): number {
    switch (val.type) {
      case ValType.Int32:
        return this.heap_allocate_Int32(val.val as number)
      case ValType.String:
        return this.heap_allocate_string(val.val as string)
      case ValType.Boolean:
        if (val.val as boolean) {
          return this.true_pos
        }
        return this.false_pos
      case ValType.Pointer:
        return val.val as number
      case ValType.Char:
        return this.heap_allocate_Uint16(val.val as number)
      case ValType.Unassigned:
        return this.unassigned_pos
      case ValType.Undefined:
        return this.undefined_pos
      
    }

    throw new InvalidValTypeError()
  }
}
