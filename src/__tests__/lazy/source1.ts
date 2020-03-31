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

const recursiveFunctionWorks = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function m(f, x) {
    display("m");
    return x === 0
        ? x
        : f(x) + m(f, x - 1);
}
m(x => x * 2, 4);
`,
    '20',
    'recursive function works'
  )

const recursiveFunctionWorksDisplay = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
function m(f, x) {
    display("m");
    return x === 0
        ? x
        : f(x) + m(f, x - 1);
}
m(x => x * 2, 4);
`,
    `
Array [
  "\\"m\\"",
  "\\"m\\"",
  "\\"m\\"",
  "\\"m\\"",
  "\\"m\\"",
]
`,
    'recursive function gives correct display statements'
  )

const unusedFunctionArgumentsNotEvaluatedError = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function add(a, b) {
    return b;
}
add(error(), 3);
`,
    '3',
    'function arguments (error) that are unused are not evaluated'
  )

const unusedFunctionArgumentsNotEvaluatedDisplay = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
function add(a, b) {
    return b;
}
add((() => display("helo"))(), 3);
`,
    'Array []',
    'function arguments (display) that are unused are not evaluated'
  )

const unusedStatementsNotEvaluated = (executionMethod: ExecutionMethod) =>
  runTestForDisplay(
    executionMethod,
    `
(() => display("helo"))();
76;
`,
    'Array []',
    'statements that are unused are not evaluated'
  )

const assignmentUsingNamesWorks = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
const a = 4;
const g = a;
g;
`,
    '4',
    'variable assignment to another name works'
  )

const ifStatementsWork = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function if_else(cond) {
    if (cond) {
        return 456;
    } else {
        error();
        return 987;
    }
}
if_else(true && (false || true));
`,
    '456',
    'if statements work'
  )

const elseStatementsWork = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function if_else(cond) {
    if (cond) {
        error();
        return 456;
    } else {
      return 987;
    }
}
if_else(true && (false && true));
`,
    '987',
    'else statements work'
  )

const elseIfStatementsWork = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function int_type(x) {
    if (x < 0) {
        return "negative";
    } else if (x === 0) {
        return "zero";
    } else {
        return "positive";
    }
}
int_type(0);
`,
    '"zero"',
    'else if statements work'
  )

const ifElseStatementsMultiple = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
function int_type(x) {
    if (x < 0) {
        return "negative";
    } else if (x === 0) {
        return "zero";
    } else if (x === 1) {
        return "one";
    } else if (x === 2) {
        return "two";
    } else if (x === 3) {
        return "three";
    } else if (x === 4) {
        return "four";
    } else if (x === 5) {
        return "five";
    } else {
        return "positive";
    }
}
int_type(9);
`,
    '"positive"',
    'multiple if-else statements work'
  )

const expressionEvaluatingToNumberInIfGivesError = (executionMethod: ExecutionMethod) =>
  runTestError(
    executionMethod,
    `
function f() {
    return 5;
}
if (f()) {
    display("if");
} else {
    display("else");
}
  `,
    '"Line 4: Expected boolean as condition, got number."',
    'execution of an if statement with an expression that evaluates ' + 'to a number gives an error'
  )

const numberLiteralInIfGivesError = (executionMethod: ExecutionMethod) =>
  runTestError(
    executionMethod,
    `
if (123456) {
    display("if");
} else {
    display("else");
}
  `,
    '"Line 1: Expected boolean as condition, got number."',
    'number literal in if statement gives an error'
  )

const selfMadePairsWork = (executionMethod: ExecutionMethod) =>
  runTestSuccess(
    executionMethod,
    `
const pair = (a, b) => str => str === "head" ? a : b;
const head = p => p("head");
const tail = p => p("tail");
const ones = pair(1, ones);
function list_add(x, y) {
    display(x);
    if (x === null || y === null) {
        return null;
    } else {
        return pair(head(x) + head(y), list_add(tail(x), tail(y)));
    }
}
const ints = pair(1, list_add(ones, ints));
head(tail(tail(tail(tail(ints)))));
`,
    '5',
    'self-made pairs work lazily'
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
  errorEvaluatesToError,
  recursiveFunctionWorks,
  recursiveFunctionWorksDisplay,
  unusedFunctionArgumentsNotEvaluatedError,
  unusedFunctionArgumentsNotEvaluatedDisplay,
  unusedStatementsNotEvaluated,
  assignmentUsingNamesWorks,
  ifStatementsWork,
  elseStatementsWork,
  elseIfStatementsWork,
  ifElseStatementsMultiple,
  expressionEvaluatingToNumberInIfGivesError,
  numberLiteralInIfGivesError,
  selfMadePairsWork
]
testArray.forEach(tst => tst('interpreter'))
testArray.forEach(tst => tst('native'))
testArray.forEach(tst => tst('auto'))
