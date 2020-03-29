import { default as createContext } from '../createContext'
import { getAllOccurrencesInScope } from '../index'
/* tslint:disable:max-classes-per-file */

const context = createContext(4)

class Target {
  public name: string
  public line: number
  public column: number

  constructor(name: string, line: number, column: number) {
    this.name = name
    this.line = line
    this.column = column
  }
}

class CodeTest {
  public label: string
  public _code: string
  public targets: Target[]
  public get code(): string {
    return this._code
      .trim()
      .split('\n')
      .map(line => line.trim())
      .join('\n')
  }
  public testAndAdd: (testFn: (code: string) => void) => void

  constructor(label: string, code: string, targets: Target[]) {
    this.label = label
    this._code = code
    this.targets = targets
  }
}

// Makes a more readable debuggable result
function result(testCase: CodeTest, target: Target, value: any) {
  return {
    label: testCase.label,
    code: testCase.code,
    target,
    value
  }
}

const variableDefinitionTests = [
  new CodeTest(
    'Test 1',
    `
      let target = 1;
      target = 2;
      {
        const target = 3;
        target + 4;
      }
    `,
    [new Target('target', 5, 3)]
  ),
  new CodeTest(
    'Test 2',
    `
      let target = 1;
      target = 2;
      target + 99;
    `,
    [new Target('target', 3, 3)]
  )
]

const functionScopeTests = [
  new CodeTest(
    'Test 1',
    `let target = 1;
      target = 2;
      function test(target) {
        const x = 3;
        target + 4;
        function y() {
          target * 99;
        }
      }
    `,
    [new Target('target', 7, 3), new Target('target', 1, 6)]
  )
]

const arrowFunctionScopeTests = [
  new CodeTest(
    'Test 1',
    `
      let target = 1;
      function test(target) {
        const arrowFn = target => target + 1;
        const x = target * 777777;
        const nestedArrowFn = (y) => (target) => 1 + target;
      }
    `,
    [new Target('target', 5, 48)]
  )
]

const conditionalsLoopsTests = [
  new CodeTest(
    'Test 1',
    `
      let target = 1;
      if (target < 2) {
        target = 2 + 3;
      } else if (target > 2) {
        target = "nooooooo";
      } else {
        target = 99999;
      }
    `,
    [new Target('target', 5, 2)]
  ),
  new CodeTest(
    'Test 2',
    `
      let target = 2;
      for (let i = 0; i < 10; i++) {
        target += 99;
      }
    `,
    [new Target('target', 3, 5), new Target('target', 2, 11), new Target('i', 5, 2)]
  ),
  new CodeTest(
    'Test 3',
    `
      let target = 2;
      while (target > 0) {
        const x = "i am coronavirus";
        target -= 0.1;
      }
    `,
    [new Target('target', 4, 4)]
  )
]

test('Scoped based refactoring of ordinary variable definitions', () => {
  const actuals: any = []
  variableDefinitionTests.forEach(testCase => {
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(testCase.code, context, {
            line: target.line,
            column: target.column
          })
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with function scopes', () => {
  const actuals: any = []
  functionScopeTests.forEach(testCase => {
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(testCase.code, context, {
            line: target.line,
            column: target.column
          })
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with arrow function scopes', () => {
  const actuals: any = []
  arrowFunctionScopeTests.forEach(testCase => {
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(testCase.code, context, {
            line: target.line,
            column: target.column
          })
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with conditionals and loops', () => {
  const actuals: any = []
  conditionalsLoopsTests.forEach(testCase => {
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(testCase.code, context, {
            line: target.line,
            column: target.column
          })
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})
