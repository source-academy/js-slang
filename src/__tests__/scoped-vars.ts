import * as es from 'estree'
import { default as createContext } from '../createContext'
import { looseParse, parse } from '../parser/parser'
import { getAllOccurrencesInScope, lookupDefinition, scopeVariables } from '../scoped-vars'
/* tslint:disable:max-classes-per-file */

/**
 * Helper function to get the parsed estree program to test the function
 */
function testParseHelper(
  code: string,
  // default to 4
  chapter: number = 4,
  useLooseParser: boolean = false
): es.Program | undefined {
  if (useLooseParser) {
    return looseParse(code, createContext(chapter))
  } else {
    return parse(code, createContext(chapter))
  }
}

class Target {
  public name: string
  public row: number
  public col: number

  constructor(name: string, row: number, col: number) {
    this.name = name
    this.row = row
    this.col = col
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
    [new Target('target', 3, 3), new Target('MISSING', 3, 3)]
  )
]

const functionScopeTests = [
  new CodeTest(
    'Test 1',
    `
      let target = 1;
      target = 2;
      function test(target) {
        const x = 3;
        target + 4;
        function y() {
          target * 99;
        }
      }
    `,
    [new Target('target', 7, 7), new Target('target', 5, 6)]
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
    [new Target('target', 5, 53)]
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
    [new Target('target', 5, 7)]
  ),
  new CodeTest(
    'Test 2',
    `
      let target = 2;
      for (let i = 0; i < 10; i++) {
        target += 99;
      }
    `,
    [new Target('target', 3, 5), new Target('target', 2, 13), new Target('i', 5, 2)]
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

test('Going to definitions of ordinary variable definitions', () => {
  const actuals: any = []
  variableDefinitionTests.forEach(testCase => {
    const program = testParseHelper(testCase.code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    testCase.targets.forEach(target => {
      actuals.push(
        result(testCase, target, lookupDefinition(target.name, target.row, target.col, scopedTree))
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring of ordinary variable definitions', () => {
  const actuals: any = []
  variableDefinitionTests.forEach(testCase => {
    const scopedTree = testParseHelper(testCase.code)
    if (scopedTree === undefined) {
      return
    }
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(target.name, target.row, target.col, scopedTree)
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions of with function scopes', () => {
  const actuals: any = []
  functionScopeTests.forEach(testCase => {
    const program = testParseHelper(testCase.code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    testCase.targets.forEach(target => {
      actuals.push(
        result(testCase, target, lookupDefinition(target.name, target.row, target.col, scopedTree))
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with function scopes', () => {
  const actuals: any = []
  functionScopeTests.forEach(testCase => {
    const scopedTree = testParseHelper(testCase.code)
    if (scopedTree === undefined) {
      return
    }
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(target.name, target.row, target.col, scopedTree)
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions with arrow function scopes', () => {
  const actuals: any = []
  arrowFunctionScopeTests.forEach(testCase => {
    const program = testParseHelper(testCase.code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    testCase.targets.forEach(target => {
      actuals.push(
        result(testCase, target, lookupDefinition(target.name, target.row, target.col, scopedTree))
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with arrow function scopes', () => {
  const actuals: any = []
  arrowFunctionScopeTests.forEach(testCase => {
    const scopedTree = testParseHelper(testCase.code)
    if (scopedTree === undefined) {
      return
    }
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(target.name, target.row, target.col, scopedTree)
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions of with conditionals and loops', () => {
  const actuals: any = []
  conditionalsLoopsTests.forEach(testCase => {
    const program = testParseHelper(testCase.code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    testCase.targets.forEach(target => {
      actuals.push(
        result(testCase, target, lookupDefinition(target.name, target.row, target.col, scopedTree))
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with conditionals and loops', () => {
  const actuals: any = []
  conditionalsLoopsTests.forEach(testCase => {
    const scopedTree = testParseHelper(testCase.code)
    if (scopedTree === undefined) {
      return
    }
    testCase.targets.forEach(target => {
      actuals.push(
        result(
          testCase,
          target,
          getAllOccurrencesInScope(target.name, target.row, target.col, scopedTree)
        )
      )
    })
  })
  expect(actuals).toMatchSnapshot()
})
