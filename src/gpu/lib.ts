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

/* main function that runs code on the GPU (using gpu.js library)
 * @end : end bounds for array
 * @extern : external variable definitions {}
 * @f : function run as on GPU threads
 * @arr : array to be written to
 */
export function __createKernel(end: any, extern: any, f: any, arr: any) {
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

  // external variables to be in the GPU
  const out = { constants: {} }
  out.constants = extern

  const gpuFunction = gpu.createKernel(f, out).setOutput(end)
  const res = gpuFunction() as any

  if (end.length === 1) return Array.from(res)
  if (end.length === 2) return build2DArray(res, end)
  return build3DArray(res, end)
}
