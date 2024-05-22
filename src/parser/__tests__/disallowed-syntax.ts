import { Chapter } from '../../types'
import { expectParsedError, expectParsedErrorsToEqual, expectResult } from '../../utils/testing'

expectParsedErrorsToEqual(
  [
    [
      'Cannot leave while loop predicate blank',
      'while() { x; }',
      'Line 1: SyntaxError: Unexpected token (1:6)'
    ],
    ['Cannot have incomplete statements', '5', 'Line 1: Missing semicolon at the end of statement'],
    [
      'No try statements',
      'try {} catch(e) {}',
      'Line 1: Catch clauses are not allowed.\nLine 1: Try statements are not allowed.'
    ],
    [
      'No for of loops',
      `
      let x = [];
      for (const each of x) {}
    `,
      'Line 3: For of statements are not allowed.'
    ],
    [
      'No for in loops',
      `
      let x = [];
      for (const each in x) {}
    `,
      'Line 3: For in statements are not allowed.'
    ],
    ['No classes', 'class C {}', 'Line 1: Class declarations are not allowed.'],
    ['No sequence expressions', '(1, 2);', 'Line 1: Sequence expressions are not allowed.'],
    [
      'No this',
      `
      function box() {
        this[0] = 0;
      }
    `,
      "Line 3: 'this' expressions are not allowed."
    ],
    ['No new', 'const b = new box();', 'Line 1: New expressions are not allowed.'],
    [
      'No assigning to reserved keywords',
      'package = 5;',
      "Line 1: SyntaxError: The keyword 'package' is reserved (1:0)"
    ],
    [
      'No declaring reserved keywords',
      'let yield = 5;',
      "Line 1: SyntaxError: The keyword 'yield' is reserved (1:4)"
    ],
    [
      'No interfaces',
      'interface Box {}',
      "Line 1: SyntaxError: The keyword 'interface' is reserved (1:0)"
    ],
    [
      'No spread in array expressions',
      '[...[]];',
      'Line 1: Spread syntax is not allowed in arrays.'
    ],
    [
      'No destructuring declarations',
      `
      let x = [1, 2];
      let [a, b] = x;
      a;
    `,
      'Line 3: Array patterns are not allowed.'
    ],
    [
      'No function expressions',
      'const x = function() {};',
      'Line 1: Function expressions are not allowed.'
    ],
    [
      'No repeated function parameters',
      'function any(x, x) {}',
      'Line 1: SyntaxError: Argument name clash (1:16)'
    ],
    ['No empty statements', ';', 'Line 1: Empty statements are not allowed.']
  ],
  Chapter.SOURCE_4
)

test('No array expressions in chapter 2', async () => {
  await expectParsedError('[];', Chapter.SOURCE_2).toEqual(
    'Line 1: Array expressions are not allowed.'
  )
  await expectResult('[];', Chapter.SOURCE_3).toEqual([])
})
