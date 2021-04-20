/* tslint:disable:only-arrow-functions */
import { __clearKernelCache, __createKernelSource } from '../lib'

test('__createKernelSource with 1 loop returns correct result', () => {
  const ctr = ['i']
  const initials = [0]
  const steps = [1]
  const end = [5]
  const idx = ['i']
  const extern: [string, any][] = []
  const local: string[] = []
  const f = () => {
    return 1
  }
  const arr: number[] = []
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([1, 1, 1, 1, 1])
})

test('__createKernelSource with 2 loops returns correct result', () => {
  const ctr = ['i', 'j']
  const initials = [0, 0]
  const steps = [1, 1]
  const end = [5, 4]
  const idx = ['i', 'j']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
  }
  const f = (i: any, j: any) => {
    return i * j
  }
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([
    [0, 0, 0, 0],
    [0, 1, 2, 3],
    [0, 2, 4, 6],
    [0, 3, 6, 9],
    [0, 4, 8, 12]
  ])
})

test('__createKernelSource with 3 loop returns correct result', () => {
  const ctr = ['i', 'j', 'k']
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const end = [5, 4, 3]
  const idx = ['i', 'j', 'k']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
    }
  }

  const f = (i: any, j: any, k: any) => {
    return i * j * k
  }
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
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

test('__createKernelSource with indices as counter combination returns correct result', () => {
  const ctr = ['i', 'j', 'k']
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const end = [5, 4, 3]
  const idx = ['k', 'i']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = 1
      }
    }
  }

  const f = (i: any, j: any, k: any) => {
    return i + k
  }
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([
    [0, 1, 2, 3, 4],
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ]
  ])
})

test('__createKernelSource with number constant as index returns correct result', () => {
  const ctr = ['i', 'j', 'k']
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const end = [5, 4, 3]
  const idx = ['k', 1, 'i']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][][] = []
  for (let k = 0; k < 3; k = k + 1) {
    arr[k] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[k][j] = []
      for (let i = 0; i < 5; i = i + 1) {
        arr[k][j][i] = 1
      }
    }
  }

  const f = (i: any, j: any, k: any) => {
    return i + k
  }
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([
    [
      [1, 1, 1, 1, 1],
      [0, 1, 2, 3, 4],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1]
    ],
    [
      [1, 1, 1, 1, 1],
      [1, 2, 3, 4, 5],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1]
    ],
    [
      [1, 1, 1, 1, 1],
      [2, 3, 4, 5, 6],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1]
    ]
  ])
})

test('__createKernelSource with counter not used in indices returns correct result', () => {
  const ctr = ['i', 'j', 'k', 'l']
  const initials = [0, 0, 0, 0]
  const steps = [1, 1, 1, 1]
  const end = [5, 4, 3, 2]
  const idx = ['i', 'j', 'k']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = []
        for (let l = 0; l < 2; l = l + 1) {
          arr[i][j][k][l] = 0
        }
      }
    }
  }

  const f = (i: any, j: any, k: any, l: any) => {
    return i * j * k * l
  }
  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
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

test('__createKernelSource with external variable as index returns correct result', () => {
  const ctr = ['i', 'j', 'k']
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const end = [5, 4, 3]
  const idx = ['x', 'j', 'k']
  const extern: [string, any][] = [['x', 4]]
  const local: string[] = []

  const arr: number[][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = 1
      }
    }
  }

  const f = (i: any, j: any, k: any) => {
    return j * k
  }

  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ],
    [
      [0, 0, 0],
      [0, 1, 2],
      [0, 2, 4],
      [0, 3, 6]
    ]
  ])
})

test('__createKernelSource with repeated counter in indices returns correct result', () => {
  const ctr = ['i', 'j', 'k']
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const end = [5, 4, 3]
  const idx = ['j', 'j']
  const extern: [string, any][] = []
  const local: string[] = []

  const arr: number[][][] = []
  for (let i = 0; i < 5; i = i + 1) {
    arr[i] = []
    for (let j = 0; j < 4; j = j + 1) {
      arr[i][j] = []
      for (let k = 0; k < 3; k = k + 1) {
        arr[i][j][k] = 1
      }
    }
  }

  const f = (i: any, j: any, k: any) => {
    return i + k
  }

  __clearKernelCache()
  __createKernelSource(ctr, end, initials, steps, idx, extern, local, arr, f, 0, [])
  expect(arr).toEqual([
    [6, [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[1, 1, 1], 6, [1, 1, 1], [1, 1, 1]],
    [[1, 1, 1], [1, 1, 1], 6, [1, 1, 1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], 6],
    [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ]
  ])
})
