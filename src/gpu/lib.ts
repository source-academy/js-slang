import { GPU } from 'gpu.js'
import { TypeError } from '../utils/rttc'
import { parse } from 'acorn'
import { generate } from 'astring'
import * as es from 'estree'
import { gpuRuntimeTranspile } from './transfomer'
import { ACORN_PARSE_OPTIONS } from '../constants'

// Heuristic : Only use GPU if array is bigger than this
const MAX_SIZE = 200

// helper function to get argument for setOutput function
export function getGPUKernelDimensions(ctr: string[], end: number[], idx: (string | number)[]) {
  const endMap = {}
  for (let i = 0; i < ctr.length; i++) {
    endMap[ctr[i]] = end[i]
  }
  const used: string[] = []
  const dim: number[] = []
  for (let m of idx) {
    if (typeof m === 'string' && m in endMap && !used.includes(m)) {
      dim.push(endMap[m])
      used.push(m)
    }
  }
  return dim.reverse()
}

// helper function to check dimensions of array to be reassigned
export function checkArray(arr: any, ctr: any, end: any, idx: any, ext: any) {
  const endMap = {}
  for (let i = 0; i < ctr.length; i++) {
    endMap[ctr[i]] = end[i]
  }

  let ok = true
  let arrQueue = [arr]
  let curIdx

  const checkArrLengths = (start: number, end: number) => {
    const newArrQueue = []
    for (let a of arrQueue) {
      if (!Array.isArray(a) || a.length < end) {
        ok = false
        break
      }
      for (let i = start; i < end; i++) {
        newArrQueue.push(a[i])
      }
    }
    arrQueue = newArrQueue
  }

  // we go through the indices, at each index, we are inspecting a "level" of
  // the array, arrQueue contains all the elements to be inspected at that
  // "level" of the array
  for (let i = 0; i < idx.length - 1; i++) {
    curIdx = idx[i]

    if (typeof curIdx === 'number') {
      // current index is a number, we only need to inspect one element
      checkArrLengths(curIdx, curIdx + 1)
    } else if (typeof curIdx === 'string' && ctr.includes(curIdx)) {
      // current index is a counter, we need to inspect all elements up till the
      // end bound of the counter
      checkArrLengths(0, endMap[curIdx])
    } else if (typeof curIdx === 'string' && curIdx in ext) {
      // current index is an external variable, if it is not a number we throw a
      // TypeError, else we treat it as a number constant
      const v = ext[curIdx]
      if (typeof v !== 'number') {
        throw new TypeError(v, '', 'number', typeof v)
      }
      checkArrLengths(v, v + 1)
    } else {
      // TODO: how to handle this properly?
      // this should never be reached, based on our static transpilation
      throw 'Index should not be a local variable'
    }

    if (!ok) {
      break
    }
  }

  // for the last level of the array, we do not require it to be of a certain
  // length, since Source supports dynamic array resizing
  for (let a of arrQueue) {
    if (!Array.isArray(a)) {
      ok = false
      break
    }
  }

  return ok
}

// helper function to assign GPU.js results to original array
export function buildArray(arr: any, ctr: any, end: any, idx: any, ext: any, res: any) {
  buildArrayHelper(arr, ctr, end, idx, ext, res, {})
}

// this is a recursive helper function for buildArray
// it recurses through the indices and determines which subarrays to reassign
function buildArrayHelper(arr: any, ctr: any, end: any, idx: any, ext: any, res: any, used: any) {
  // we are guranteed the types are valid from checkArray
  if (idx.length === 0) {
    return arr
  }

  // look at the first index
  const cur = idx[0]
  if (typeof cur === 'number') {
    // we only need to modify one of the subarrays of res
    res[cur] = buildArrayHelper(arr, ctr, end, idx.slice(1), ext, res[cur], used)
  } else if (typeof cur === 'string' && cur in ext) {
    // index is an external variable, treat as a number constant
    const v = ext[cur]
    res[v] = buildArrayHelper(arr, ctr, end, idx.slice(1), ext, res[v], used)
  } else if (typeof cur === 'string' && ctr.includes(cur) && !(cur in used)) {
    // index is a counter, we need to modify all subarrays of res from index 0
    // to the end bound of the counter
    let e = undefined
    for (let i = 0; i < ctr.length; i++) {
      if (ctr[i] === cur) {
        e = end[i]
        break
      }
    }
    for (let i = 0; i < e; i++) {
      const newUsed = { ...used }
      newUsed[cur] = i
      res[i] = buildArrayHelper(arr[i], ctr, end, idx.slice(1), ext, res[i], newUsed)
    }
  } else if (typeof cur === 'string' && ctr.includes(cur) && cur in used) {
    // if the ctr was used as an index before, we need to take the same value
    const v = used[cur]
    res[v] = buildArrayHelper(arr, ctr, end, idx.slice(1), ext, res[v], used)
  }
  return res
}

