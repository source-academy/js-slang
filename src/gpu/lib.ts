import { GPU } from 'gpu.js'

export function __createKernel() {
  const gpu = new GPU()
  const multiplyMatrix = gpu
    .createKernel(function(a, b) {
      let sum = 0
      for (let i = 0; i < 512; i++) {
        sum += a[this.thread.y as any][i] * b[i][this.thread.x]
      }
      return sum
    })
    .setOutput([512, 512])

  return multiplyMatrix([1, 2, 3], [1, 2, 3])
}
