import { Chapter } from '../../langs'
import { runCodeInSource } from '../../runner'
import type { Context, Environment } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { mockContext } from '../../utils/testing/mocks'
import { createProgramEnvironment } from '../utils'

const getContextFrom = async (code: string, envSteps?: number) => {
  const context = mockContext(Chapter.SOURCE_4)
  await runCodeInSource(code, context, {
    executionMethod: 'cse-machine',
    envSteps
  })
  return context
}

test("Program environment's id continues after prelude", async () => {
  const context = await getContextFrom('const a = list(1, 2, 3);')
  // 1 prelude environment + 46 prelude closures in Source 4,
  // so program environment has id of '47'
  expect(context.runtime.environments[0].id).toMatchInlineSnapshot(`"47"`)
})

test("Context runtime's objectCount continues after prelude", async () => {
  const context = await getContextFrom('const a = list(1, 2, 3);')
  // 1 program environment + 3 arrays from the list function, so final objectCount is 51
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`51`)
})

test("Context runtime's objectCount continues after apply_in_underlying_javascript call", async () => {
  const context = await getContextFrom(
    stripIndent`
      function f(...x) {
        return [x];
      }
      apply_in_underlying_javascript(f, list(1, 2, 3));
    `
  )
  // 1 program environment + 1 closure + 1 function environment
  // 3 arrays from list + 1 array from variadic argument + 1 array from from function result
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`55`)
})

test('Every environment/array/closure has a unique id', async () => {
  const context = await getContextFrom(
    stripIndent`
      [1];
      const a = [2];
      const b = pair(3, null);
      function c(x) {}
      c(list(6, 7, 8));
      {
        const d = [9];
        [10];
        x => x;
      }
    `
  )
  expect(context.runtime.environmentTree).toMatchSnapshot()
  // Environments: 1 prelude + 1 program + 1 function (c) + 1 block, total: 4
  // Arrays: 4 arrays created manually + 4 arrays from in-built functions (pair, list), total: 8
  // Closures: 46 prelude closures + 1 closure in program (c) + 1 closure in block, total 48
  // Total count: 4 + 8 + 48 = 60
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`60`)
})

test('CSE Machine stops at the given step number', async () => {
  const context = await getContextFrom(
    stripIndent`
      let x = 0;
      for (let i = 0; i < 10; i = i + 1) {
        x = [x];
      }
    `,
    100
  )
  // 7 additional environments + 2 arrays created at step 100, so object count is 48 + 7 + 2 = 57
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`57`)
})

const programEnvName = createProgramEnvironment(mockContext(), false).name

const getProgramEnv = (context: Context) => {
  let env: Environment | null = context.runtime.environments[0]
  while (env && env.name !== programEnvName) {
    env = env.tail
  }
  return env
}

test('Program environment id stays the same regardless of amount of steps', async () => {
  const code = stripIndent`
        let x = 0;
        for (let i = 0; i < 10; i = i + 1) {
          x = [x];
        }
      `

  let programEnvId = '47'
  // The above program has a total of 335 steps
  // Start from steps = 1 so that the program environment always exists
  for (let steps = 1; steps < 336; steps++) {
    const context = await getContextFrom(code, steps)
    const programEnv = getProgramEnv(context)!
    if (programEnv.id !== programEnvId) {
      programEnvId = programEnv.id
      break
    }
  }
  expect(programEnvId).toMatchInlineSnapshot(`"47"`)
})
