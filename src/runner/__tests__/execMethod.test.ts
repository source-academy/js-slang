import { beforeEach, describe, expect, test, vi } from 'vitest'
import { runCodeInSource } from '..'
import { parseError } from '../..'
import { Chapter, Variant } from '../../langs'
import type { ExecutionMethod } from '../../types'
import { getChapterName, objectKeys } from '../../utils/misc'
import { wrapWithSkipAndOnly } from '../../utils/testing/misc'
import { mockContext } from '../../utils/testing/mocks'
import * as validator from '../../validator/validator'
import runners, { type RunnerTypes } from '../sourceRunner'
import type { Runner } from '../types'

vi.spyOn(validator, 'validateAndAnnotate')

// Required since the Typed variant tries to load modules
vi.mock(import('../../modules/loader/loaders'))

vi.mock(import('../sourceRunner'), async importOriginal => {
  const { default: actualRunners } = await importOriginal()

  return {
    default: Object.keys(actualRunners).reduce(
      (res, key) => {
        const mockRunner: Runner = (_, context) =>
          Promise.resolve({
            status: 'finished',
            value: '',
            context
          })

        return {
          ...res,
          [key]: vi.fn(mockRunner)
        }
      },
      {} as typeof runners
    )
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

interface TestCase {
  chapter?: Chapter
  variant?: Variant
  code?: string
  /**
   * Set this to simulate the options having
   * a specific execution method set
   */
  optionMethod?: ExecutionMethod
  /**
   * Set this to simulate the context having a specific
   * execution method set
   */
  contextMethod?: ExecutionMethod

  /**
   * Which runner was expected to be called
   */
  expectedRunner: RunnerTypes

  /**
   * Should the runner have evaluated the prelude?
   */
  expectedPrelude: boolean

  /**
   * Should the validator have been called?
   */
  expectedValidate: boolean

  verboseErrors?: boolean
  timeout?: number
}

const sourceCases: TestCase[] = [
  {
    chapter: Chapter.SOURCE_1,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true,
    expectedValidate: true
  },
  {
    chapter: Chapter.SOURCE_2,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true,
    expectedValidate: true
  },
  {
    chapter: Chapter.SOURCE_3,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true,
    expectedValidate: true
  },
  {
    chapter: Chapter.SOURCE_4,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true,
    expectedValidate: true
  },
  {
    contextMethod: 'native',
    variant: Variant.NATIVE,
    expectedRunner: 'fulljs',
    expectedPrelude: false,
    expectedValidate: true
  }
]

// These JS cases never evaluate a prelude,
// nor ever have verbose errors enabled
const fullJSCases: Chapter[] = [Chapter.FULL_JS, Chapter.FULL_TS]

// These alt langs never evaluate a prelude,
// always use fullJS regardless of variant,
// but we don't need to check for verbose errors
const altLangCases: [Chapter, RunnerTypes][] = [[Chapter.PYTHON_1, 'fulljs']]

type TestObject = {
  code: string
  chapter: Chapter
  variant: Variant
  expectedPrelude: boolean
  expectedValidate: boolean
  expectedRunner: RunnerTypes
  optionMethod?: ExecutionMethod
  contextMethod?: ExecutionMethod
}

function expectCalls(count: number, expected: RunnerTypes) {
  const unexpectedRunner = objectKeys(runners).find(runner => {
    const { calls } = vi.mocked(runners[runner]).mock
    return calls.length > 0
  })

  switch (unexpectedRunner) {
    case undefined:
      throw new Error(
        `Expected ${expected} to be called ${count} times, but no runners were called`
      )
    case expected: {
      expect(runners[expected]).toHaveBeenCalledTimes(count)
      return vi.mocked(runners[expected]).mock.calls
    }
    default: {
      const callCount = vi.mocked(runners[unexpectedRunner]).mock.calls.length
      throw new Error(
        `Expected ${expected} to be called ${count} times, but ${unexpectedRunner} was called ${callCount} times`
      )
    }
  }
}

async function caseTester({
  code,
  chapter,
  variant,
  contextMethod,
  optionMethod,
  expectedPrelude,
  expectedRunner,
  expectedValidate
}: TestObject) {
  const context = mockContext(chapter, variant)
  if (contextMethod !== undefined) {
    context.executionMethod = contextMethod
  }

  // Check if the prelude is null before execution
  // because the prelude gets set to null if it wasn't before
  const shouldPrelude = expectedPrelude && context.prelude !== null
  const options =
    optionMethod === undefined
      ? undefined
      : {
          executionMethod: optionMethod
        }

  await runCodeInSource(code, context, options)

  if (context.errors.length > 0) {
    console.log(parseError(context.errors))
  }

  expect(context.errors.length).toEqual(0)

  if (shouldPrelude) {
    // If the prelude was to be evaluated and the prelude is not null,
    // the runner should be called twice
    const [call0, call1] = expectCalls(2, expectedRunner)

    // First with isPrelude true
    expect(call0[2].isPrelude).toEqual(true)

    // and then with isPrelude false
    expect(call1[2].isPrelude).toEqual(false)

    // If the validator is to be called, then it should've been called
    // with both the user program and the prelude
    expect(validator.validateAndAnnotate).toHaveBeenCalledTimes(expectedValidate ? 2 : 1)
  } else {
    // If not, the runner should only have been called once
    const [call0] = expectCalls(1, expectedRunner)

    // with isPrelude false
    expect(call0[2].isPrelude).toEqual(false)

    // If the validator is to be called, then it should've been called
    // with just the user program
    expect(validator.validateAndAnnotate).toHaveBeenCalledTimes(expectedValidate ? 1 : 0)
  }
}

const testCases = wrapWithSkipAndOnly(
  'describe',
  function (desc: string, cases: TestCase[], timeout?: number) {
    this(desc, () => {
      const testEach = test.each(
        cases.map(({ code, verboseErrors, contextMethod, chapter, variant, ...tc }, i) => {
          chapter = chapter ?? Chapter.SOURCE_1
          variant = variant ?? Variant.DEFAULT
          const context = mockContext(chapter, variant)
          if (contextMethod !== undefined) {
            context.executionMethod = contextMethod
          }

          const chapterName = getChapterName(chapter)
          let desc = `${i + 1}. Testing ${chapterName}, Variant: ${variant}, expected ${tc.expectedRunner} runner`
          code = code ?? ''
          if (verboseErrors) {
            code = `"enable verbose";\n${code}`
            desc += ' (verbose errors)'
          }

          return [desc, { code, chapter, variant, ...tc }]
        })
      )
      if (timeout !== undefined) {
        return testEach('%s', { timeout }, async (_, to) => caseTester(to))
      }
      return testEach('%s', async (_, to) => caseTester(to))
    })
  }
)

describe('Ensure that the correct runner is used for the given evaluation context and settings', () => {
  testCases('Test regular source cases', sourceCases)
  testCases(
    'Test source verbose error cases',
    sourceCases.map(tc => ({
      ...tc,
      verboseErrors: true,
      expectedRunner: 'cse-machine'
    }))
  )

  testCases(
    'Test source cases with debugger statements',
    sourceCases.map(tc => ({
      ...tc,
      code: 'debugger;\n' + (tc.code ?? ''),
      expectedRunner: 'cse-machine'
    }))
  )

  testCases(
    'Test explicit control variant',
    sourceCases.map(tc => ({
      ...tc,
      variant: Variant.EXPLICIT_CONTROL,
      expectedRunner: 'cse-machine'
    }))
  )

  testCases(
    'Test FullJS cases',
    fullJSCases.flatMap((chapter): TestCase[] => {
      const fullCase: TestCase = {
        chapter,
        verboseErrors: false,
        expectedPrelude: false,
        expectedRunner: 'fulljs',
        expectedValidate: false
      }

      const verboseErrorCase: TestCase = {
        ...fullCase,
        verboseErrors: true
      }

      const variantCases = Object.values(Variant).map(
        (variant): TestCase => ({
          code: '',
          variant,
          chapter,
          expectedPrelude: false,
          expectedRunner: 'fulljs',
          verboseErrors: false,
          expectedValidate: false
        })
      )

      return [fullCase, verboseErrorCase, ...variantCases]
    }),
    10_000
  )

  testCases(
    'Test alt-langs',
    altLangCases.flatMap(([chapter, expectedRunner]) =>
      Object.values(Variant).map(
        (variant): TestCase => ({
          code: '',
          variant,
          chapter,
          expectedPrelude: false,
          expectedRunner,
          verboseErrors: false,
          expectedValidate: false
        })
      )
    )
  )

  test('if optionMethod is specified, verbose errors is ignored', () =>
    caseTester({
      code: '"enable verbose"; 0;',
      optionMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native',
      expectedValidate: true
    }))

  // testCases('runner correctly respects optionMethod', objectKeys(runners).map(runner => ({
  //   code: '"enable verbose"; 0;',
  //   optionMethod: runner,
  //   chapter: Chapter.SOURCE_4,
  //   variant: Variant.DEFAULT,
  //   expectedPrelude: true,
  //   expectedRunner: runner
  // })))

  test('if optionMethod is specified, debubger statements are ignored', () =>
    caseTester({
      code: 'debugger; 0;',
      optionMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native',
      expectedValidate: true
    }))

  test('if contextMethod is specified, verbose errors is ignored', () =>
    caseTester({
      code: '"enable verbose"; 0;',
      contextMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native',
      expectedValidate: true
    }))

  test('if contextMethod is specified, debugger statements are ignored', () =>
    caseTester({
      code: 'debugger; 0;',
      contextMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native',
      expectedValidate: true
    }))

  test('optionMethod takes precedence over contextMethod', () =>
    caseTester({
      code: '0;',
      contextMethod: 'native',
      optionMethod: 'cse-machine',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'cse-machine',
      expectedValidate: true
    }))

  test('debugger statements require cse-machine', () =>
    caseTester({
      code: 'debugger; 0;',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'cse-machine',
      expectedValidate: true
    }))
})