/*
 * we only use the gpu if:
 * 1. we are working with numbers
 * 2. we have a large array (> 100 elements)
 */
function checkValidGPU(f: any, end: any): boolean {
  const args = end.map(() => 0)
  const res = f.apply({}, args)

  // we do not allow array assignment
  // we expect the programmer break it down for us
  if (typeof res !== 'number') {
    return false
  }

  let cnt = 1
  for (const i of end) {
    cnt = cnt * i
  }

  return cnt > MAX_SIZE
}

// just run on js!
function manualRun(f: any, ctr: any, end: any, idx: any, ext: any, res: any) {
  // generate all variations of counters
  let variants: number[][] = [[]]
  for (let e of end) {
    const newVariant = []
    for (let i = 0; i < e; i++) {
      for (let p of variants) {
        const t: number[] = [...p]
        t.push(i)
        newVariant.push(t)
      }
    }
    variants = newVariant
  }

  // we run the function for each variation of counters
  for (let p of variants) {
    const value = f.apply({}, p)

    // we find the location to assign the result in the original array
    let arr = res
    for (let i = 0; i < idx.length - 1; i++) {
      const curIdx = idx[i]
      if (typeof curIdx === 'number') {
        arr = arr[curIdx]
      } else if (typeof curIdx === 'string' && ctr.includes(curIdx)) {
        const v = p[ctr.indexOf(curIdx)]
        arr = arr[v]
      } else if (typeof curIdx === 'string' && curIdx in ext) {
        const v = ext[curIdx]
        arr = arr[v]
      } else {
        // index should alreday be guranteed to be a counter, number or external
        // variable
        throw 'Index must be number, counter or external variable'
      }
    }

    // assign the new result
    const lastIdx = idx[idx.length - 1]
    if (typeof lastIdx === 'number') {
      arr[lastIdx] = value
    } else if (typeof lastIdx === 'string' && ctr.includes(lastIdx)) {
      const v = p[ctr.indexOf(lastIdx)]
      arr[v] = value
    } else if (typeof lastIdx === 'string' && lastIdx in ext) {
      const v = ext[lastIdx]
      arr[v] = value
    } else {
      // index should alreday be guranteed to be a counter, number or external
      // variable
      throw 'Index must be number, counter or external variable'
    }
  }
}

/* main function that runs code on the GPU (using gpu.js library)
 * @ctr: identifiers of loop counters
 * @end : end bounds for array
 * @idx : identifiers/value of array indices
 * @extern : external variable definitions {}
 * @f : function run as on GPU threads
 * @arr : array to be written to
 */
export function __createKernel(
  ctr: any,
  end: any,
  idx: any,
  extern: any,
  f: any,
  arr: any,
  f2: any
) {
  const gpu = new GPU()

  // check if the assignment is to a valid array
  if (!checkArray(arr, ctr, end, idx, extern)) {
    throw new TypeError(arr, '', 'object or array', typeof arr)
  }

  // check if program is valid to run on GPU
  const ok = checkValidGPU(f2, end)
  if (!ok) {
    manualRun(f2, ctr, end, idx, extern, arr)
    return
  }

  const kernelDim = getGPUKernelDimensions(ctr, end, idx)

  // external variables to be in the GPU
  const out = { constants: {} }
  out.constants = extern

  const gpuFunction = gpu.createKernel(f, out).setOutput(kernelDim)
  const res = gpuFunction() as any
  buildArray(res, ctr, end, idx, extern, arr)
}

function entriesToObject(entries: [string, any][]): any {
  const res = {}
  entries.forEach(([key, value]) => (res[key] = value))
  return res
}

/* tslint:disable-next-line:ban-types */
const kernels: Map<number, Function> = new Map()

export function __clearKernelCache() {
  kernels.clear()
}

export function __createKernelSource(
  ctr: string[],
  end: number[],
  idx: (string | number)[],
  externSource: [string, any][],
  localNames: string[],
  arr: any,
  f: any,
  kernelId: number
) {
  const extern = entriesToObject(externSource)

  const memoizedf = kernels.get(kernelId)
  if (memoizedf !== undefined) {
    return __createKernel(ctr, end, idx, extern, memoizedf, arr, f)
  }

  const code = f.toString()
  // We don't need the full source parser here because it's already validated at transpile time.
  const ast = (parse(code, ACORN_PARSE_OPTIONS) as unknown) as es.Program
  const body = (ast.body[0] as es.ExpressionStatement).expression as es.ArrowFunctionExpression
  const newBody = gpuRuntimeTranspile(body, new Set(localNames), end, idx)
  const kernel = new Function(generate(newBody))

  kernels.set(kernelId, kernel)

  return __createKernel(ctr, end, idx, extern, kernel, arr, f)
}
