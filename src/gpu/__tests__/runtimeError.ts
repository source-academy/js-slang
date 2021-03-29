// /* tslint:disable:only-arrow-functions */
// import { __createKernel } from '../lib'
// import { TypeError } from '../../utils/rttc'

// test('__createKernel with uninitialized array throws error', () => {
//   const bounds = [5, 4]
//   const extern = {}
//   const f1 = function (this: any) {
//     return this.thread.y * this.thread.x
//   }

//   const arr: number[][] = []

//   const f2 = function (i: any, j: any) {
//     return i * j
//   }
//   const f = () => __createKernel(bounds, extern, f1, arr, f2)
//   expect(f).toThrow(TypeError)
// })

// test('__createKernel with 2 loops + uninitialized array throws error', () => {
//   const bounds = [5, 4, 3]
//   const extern = {}
//   const f1 = function (this: any) {
//     return this.thread.z * this.thread.y * this.thread.x
//   }

//   const arr: number[][][] = []
//   for (let i = 0; i < 5; i = i + 1) {
//     arr[i] = []
//   }

//   const f2 = function (i: any, j: any, k: any) {
//     return i * j * k
//   }
//   const f = () => __createKernel(bounds, extern, f1, arr, f2)
//   expect(f).toThrow(TypeError)
// })
