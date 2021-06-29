export enum Mode {
    Concrete,
    Loop,
    Function,
    Stream
}

export interface State {
    mode: Mode
    // TODO: name of function
    // TODO: function stack (with iterations) (+ count number of inner loops)
    // TODO: whichloopamiin stack (^) (*<- space considerations here??)
    // TODO: cache
    // TODO: threshold??
}

export const initState = () => ({
    mode: Mode.Loop
}) as State

