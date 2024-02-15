import Dict, { arrayMapFrom } from '../dict'

test('arrayMapFrom', () => {
  const arrMap = arrayMapFrom([
    [1, [1, 2, 3]],
    [2, [2, 4, 6]]
  ])

  expect(arrMap.get(1)).toEqual([1, 2, 3])
  expect(arrMap.get(2)).toEqual([2, 4, 6])
})

test('setdefault', () => {
  const map = new Dict<number, number>()
  map.setdefault(0, -1)

  expect(map.get(0)).toEqual(-1)

  // If the map already contains a key with a value,
  // setdefault should not change the value of that key
  // and should just return the current value
  expect(map.setdefault(0, 1)).toEqual(-1)
  expect(map.get(0)).toEqual(-1)
})
