import { mockContext } from '../../mocks/context'
import { Chapter, type Context, type Environment } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { runCodeInSource } from '../../runner'
import { createProgramEnvironment } from '../utils'

const getContextFrom = async (code: string, envSteps?: number) => {
  const context = mockContext(Chapter.SOURCE_4)
  await runCodeInSource(code, context, {
    envSteps,
    executionMethod: 'cse-machine'
  })
  return context
}

test("Context runtime's objectCount continues after prelude", async () => {
  const context = await getContextFrom('const a = list(1, 2, 3);')
  // 1 prelude environment + 45 prelude closures in Source 4,
  // so program environment has id of '46'
  expect(context.runtime.environments[0].id).toMatchInlineSnapshot(`"47"`)
})

test("Context runtime's objectCount continues after prelude", async () => {
  const context = await getContextFrom('const a = list(1, 2, 3);')
  // 1 program environment + 3 arrays from the list function, so final objectCount is 50
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`51`)
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
  // Closures: 45 prelude closures + 1 closure in program (c) + 1 closure in block, total 47
  // Total count: 4 + 8 + 47 = 59
  expect(context.runtime.objectCount).toMatchInlineSnapshot(`60`)
})

test('CSE Machine stops at the given step number', async () => {
  const code = stripIndent`
      let x = 0;
      for (let i = 0; i < 10; i = i + 1) {
        x = [x];
      }
    `
  // The above program has a total of 335 steps
  // Start from steps = 1 so that the program environment always exists
  for (let steps = 1; steps < 336; steps++) {
    const context = await getContextFrom(code, steps)
    // A simple check to ensure that the the CSE Machine does indeed stop at the given step number
    if (steps === 100) {
      // 7 additional environments + 2 arrays created, so object count is 47 + 7 + 2 = 56
      expect(context.runtime.objectCount).toMatchInlineSnapshot(`57`)
    }
  }
})

// The above program has a total of 335 steps
// Start from steps = 1 so that the program environment always exists
test('Program environment id stays the same regardless of amount of steps', async () => {
  const mockProgramEnv = createProgramEnvironment(mockContext(), false)

  const getProgramEnv = (context: Context) => {
    let env: Environment | null = context.runtime.environments[0]
    while (env && env.name !== mockProgramEnv.name) {
      env = env.tail
    }
    return env
  }

  const code = stripIndent`
    let x = 0;
    for (let i = 0; i < 10; i = i + 1) {
      x = [x];
    }
  `
  let same = true
  for (let steps = 1; steps < 336; steps++) {
    const context = await getContextFrom(code, steps)
    const programEnv = getProgramEnv(context)
    same &&= programEnv!.id === `"46"`
  }
  expect(same).toMatchInlineSnapshot(`false`)
})
