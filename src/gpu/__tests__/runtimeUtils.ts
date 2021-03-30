import { getGPUKernelDimensions } from '../lib'

test('getGPUKernelDimensions with counter prefix returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 5, 1]
  const idx = ['i', 'j', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, idx)
  expect(kernelDim).toEqual([1, 5, 3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const idx2 = ['i', 'j']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, idx2)
  expect(kernelDim2).toEqual([5, 3])
})

test('getGPUKernlDimensions with counter combination returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const idx = ['j', 'k', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, idx)
  expect(kernelDim).toEqual([3, 5, 2])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const idx2 = ['k', 'i']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, idx2)
  expect(kernelDim2).toEqual([3, 1])
})

test('getGPUKernlDimensions with numbers returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const idx = ['j', '1', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, idx)
  expect(kernelDim).toEqual([3, 2])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const idx2 = [3, 'i']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, idx2)
  expect(kernelDim2).toEqual([3])
})

test('getGPUKernelDimensions with external variables returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const idx = ['test', '1', 'i']
  const kernelDim = getGPUKernelDimensions(ctr, end, idx)
  expect(kernelDim).toEqual([3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const idx2 = ['l', 'test', 'k']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, idx2)
  expect(kernelDim2).toEqual([1, 2])
})

test('getGPUKernelDimensions with repeated counters returns correct dimensions', () => {
  const ctr = ['i', 'j', 'k']
  const end = [3, 2, 5]
  const idx = ['i', 'i', 'k']
  const kernelDim = getGPUKernelDimensions(ctr, end, idx)
  expect(kernelDim).toEqual([5, 3, 3])

  const ctr2 = ['i', 'j', 'k', 'l']
  const end2 = [3, 5, 1, 2]
  const idx2 = ['l', 'l', 'k']
  const kernelDim2 = getGPUKernelDimensions(ctr2, end2, idx2)
  expect(kernelDim2).toEqual([1, 2, 2])
})

test('checkArray returns true when array is valid', () => {
})

test('checkArray returns false when array is invalid', () => {
})
