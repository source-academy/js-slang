import { instrument } from '../instrument'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Program } from 'estree'

function checkMatchInInstrumentedCode(
  main: string,
  matchers: (string | RegExp)[],
  codeHistory?: string[],
  builtins: string[] = []
) {
  const context = mockContext(4)
  const program = parse(main, context)
  expect(program).not.toBeUndefined()
  let previous: Program[] = []
  if (codeHistory !== undefined) {
    const restOfCode = codeHistory.map(x => parse(x, context))
    for (const code of restOfCode) {
      expect(code).not.toBeUndefined()
    }
    previous = restOfCode as Program[]
  }
  const [code, _1, _2, _3] = instrument(previous, program as Program, builtins)
  for (const toCheck of matchers) {
    expect(code).toMatch(toCheck)
  }
}

test('globals from old code added as var', () => {
  const main = 'display(x);'
  const prev = ['const y = 3;let z = 2;', 'let w = 4;']
  checkMatchInInstrumentedCode(main, ['var y', 'var z', 'var w'], prev)
})

test('shadowed variables are renamed', () => {
  const main = `function y(y){y(1);}
    y(2);`
  const prev = ['const y = 2;', 'let y = 1;']
  checkMatchInInstrumentedCode(main, ['y_0 = 1', 'y_1 = 2', 'y_2', 'y_3'], prev)
})
