type address = number;

export class GoRoutine {
    env: GoRoutineEnv;
    PC: number;       
}

class GoRoutineEnv {
    OS: address[];
    ENV: address;
    RTS: address;
}

class GoRoutineQueue {
    capacity: number;
    startPos: number;
    goroutines: GoRoutine[];


    
}