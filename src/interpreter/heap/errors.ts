class MemExhaustedError extends Error {
    constructor() {
        super("Memory exhausted");
    }
}

class MemOutOfBoundsError extends Error {
    constructor() {
        super("Address out of bounds");
    }
}

class InvalidMemRequestedError extends Error {
    constructor() {
        super("Invalid amount of memory requested");
    }
}

class InvalidChildIndexError extends Error {
    constructor(childIdx : number, numChildren : number) {
        super(`Child index ${childIdx} requested but node only has ${numChildren} children`);
    }
}

class CannotAddChildError extends Error {
    constructor() {
        super("Data type does not support adding children");
    }
}