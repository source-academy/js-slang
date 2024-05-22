import { Chapter } from '../../types'
import { oneLine } from '../../utils/formatters'
import { testMultipleCases, testSuccess } from '../../utils/testing'

testMultipleCases([
  ['Parses empty program', 'stringify(parse(""), undefined, 2);', Chapter.SOURCE_4],
  [
    'Parses literals',
    `stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'Parses name expression',
    'stringify(parse("x;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses name expressions',
    'stringify(parse("x; moreNames; undefined;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses infix expressions',
    'stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses declaration statements',
    'stringify(parse("const x = 5; let y = x;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses assignment statements',
    'stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses if statements',
    'stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses arrow function expressions properly',
    'stringify(parse("x => x + 1;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses multi-argument arrow function expressions',
    'stringify(parse("(x, y) => x + 1;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses function calls',
    'stringify(parse("f(x); thrice(thrice)(plus_one)(0);"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses fibonacci',
    'stringify(parse("function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); } fib(4);"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses object notation',
    `stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'Parses property access',
    `stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'Parses property assignment',
    `stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'Parses loops',
    oneLine`
    stringify(parse(
      "while (true) {
        continue;
        break;
      }
      for (let i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }
      for (i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }"), undefined, 2);
    `,
    Chapter.SOURCE_4
  ],
  [
    'Parses assignment expressions',
    'stringify(parse("x = y = x;"), undefined, 2);',
    Chapter.SOURCE_4
  ],
  [
    'Parses import default specifiers',
    `stringify(parse("import defaultExport from 'module-name';"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'Parses named export declarations',
    oneLine`
      stringify(parse(
      "export const x = 42;
      export const square = x => x * x;
      export function id(x) {
        return x;
      }
      export { x as y };"), undefined, 2);
    `,
    Chapter.LIBRARY_PARSER
  ],
  [
    'Parses default export declarations',
    oneLine`
    stringify(parse(
      "export const x = 42;
      export default x;"), undefined, 2);
    stringify(parse(
      "export default function square(x) {
        return x * x;
      }"), undefined, 2);
    `,
    Chapter.LIBRARY_PARSER
  ]
], async ([code, chapter]) => {
  const { result } = await testSuccess(code, chapter)
  expect(result).toMatchSnapshot()
})
