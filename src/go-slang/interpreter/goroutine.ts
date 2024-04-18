type address = number

export class GoRoutine {
  env: GoRoutineEnv
  PC: number
}

class GoRoutineEnv {
  OS: address[]
  ENV: address
  RTS: address
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
    this.goroutines = new Array(64).fill(null)
  }

  push(routine: GoRoutine) {
    if (this.size === this.capacity) {
      this.resizeQueue()
    }
    this.goroutines[(this.startPos + this.size) % this.capacity] = routine
    this.size++
  }

  pop(): GoRoutine | undefined {
    if (this.goroutines[this.startPos] == null) {
      return undefined
    }
    const retRoutine = this.goroutines[this.startPos]
    this.startPos = (this.startPos + 1) % this.capacity
    this.size--
    return retRoutine
  }

  private resizeQueue() {
    const newQueue = new Array(this.capacity * 2).fill(null)
    for (let i = 0; i < this.capacity; ++i) {
      newQueue[i] = this.goroutines[(this.startPos + i) % this.capacity]
    }
    this.capacity *= 2
    this.startPos = 0
    this.goroutines = newQueue
  }
}
