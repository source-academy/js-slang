import { getGPUKernelDimensions, checkArray, buildArray, checkValidLoops } from '../lib'

test('getGPUKernelDimensions with counter prefix returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 5, 1]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<', '<', '<']
  const idx = ['i', 'j', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([1, 5, 3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const initials2 = [0, 0, 0, 0]
  const steps2 = [1, 1, 1, 1]
  const operators2 = ['<', '<', '<', '<']
  const idx2 = ['i', 'j']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, initials2, steps2, operators2, idx2)
  expect(kernelDim2).toEqual([5, 3])
})

test('getGPUKernlDimensions with counter combination returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<', '<', '<']
  const idx = ['j', 'k', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([3, 5, 2])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const initials2 = [0, 0, 0, 0]
  const steps2 = [1, 1, 1, 1]
  const operators2 = ['<', '<', '<', '<']
  const idx2 = ['k', 'i']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, initials2, steps2, operators2, idx2)
  expect(kernelDim2).toEqual([3, 1])
})

test('getGPUKernlDimensions with numbers returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<', '<', '<']
  const idx = ['j', '1', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([3, 2])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const initials2 = [0, 0, 0, 0]
  const steps2 = [1, 1, 1, 1]
  const operators2 = ['<', '<', '<']
  const idx2 = [3, 'i']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, initials2, steps2, operators2, idx2)
  expect(kernelDim2).toEqual([3])
})

test('getGPUKernelDimensions with external variables returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<', '<', '<']
  const idx = ['test', '1', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const initials2 = [0, 0, 0, 0]
  const steps2 = [1, 1, 1, 1]
  const operators2 = ['<', '<', '<']
  const idx2 = ['l', 'test', 'k']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, initials2, steps2, operators2, idx2)
  expect(kernelDim2).toEqual([1, 2])
})

test('getGPUKernelDimensions with repeated counters returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<', '<', '<']
  const idx = ['i', 'i', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([5, 3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const initials2 = [0, 0, 0, 0]
  const steps2 = [1, 1, 1, 1]
  const operators2 = ['<', '<', '<', '<']
  const idx2 = ['l', 'k', 'l']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, initials2, steps2, operators2, idx2)
  expect(kernelDim2).toEqual([1, 2])
})

test('getGPUKernelDimensions with non-standard initial/step returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [10, 11, 12]
  const initials = [1, 2, 3]
  const steps = [2, 3, 4]
  const operators = ['<', '<', '<']
  const idx = ['i', 'j', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([3, 3, 5])
})

test('getGPUKernelDimensions with <= operator returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 5, 1]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const operators = ['<=', '<=', '<=']
  const idx = ['i', 'j', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([2, 6, 4])
})

test('getGPUKernelDimensions with <= operator and non-standard initial/step returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [10, 11, 12]
  const initials = [1, 2, 3]
  const steps = [2, 3, 4]
  const operators = ['<=', '<=', '<=']
  const idx = ['i', 'j', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, initials, steps, operators, idx)
  expect(kernelDim).toEqual([3, 4, 5])
})

test('checkArray returns true when array is valid with counter prefix', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
    }
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 'j', 'k']
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(true)
})

test('checkArray returns true when array is valid with counter combination', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
      for (let k = 0; k < 3; k++) {
        arr[i][j][k] = []
      }
    }
  }
  const ctr = ['i', 'j', 'k', 'l']
  const end = [100, 5, 3, 50]
  const idx = ['k', 'i']
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(true)
})

test('checkArray returns true when array is valid with numbers', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    arr[i][1000] = []
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 1000]
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(true)
})

test('checkArray returns true when array is valid with external variables', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
      for (let k = 0; k < 5; k++) {
        arr[i][j][k] = []
        arr[i][j][k][999] = []
      }
    }
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 'j', 'k', 'x']
  const ext = { x: 999 }
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(true)
})

test('checkArray returns true when array is valid with repeated counters', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 100; j++) {
      arr[i][j] = []
    }
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 'i', 'i']
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(true)
})

test('checkArray returns false when array is invalid with counter prefix', () => {
  let arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = 1
  }
  let ctr = ['i', 'j', 'k']
  let end = [100, 5, 3]
  let idx = ['i', 'j', 'k']
  let ext = {}
  let res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)

  arr = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 2; j++) {
      arr[i][j] = []
    }
  }
  ctr = ['i', 'j', 'k']
  end = [100, 5, 3]
  idx = ['i', 'j', 'k']
  ext = {}
  res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)
})

test('checkArray returns false when array is invalid with counter combination', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
      for (let k = 0; k < 3; k++) {
        arr[i][j][k] = []
      }
    }
  }
  const ctr = ['i', 'j', 'k', 'l']
  const end = [100, 5, 3, 50]
  const idx = ['k', 'l', 'i']
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)
})

test('checkArray returns false when array is invalid with numbers', () => {
  let arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = 'string'
  }
  let ctr = ['i', 'j', 'k']
  let end = [100, 5, 3]
  let idx = ['i', 1000]
  let ext = {}
  let res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)

  arr = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 100; j++) {
      arr[i][j] = 3
    }
  }
  ctr = ['i', 'j', 'k']
  end = [100, 5, 3]
  idx = ['i', 'j', 1000]
  ext = {}
  res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)
})

test('checkArray returns false when array is invalid with external variables', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
      for (let k = 0; k < 5; k++) {
        arr[i][j][9999] = []
      }
    }
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 'j', 'x', 'k']
  const ext = { x: 999 }
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)
})

