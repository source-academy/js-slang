/* tslint:disable:only-arrow-functions */
import { __createKernel } from '../lib'

test('__createKernel with 1 loop returns correct result', () => {
  const bounds = [5]
  const extern = {}
  const f1 = function () {
    return 1
  }
  const arr: number[] = []
  const f2 = function (_i: any) {
    return 1
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([1, 1, 1, 1, 1])
})

test('__createKernel with 2 loops returns correct result', () => {
  const bounds = [5, 4]
  const extern = {}
  const f1 = function (this: any) {
    return this.thread.y * this.thread.x
  }

  const arr: number[][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
  }

  const f2 = function (i: any, j: any) {
    return i * j
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([
    [0, 0, 0, 0],
    [0, 1, 2, 3],
    [0, 2, 4, 6],
    [0, 3, 6, 9],
    [0, 4, 8, 12]
  ])
})

test('__createKernel with 3 loop returns correct result', () => {
  const bounds = [5, 4, 3]
  const extern = {}
  const f1 = function (this: any) {
    return this.thread.z * this.thread.y * this.thread.x
  }

  const arr: number[][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
    }
  }

  const f2 = function (i: any, j: any, k: any) {
    return i * j * k
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, 0],
      [0, 1, 2],
      [0, 2, 4],
      [0, 3, 6]
    ],
    [
      [0, 0, 0],
      [0, 2, 4],
      [0, 4, 8],
      [0, 6, 12]
    ],
    [
      [0, 0, 0],
      [0, 3, 6],
      [0, 6, 12],
      [0, 9, 18]
    ],
    [
      [0, 0, 0],
      [0, 4, 8],
      [0, 8, 16],
      [0, 12, 24]
    ]
  ])
})

test('__createKernel with 1 loop + return string returns correct result', () => {
  const bounds = [5]
  const extern = {}
  const f1 = function () {
    return 'a'
  }
  const arr: number[] = []
  const f2 = function () {
    return 'a'
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual(['a', 'a', 'a', 'a', 'a'])
})

test('__createKernel with 1 loop + return number array returns correct result', () => {
  const bounds = [5]
  const extern = {}
  const f1 = function () {
    return [1, 2, 3]
  }
  const arr: number[] = []
  const f2 = function () {
    return [1, 2, 3]
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([
    [1, 2, 3],
    [1, 2, 3],
    [1, 2, 3],
    [1, 2, 3],
    [1, 2, 3]
  ])
})

test('__createKernel with 1 loop + return string array returns correct result', () => {
  const bounds = [5]
  const extern = {}
  const f1 = function () {
    return ['a', 'a']
  }
  const arr: number[] = []
  const f2 = function () {
    return ['a', 'a']
  }
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([
    ['a', 'a'],
    ['a', 'a'],
    ['a', 'a'],
    ['a', 'a'],
    ['a', 'a']
  ])
})

test('__createKernel with 1 loop + external variable returns correct result', () => {
  const bounds = [3]
  const extern = { y: 100 }
  const f1 = function (this: any) {
    return this.constants.y + this.thread.x
  }
  const arr: number[] = []
  const f2 = function () {
    return 1 + y
  }

  const y = 100
  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([101, 101, 101])
})

test('__createKernel with 1 loop + external variable + math function returns correct result', () => {
  const bounds = [3]
  const extern = { y: 100 }
  const f1 = function (this: any) {
    return Math.abs(-this.constants.y + this.thread.x)
  }
  const arr: number[] = []

  const y = 100

  // tslint:disable-next-line
  const math_abs = Math.abs
  const f2 = function (i: any) {
    return math_abs(-y + i)
  }

  __createKernel(bounds, extern, f1, arr, f2)
  expect(arr).toEqual([100, 99, 98])
})
