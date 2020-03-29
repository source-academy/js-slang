import { stripIndent } from '../../utils/formatters'
import { expectResult, expectDisplayResult, expectParsedError } from '../../utils/testing'
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

const runTestError = (
  executionMethod: ExecutionMethod,
  program: string,
  error: string,
  testName: string
) =>
  test(testName + ' (' + executionMethod + ')', () => {
    return expectParsedError(stripIndent(program), {
      chapter: LAZY_SOURCE_2,
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
      chapter: LAZY_SOURCE_2,
      executionMethod
    }).toMatchInlineSnapshot(displayed)
  })

// ==================== LAZY TESTS =====================
const mapReturnsCorrectly = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
equal(map(x => x / 2, list(2, 4, 8)), list(1, 2, 4));
`,
    'true',
    'map returns the correct list'
  )

const filterReturnsCorrectly = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
equal(filter(x => x % 2 === 0, list(1, 2, 3, 4, 5, 6)), list(2, 4, 6));
`,
    'true',
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
  "\\"mapped\\"",
]
`,
    'lists are mapped lazily'
  )

const selfDeclaredMapFunctionWorks = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function m(f, xs) {
    display("m");
    return is_null(xs)
        ? xs
        : pair(f(head(xs)), m(f, tail(xs)));
}
const s = x => x * 3;
stringify(force_pair(m(s, list(1, 2, 3))));
`,
    '"[3, [6, [9, null]]]"',
    'a self-declared map function gives correct display statements'
  )

const selfDeclaredMapFunctionWorksDisplay = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
function m(f, xs) {
    display("m");
    return is_null(xs)
        ? xs
        : pair(f(head(xs)), m(f, tail(xs)));
}
const s = x => x * 3;
stringify(force_pair(m(s, list(1, 2, 3))));
`,
    `
Array [
  "\\"m\\"",
  "\\"m\\"",
  "\\"m\\"",
  "\\"m\\"",
]
`,
    'a self-declared map function gives correct display statements'
  )

const selfDeclaredMapFunctionIsLazy = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
function m(f, xs) {
    display("m");
    return is_null(xs)
        ? xs
        : pair(f(head(xs)), m(f, tail(xs)));
}
const s = x => x * 3;
head(m(s, list(1, 2, 3)));
`,
    `
Array [
  "\\"m\\"",
]
`,
    'a self-declared map function only evaluates the required amount'
  )

const selfDeclaredMapFunctionOneElement = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function m(f, xs) {
    display("m");
    return is_null(xs)
        ? xs
        : pair(f(head(xs)), m(f, tail(xs)));
}
const s = x => x * 3;
head(m(s, list(1, 2, 3)));
`,
    '3',
    'a self-declared map function works to give the first element in a list'
  )

const permutationsWorks = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function permutations(s) {
    return is_null(s)
        ? list(null)
        : accumulate(append, null,
            map(x => map(p => pair(x, p),
                         permutations(remove(x, s))),
                s));
}

equal(permutations(list(1, 2, 3)), list(list(1, 2, 3),
                                        list(1, 3, 2),
                                        list(2, 1, 3),
                                        list(2, 3, 1),
                                        list(3, 1, 2),
                                        list(3, 2, 1)));
`,
    'true',
    'permutations function works in lazy'
  )

const filterWorksLazilyResult = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
const xs = list(1, 2, 3, 4, 5, 6);
const filtered = filter(x => {
        display("filter");
        return x % 2 === 0;
    }, xs);
head(filtered);
`,
    '2',
    'filter function works lazily'
  )

const filterWorksLazilyDisplay = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
const xs = list(1, 2, 3, 4, 5, 6);
const filtered = filter(x => {
        display("filter");
        return x % 2 === 0;
    }, xs);
head(filtered);
`,
    `
Array [
  "\\"filter\\"",
  "\\"filter\\"",
]
`,
    'filter function gives correct display statements'
  )

const wrongNumberOfArgumentsNoError = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
const xs1 = list(7, 8, 9, 10, 11, 13);
const sum = accumulate((x, y) => {
        display("add");
        return x + y;
    }, xs1);
`,
    'undefined',
    'wrong number of arguments works, as long as it is not called'
  )

const wrongNumberOfArgumentsError = (executionMethod: ExecutionMethod) =>
  runTestError(
    executionMethod,
    `
const xs1 = list(7, 8, 9, 10, 11, 13);
const sum = accumulate((x, y) => {
        display("add");
        return x + y;
    }, xs1);
sum;
`,
    '"Line 2: Expected 3 arguments, but got 2."',
    'wrong number of arguments gives error when called'
  )

const accumulateWorks = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
const xs2 = list(7, 8, 9, 10, 11, 13);
const sum1 = accumulate((x, y) => {
        display("add");
        return x + y;
    }, 0, xs2);
sum1;
`,
    '58',
    'accumulate gives correct result'
  )

const accumulateWorksDisplay = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
const xs2 = list(7, 8, 9, 10, 11, 13);
const sum1 = accumulate((x, y) => {
        display("add");
        return x + y;
    }, 0, xs2);
sum1;
`,
    `
Array [
  "\\"add\\"",
  "\\"add\\"",
  "\\"add\\"",
  "\\"add\\"",
  "\\"add\\"",
  "\\"add\\"",
]
`,
    'accumulate gives correct display statements'
  )

// ================== RUN THE TESTS ====================
const testArray = [
  mapReturnsCorrectly,
  filterReturnsCorrectly,
  listsAreMemoised,
  listsAreMappedLazily,
  selfDeclaredMapFunctionWorks,
  selfDeclaredMapFunctionWorksDisplay,
  selfDeclaredMapFunctionIsLazy,
  selfDeclaredMapFunctionOneElement,
  permutationsWorks,
  filterWorksLazilyResult,
  filterWorksLazilyDisplay,
  wrongNumberOfArgumentsNoError,
  wrongNumberOfArgumentsError,
  accumulateWorks,
  accumulateWorksDisplay
]
testArray.forEach(tst => tst('interpreter'))
testArray.forEach(tst => tst('native'))
testArray.forEach(tst => tst('auto'))
