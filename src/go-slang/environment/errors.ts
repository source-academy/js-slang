export class VariableRedeclaredError extends Error {
  constructor(sym: string) {
    super(`${sym} has already been declared`)
  }
}

export class InvalidEnvironmentPos extends Error {
  constructor(env: number, frame: number) {
    super(`EnvironmentPos (${env}, ${frame}) is invalid`)
  }
}

export class SymbolNotFoundError extends Error {
  constructor(sym: string) {
    super(`${sym} not found in Environment`)
  }
}
