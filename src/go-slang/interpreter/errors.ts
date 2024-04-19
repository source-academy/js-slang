export class EmptyOsError extends Error {
  constructor() {
    super('OS is empty')
  }
}

export class EmptyRtsError extends Error {
  constructor() {
    super('RTS is empty')
  }
}
