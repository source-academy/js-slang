import { EnvironmentPos } from '../../environment/environment'
import { GoRoutineQueue } from '../goroutine'
import { InvalidMemRequestedError, MemExhaustedError, MemOutOfBoundsError, InvalidChildIndexError, BadTagError, WaitGroupCounterOverflowError, NegativeWaitGroupCounterError, InvalidSemaphoreValueError } from './errors'

const word_pow = 3
const word_size = 1 << word_pow
const mega = 20
const gc_offset = 7
const size_offset = 5

const FALSE_TAG = 0;
const TRUE_TAG = 1;
const NULL_TAG = 2;
const UNASSIGNED_TAG = 3;
const UNDEFINED_TAG = 4;
const BLOCKFRAME_TAG = 5;
const CALLFRAME_TAG = 6;
const CLOSURE_TAG = 7;
const FRAME_TAG = 8
const ENVIRONMENT_TAG = 9
const PAIR_TAG = 10;
const BUILTIN_TAG = 11;
const STRING_TAG = 12
// const INT8_TAG = 13
const UINT8_TAG = 14
// const INT16_TAG = 15 
// const UINT16_TAG = 16
const INT32_TAG = 17
// const UINT32_TAG = 18 // for future use
// const INT64_TAG = 19; // for future use
// const UINT64_TAG = 20; // for future use
const FLOAT32_TAG = 21
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
    this.heap_set_2_bytes_at_offset(0, gc_offset, this.heap_pow << 3)
    this.size_last_gc = min_gc_size // will not trigger gc if curr_used < 2 * size_last_gc
    this.curr_used = 0
    this.grQueue = new GoRoutineQueue()
  }

  public allocate(tag: number, size: number): number {
    if (size <= 0) {
      // ensures that size is a positive number
      throw new InvalidMemRequestedError()
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
      this.available[currIdx].push(address + (word_size << currIdx))
      this.heap_set_byte_at_offset(address + (word_size << currIdx), gc_offset, currIdx << 3)
    }
    // for the 8th byte of the first word, first 5 bits encode the power of the memory block
    // size returned (e.g. 256 words -> 8), and the last 2 bits encode the node colour
    // (00 -> white, 01 -> gray, 10 -> black)
    // All newly allocated blocks will be coloured gray
    this.heap_set_byte_at_offset(address, gc_offset, (currIdx << 3) + GRAY)
    // set size
    this.heap_set_2_bytes_at_offset(address, size_offset, size)
    this.curr_used += 1 << currIdx
    return address
  }

  private run_gc() {
    for (var thread of this.grQueue.goroutines) {
      if (thread !== null) {
        thread.env.OS.forEach(address => this.mark(address, true))
        this.mark(thread.env.ENV, true)
        this.mark(thread.env.RTS, true)
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
          const pointerAddress =
            this.heap_get_2_bytes_at_offset(address, 1) <<
            (16 + this.heap_get_2_bytes_at_offset(address, 3))
          this.mark(pointerAddress, true)
          if (needColour) {
            this.setColour(address, BLACK)
          }
          break
        default:
          if (needColour) {
            this.setColour(address, GRAY)
          }
          const numChildren = this.heap_get_number_of_children(address)
          for (let i = 0; i < numChildren; ++i) {
            this.mark(address + (1 + i) * word_size, false)
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
      } else {
        this.curr_used += 1 << allocSize
        this.setColour(addr, WHITE)
        addr += 1 << allocSize
      }
    }
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
  public heap_get(address: number): number {
    this.addressCheck(address)
    return this.view.getFloat64(address * word_size)
  }

  public heap_set(address: number, value: number) {
    this.addressCheck(address)
    this.view.setFloat64(address * word_size, value)
  }

  public heap_get_number_of_children(address: number) {
    const numChildren = this.heap_get_size(address)
    return numChildren - 1
  }

  public heap_get_size(address: number): number {
    return this.heap_get_2_bytes_at_offset(address * word_size, size_offset)
  }

  private heap_get_allocated_size(address: number): number {
    // get first 5 bits
    return (this.heap_get_byte_at_offset(address * word_size, gc_offset) & 248) >> 3
  }

  private heap_get_colour(address: number): number {
    return this.heap_get_byte_at_offset(address * word_size, gc_offset) & 3
  }

  // child index starts at 0
  public heap_get_child(address: number, child_index: number): number {
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

  public heap_get_tag(address: number): number {
    this.addressCheck(address)
    return this.view.getUint8(address * word_size)
  }

  public heap_set_byte_at_offset(address: number, offset: number, value: number) {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size) {
      throw new MemOutOfBoundsError()
    }
    this.view.setUint8(address * word_size + offset, value)
  }

  public heap_get_byte_at_offset(address: number, offset: number): number {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size) {
      throw new MemOutOfBoundsError()
    }
    return this.view.getUint16(address * word_size + offset)
  }

  public heap_set_2_bytes_at_offset(address: number, offset: number, value: number) {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 1) {
      throw new MemOutOfBoundsError()
    }
    this.view.setUint16(address * word_size + offset, value)
  }

  public heap_get_2_bytes_at_offset(address: number, offset: number): number {
    this.addressCheck(address)
    if (offset < 0 || offset >= word_size - 1) {
      throw new MemOutOfBoundsError()
    }
    return this.view.getUint16(address * word_size + offset)
  }

  private isFalse(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FALSE_TAG
  }

  private isTrue(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === TRUE_TAG
  }

  private isBoolean(address : number) : boolean {
    return this.isTrue(address) || this.isFalse(address)
  }

  private isUnassigned(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UNASSIGNED_TAG
  }

  private isUndefined(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UNDEFINED_TAG
  }

  public allocateLiteralValues() : any {
    const output : any = {}
    output["false"] = this.allocate(FALSE_TAG, 1)
    output["true"] = this.allocate(TRUE_TAG, 1)
    output["nil"] = this.allocate(NULL_TAG, 1)
    output["*unassigned*"] = this.allocate(UNASSIGNED_TAG, 1)
    output["*undefined*"] = this.allocate(UNDEFINED_TAG, 1)
    return output
  }

  private isBuiltin(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === BUILTIN_TAG
  }

  // builtin id encoded in second byte [1 byte tag, 1 byte id, 3 bytes unused,
  // 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_builtin(id : number) : number {
    const address = this.allocate(BUILTIN_TAG, 1)
    this.heap_set_byte_at_offset(address, 1, id)
    return address
  }

  public heap_get_builtin_id(address : number) : number {
    if (!this.isBuiltin(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(BUILTIN_TAG, tag)
    }
    return this.heap_get_byte_at_offset(address, 1)
  }

  // closure
  // [1 byte tag, 1 byte arity, 3 bytes pc, 2 bytes #children, 1 byte gc + colour]
  // #children = 1 (pointer to env)
  public heap_allocate_Closure(arity : number, pc : number, envAddr : number) : number {
    const address = this.allocate(CLOSURE_TAG, 2)
    this.heap_set_byte_at_offset(address, 1, arity)
    const otherBits = this.heap_get(address) & ((1 << 64) - 1 - (((1 << 24) - 1)) << 24)
    this.heap_set(address, otherBits + (pc << 24))
    // we initialise value pointer ourselves to avoid additional allocation
    const envPointer = (POINTER_TAG << 56) + (envAddr << 24)
    this.heap_set_child(address, 0, envPointer)
    return address
  }

  public heap_get_Closure_arity(address : number) : number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return this.heap_get_byte_at_offset(address, 1)
  }

  public heap_get_Closure_pc(address : number) : number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return (this.heap_get(address) & (((1 << 24) - 1) << 24)) >> 24
  }

  public heap_get_Closure_env(address : number) : number {
    if (!this.isClosure(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CLOSURE_TAG, tag)
    }
    return this.getPointerAddress(address + 1)
  }

  public isClosure(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === CLOSURE_TAG
  }

  // block frame
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Blockframe(envAddr : number) : number {
    const addr = this.allocate(BLOCKFRAME_TAG, 1)
    const otherBits = this.heap_get(addr) & ((1 << 64) - 1 - (((1 << 32) - 1) << 16))
    this.heap_set(addr, otherBits + (envAddr << 16))
    return addr
  }

  public heap_get_Blockframe_environment(address : number) : number {
    if (!this.isBlockframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(BLOCKFRAME_TAG, tag)
    }
    const addr = (this.heap_get(address) & (((1 << 32) - 1) << 16)) >> 16
    return addr
  }

  public isBlockframe(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === BLOCKFRAME_TAG
  }

  // callframe
  // [1 byte tag, 1 byte unused, 3 bytes pc, 2 bytes #children, 1 byte gc + colour]
  // #children = 1
  // followed by pointer to env
  public heap_allocate_Callframe(pc : number, envAddr : number) : number {
    const address = this.allocate(CALLFRAME_TAG, 2)
    const otherBits = this.heap_get(address) & ((1 << 64) - 1 - (((1 << 24) - 1)) << 24)
    this.heap_set(address, otherBits + (pc << 24))
    // we initialise value pointer ourselves to avoid additional allocation
    const envPointer = (POINTER_TAG << 56) + (envAddr << 24)
    this.heap_set_child(address, 0, envPointer)
    return address
  }

  public heap_get_Callframe_pc(address : number) : number {
    if (!this.isCallframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CALLFRAME_TAG, tag)
    }
    return (this.heap_get(address) & (((1 << 24) - 1) << 24)) >> 24
  }

  public heap_get_Callframe_env(address : number) : number {
    if (!this.isCallframe(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(CALLFRAME_TAG, tag)
    }
    return this.getPointerAddress(address + 1)
  }

  public isCallframe(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === CALLFRAME_TAG
  }

  // environment frame
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte gc + colour]
  // followed by addresses of values
  public heap_allocate_Frame(numValues : number) : number {
    return this.allocate(FRAME_TAG, numValues + 1)
  }

  public heap_Frame_display(address : number) {
    if (!this.isFrame(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(FRAME_TAG, tag)
    }
    console.log("Frame:")
    const size = this.heap_get_number_of_children(address)
    console.log("Frame size: %d", size)
    for (let i = 0; i < size; ++i) {
      const value = this.heap_get_child(address, i)
      console.log("%d: Value address: %d, Value: %d", i, value, this.word_to_string(value))
    }
  }

  public isFrame(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FRAME_TAG
  }

  // environment
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte gc + colour]
  // #children = number of frames
  // followed by addresses of frames
  public heap_allocate_Environment(numFrames : number) : number {
    return this.allocate(ENVIRONMENT_TAG, numFrames + 1)
  }

  public heap_get_Environment_value(envAddr : number, pos : EnvironmentPos) : number {
    if (!this.isEnvironment(envAddr)) {
      const tag = this.heap_get_tag(envAddr)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const frame_addr = this.heap_get_child(envAddr, pos.env_offset)
    return this.heap_get_child(frame_addr, pos.frame_offset);
  }

  public heap_set_Environment_value(envAddr : number, pos : EnvironmentPos, val : number) {
    if (!this.isEnvironment(envAddr)) {
      const tag = this.heap_get_tag(envAddr)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const frame_addr = this.heap_get_child(envAddr, pos.env_offset)
    this.heap_set_child(frame_addr, pos.frame_offset, val)
  }

  // extends given environment by new frame
  // creates a new environment bigger by 1 frame slot than the given environment
  // copy the frame addresses of given environment into the new environment
  // new frame appended at the end of the environment
  public heap_Environment_extend(frame_addr : number, env_addr : number) : number {
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
  public heap_Environment_display(address : number) {
    if (!this.isEnvironment(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(ENVIRONMENT_TAG, tag)
    }
    const size = this.heap_get_number_of_children(address)
    console.log("Environment")
    console.log("Environment size: %d", size)
    for (let i = 0; i < size; ++i) {
      console.log("Frame %d:", i)
      const frame = this.heap_get_child(address, i)
      this.heap_Frame_display(frame)
    }
  }

  private isEnvironment(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === ENVIRONMENT_TAG
  }

  // pair
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte gc + colour]
  // #children = 2
  // followed by head and tail addresses
  // pass in address of head and tail objects
  public heap_allocate_Pair(head_addr: number, tail_addr: number) : number {
    const addr = this.allocate(PAIR_TAG, 3)
    const headPtr = (POINTER_TAG << 56) + (head_addr << 24)
    const tailPtr = (POINTER_TAG << 56) + (tail_addr << 24)
    this.heap_set_child(addr, 0, headPtr)
    this.heap_set_child(addr, 1, tailPtr)
    return addr
  }

  private isPair(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === PAIR_TAG
  }

  // Uint8 can be used to represent char variables
  // [1 byte tag, 3 bytes unused, 1 byte uint8 value, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Uint8(val : number) {
    const addr = this.allocate(UINT8_TAG, 1)
    this.heap_set_byte_at_offset(addr, 4, val)
  }

  public getUint8(address : number) : number {
    if (!this.isUint8) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(INT32_TAG, tag)
    }
    const val = (this.heap_get(address) & (((1 << 8) - 1) << 24)) >> 24
    return val
  }

  private isUint8(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === UINT8_TAG
  }

  // Int32 represents the standard int
  // [1 byte tag, 4 bytes int32 val, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Int32(val : number) : number {
    const addr = this.allocate(INT32_TAG, 1)
    const otherBits = ((1 << 64) - 1) - (((1 << 32) - 1) << 24)
    this.heap_set(addr, otherBits + val << 24)
    return addr
  }

  public getInt32(addr : number) : number {
    if (!this.isInt32) {
      const tag = this.heap_get_tag(addr)
      throw new BadTagError(INT32_TAG, tag)
    }
    const val = (this.heap_get(addr) & (((1 << 32) - 1) << 24)) >> 24
    return val
  }

  private isInt32(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === INT32_TAG
  }

  // Flaot32 represents the standard float
  // [1 byte tag, 4 bytes float32 val, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Float32(val : number) : number {
    const addr = this.allocate(FLOAT32_TAG, 1)
    // write directly to DataView to guarantee that 32 bits are written
    this.view.setFloat32(addr * word_size + 1, val)
    return addr
  }

  public getFloat32(addr : number) : number {
    if (!this.isFloat32) {
      const tag = this.heap_get_tag(addr)
      throw new BadTagError(FLOAT32_TAG, tag)
    }
    const val = (this.heap_get(addr) & (((1 << 32) - 1) << 24)) >> 24
    return val
  }

  private isFloat32(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === FLOAT32_TAG
  }



  // pointer
  // [1 byte tag, 4 bytes address, 2 bytes #children, 1 byte gc + colour]
  // # children = 0
  public heap_allocate_pointer(address : number) : number {
    const pAddr = this.allocate(POINTER_TAG, 1)
    const otherBits = this.heap_get(pAddr) & ((1 << 64) - 1 - (((1 << 32) - 1) << 16))
    this.heap_set(pAddr, otherBits + (address << 16))
    return pAddr
  }

  public isPointer(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === POINTER_TAG
  }

  public getPointerAddress(address : number) : number {
    if (!this.isPointer(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(POINTER_TAG, tag)
    }
    const addr = (this.heap_get(address) & (((1 << 32) - 1) << 16)) >> 16
    return addr
  }

  // wait group implemented as 
  // [1 byte tag, 1 byte mutex lock, 3 bytes counter, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_WaitGroup() : number {
    const addr = this.allocate(WAITGROUP_TAG, 1)
    // lock available (set to 1 to acquire)
    this.heap_set_byte_at_offset(addr, 1, 0)
    const otherBits = this.heap_get(addr) & ((1 << 64) - 1 - (((1 << 24) - 1) << 24))
    // set counter to 0
    this.heap_set(addr, otherBits)
    return addr
  }

  private getWaitgroupCounter(address : number) : number {
    if (!this.isWaitGroup(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(WAITGROUP_TAG, tag)
    }
    const val = (this.heap_get(address) & (((1 << 24) - 1) << 24)) >> 24
    return val
  }

  // returns true if successfully incremented, false otherwise (i.e. TestAndSet)
  public incrementWaitGroup(address : number, val : number) : boolean {
    this.addressCheck(address)
    const acquireLock = this.TestAndSet(address, 1, 1)
    if (!acquireLock) {
      return false // failed to acquire lock, blocked
    }
    const currVal = this.getWaitgroupCounter(address)
    if (val < 0 || currVal + val >= (1 >> 24)) {
      throw new WaitGroupCounterOverflowError() // need to ensure that new counter can be written in 3 bytes
    }
    const newVal = currVal + val
    const otherBits = this.heap_get(address) & ((1 << 64) - 1 - (((1 << 24) - 1) << 24))
    this.heap_set(address, otherBits + newVal << 24)
    this.heap_set_byte_at_offset(address, 1, 0) // release lock
    return true
  }

  // returns true if successfully decremented, false otherwise (i.e. TestAndSet)
  public decrementWaitGroup(address : number) : boolean {
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
    this.heap_set(address, otherBits + (currVal - 1) << 24)
    this.heap_set_byte_at_offset(address, 1, 0) // release lock
    return true
  }

  // used to determine if goroutines blocked at 
  public isWaitGroupCounterZero(address : number) : boolean {
    return this.getWaitgroupCounter(address) === 0
  }

  private isWaitGroup(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === WAITGROUP_TAG
  }

  // semaphore
  // [1 byte tag, 4 bytes semaphore counter, 2 bytes #children, 1 byte gc + colour]
  // #children = 0
  public heap_allocate_Semaphore(val? : number) : number {
    let initVal = 1 // default counter is 1 (binary semaphore) if unspecified
    if (val !== undefined) {
      // set semaphore's initial value to this value
      if (val >= 255 || val <= 0) {
        throw new InvalidSemaphoreValueError(val) // ensure that semaphore value is between 1 and 255 inclusive
      }
      initVal = val
    }
    const addr = this.allocate(SEMAPHORE_TAG, 1)
    this.view.setInt32(addr * word_size + 1, initVal)
    return addr
  }

  // returns true if semaphore acquired, false otherwise
  public semaphoreWait(address : number) : boolean {
    if (!this.isSemaphore(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(SEMAPHORE_TAG, tag)
    }
    const currCnt = (this.heap_get(address) & (((1 << 32) - 1) << 24)) >> 24
    if (currCnt == 0) {
      return false
    }
    this.TestAndSetInt32(address, 1, currCnt - 1)
    return true
  }

  // releases semaphore
  public semaphoreSignal(address : number) {
    if (!this.isSemaphore(address)) {
      const tag = this.heap_get_tag(address)
      throw new BadTagError(SEMAPHORE_TAG, tag)
    }
    const currCnt = (this.heap_get(address) & (((1 << 32) - 1) << 24)) >> 24
    this.TestAndSetInt32(address, 1, currCnt + 1)
  }

  private isSemaphore(address : number) : boolean {
    this.addressCheck(address)
    return this.heap_get_tag(address) === SEMAPHORE_TAG
  }

  private TestAndSet(address : number, offset: number, val : number) : boolean {
    this.addressCheck(address)
    const currVal = this.heap_get_byte_at_offset(address, offset)
    if (currVal === val) {
      return false // nothing to change
    }
    this.heap_set_byte_at_offset(address, offset, val)
    return true // successfully set byte
  }

  private TestAndSetInt32(address : number, offset: number, val : number) : boolean {
    this.addressCheck(address)
    const currVal = this.view.getInt32(address * word_size + offset)
    if (currVal === val) {
      return false // nothing to change
    }
    this.view.setInt32(address * word_size + offset, val)
    return true // successfully set byte
  }

  private word_to_string(word : number) : string {
    const buf = new ArrayBuffer(8)
    const view = new DataView(buf)
    view.setFloat64(0, word)
    let binStr = ''
    for (let i = 0; i < 8; i++) {
      binStr += ('00000000' + 
                 view.getUint8(i).toString(2)).slice(-8) + 
                 ' ';
    }
    return binStr
  }
}
