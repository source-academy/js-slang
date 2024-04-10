class CompileEnvironment {
    env : string[][];

    public compile_time_environment_position(sym : string) : EnvironmentPos {
        let frame_index = this.env.length;
        let value_index : number;
        while ((value_index = this.get_frame_value_index(--frame_index, sym)) === -1) {}
        return new EnvironmentPos(frame_index, value_index);
    }

    private get_frame_value_index(frame_idx : number, sym : string) : number {
        const frame = this.env[frame_idx];
        for (let i = 0; i < frame.length; ++i) {
            if (frame[i] === sym) {
                return i;
            }
        }
        return -1;
    }
}

class EnvironmentPos {
    env_offset : number;
    frame_offset : number;

    constructor(frame_index : number, val_index : number) {
        this.env_offset = frame_index;
        this.frame_offset = val_index;
    }
}