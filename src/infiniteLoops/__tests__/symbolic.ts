import * as sym from '../symbolic'

test('make dummy only dummifies concrete values', () => {
  const concreteVal = 2
  const hybrid = sym.makeDummyHybrid(concreteVal)
  expect(sym.isHybrid(hybrid)).toBe(true)

  const concreteArray = [2]
  const notHybrid = sym.makeDummyHybrid(concreteArray)
  expect(sym.isHybrid(notHybrid)).toBe(false)

  expect(sym.makeDummyHybrid(hybrid)).toBe(hybrid)
})

test('hybridization and concretization are idempotent', () => {
  const concreteVal = 2
  const hybrid1 = sym.hybridizeNamed('c', concreteVal)
  const hybrid2 = sym.hybridizeNamed('d', hybrid1)
  expect(hybrid1).toBe(hybrid2)
  const conc = sym.shallowConcretize(hybrid1)
  expect(conc).toBe(sym.shallowConcretize(conc))

  const concreteArray = [2]
  const hybridA1 = sym.hybridizeNamed('a', concreteArray)
  const hybridA2 = sym.hybridizeNamed('b', hybridA1)
  expect(hybridA1).toBe(hybridA2)
  const concA = sym.shallowConcretize(hybridA1)
  expect(concA).toBe(sym.shallowConcretize(concA))
})
