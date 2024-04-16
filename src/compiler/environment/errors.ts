class VariableRedeclaredError extends Error {
  constructor(sym: string) {
    super(`${sym} has already been declared`)
  }
}

class InvalidEnvironmentPos extends Error {
  constructor(pos: EnvironmentPos) {
    super(`EnvironmentPos (${pos.env_offset}, ${pos.frame_offset}) is invalid`)
  }
}
