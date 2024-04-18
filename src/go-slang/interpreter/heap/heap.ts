import { GoRoutineQueue } from "../goroutine"

const word_pow = 3
const word_size = 1 << word_pow
const mega = 20
const gc_offset = 7
const size_offset = 5

// const FALSE_TAG = 0;
// const TRUE_TAG = 1;
// const NULL_TAG = 2;
// const UNASSIGNED_TAG = 3;
// const UNDEFINED_TAG = 4;
// const BLOCKFRAME_TAG = 5;
// const CALLFRAME_TAG = 6;
// const CLOSURE_TAG = 7;
const FRAME_TAG = 8
const ENVIRONMENT_TAG = 9
// const PAIR_TAG = 10;
// const BUILTIN_TAG = 11;
const STRING_TAG = 12;
const INT8_TAG = 13 // for future use
const UINT8_TAG = 14
const INT16_TAG = 15 // for future use
const UINT16_TAG = 16 // for future use
const INT32_TAG = 17
const UINT32_TAG = 18 // for future use
// const INT64_TAG = 19; // for future use
// const UINT64_TAG = 20; // for future use
const FLOAT32_TAG = 21
// const FLOAT64_TAG = 22; // for future use
const CHANNEL_TAG = 23
const POINTER_TAG = 24

const min_gc_size = 256 // do not trigger gc so long as size used <= 2 * min_gc_size


const WHITE = 0; // node not visited (yet)
const GRAY = 1; // node visited but children not fully mapped yet
const BLACK = 2; // node + children visited

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
    this.grQueue = new GoRoutineQueue();
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
    while (currIdx > 0 && size * 2 <= (1 << currIdx)) {
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
    this.curr_used += 1 << currIdx
    return address
  }

  private run_gc() {
    for (var thread of this.grQueue.goroutines) {
      if (thread !== null) {
        thread.env.OS.forEach(address => this.mark(address, true));
        this.mark(thread.env.ENV, true);
        this.mark(thread.env.RTS, true);
      }
    }
    let addr = 0;
    const heapsize = 1 << this.heap_pow;
    // find all gray non-child nodes and mark them as black
    for (addr; addr < heapsize;) {
      const colour = this.heap_get_colour(addr);
      if (colour === GRAY) {
        this.mark(addr, true, true);
      }
      const allocSize = 1 << this.heap_get_allocated_size(addr);
      addr += allocSize;
    }
    this.sweep();
  }

  // needColour is used to indicate whether the current address needs to be coloured
  // the sweep algorithm will jump over the block if it sees black, hence children
  // nodes will not be uncoloured
  private mark(address : number, needColour: boolean, process_gray?: boolean) {
    const colour = this.heap_get_colour(address);
    if (colour === WHITE || (process_gray === true && colour === GRAY)) {
      const nodeTag = this.heap_get_tag(address);
      switch (nodeTag) {
        case STRING_TAG:
          if (needColour) {
            // do not iterate through children (which contain letters packed together)
            this.setColour(address, BLACK)
          }
          return;
        case CHANNEL_TAG:
          // first 8 bytes of channel: 1 byte tag, 1 byte lock (test and set), 1 byte startIdx, 
          // 1 byte channelSize, 1 byte empty, 2 bytes numChildren/channel capacity, 1 byte gc + colour
          const channelCap = this.heap_get_number_of_children(address);
          const startPos = this.heap_get_byte_at_offset(address, 2);
          const numItems = this.heap_get_byte_at_offset(address, 3);

          if (needColour) {
            this.setColour(address, GRAY);
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
          const pointerAddress = this.heap_get_2_bytes_at_offset(address, 1) << 16 + this.heap_get_2_bytes_at_offset(address, 3)
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
            this.mark(address + (1 + i) * word_size, false);
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
    this.curr_used = 0;
    let addr = 0;
    const heapsize = 1 << this.heap_pow;
    for (addr; addr < heapsize;) {
      const colour = this.heap_get_colour(addr);
      const allocSize = this.heap_get_allocated_size(addr);
      if (colour === WHITE) {
        let currPow = allocSize
        let currAddr = addr
        // since we sweep from left to right, left buddy is the last entry for the current row if it is free
        while (currPow < this.heap_pow) {
          const buddy = currAddr ^ (1 << currPow);
          if (this.available[currPow].length > 0 && this.available[currPow][this.available[currPow].length - 1] === buddy) {
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
        this.curr_used += 1 << allocSize;
        this.setColour(addr, WHITE);
        addr += 1 << allocSize;
      }
    }
  }

  private setColour(address : number, colour : number) {
    const gcByte = this.heap_get_byte_at_offset(address, gc_offset);
    this.heap_set_byte_at_offset(address, gc_offset, (gcByte & 248) | colour);
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
    const tag = this.heap_get_tag(address)
    const numChildren = this.heap_get_size(address)
    switch (tag) {
      case INT8_TAG ||
        UINT8_TAG ||
        INT16_TAG ||
        UINT16_TAG ||
        INT32_TAG ||
        UINT32_TAG ||
        FLOAT32_TAG ||
        CHANNEL_TAG:
        return numChildren - 1
      default:
        return numChildren
    }
  }

  public heap_get_size(address: number): number {
    return this.heap_get_2_bytes_at_offset(address * word_size, size_offset)
  }

  private heap_get_allocated_size(address: number): number {
    // get first 5 bits
    return (this.heap_get_byte_at_offset(address * word_size, gc_offset) & 248) >> 3
  }

  private heap_get_colour(address: number): number {
    return (this.heap_get_byte_at_offset(address * word_size, gc_offset) & 3);
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
}
