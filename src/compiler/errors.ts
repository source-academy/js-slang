class UnsupportedInstructionError extends Error {
  constructor() {
    super('Node not supported')
  }
}

class IllegalInstructionError extends Error {
  constructor() {
    super('Illegal expression!')
  }
}