test('checkArray returns false when array is invalid with repeated counters', () => {
  const arr: any = []
  for (let i = 0; i < 100; i++) {
    arr[i] = []
    for (let j = 0; j < 5; j++) {
      arr[i][j] = []
    }
  }
  const ctr = ['i', 'j', 'k']
  const end = [100, 5, 3]
  const idx = ['i', 'i', 'i']
  const ext = {}
  const res = checkArray(arr, ctr, end, idx, ext)
  expect(res).toBe(false)
})

test('buildArray with counter prefix performs correct assignment', () => {
  let ctr = ['i', 'j', 'k']
  let end = [3, 3, 2]
  let initials = [0, 0, 0]
  let steps = [1, 1, 1]
  let idx = ['i', 'j', 'k']
  let ext = {}
  let res: any = [
    [
      [1, 1],
      [1, 1],
      [1, 1]
    ],
    [
      [1, 1],
      [1, 1],
      [1, 1]
    ],
    [
      [1, 1],
      [1, 1],
      [1, 1]
    ]
  ]
  let arr: any = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  let exp: any = [
    [
      [1, 1, 2],
      [1, 1, 2],
      [1, 1, 2]
    ],
    [
      [1, 1, 2],
      [1, 1, 2],
      [1, 1, 2]
    ],
    [
      [1, 1, 2],
      [1, 1, 2],
      [1, 1, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)

  ctr = ['i', 'j', 'k', 'l']
  end = [1, 3, 2, 4]
  initials = [0, 0, 0, 0]
  steps = [1, 1, 1, 1]
  idx = ['i', 'j']
  ext = {}
  res = [[1, 1, 1]]
  arr = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  exp = [
    [1, 1, 1],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)
})

test('buildArray with counter combination performs correct assignment', () => {
  let ctr = ['i', 'j', 'k']
  let end = [1, 3, 2]
  let initials = [0, 0, 0]
  let steps = [1, 1, 1]
  let idx = ['k', 'i', 'j']
  let ext = {}
  let res: any = [[[1, 1, 1]], [[1, 1, 1]]]
  let arr: any = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  let exp: any = [
    [
      [1, 1, 1],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [1, 1, 1],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)

  ctr = ['i', 'j', 'k', 'l']
  end = [1, 3, 2, 4]
  initials = [0, 0, 0, 0]
  steps = [1, 1, 1, 1]
  idx = ['l', 'j']
  ext = {}
  res = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]
  arr = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  exp = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)
})

test('buildArray with numbers performs correct assignment', () => {
  let ctr = ['i', 'j', 'k']
  let end = [1, 2, 3]
  let initials = [0, 0, 0]
  let steps = [1, 1, 1]
  let idx = ['i', 1, 'j']
  let ext = {}
  let res: any = [[1, 1]]
  let arr: any = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  let exp: any = [
    [
      [2, 2, 2],
      [1, 1, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)

  ctr = ['i', 'j', 'k']
  end = [1, 2, 3]
  initials = [0, 0, 0]
  steps = [1, 1, 1]
  idx = [2, 1, 'k']
  ext = {}
  res = [1, 1, 1]
  arr = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  exp = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [1, 1, 1],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)
})

test('buildArray with external variables performs correct assignment', () => {
  let ctr = ['i', 'j', 'k']
  let end = [1, 2, 3]
  let initials = [0, 0, 0]
  let steps = [1, 1, 1]
  let idx = ['i', 'x', 'j']
  let ext: any = { x: 1 }
  let res: any = [[1, 1]]
  let arr: any = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  let exp: any = [
    [
      [2, 2, 2],
      [1, 1, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)

  ctr = ['i', 'j', 'k']
  end = [1, 2, 3]
  initials = [0, 0, 0]
  steps = [1, 1, 1]
  idx = ['x', 'y', 'k']
  ext = { x: 2, y: 1 }
  res = [1, 1, 1]
  arr = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  exp = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [1, 1, 1],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)
})

test('buildArray with repeated counters performs correct assignment', () => {
  const ctr = ['i', 'j', 'k']
  const end = [1, 2, 3]
  const initials = [0, 0, 0]
  const steps = [1, 1, 1]
  const idx = ['j', 'j', 'k']
  const ext: any = {}
  const res: any = [
    [1, 1, 1],
    [1, 1, 1]
  ]
  const arr: any = [
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  const exp: any = [
    [
      [1, 1, 1],
      [2, 2, 2],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [1, 1, 1],
      [2, 2, 2]
    ],
    [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2]
    ]
  ]
  buildArray(res, ctr, end, initials, steps, idx, ext, arr)
  expect(arr).toEqual(exp)
})

test('checkValidLoops accepts standard loops', () => {
  // let i = 0; i < 10; i = i + 1
  const end = [10]
  const initials = [0]
  const steps = [1]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(true)
})

test('checkValidLoops accepts loops with non-standard initial/step size', () => {
  // let i = 2; i < 10; i = i + 2
  const end = [10]
  const initials = [2]
  const steps = [2]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(true)
})

test('checkValidLoops rejects loops with non-integer initial', () => {
  // let i = 0.5; i < 10; i = i + 2
  const end = [10]
  const initials = [0.5]
  const steps = [2]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(false)
})

test('checkValidLoops rejects loops with non-integer step size', () => {
  // let i = 2; i < 10; i = i + 0.5
  const end = [10]
  const initials = [2]
  const steps = [0.5]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(false)
})

test('checkValidLoops rejects loops with negative initial', () => {
  // let i = -2; i < 10; i = i + 1
  const end = [10]
  const initials = [-2]
  const steps = [1]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(false)
})

test('checkValidLoops rejects loops which end up with negative array indiices', () => {
  // let i = 0; i < 10; i = i + (-1)
  const end = [10]
  const initials = [0]
  const steps = [-1]
  const res = checkValidLoops(end, initials, steps)
  expect(res).toEqual(false)
})
