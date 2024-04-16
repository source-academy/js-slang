const word_pow = 3;
const word_size = 1 << word_pow;
const mega = 20;
const gc_offset = 7;
const size_offset = 5;

// const FALSE_TAG = 0;
// const TRUE_TAG = 1;
// const NULL_TAG = 2;
// const UNASSIGNED_TAG = 3;
// const UNDEFINED_TAG = 4;
// const BLOCKFRAME_TAG = 5;
// const CALLFRAME_TAG = 6;
// const CLOSURE_TAG = 7;
const FRAME_TAG = 8;
const ENVIRONMENT_TAG = 9;
// const PAIR_TAG = 10;
// const BUILTIN_TAG = 11;
// const STRING_TAG = 12;
const INT8_TAG = 13; // for future use
const UINT8_TAG = 14;
const INT16_TAG = 15; // for future use
const UINT16_TAG = 16; // for future use
const INT32_TAG = 17;
const UINT32_TAG = 18; // for future use
// const INT64_TAG = 19; // for future use
// const UINT64_TAG = 20; // for future use
const FLOAT32_TAG = 21;
// const FLOAT64_TAG = 22; // for future use
// const GOSTACK_TAG = 23; // use for goroutine stacks (operand stack, runtime stack)

const min_gc_size = 256; // do not trigger gc so long as size used <= 2 * min_gc_size

// 1 byte tag, 4 bytes payload, 2 bytes children, 1 byte (allocated size + gc colour)

export class HeapBuffer {
    heap : ArrayBuffer;
    view : DataView;
    available : number[][];
    heap_pow : number;
    size_last_gc : number;
    curr_used : number;

    constructor(byte_pow?: number) {
        // 1024 bytes should be enough at the very least
        if (byte_pow !== undefined && byte_pow < 10) {
            throw new Error(`byte power must be at least 10`);
        }
        this.heap_pow = byte_pow ?? mega;
        this.heap = new ArrayBuffer(1 << (this.heap_pow + word_pow));
        this.view = new DataView(this.heap);
        this.available = [];
        for (var i = 0; i <= this.heap_pow; ++i) {
            this.available[i] = [];
        }
        this.available[this.heap_pow].push(0);
        this.size_last_gc = min_gc_size // will not trigger gc if curr_used < 2 * size_last_gc
        this.curr_used = 0;
    }

    public allocate(tag : number, size : number) : number {
        if (size <= 0) {
            // ensures that size is a positive number
            throw new InvalidMemRequestedError();
        } 
        let address = this.findMemBlock(size);
        if (address === -1) {
            // memory not found, trigger gc
            this.run_gc();
            // try again
            address = this.findMemBlock(size);
        }
        if (address === -1) {
            // memory not found even after gc, throw error
            throw new MemExhaustedError();
        }
        this.view.setUint8(address * word_size, tag);
        return address;
    }

    // returns available memory block if available, otherwise returns -1
    private findMemBlock(size : number) : number {
        // size is the number of words requested
        let startPos = 0;
        while (startPos <= this.heap_pow && ((1 << startPos) < size || this.available[startPos].length == 0)) {
            startPos += 1;
        }
        if (startPos > this.heap_pow) {
            return -1;
        }

        let currIdx = startPos;
        const address = this.available[currIdx].pop() as number;
        while (currIdx > 0 && (size * 2) <= (1 << currIdx)) {
            // we try to use the smallest unit required, cut out right half for future use
            currIdx--;
            this.available[currIdx].push(address + (word_size << currIdx));
        }
        // for the 8th byte of the first word, first 5 bits encode the power of the memory block
        // size returned (e.g. 256 words -> 8), and the last 2 bits encode the node colour
        // (00 -> white, 01 -> gray, 10 -> black)
        // All newly allocated blocks will be coloured gray
        this.view.setUint8(address * word_size + gc_offset, (currIdx << 3) + 1);
        this.curr_used += (1 << currIdx);
        return address;
    }

    private run_gc() {

    }

    private addressCheck(address : number) {
        if (address < 0 || address >= (word_size << this.heap_pow)) {
            throw new MemOutOfBoundsError();
        }
    }

