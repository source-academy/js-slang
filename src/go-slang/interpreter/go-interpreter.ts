import { Instruction } from "../compiler/instructions";
import { GoRoutineQueue } from "./goroutine";
import { HeapBuffer } from "./heap/heap";

class GoVirtualMachine {
    grQueue : GoRoutineQueue;
    memory : HeapBuffer;

    instrs : Instruction[];

    constructor(instrs : Instruction[]) {
        this.instrs = instrs;
        this.memory = new HeapBuffer();
        this.grQueue = new GoRoutineQueue();
        
    }
}
