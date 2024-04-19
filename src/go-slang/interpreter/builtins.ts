import { HeapBuffer } from '../heap/heap'
import { HeapVal, ValType } from '../heap/heapVals'

export function generateBuiltins(mem: HeapBuffer) {
  let builtins = {
    'make': {
        func: (...x: HeapVal[]) => new HeapVal(0, ValType.Undefined)
    },
    'print': {
        func: (...x: HeapVal[]) => {
            if (x.length > 0) {
                console.log(x[0].val)
            }
            return new HeapVal(0, ValType.Undefined)
        }
    }
  }
  return Object.values(builtins)
}

export const builtin_keywords = ['make', 'print']
