import { HeapBuffer } from '../heap/heap'
import { HeapVal, ValType } from '../heap/heapVals'

export function generateBuiltins(mem: HeapBuffer) {
  let builtins = {
    make: {
      func: (...x: any[]) => new HeapVal(0, ValType.Undefined)
    }
  }
  return Object.values(builtins)
}

export const builtin_keywords = ['make']
