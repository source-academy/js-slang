import { stripIndent } from '../../utils/formatters'
import { expectResult } from '../../utils/testing'
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

// ==================== LAZY TESTS =====================
const additionTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
    43694 + 89076;
  `,
    '132770',
    'addition'
  )

const subtractionTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
    83553 - 28018;
  `,
    '55535',
    'subtraction'
  )

const multiplicationTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  95533 * 269;
`,
    '25698377',
    'multiplication'
  )

const divisionTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  69573 / 7;
`,
    '9939',
    'division'
  )

const equalityTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  4 === 423;
`,
    'false',
    'equality'
  )

const inequalityTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  577 !== 577;
`,
    'false',
    'inequality'
  )

const logicalAndTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  true && false;
`,
    'false',
    'logical and'
  )

const logicalOrTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  true || error();
`,
    'true',
    'logical Or'
  )

const logicalAndTestLazy = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  false && error();
`,
    'false',
    'logical and (lazy)'
  )

const conditionalsTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  false ? 20 : 46;
`,
    '46',
    'conditionals test'
  )

const conditionalsTestLazyConsequent = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  false ? error() : 934;
`,
    '934',
    'conditionals test (lazy consequent)'
  )

const conditionalsTestLazyAlternative = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  true ? 782 : error();
`,
    '782',
    'conditionals test (lazy alternative)'
  )

const nestedExpressionsTest = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
  (true && (true || false)) ? (441 * 2) : (7 + 245);
`,
    '882',
    'nested expressions test'
  )

// ================== RUN THE TESTS ====================
const testArray = [
  additionTest,
  subtractionTest,
  multiplicationTest,
  divisionTest,
  equalityTest,
  inequalityTest,
  logicalAndTest,
  logicalOrTest,
  logicalAndTestLazy,
  conditionalsTest,
  conditionalsTestLazyConsequent,
  conditionalsTestLazyAlternative,
  nestedExpressionsTest
]
testArray.forEach(tst => tst('interpreter'))
testArray.forEach(tst => tst('native'))
testArray.forEach(tst => tst('auto'))
