import { GPU } from 'gpu.js'
import { TypeError } from '../utils/rttc'
import { parse } from 'acorn'
import { generate } from 'astring'
import * as es from 'estree'
import { gpuFunctionTranspile, gpuRuntimeTranspile } from './transfomer'
import { ACORN_PARSE_OPTIONS } from '../constants'
import { evaluateBinaryExpression } from '../utils/operators'

// Heuristic : Only use GPU if array is bigger than this
const MAX_SIZE = 200

// helper function to get argument for setOutput function
export function getGPUKernelDimensions(
  ctr: string[],
  end: number[],
  initials: number[],
  steps: number[],
  operators: string[],
  idx: (string | number)[]
) {
  const dimMap = {}
  for (let i = 0; i < ctr.length; i++) {
    const op = operators[i] as es.BinaryOperator
    const e = end[i]
    const initial = initials[i]
    const step = steps[i]
    // handle the case where the condition already fails at the start of the loop (initial op end === false)
    if (!evaluateBinaryExpression(op, initial, e)) {
      // then the dimension will be 0
      dimMap[ctr[i]] = 0
    } else {
      // calculate dimension based on step size
      let dimension = Math.ceil((e - initial) / step)
      // handle the operators <= and >=, where the equality condition might cause dimension to be larger by 1
      const finalVal = initial + step * dimension
      if (evaluateBinaryExpression(op, finalVal, e)) {
        dimension += 1
      }
      dimMap[ctr[i]] = dimension
    }
  }
  const used: string[] = []
  const dim: number[] = []
  for (const m of idx) {
    if (typeof m === 'string' && m in dimMap && !used.includes(m)) {
      dim.push(dimMap[m])
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
    for (const a of arrQueue) {
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
  for (const a of arrQueue) {
    if (!Array.isArray(a)) {
      ok = false
      break
    }
  }

  return ok
}

// helper function to assign GPU.js results to original array
export function buildArray(
  arr: any,
  ctr: any,
  end: any,
  initials: any,
  steps: any,
  idx: any,
  ext: any,
  res: any
) {
  buildArrayHelper(arr, ctr, end, initials, steps, idx, ext, res, {})
}

// this is a recursive helper function for buildArray
// it recurses through the indices and determines which subarrays to reassign
function buildArrayHelper(
  arr: any,
  ctr: any,
  end: any,
  initials: any,
  steps: any,
  idx: any,
  ext: any,
  res: any,
  used: any
) {
  // we are guaranteed the types are valid from checkArray
  if (idx.length === 0) {
    return arr
  }

  // look at the first index
  const cur = idx[0]
  if (typeof cur === 'number') {
    // we only need to modify one of the subarrays of res
    res[cur] = buildArrayHelper(arr, ctr, end, initials, steps, idx.slice(1), ext, res[cur], used)
  } else if (typeof cur === 'string' && cur in ext) {
    // index is an external variable, treat as a number constant
    const v = ext[cur]
    res[v] = buildArrayHelper(arr, ctr, end, initials, steps, idx.slice(1), ext, res[v], used)
  } else if (typeof cur === 'string' && ctr.includes(cur) && !(cur in used)) {
    // index is a counter, we need to modify all subarrays of res from index (initial)
    // to the end bound of the counter, incrementing by a given step size
    let initial = undefined
    let step = undefined
    for (let i = 0; i < ctr.length; i++) {
      if (ctr[i] === cur) {
        initial = initials[i]
        step = steps[i]
        break
      }
    }
    // maintain an index for our output array (res), which is different from the index of the GPU result array
    // the GPU result array index (i) starts from 0 and increments by 1
    // our output array index (res_i) starts from initial and increments by step
    let res_i = initial
    for (let i = 0; i < arr.length; i++) {
      const newUsed = { ...used }
      newUsed[cur] = res_i
      res[res_i] = buildArrayHelper(
        arr[i],
        ctr,
        end,
        initials,
        steps,
        idx.slice(1),
        ext,
        res[res_i],
        newUsed
      )
      res_i += step
    }
  } else if (typeof cur === 'string' && ctr.includes(cur) && cur in used) {
    // if the ctr was used as an index before, we need to take the same value
    const v = used[cur]
    res[v] = buildArrayHelper(arr, ctr, end, initials, steps, idx.slice(1), ext, res[v], used)
  }
  return res
}

// If the counter is being decremented rather than incremented by step size, we flip the sign of the step
function modifySteps(steps: any, isIncrements: any) {
  for (let i = 0; i < steps.length; i++) {
    if (!isIncrements[i]) {
      steps[i] = -steps[i]
    }
  }
}

/*
 * This helper function checks that the loops are valid
 * 1. All initial values and step sizes are integers (then array indices will always be integers)
 * 2. The array index is always non-negative from initial to end
 */
export function checkValidLoops(end: any, initials: any, steps: any): boolean {
  for (let i = 0; i < end.length; i++) {
    const e = end[i]
    const initial = initials[i]
    const step = steps[i]

    // 1. All initial values and step sizes are integers
    if (!Number.isInteger(initial) || !Number.isInteger(step)) {
      return false
    }

    // 2. The array index is always non-negative from initial to end
    // The initial and end values must be non-negative
    if (initial < 0 || e < 0) {
      return false
    }
    // The counter must be moving in the direction from initial to end
    if (step === 0 || Math.sign(e - initial) !== Math.sign(step)) {
      return false
    }
  }
  return true
}
/*
 * we only use the gpu if:
 * 1. we are working with numbers
 * 2. we have a large array (> MAX_SIZE elements)
 */
function checkValidGPU(f: any, end: any, dims: any): boolean {
  const args = end.map(() => 0)
  const res = f.apply({}, args)

  // we do not allow array assignment
  // we expect the programmer break it down for us
  if (typeof res !== 'number') {
    return false
  }

  let cnt = 1
  for (let i = 0; i < dims.length; i++) {
    cnt *= dims[i]
  }

  return cnt > MAX_SIZE
}

// just run on js!
function manualRun(
  f: any,
  ctr: any,
  end: any,
  initials: any,
  steps: any,
  operators: any,
  idx: any,
  ext: any,
  res: any
) {
  // generate all variations of counters
  let variants: number[][] = [[]]
  for (let i = 0; i < end.length; i++) {
    const e = end[i]
    const initial = initials[i]
    const step = steps[i]
    const operator = operators[i]

    const newVariant = []
    for (let j = initial; evaluateBinaryExpression(operator, j, e); j += step) {
      for (const p of variants) {
        const t: number[] = [...p]
        t.push(j)
        newVariant.push(t)
      }
    }
    variants = newVariant
  }

  // we run the function for each variation of counters
  for (const p of variants) {
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
      // index should alreday be guaranteed to be a counter, number or external
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
 * @customFunctions: custom functions to be passed to GPU
 */
export function __createKernel(
  ctr: any,
  end: any,
  initials: any,
  steps: any,
  operators: any,
  idx: any,
  extern: any,
  f: any,
  arr: any,
  f2: any,
  customFunctions: any
) {
  const gpu = new GPU()

  // check if the assignment is to a valid array
  if (!checkArray(arr, ctr, end, idx, extern)) {
    throw new TypeError(arr, '', 'object or array', typeof arr)
  }

  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)

  // check if program is valid to run on GPU
  const ok = checkValidGPU(f2, end, kernelDim)
  if (!ok) {
    manualRun(f2, ctr, end, initials, steps, operators, idx, extern, arr)
    return
  }

  // custom functions to be added to GPU
  for (const customFunction of customFunctions) {
    gpu.addFunction(customFunction)
  }
  // external variables to be in the GPU
  const out = { constants: {} }
  out.constants = extern

  const gpuFunction = gpu.createKernel(f, out).setOutput(kernelDim)
  const res = gpuFunction() as any
  buildArray(res, ctr, end, initials, steps, idx, extern, arr)
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
  initials: number[],
  steps: number[],
  operators: string[],
  isIncrements: boolean[],
  idx: (string | number)[],
  externSource: [string, any][],
  localNames: string[],
  arr: any,
  f: any,
  kernelId: number,
  functionEntries: [string, any][]
) {
  modifySteps(steps, isIncrements)
  if (!checkValidLoops(end, initials, steps)) {
    throw 'Loop is invalid'
  }

  const extern = entriesToObject(externSource)
  // Create a set of function names (used in transpilation methods)
  const customFunctionNames = new Set<string>()
  for (const entry of functionEntries) {
    customFunctionNames.add(entry[0])
  }

  // Transpile custom functions into string form
  const customFunctions: string[] = []
  for (const entry of functionEntries) {
    const code = (entry[1] as es.FunctionDeclaration).toString()
    const ast = (parse(code, ACORN_PARSE_OPTIONS) as unknown) as es.Program
    const fn = ast.body[0] as es.FunctionDeclaration
    const fnTranspiled = gpuFunctionTranspile(fn)
    const fnString = generate(fnTranspiled)
    customFunctions.push(fnString)
  }

  const memoizedf = kernels.get(kernelId)
  if (memoizedf !== undefined) {
    return __createKernel(
      ctr,
      end,
      initials,
      steps,
      operators,
      idx,
      extern,
      memoizedf,
      arr,
      f,
      customFunctions
    )
  }

  const code = f.toString()
  // We don't need the full source parser here because it's already validated at transpile time.
  const ast = (parse(code, ACORN_PARSE_OPTIONS) as unknown) as es.Program
  const body = (ast.body[0] as es.ExpressionStatement).expression as es.ArrowFunctionExpression
  const newBody = gpuRuntimeTranspile(
    body,
    new Set(localNames),
    end,
    initials,
    steps,
    idx,
    customFunctionNames
  )
  const kernel = new Function(generate(newBody))

  kernels.set(kernelId, kernel)

  return __createKernel(
    ctr,
    end,
    initials,
    steps,
    operators,
    idx,
    extern,
    kernel,
    arr,
    f,
    customFunctions
  )
}
