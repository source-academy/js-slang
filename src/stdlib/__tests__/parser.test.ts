import { expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { oneLine } from '../../utils/formatters'
import { testForValue } from '../../utils/testing'

const testCases: [string, string, Chapter][] = [
  ['empty program', 'stringify(parse(""), undefined, 2);', Chapter.SOURCE_4],
  [
    'literals',
    `stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  ['name expression', `stringify(parse("x;"), undefined, 2);`, Chapter.SOURCE_4],
  [
    'name expressions',
    `stringify(parse("x; moreNames; undefined;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'infix expressions',
    `stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'declaration statements',
    `stringify(parse("const x = 5; let y = x;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'assignment statements',
    `stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'if statements',
    `stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'multi-argument arrow function expressions properly',
    `stringify(parse("(x, y) => x + 1;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'multi-argument arrow function assignments properly',
    `stringify(parse("const y = (x, y) => x + 1;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'arrow function expressions properly',
    `stringify(parse("x => x + 1;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'arrow function assignments properly',
    `stringify(parse("const y = x => x + 1;"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'function calls',
    `stringify(parse("f(x); thrice(thrice)(plus_one)(0);"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'fibonacci',
    `stringify(parse("function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); } fib(4);"), undefined, 2);`,
    Chapter.SOURCE_4
  ],
  [
    'object notation',
    `stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'property access',
    `stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'property assignment',
    `stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'loops',
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
  ['assignment expressions', `stringify(parse("x = y = x;"), undefined, 2);`, Chapter.SOURCE_4],
  [
    'default import specifiers',
    `stringify(parse("import defaultExport from 'module-name';"), undefined, 2);`,
    Chapter.LIBRARY_PARSER
  ],
  [
    'named export declarations',
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
    'default export declarations',
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
]

test.each(testCases)('Parses %s', (name, snippet, chapter) => {
  return expect(testForValue(snippet, chapter)).resolves.toMatchSnapshot(name)
})
