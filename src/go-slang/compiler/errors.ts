export class UnsupportedInstructionError extends Error {
  constructor() {
    super('Node not supported')
  }
}

export class IllegalInstructionError extends Error {
  constructor() {
    super('Illegal expression!')
  }
}
