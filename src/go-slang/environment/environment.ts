class CompileEnvironment {
  env: EnvironmentSymbol[][]

  public compile_time_environment_position(sym: string): EnvironmentPos {
    let frame_index = this.env.length
    let value_index: number
    while ((value_index = this.get_frame_value_index(--frame_index, sym)) === -1) {}
    return new EnvironmentPos(frame_index, value_index)
  }

  private get_frame_value_index(frame_idx: number, sym: string): number {
    const frame = this.env[frame_idx]
    for (let i = 0; i < frame.length; ++i) {
      if (frame[i].sym === sym) {
        return i
      }
    }
    return -1
  }

  public compile_time_extend_environment(frame: EnvironmentSymbol[]): CompileEnvironment {
    let newEnv = new CompileEnvironment()
    newEnv.env = [...this.env]
    newEnv.env.push(frame)
    return newEnv
  }

  public combineFrames(
    first: EnvironmentSymbol[],
    second: EnvironmentSymbol[]
  ): EnvironmentSymbol[] {
    let seenVars = new Set(first.map(eSym => eSym.sym))
    for (var idents of second) {
      if (idents.sym in seenVars) {
        throw new VariableRedeclaredError(idents.sym)
      }
      seenVars.add(idents.sym)
    }
    return first.concat(second)
  }

  public generateFrame(...vars: EnvironmentSymbol[]): EnvironmentSymbol[] {
    let seenVar = new Set()
    for (var ident of vars) {
      if (ident.sym in seenVar) {
        throw new VariableRedeclaredError(ident.sym)
      }
      seenVar.add(ident.sym)
    }
    return vars
  }
}

class EnvironmentPos {
  env_offset: number
  frame_offset: number

  constructor(frame_index: number, val_index: number) {
    this.env_offset = frame_index
    this.frame_offset = val_index
  }
}

class EnvironmentSymbol {
  sym: string

  constructor(sym: string) {
    this.sym = sym
  }
}

const IgnoreEnvironmentPos = new EnvironmentPos(-1, -1)
const constant_keywords: string[] = ['true', 'false', 'nil']
