export enum SSAType {
    INT8,
    UINT8,
    INT16,
    UINT16,
    INT32,
    UINT32,
    INT64,
    UINT64,
    INT,
    UINT,
    UINTPTR,

    COMPLEX64,
    COMPLEX128,
    FLOAT32,
    FLOAT64,

    BOOL,
    
    PTR32,
    PTR64,

    FUNC,
    SLICE,
    ARRAY,
    STRUCT,
    CHAN,
    MAP,
    INTER,
    FORW,
    ANY,
    STRING,
    UNSAFEPTR,

    IDEAL,
    NIL,
    BLANK,

    FUNCARGS,
    CHANARGS,

    SSA,
    TUPLE,

    NTYPE,
}

// Channel status

export type ChanDir = number;

const ChRecv : ChanDir = 1 << 0;
const ChSend : ChanDir = 1 << 1;
const ChBoth : ChanDir = ChRecv | ChSend;

export function ChCanReceive(chStatus : ChanDir) : boolean {
    return (chStatus & ChRecv) != 0;
}

export function ChCanSend(chStatus : ChanDir) : boolean {
    return (chStatus & ChSend) != 0;
}

export class Type {
    Width: number;

}

class Field {
    flags: number;
    // embedded: number;

}