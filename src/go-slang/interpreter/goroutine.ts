type address = number

export class GoRoutine {
  OS: address[]
  ENV: address
  RTS: address[]
  PC: number
  blocked: boolean
  terminate: boolean
  spawnNewRoutine: boolean
  newRoutinePC: number
  id: number

  constructor(env: number, id: number, pc?: number) {
    this.OS = []
    this.RTS = []
    this.ENV = env
    this.PC = pc === undefined ? 0 : pc
    this.blocked = false
    this.terminate = false
    this.id = id
  }
}

export class GoRoutineQueue {
  capacity: number
  startPos: number
  size: number
  goroutines: GoRoutine[]

  constructor() {
    this.capacity = 64
    this.startPos = 0
    this.size = 0
    this.goroutines = new Array(64).fill(undefined)
  }

  push(routine: GoRoutine) {
    if (this.size === this.capacity) {
      this.resizeQueue()
    }
    this.goroutines[(this.startPos + this.size) % this.capacity] = routine
    this.size++
  }

  pop(): GoRoutine | undefined {
    if (this.goroutines[this.startPos] === undefined) {
      return undefined
    }
    const retRoutine = this.goroutines[this.startPos]
    this.startPos = (this.startPos + 1) % this.capacity
    this.size--
    return retRoutine
  }

  isEmpty(): boolean {
    return this.size === 0
  }

  peek(): GoRoutine | undefined {
    if (!this.isEmpty()) {
      return this.goroutines[this.startPos]
    }
    return undefined
  }

  private resizeQueue() {
    const newQueue = new Array(this.capacity * 2).fill(undefined)
    for (let i = 0; i < this.capacity; ++i) {
      newQueue[i] = this.goroutines[(this.startPos + i) % this.capacity]
    }
    this.capacity *= 2
    this.startPos = 0
    this.goroutines = newQueue
  }
}
