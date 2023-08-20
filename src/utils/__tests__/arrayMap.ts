import { arrayMapFrom } from '../arrayMap'

test('arrayMapFrom', () => {
  const arrMap = arrayMapFrom([
    [1, [1, 2, 3]],
    [2, [2, 4, 6]]
  ])

  expect(arrMap.get(1)).toEqual([1, 2, 3])
  expect(arrMap.get(2)).toEqual([2, 4, 6])
})

test('mapAsync', async () => {
  const arrMap = arrayMapFrom([
    [1, [1, 2, 3]],
    [2, [2, 4, 6]]
  ])

  const mapper = jest.fn((k: number, entry: number[]) =>
    Promise.resolve([k, entry.map(each => each * 2)] as [number, number[]])
  )
  const newMap = await arrMap.mapAsync(mapper)

  expect(newMap.get(1)).toEqual([2, 4, 6])
  expect(newMap.get(2)).toEqual([4, 8, 12])
  expect(mapper).toHaveBeenCalledTimes(2)
})
