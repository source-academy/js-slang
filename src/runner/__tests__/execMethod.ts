import runners, { type RunnerTypes } from '../sourceRunner'
import { Chapter, type ExecutionMethod, Variant } from '../../types'
import type { Runner } from '../types'
import { DEFAULT_SOURCE_OPTIONS, runCodeInSource } from '..'
import { mockContext } from '../../utils/testing/mocks'
import { getChapterName, objectKeys, objectValues } from '../../utils/misc'
import { asMockedFunc } from '../../utils/testing/misc'
import { parseError } from '../..'

jest.mock('../sourceRunner', () => ({
  default: new Proxy({} as Record<string, Runner>, {
    get: (obj, prop: string) => {
      if (!(prop in obj)) {
        const mockRunner: Runner = (_, context) =>
          Promise.resolve({
            status: 'finished',
            value: '',
            context
          })

        obj[prop] = jest.fn(mockRunner)
      }
      return obj[prop]
    }
  })
}))

// Required since Typed variant tries to load modules
jest.mock('../../modules/loader')

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
  /**
   * Set this to simulate the context having a specific
   * execution method set
   */
  contextMethod?: ExecutionMethod
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

  verboseErrors?: boolean
}

const sourceCases: FullTestCase[] = [
  {
    chapter: Chapter.SOURCE_1,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true
  },
  {
    chapter: Chapter.SOURCE_2,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true
  },
  {
    chapter: Chapter.SOURCE_3,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true
  },
  {
    chapter: Chapter.SOURCE_4,
    variant: Variant.DEFAULT,
    expectedRunner: 'native',
    expectedPrelude: true
  },
  {
    contextMethod: 'native',
    variant: Variant.NATIVE,
    expectedRunner: 'native',
    expectedPrelude: false
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
  expectedRunner: RunnerTypes
  optionMethod?: ExecutionMethod
  contextMethod?: ExecutionMethod
}

function expectCalls(count: number, expected: RunnerTypes) {
  const unexpectedRunner = objectKeys(runners).find(runner => {
    const { calls } = asMockedFunc(runners[runner]).mock
    return calls.length > 0
  })

  switch (unexpectedRunner) {
    case undefined:
      throw new Error(
        `Expected ${expected} to be called ${count} times, but no runners were called`
      )
    case expected: {
      expect(runners[expected]).toHaveBeenCalledTimes(count)
      return asMockedFunc(runners[expected]).mock.calls
    }
    default: {
      const callCount = asMockedFunc(runners[unexpectedRunner]).mock.calls.length
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
  contextMethod,
  optionMethod,
  expectedPrelude,
  expectedRunner
}: TestObject) {
  const context = mockContext(chapter, variant)
  if (contextMethod !== undefined) {
    context.executionMethod = contextMethod
  }

  // Check if the prelude is null before execution
  // because the prelude gets set to null if it wasn't before
  const shouldPrelude = expectedPrelude && context.prelude !== null
  const options = { ...DEFAULT_SOURCE_OPTIONS }

  if (optionMethod !== undefined) {
    options.executionMethod = optionMethod
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
}

function testCases(desc: string, cases: FullTestCase[]) {
  describe(desc, () =>
    test.each(
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
        expectedRunner: 'fulljs'
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
      expectedRunner: 'native'
    }))

  test('if optionMethod is specified, debubger statements are ignored', () =>
    testCase({
      code: 'debugger; 0;',
      optionMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native'
    }))

  test('if contextMethod is specified, verbose errors is ignored', () =>
    testCase({
      code: '"enable verbose"; 0;',
      contextMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native'
    }))

  test('if contextMethod is specified, debugger statements are ignored', () =>
    testCase({
      code: 'debugger; 0;',
      contextMethod: 'native',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'native'
    }))

  test('optionMethod takes precedence over contextMethod', () =>
    testCase({
      code: '0;',
      contextMethod: 'native',
      optionMethod: 'cse-machine',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'cse-machine'
    }))

  test('debugger statements require cse-machine', () =>
    testCase({
      code: 'debugger; 0;',
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT,
      expectedPrelude: true,
      expectedRunner: 'cse-machine'
    }))
})
