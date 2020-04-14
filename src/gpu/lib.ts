import { GPU } from 'gpu.js'

export function __createKernel1() {
  const gpu = new GPU()
  const multiplyMatrix = gpu
    .createKernel(function(a, b) {
      let sum = 0
      for (let i = 0; i < 512; i++) {
        sum += a[this.thread.y as any][i] * b[i][this.thread.x]
      }
      return sum
    }, {})
    .setOutput([512, 512])

  return multiplyMatrix([1, 2, 3], [1, 2, 3])
}

function build2DArray(arr: Float32Array[][], end: any): Float32Array[][] {
  const res = []
  for (let i = 0; i < end[0]; i++) {
    res.push(Array.from(arr[i]))
  }
  return res
}

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

export function __createKernel(end: any, extern: any, f: any) {
  const gpu = new GPU()
  const out = { constants: {} }
  out.constants = extern

  console.log(f)

  // function ff(a : any, b : any) {
  //     return a + b;
  // }

  // // const r2 = function() {
  // //     let r = 0;
  // //     for (let j = 0; j < 5; j = j+1) {

  // //     }
  // //     return r + this.constants.y
  // // }

  // gpu.addFunction(ff)

  const g = gpu.createKernel(f, out).setOutput(end)

  console.log(end)
  console.log(out)

  const res = g() as any
  console.log('HIHI')
  console.log(res)

  if (end.length === 1) return Array.from(res)
  else if (end.length === 2) return build2DArray(res, end)
  return build3DArray(res, end)
}
