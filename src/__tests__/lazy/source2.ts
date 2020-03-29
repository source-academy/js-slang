import { stripIndent } from '../../utils/formatters'
import { expectResult, expectDisplayResult } from '../../utils/testing'
import { LAZY_SOURCE_2 } from '../../lazyContext'
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
      chapter: LAZY_SOURCE_2,
      executionMethod
    }).toMatchInlineSnapshot(result)
  })

const runTestForDisplay = (
  executionMethod: ExecutionMethod,
  program: string,
  displayed: string,
  testName: string
) =>
  test(testName + ' (' + executionMethod + ')', () => {
    return expectDisplayResult(stripIndent(program), {
      chapter: LAZY_SOURCE_2,
      executionMethod
    }).toMatchInlineSnapshot(displayed)
  })

// ==================== LAZY TESTS =====================
const mapReturnsCorrectly = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
force_pair(map(x => x / 2, list(2, 4, 8)));
`,
    `
Array [
  1, Array [
    2, Array [
      4, null
    ]
  ]
]
  `,
    'map returns the correct list'
  )

const filterReturnsCorrectly = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
force_pair(filter(x => x % 2 === 0, list(1, 2, 3, 4, 5, 6)));
`,
    `
Array [
  2, Array [
    4, Array [
      6, null
    ]
  ]
]
  `,
    'filter returns the correct list'
  )

const listsAreMemoised = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
  const ones = pair(1, ones);
  const twos = map(x => {
          display("mapped");
          return x * 2;
      }, ones);
  force(head(twos));
  force(head(twos));
  head(twos);
`,
    `
Array [
  "\\"mapped\\"",
]
  `,
    'lists are memoised'
  )

const listsAreMappedLazily = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
  const ones = pair(1, ones);
  const twos = map(x => {
          display("mapped");
          return x * 2;
      }, ones);
  force(head(twos));
  head(tail(twos));
`,
    `
Array [
  "\\"mapped\\"",
  "\\"mapped\\""
]
  `,
    'lists are mapped lazily'
  )

// ================== RUN THE TESTS ====================
const testArray = [
  mapReturnsCorrectly,
  filterReturnsCorrectly,
  listsAreMemoised,
  listsAreMappedLazily
]
testArray.forEach(tst => tst('interpreter'))
testArray.forEach(tst => tst('native'))
testArray.forEach(tst => tst('auto'))
