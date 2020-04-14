import { GPU } from 'gpu.js'

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

/* main function that runs code on the GPU (using gpu.js library)
 * @end : end bounds for array
 * @extern : external variable definitions {}
 * @f : function run as on GPU threads
 */
export function __createKernel(end: any, extern: any, f: any) {
  const gpu = new GPU()

  // external variables to be in the GPU
  const out = { constants: {} }
  out.constants = extern

  const gpuFunction = gpu.createKernel(f, out).setOutput(end)
  const res = gpuFunction() as any

  if (end.length === 1) return Array.from(res)
  else if (end.length === 2) return build2DArray(res, end)
  return build3DArray(res, end)
}
