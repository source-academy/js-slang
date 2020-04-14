import { GPU } from 'gpu.js'
import { TypeError } from '../utils/rttc'

// helper function to build 2D array output
function build2DArray(arr: Float32Array[][], end: any): Float32Array[][] {
  const res = []
  for (let i = 0; i < end[0]; i++) {
    res.push(Array.from(arr[i]))
  }
  return res
}

// helper function to build 3D array output
function build3DArray(arr: Float32Array[][][], end: any): Float32Array[][][] {
  const res = []
  for (let i = 0; i < end[0]; i++) {
    const res1 = []
    for (let j = 0; j < end[1]; j++) {
      res1.push(Array.from(arr[i][j]))
    }
    res.push(res1)
  }
  return res
}

// helper function to check array is initialized
function checkArray(arr: any): boolean {
  return Array.isArray(arr)
}

// helper function to check 2D array is initialized
function checkArray2D(arr: any, end: any): boolean {
  for (let i = 0; i < end[0]; i = i + 1) {
    for (let j = 0; j < end[1]; j = j + 1) {
      if (arr[i] === undefined) return false
    }
  }
  return true
}

// helper function to check 3D array is initialized
function checkArray3D(arr: any, end: any): boolean {
  for (let i = 0; i < end[0]; i = i + 1) {
    for (let j = 0; j < end[1]; j = j + 1) {
      for (let k = 0; k < end[2]; k = k + 1) {
        if (arr[i][j] === undefined) return false
      }
    }
  }
  return true
}

/*
 * we only use the gpu if:
 * 1. we are working with numbers
 * 2. we have a large array (> 100 elements)
 */
function checkValidGPU(f: any, end: any): boolean {
  let res: any
  if (end.length === 1) res = f(0)
  if (end.length === 2) res = f(0, 0)
  if (end.length === 3) res = f(0, 0, 0)

  if (typeof res !== 'number') {
    return false
  }

  let cnt = 1
  for (const i of end) {
    cnt = cnt * i
  }

  return cnt > 100
}

// just run on js!
function manualRun(f: any, end: any) {
  function build() {
    const res = []
    for (let i = 0; i < end[0]; i++) {
      res[i] = f(i)
    }
    return res
  }

  function build2D() {
    const res = [] as any
    for (let i = 0; i < end[0]; i = i + 1) {
      res[i] = []
      for (let j = 0; j < end[1]; j = j + 1) {
        res[i][j] = f(i, j)
      }
    }
    return res
  }

  function build3D() {
    const res = [] as any
    for (let i = 0; i < end[0]; i = i + 1) {
      res[i] = []
      for (let j = 0; j < end[1]; j = j + 1) {
        res[j] = []
        for (let k = 0; k < end[2]; k = k + 1) {
          res[i][j][k] = f(i, j, k)
        }
      }
    }
    return res
  }

  if (end.length === 1) return build()
  if (end.length === 2) return build2D()
  return build3D()
}

/* main function that runs code on the GPU (using gpu.js library)
 * @end : end bounds for array
 * @extern : external variable definitions {}
 * @f : function run as on GPU threads
 * @arr : array to be written to
 */
export function __createKernel(end: any, extern: any, f: any, arr: any, f2: any) {
  const gpu = new GPU()

  // check array is initialized properly
  let ok = checkArray(arr)
  let err = ''
  if (!ok) {
    err = typeof arr
  }

  // TODO: find a cleaner way to do this
  if (end.length > 1) {
    ok = ok && checkArray2D(arr, end)
    if (!ok) {
      err = 'undefined'
    }
  }

  if (end.length > 2) {
    ok = ok && checkArray3D(arr, end)
    if (!ok) {
      err = 'undefined'
    }
  }

  if (!ok) {
    throw new TypeError(arr, '', 'object or array', err)
  }

  // check if program is valid to run on GPU
  ok = checkValidGPU(f2, end)
  if (!ok) {
    return manualRun(f2, end)
  }

  // external variables to be in the GPU
  const out = { constants: {} }
  out.constants = extern

  const gpuFunction = gpu.createKernel(f, out).setOutput(end)
  const res = gpuFunction() as any

  if (end.length === 1) return Array.from(res)
  if (end.length === 2) return build2DArray(res, end)
  return build3DArray(res, end)
}
