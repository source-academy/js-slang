import type { VariableDeclaration } from 'estree'
import { astTester } from '../../testing'
import {
  getDeclaredIdentifiers,
  getIdentifiersFromVariableDeclaration,
  mapIdentifiersToNames
} from '../helpers'
import { Chapter } from '../../../types'

describe(`Test ${getDeclaredIdentifiers.name}`, () => {
  astTester(
    (program, _, expected) => {
      const ids = getDeclaredIdentifiers(program, true)
      const sorted = mapIdentifiersToNames(ids).sort()
      expect(sorted).toEqual(expected)
    },
    [
      ['single const var declarations', 'const a = "a";', ['a']],
      ['single let var declarations', 'let a = "a";', ['a']],
      ['var declaration with array pattern', 'const [a, b] = [0,1];', ['a', 'b']],
      ['var declaration with object pattern', 'const {a, b} = {};', ['a', 'b']],
      ['function declarations', 'function a(param) {}', ['a']],
      ['import specifiers', 'import { a, c as b } from "./b.js";', ['a', 'b']],
      ['import default specifiers', 'import d, { a, c as b } from "./b.js";', ['a', 'b', 'd']],
      ['import namespace specifier', 'import * as a from "./b.js";', ['a']],
      ['export default function', 'export default function a() {}', ['a']],
      ['export default function without name', 'export default function () {}', []],
      ['export named var declaration', 'export const a = "a";', ['a']],
      ['export named declaration reexport', 'export { a } from "./a.js";', []],

      [
        'program',
        `
        import { d } from './d.js';
        const a = "a";
        function b() {}
        export const c = "c";
        `,
        ['a', 'b', 'c', 'd']
      ],
      [
        'does not check programs recursively',
        `
        import { d } from './d.js';
        const a = "a";
        function b() {}
        export const c = "c";
        {
          const e = "e";
        }

        `,
        ['a', 'b', 'c', 'd']
      ],
      [
        'checks programs for nested var declarations',
        `
        import { d } from './d.js';
        const a = "a";
        function b() {}
        export const c = "c";
        {
          const e = "e";
          {
            {
              var f = "f";
            }
          }
        }

        `,
        ['a', 'b', 'c', 'd', 'f']
      ]
    ],
    Chapter.FULL_JS
  )
})

describe(`Test ${getIdentifiersFromVariableDeclaration.name}`, () => {
  astTester(
    (program, _, expected) => {
      expect(program.body[0].type).toEqual('VariableDeclaration')
      const ids = getIdentifiersFromVariableDeclaration(program.body[0] as VariableDeclaration)
      const sorted = mapIdentifiersToNames(ids).sort()
      expect(sorted).toEqual(expected)
    },
    [
      ['single const var declarations', 'const a = "a";', ['a']],
      ['single let var declarations', 'let a = "a";', ['a']],
      ['var declaration with array pattern', 'const [a, b] = [0,1];', ['a', 'b']],
      ['var declaration with object pattern', 'const {a, b: { c } } = {};', ['a', 'c']],
      [
        'var declaration with object pattern with rest element',
        'const {a, b: { ...c } } = {};',
        ['a', 'c']
      ],
      [
        'var declaration with complex pattern',
        'const {a: [{ d }, e], b: { c: { f, g } } } = {};',
        ['d', 'e', 'f', 'g']
      ]
    ],
    Chapter.FULL_JS
  )
})
