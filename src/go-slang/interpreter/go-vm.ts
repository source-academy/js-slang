import { Instruction } from '../compiler/instructions'
import { HeapBuffer } from './heap/heap'

class GoVirtualMachine {
  memory: HeapBuffer
  instrs: Instruction[]

  constructor(instrs: Instruction[]) {
    this.instrs = instrs
    this.memory = new HeapBuffer()
  }
}
