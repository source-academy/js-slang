import { stripIndent } from '../../utils/formatters'
import { expectResult, expectParsedError, expectDisplayResult } from '../../utils/testing'
import { LAZY_SOURCE_1 } from '../../lazyContext'
import { ExecutionMethod } from '../../types'

// ================= UTILITY FUNCTIONS =================
const runTestSuccess = (
  executionMethod: ExecutionMethod,
  program: string,
  result: string,
  testName: string
) =>
  test(testName + ' (' + executionMethod + ')', () => {
    return expectResult(stripIndent(program), {
      chapter: LAZY_SOURCE_1,
      executionMethod
    }).toMatchInlineSnapshot(result)
  })

const runTestError = (
  executionMethod: ExecutionMethod,
  program: string,
  error: string,
  testName: string
) =>
  test(testName + ' (' + executionMethod + ')', () => {
    return expectParsedError(stripIndent(program), {
      chapter: LAZY_SOURCE_1,
      executionMethod
    }).toMatchInlineSnapshot(error)
  })

const runTestForDisplay = (
  executionMethod: ExecutionMethod,
  program: string,
  displayed: string,
  testName: string
) =>
  test(testName + ' (' + executionMethod + ')', () => {
    return expectDisplayResult(stripIndent(program), {
      chapter: LAZY_SOURCE_1,
      executionMethod
    }).toMatchInlineSnapshot(displayed)
  })

// ==================== LAZY TESTS =====================
const isNumberReturnsTrue = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_number(145);
`,
    'true',
    'is number returns true for number'
  )

const isNumberReturnsFalse = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_number(true);
`,
    'false',
    'is number returns false for boolean'
  )

const isBooleanReturnsTrue = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_boolean(true || false);
`,
    'true',
    'is boolean returns true for boolean'
  )

const isBooleanReturnsFalse = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_boolean("hello");
`,
    'false',
    'is boolean returns false for string'
  )

const isStringReturnsTrue = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_string("");
`,
    'true',
    'is string returns true for string'
  )

const isStringReturnsFalse = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_string(() => "world");
`,
    'false',
    'is string returns false for function'
  )

const isFunctionReturnsTrue = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_function((x, y) => x + y);
`,
    'true',
    'is function returns true for function'
  )

const isFunctionReturnsFalse = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  is_function(670);
`,
    'false',
    'is function returns false for number'
  )

const lazyAccessOfNames = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  const a = 1 + a;
`,
    'undefined',
    'names are lazily accessed'
  )

const lazyFunctionArguments = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  function try_me(test, alternative) {
      return test ? 123 : alternative;
  }
  try_me(true, head(null));
`,
    '123',
    'function arguments are lazily evaluated'
  )

const errorEvaluatesToError = (executionMethod: ExecutionMethod) =>
  runTestError(
    executionMethod,
    `
  error("This is the error");
  `,
    '"Line 1: Error: \\"This is the error\\""',
    'error evaluates to error'
  )

const lazyEvaluationOfFunctions = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
  function square(x) {
      display("squared");
      return x * x;
  }
  const sq = square(7);
`,
    'Array []',
    'function does not run if it does not need to'
  )

const lazyMemoisation = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
  function square(x) {
      display("squared");
      return x * x;
  }
  const sq = square(7);
  force(sq);
  force(sq);
  sq;
`,
    `
Array [
  "\\"squared\\"",
]
`,
    'function only runs once and value is memoised'
  )

// ================== RUN THE TESTS ====================
const testArray = [
  isNumberReturnsTrue,
  isNumberReturnsFalse,
  isBooleanReturnsTrue,
  isBooleanReturnsFalse,
  isStringReturnsTrue,
  isStringReturnsFalse,
  isFunctionReturnsTrue,
  isFunctionReturnsFalse,
  lazyAccessOfNames,
  lazyFunctionArguments,
  lazyEvaluationOfFunctions,
  lazyMemoisation,
  errorEvaluatesToError
]
testArray.forEach(tst => tst('interpreter'))
testArray.forEach(tst => tst('native'))
testArray.forEach(tst => tst('auto'))
