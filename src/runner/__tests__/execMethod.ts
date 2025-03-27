import runners, { type RunnerTypes } from '../sourceRunner'
import { Chapter, type ExecutionMethod, Variant } from '../../types'
import { runCodeInSource } from '..'
import { mockContext } from '../../utils/testing/mocks'
import { getChapterName, objectKeys, objectValues } from '../../utils/misc'
import { asMockedFunc } from '../../utils/testing/misc'
import { parseError } from '../..'
import type { Runner } from '../types'
import * as validator from '../../validator/validator'

jest.spyOn(validator, 'validateAndAnnotate')
// Required since Typed variant tries to load modules
jest.mock('../../modules/loader')
jest.mock('../sourceRunner', () => {
  const { default: actualRunners } = jest.requireActual('../sourceRunner')
  return {
    default: Object.entries(actualRunners as typeof runners).reduce(
      (res, [key, { prelude, validate }]) => {
        const mockRunner: Runner = jest.fn((_, context) =>
          Promise.resolve({
            status: 'finished',
            value: '',
            context
          })
        )

        return {
          ...res,
          [key]: {
            runner: mockRunner,
            validate,
            prelude
          }
        }
      },
      {}
    )
  }
})

beforeEach(() => {
  jest.clearAllMocks()
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
}

interface FullTestCase extends TestCase {
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
}

const sourceCases: FullTestCase[] = [
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
    variant: Variant.NATIVE,
    expectedRunner: 'native',
    expectedPrelude: false,
    expectedValidate: true
  }
]

// These JS cases never evaluate a prelude,
// nor ever have verbose errors enabled
const fullJSCases: TestCase[] = [{ chapter: Chapter.FULL_JS }, { chapter: Chapter.FULL_TS }]

// The alt langs never evaluate a prelude,
// always use fullJS regardless of variant,
// but we don't need to check for verbose errors
const altLangCases: Chapter[] = [Chapter.PYTHON_1]

type TestObject = {
  code: string
  chapter: Chapter
  variant: Variant
  expectedPrelude: boolean
  expectedValidate: boolean
  expectedRunner: RunnerTypes
  optionMethod?: ExecutionMethod
}

function expectCalls(count: number, expected: RunnerTypes) {
  const unexpectedRunner = objectKeys(runners).find(runner => {
    const { calls } = asMockedFunc(runners[runner].runner).mock
    return calls.length > 0
  })

  switch (unexpectedRunner) {
    case undefined:
      throw new Error(
        `Expected ${expected} to be called ${count} times, but no runners were called`
      )
    case expected: {
      expect(runners[expected].runner).toHaveBeenCalledTimes(count)
      return asMockedFunc(runners[expected].runner).mock.calls
    }
    default: {
      const callCount = asMockedFunc(runners[unexpectedRunner].runner).mock.calls.length
      throw new Error(
        `Expected ${expected} to be called ${count} times, but ${unexpectedRunner} was called ${callCount} times`
      )
    }
  }
}

async function testCase({
  code,
  chapter,
  variant,
  optionMethod,
  expectedPrelude,
  expectedValidate,
  expectedRunner
}: TestObject) {
  const context = mockContext(chapter, variant)

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
  } else {
    // If not, the runner should only have been called once
    const [call0] = expectCalls(1, expectedRunner)

    // with isPrelude false
    expect(call0[2].isPrelude).toEqual(false)
  }

  // Ensure that the validator has either been called
  // or not been called
  expect(validator.validateAndAnnotate).toHaveBeenCalledTimes(expectedValidate ? 1 : 0)

  // Ensure that the execution method on the context is set
  // appropriately
  expect(context.executionMethod).toEqual(expectedRunner)
}

function testCases(desc: string, cases: FullTestCase[]) {
  describe(desc, () =>
    test.each(
      cases.map(({ code, verboseErrors, chapter, variant, ...tc }, i) => {
        chapter = chapter ?? Chapter.SOURCE_1
        variant = variant ?? Variant.DEFAULT

        const chapterName = getChapterName(chapter)
        let desc = `${i + 1}. Testing ${chapterName}, Variant: ${variant}, expected ${tc.expectedRunner} runner`
        code = code ?? ''
        if (verboseErrors) {
          code = `"enable verbose";\n${code}`
          desc += ' (verbose errors)'
        }

        return [desc, { code, chapter, variant, ...tc }]
      })
    )('%s', async (_, to) => testCase(to))
  )
}

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
    fullJSCases.flatMap((tc): FullTestCase[] => {
      const fullCase: FullTestCase = {
        ...tc,
        verboseErrors: false,
        expectedPrelude: false,
        expectedRunner: 'fulljs',
        expectedValidate: false
      }

      const verboseErrorCase: FullTestCase = {
        ...fullCase,
        verboseErrors: true
      }

      return [fullCase, verboseErrorCase]
    })
  )

  testCases(
    'Test alt-langs',
    altLangCases.flatMap(chapter =>
      objectValues(Variant).map(
        (variant): FullTestCase => ({
          code: '',
          variant,
          chapter,
          expectedPrelude: false,
          expectedValidate: false,
          expectedRunner: 'fulljs',
          verboseErrors: false
        })
      )
    )
  )

  test('if optionMethod is specified, verbose errors is ignored', () =>
    testCase({
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
    testCase({
      code: 'debugger; 0;',
      optionMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native',
      expectedValidate: true
    }))

  test('debugger statements require cse-machine', () =>
    testCase({
      code: 'debugger; 0;',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'cse-machine',
      expectedValidate: true
    }))
})
