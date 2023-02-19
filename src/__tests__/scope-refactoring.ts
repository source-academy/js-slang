import { Program } from 'estree'

import { default as createContext } from '../createContext'
import { getAllOccurrencesInScope } from '../index'
import { looseParse } from '../parser/utils'
import {
  getAllIdentifiers,
  getBlockFramesInCurrentBlockFrame,
  getBlockFromLoc,
  getNodeLocsInCurrentBlockFrame,
  getScopeHelper,
  scopeVariables
} from '../scope-refactoring'
import { BlockFrame, Chapter } from '../types'
/* tslint:disable:max-classes-per-file */

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
  ),
  new CodeTest(
    'Test 1',
    `function parse_and_eval(1) {
      eval_top_level(1);
    }
    function repl(str) {
      const res = parse_and_eval(23);
    }`,
    [new Target('parse_and_eval', 1, 13)]
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
    [new Target('target', 3, 5), new Target('i', 2, 10)]
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
  ),
  new CodeTest(
    'Test 4',
    `
    let i = "dontgetconfusedwith the next one pls";
      for (let i = 0; i < 10; i++) {
        target += 99;
      }
    `,
    [new Target('i', 2, 10), new Target('i', 1, 5)]
  )
]

test('Scoped based refactoring of ordinary variable definitions', () => {
  const context = createContext(Chapter.SOURCE_4)
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
  const context = createContext(Chapter.SOURCE_4)
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
  const context = createContext(Chapter.SOURCE_4)
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
  const context = createContext(Chapter.SOURCE_4)
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

test('scopeVariables should return an accurate scope tree', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `
    const anakin = "chancellor palpatine is evil";
    const obiwan = "from my point of view the jedi are evil";
    function disneyTrilogy() {
      const isWorseThanPrequels = true;
      return isWorseThanPrequels;
    }
    function functionmcfunctionface() {
      const x = (corona) => (virus) => corona + virus;
      let hahaha = "be";
      return hahaha;
    }
  `
  expect(scopeVariables(looseParse(program, context) as Program)).toMatchSnapshot()
})

test('scopeVariables should return an accurate scope tree with normal block scopes', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `
    const anakin = 'chancellor palpatine is evil';
    const obiwan = 'from my point of view the jedi are evil';
    function disneyTrilogy() {
      const isWorseThanPrequels = true;
      return isWorseThanPrequels;
    }
    {
      for (let i = 0; i < 10; i++) {
        const x = 'nooooooooo';
      }
      if (true) {
        const y = 10;
      } else if (false) {
        const t = 10;
      } else {
        const jfksdfjgk = 'S/U the semester!';
      }
    }
  `
  expect(scopeVariables(looseParse(program, context) as Program)).toMatchSnapshot()
})

test('getBlockFromLoc with normal variable name', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    return dancingqueen;
  }
}`
  const scopedTree = scopeVariables(looseParse(program, context) as Program)
  const loc = { start: { line: 8, column: 12 }, end: { line: 8, column: 23 } }
  expect(getBlockFromLoc(loc, scopedTree)).toMatchSnapshot()
})

test('getBlockFromLoc with function definition name', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
function picklerick() {
  return 1;
}
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    return dancingqueen;
  }
  picklerick();
}`
  const scopedTree = scopeVariables(looseParse(program, context) as Program)
  const loc = { start: { line: 13, column: 3 }, end: { line: 13, column: 12 } }
  expect(getBlockFromLoc(loc, scopedTree)).toMatchSnapshot()
})

