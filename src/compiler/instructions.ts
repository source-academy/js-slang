enum InstType {
    DONE,
    LDC,
    LD,
    UNOP,
    BINOP,
    JOF,
    GOTO,
    ITER_END,
    FOR_END,
    CALL,
}

class Instruction {
    tag : InstType;

    constructor(tag : InstType) {
        this.tag = tag;
    }
}

class DoneInstruction extends Instruction {
    constructor() {
        super(InstType.DONE);
    }
}

class BasicLitInstruction extends Instruction {
    value: number | string;
    type: Token.token;

    constructor(type : Token.token, value : number | string) {
        super(InstType.LDC);
        this.type = type;
        this.value = value;
    }
}

class IdentInstruction extends Instruction {
    sym: string;
    pos: EnvironmentPos;

    constructor(sym : string, pos : EnvironmentPos) {
        super(InstType.LD);
        this.sym = sym;
        this.pos = pos;
    }
}

class UnOpInstruction extends Instruction {
    op: Token.token;

    constructor(op : Token.token) {
        super(InstType.UNOP);
        this.op = op;
    }
}

class BinOpInstruction extends Instruction {
    op: Token.token;

    constructor(op : Token.token) {
        super(InstType.BINOP);
        this.op = op;
    }
}

class JumpOnFalseInstruction extends Instruction {
    dest: number;

    constructor() {
        super(InstType.JOF);
    }

    setJumpDest(dest : number) {
        this.dest = dest;
    }
}

class GotoInstruction extends Instruction {
    dest : number;

    constructor() {
        super(InstType.GOTO);
    }

    setGotoDest(dest : number) {
        this.dest = dest;
    }
}

class IterEndInstruction extends Instruction {
    constructor() {
        super(InstType.ITER_END);
    }
}

class ForEndInstruction extends Instruction {
    constructor() {
        super(InstType.FOR_END);
    }
}

class CallInstruction extends Instruction {
    arity : number;

    constructor(arity : number) {
        super(InstType.CALL);
        this.arity = arity;
    }
}