    // address is word-based (i.e. increment of 1 -> increment of word_size in ArrayBuffer)
    public heap_get(address : number) : number {
        this.addressCheck(address);
        return this.view.getFloat64(address * word_size);
    }
    
    public heap_set(address : number, value : number) {
        this.addressCheck(address);
        this.view.setFloat64(address * word_size, value);
    }

    public heap_get_number_of_children(address : number) {
        const tag = this.heap_get_tag(address);
        const numChildren = this.heap_get_size(address);
        switch (tag) {
            case INT8_TAG || UINT8_TAG || INT16_TAG || UINT16_TAG || INT32_TAG || UINT32_TAG || FLOAT32_TAG:
                return numChildren - 1;
            default:
                return numChildren;
        }
    }

    public heap_get_size(address : number) : number {
        return this.heap_get_2_bytes_at_offset(address * word_size, size_offset);
    }

    private heap_get_allocated_size(address : number) : number {
        // get first 5 bits
        return (this.heap_get_byte_at_offset(address * word_size, gc_offset) & 248) >> 3;
    }

    // child index starts at 0
    public heap_get_child(address : number, child_index : number) : number {
        const numChildren = this.heap_get_number_of_children(address);
        if (child_index >= numChildren) {
            throw new InvalidChildIndexError(child_index, numChildren);
        }
        return this.heap_get(address + 1 + child_index);
    }

    public heap_set_child(address : number, child_index : number, value : number) {
        const numChildren = this.heap_get_number_of_children(address);
        if (child_index >= numChildren) {
            throw new InvalidChildIndexError(child_index, numChildren);
        }
        this.heap_set(address + 1 + child_index, value);
    }

    // returns new address if reallocation required, otherwise returns -1
    public heap_add_child(address : number, value : number) : number {
        const currSize = this.heap_get_size(address);
        const allocated_size = 1 << this.heap_get_allocated_size(address);
        const tag = this.heap_get_tag(address);
        let node_addr = address;
        let return_val = -1;
        switch (tag) {
            case FRAME_TAG || ENVIRONMENT_TAG:
                if (currSize + 1 == allocated_size) {
                    // base node + children, since currSize == number of children
                    node_addr = this.doubleAllocatedSize(address);
                    return_val = node_addr;
                }
                this.heap_set_2_bytes_at_offset(node_addr * word_size, size_offset, currSize + 1);
                this.heap_set_child(node_addr * word_size, currSize, value);
                return return_val;
        }
        throw new CannotAddChildError();
    }

    // reallocates current node to memory block with double size and copies
    // data over; returns new address
    private doubleAllocatedSize(address : number) : number {
        const size = this.heap_get_size(address);
        const allocated_size_pow = this.heap_get_allocated_size(address);
        const tag = this.heap_get_tag(address);
        const new_address = this.allocate(tag, 1 << (allocated_size_pow + 1));
        this.heap_set_2_bytes_at_offset(new_address * word_size, size_offset, size);
        for (var i = 0; i < size - 1; ++i) {
            this.heap_set_child(new_address, i, this.heap_get_child(address, i));
        }
        return new_address;
    }

    public heap_get_tag(address : number) : number {
        this.addressCheck(address);
        return this.view.getUint8(address * word_size)
    }

    public heap_set_byte_at_offset(address : number, offset : number, value : number) {
        this.addressCheck(address);
        if (offset < 0 || offset >= word_size) {
            throw new MemOutOfBoundsError();
        }
        this.view.setUint8(address * word_size + offset, value);
    }

    public heap_get_byte_at_offset(address : number, offset : number) : number {
        this.addressCheck(address);
        if (offset < 0 || offset >= word_size) {
            throw new MemOutOfBoundsError();
        }
        return this.view.getUint16(address * word_size + offset);
    }

    public heap_set_2_bytes_at_offset(address : number, offset : number, value : number) {
        this.addressCheck(address);
        if (offset < 0 || offset >= word_size - 1) {
            throw new MemOutOfBoundsError();
        }
        this.view.setUint16(address * word_size + offset, value);
    }

    public heap_get_2_bytes_at_offset(address : number, offset : number) : number {
        this.addressCheck(address);
        if (offset < 0 || offset >= word_size - 1) {
            throw new MemOutOfBoundsError();
        }
        return this.view.getUint16(address * word_size + offset);
    }
}