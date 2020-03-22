/* tslint:disable:max-line-length */
import { runInContext, resume, IOptions } from '../index'
import { mockContext } from '../mocks/context'
import { SuspendedNonDet, Finished } from '../types'

const nonDetTestOptions = {
  scheduler: 'preemptive',
  executionMethod: 'non-det-interpreter'
} as Partial<IOptions>

// ---------------------------------- Deterministic code tests --------------------------------
test('Empty code returns undefined', async () => {
  await testDeterministicCode('', undefined)
})

test('Deterministic calculation', async () => {
  await testDeterministicCode('1 + 4 - 10 * 5;', -45)
})

async function testDeterministicCode(code: string, expectedValue: any) {
  const context = makeNonDetContext()
  let result = await runInContext(code, context, nonDetTestOptions)
  expect((result as SuspendedNonDet).value).toBe(expectedValue)
  expect(result.status).toBe('suspended-non-det')
  // deterministic code only has a single value
  result = await resume(result)
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe(undefined)
}
// ---------------------------------- Non deterministic code tests -------------------------------

test('Test simple amb application', async () => {
  const context = makeNonDetContext()
  let result = await runInContext('amb(1, 4 + 5, 3 - 10);', context, nonDetTestOptions)
  expect(result.status).toBe('suspended-non-det')
  expect((result as SuspendedNonDet).value).toBe(1)
  result = await resume(result)
  expect(result.status).toBe('suspended-non-det')
  expect((result as SuspendedNonDet).value).toBe(9)
  result = await resume(result)
  expect(result.status).toBe('suspended-non-det')
  expect((result as SuspendedNonDet).value).toBe(-7)

  result = await resume(result)
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe(undefined)
})

function makeNonDetContext() {
  const context = mockContext(4)
  context.executionMethod = 'non-det-interpreter'
  return context
}
