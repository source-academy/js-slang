import * as es from 'estree'
import { default as createContext } from '../createContext'
import { looseParse, parse } from '../parser'
import { getAllOccurrencesInScope, lookupDefinition, scopeVariables } from '../scoped-vars'

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

const variableDefinitionTests = [
  {
    code: 'let target = 1;\n\
target = 2;\n\
{\n\
  const target = 3;\n\
  target + 4;\n\
}',
    target: { varName: 'target', row: 5, col: 3 }
  },
  {
    code: 'let target = 1;\n\
target = 2;\n\
target + 99;\n',
    target: { varName: 'target', row: 3, col: 3 }
  },
  {
    code: 'let target = 1;\n\
target = 2;\n\
target + 99;\n',
    target: { varName: 'MISSING', row: 3, col: 3 }
  }
]

const functionScopeTests = [
  {
    code:
      'let target = 1;\n\
target = 2;\n\
function test(target) {\n\
  const x = 3;\n\
  target + 4;\n\
  function y() {\n\
    target * 99;\n\
  }\n \
}',
    target: { varName: 'target', row: 7, col: 7 }
  },
  {
    code:
      'let target = 1;\n\
target = 2;\n\
function test(target) {\n\
  const x = 3;\n\
  target + 4;\n\
  function y() {\n\
    target * 99;\n\
  }\n \
}',
    target: { varName: 'target', row: 5, col: 6 }
  }
]

const arrowFunctionScopeTests = [
  {
    code:
      'let target = 1;\n\
function test(target) {\n\
  const arrowFn = target => target + 1;\n\
  const x = target * 777777;\n\
}',
    target: { varName: 'target', row: 3, col: 31 }
  },
  {
    code:
      'let target = 1;\n\
function test(target) {\n\
  const arrowFn = target => target + 1;\n\
  const x = target * 777777;\n\
  const nestedArrowFn = (y) => (target) => 1 + target;\n\
}',
    target: { varName: 'target', row: 5, col: 53 }
  }
]

const conditionalsLoopsTests = [
  {
    code:
      'let target = 1;\n\
if (target < 2) {\n\
  target = 2 + 3;\n\
} else if (target > 2) {\n\
  target = "noooooo";\n\
} else {\n\
  target = 99999;\n\
}\n\
',
    target: { varName: 'target', row: 5, col: 7 }
  },
  {
    code: 'let target = 2;\n\
for (let i = 0; i < 10; i++) {\n\
  target += 99;\n\
}\n\
',
    target: { varName: 'target', row: 3, col: 5 }
  },
  {
    code:
      'let target = 2;\n\
for (let target = 0; target < 10; target++) {\n\
  target += 99;\n\
}\n\
',
    target: { varName: 'target', row: 2, col: 13 }
  },
  {
    code: 'let target = 2;\n\
for (let i = 0; i < 10; i++) {\n\
  target += 99;\n\
}\n\
',
    target: { varName: 'i', row: 5, col: 2 }
  },
  {
    code:
      'let target = 2;\n\
while (target > 0) {\n\
  const x = "i am coronavirus";\n\
  target -= 0.1;\n\
}\n\
',
    target: { varName: 'target', row: 4, col: 4 }
  }
]

test('Going to definitions of ordinary variable definitions', () => {
  const actuals: any = []
  variableDefinitionTests.forEach(testCase => {
    const { code, target } = testCase
    const program = testParseHelper(code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    actuals.push(lookupDefinition(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring of ordinary variable definitions', () => {
  const actuals: any = []
  variableDefinitionTests.forEach(testCase => {
    const { code, target } = testCase
    const scopedTree = testParseHelper(code)
    if (scopedTree === undefined) {
      return
    }
    actuals.push(getAllOccurrencesInScope(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions of with function scopes', () => {
  const actuals: any = []
  functionScopeTests.forEach(testCase => {
    const { code, target } = testCase
    const program = testParseHelper(code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    actuals.push(lookupDefinition(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with function scopes', () => {
  const actuals: any = []
  functionScopeTests.forEach(testCase => {
    const { code, target } = testCase
    const scopedTree = testParseHelper(code)
    if (scopedTree === undefined) {
      return
    }
    actuals.push(getAllOccurrencesInScope(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions with arrow function scopes', () => {
  const actuals: any = []
  arrowFunctionScopeTests.forEach(testCase => {
    const { code, target } = testCase
    const program = testParseHelper(code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    actuals.push(lookupDefinition(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with arrow function scopes', () => {
  const actuals: any = []
  arrowFunctionScopeTests.forEach(testCase => {
    const { code, target } = testCase
    const scopedTree = testParseHelper(code)
    if (scopedTree === undefined) {
      return
    }
    actuals.push(getAllOccurrencesInScope(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Going to definitions of with conditionals and loops', () => {
  const actuals: any = []
  conditionalsLoopsTests.forEach(testCase => {
    const { code, target } = testCase
    const program = testParseHelper(code)
    if (program === undefined) {
      return
    }
    const scopedTree = scopeVariables(program)
    actuals.push(lookupDefinition(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})

test('Scoped based refactoring with conditionals and loops', () => {
  const actuals: any = []
  conditionalsLoopsTests.forEach(testCase => {
    const { code, target } = testCase
    const scopedTree = testParseHelper(code)
    if (scopedTree === undefined) {
      return
    }
    actuals.push(getAllOccurrencesInScope(target.varName, target.row, target.col, scopedTree))
  })
  expect(actuals).toMatchSnapshot()
})
