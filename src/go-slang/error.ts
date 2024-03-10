import { RuntimeSourceError } from '../errors/runtimeSourceError'

export class UnknownInstructionError extends RuntimeSourceError {
  private inst_type: string

  constructor(inst_type: string) {
    super()
    this.inst_type = inst_type
  }

  public explain() {
    return `Unknown instruction ${this.inst_type}.`
  }

  public elaborate() {
    return `The instruction ${this.inst_type} is not supported by the interpreter. This is likely a bug in the interpreter. Please report this issue.`
  }
}