test('getBlockFromLoc with arrow function name', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
const picklerick() = x => {
  return 1;
};
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    return dancingqueen;
  }
  picklerick();
}`
  const scopedTree = scopeVariables(looseParse(program, context) as Program)
  const loc = { start: { line: 13, column: 3 }, end: { line: 13, column: 12 } }
  expect(getBlockFromLoc(loc, scopedTree)).toMatchSnapshot()
})

test('getAllIdentifiers should get all indentifiers regardless of scope', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
const picklerick() = x => {
  return 1;
};
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    const virus = 'OwO';
    return dancingqueen;
  }
  picklerick();
}
for (let i = 0; i < 10; i++) {
  while (1 > 0) {
    // do something cool
  }
  function wowThisIsANestedFunction(x) {
    const virus = 'imameme';
    const coronavirus = 'memememe' + virus;
    return x + 'wowwowowowowowowowowow uwu';
  }
  wowThisIsANestedFunction('UwU');
}
if (true) {
  const x = 2;
} else if (false) {
  const x = corona => virus => coronavirus;
} else {
  return 'idontliketests';
}
`
  expect(getAllIdentifiers(looseParse(program, context) as Program, 'virus').length).toBe(4)
})

test('getNodeLocsInCurrentBlockFrame should return all nodes in the current block frame', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
const picklerick() = x => {
  return 1;
};
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    const virus = 'OwO';
    return dancingqueen;
  }
  picklerick();
}
for (let i = 0; i < 10; i++) {
  while (1 > 0) {
    // do something cool
  }
  function wowThisIsANestedFunction(x) {
    const virus = 'imameme';
    const coronavirus = 'memememe' + virus;
    return x + 'wowwowowowowowowowowow uwu';
  }
  wowThisIsANestedFunction('UwU');
}
if (true) {
  const x = 2;
} else if (false) {
  const x = corona => virus => coronavirus;
} else {
  return 'idontliketests';
}`
  const block = scopeVariables(looseParse(program, context) as Program)
  const identifiers = getAllIdentifiers(looseParse(program, context) as Program, 'virus')
  expect(
    getNodeLocsInCurrentBlockFrame(
      identifiers,
      {
        start: { line: 1, column: 1 },
        end: { line: 33, column: 2 }
      },
      [block]
    ).length
  ).toBe(0)
})

test('getBlockFramesInCurrentBlockFrame', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `const y = true;
const dancingqueen = 'you can dance, you can jive';
const nextline = 'having the time of your life';
const picklerick() = x => {
  return 1;
};
{
  const lmao = dancingqueen;
  function abba() {
    const bestSong = 'the winnner takes it all';
    const virus = 'OwO';
    return dancingqueen;
  }
  picklerick();
}
for (let i = 0; i < 10; i++) {
  while (1 > 0) {
    // do something cool
  }
  function wowThisIsANestedFunction(x) {
    const virus = 'imameme';
    const coronavirus = 'memememe' + virus;
    return x + 'wowwowowowowowowowowow uwu';
  }
  wowThisIsANestedFunction('UwU');
}
if (true) {
  const x = 2;
} else if (false) {
  const x = corona => virus => coronavirus;
} else {
  return 'idontliketests';
}`
  const block = scopeVariables(looseParse(program, context) as Program)
  const blockFrames = block.children.filter(node => node.type === 'BlockFrame')
  expect(
    getBlockFramesInCurrentBlockFrame(
      blockFrames as BlockFrame[],
      {
        start: { line: 1, column: 1 },
        end: { line: 33, column: 2 }
      },
      []
    ).length
  ).toBe(6)
})

test('getScopeHelper', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const definitionLocation = {
    start: { line: 2, column: 10 },
    end: { line: 2, column: 11 }
  }
  expect(getScopeHelper(definitionLocation, looseParse(program, context) as any, 'x').length).toBe(
    2
  )
})

test('getScopeHelperNested', () => {
  const context = createContext(Chapter.SOURCE_4)
  const program = `{
    const x = 1;
    {
        const x = 2;
        function f(y) {
            return x + y;
        }
    }
    display(x);
  }`
  const definitionLocation = {
    start: { line: 4, column: 15 },
    end: { line: 4, column: 16 }
  }
  expect(getScopeHelper(definitionLocation, looseParse(program, context) as any, 'x').length).toBe(
    1
  )
})
