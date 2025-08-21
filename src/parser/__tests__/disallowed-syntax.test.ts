import { describe, expect, test, vi } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure } from '../../utils/testing'

vi.mock(import('../../modules/loader/loaders'))

test('Cannot leave blank init in for loop', () => {
  return expect(
    testFailure(
      stripIndent`
    for (; i < 3; i = i + 1) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing init expression in for statement."`)
})

test('Cannot leave blank init in for loop - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (; i < 3; i = i + 1) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing init expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank test in for loop', () => {
  return expect(
    testFailure(
      stripIndent`
    for (let i = 0; ; i = i + 1) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing test expression in for statement."`)
})

test('Cannot leave blank test in for loop - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (let i = 0; ; i = i + 1) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing test expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank update in for loop', () => {
  return expect(
    testFailure(
      stripIndent`
    for (let i = 0; i < 3;) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing update expression in for statement."`)
})

test('Cannot leave blank update in for loop - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (let i = 0; i < 3;) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing update expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank expressions in for loop', () => {
  return expect(
    testFailure(
      stripIndent`
    for (;;) {
      break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(
    `"Line 1: Missing init, test, update expressions in for statement."`
  )
})

test('Cannot leave blank expressions in for loop - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (;;) {
    break;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing init, test, update expressions in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave while loop predicate blank', () => {
  return expect(
    testFailure(
      stripIndent`
    while () {
      x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: SyntaxError: Unexpected token (1:7)"`)
})

test('Cannot leave while loop predicate blank - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    while () {
      x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 7: SyntaxError: Unexpected token (2:7)
            There is a syntax error in your program
            "
          `)
})

test('Cannot use update expressions', () => {
  return expect(
    testFailure(
      stripIndent`
    let x = 3;
    x++;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Update expressions are not allowed"`)
})

test('Cannot use update expressions - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x = 3;
    x++;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 0: Update expressions are not allowed
            You are trying to use Update expressions, which is not allowed (yet).
            "
          `)
})

test('Cannot have incomplete statements', () => {
  return expect(
    testFailure(
      stripIndent`
    5
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing semicolon at the end of statement"`)
})

test('Cannot have incomplete statements - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    5
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 1: Missing semicolon at the end of statement
            Every statement must be terminated by a semicolon.
            "
          `)
})

test('Equality operator has specific error', () => {
  return expect(testFailure('0 == 0;')).resolves.toMatchInlineSnapshot(
    `"Line 1: Use === instead of ==."`
  )
})

test('Inequality operator has specific error', () => {
  return expect(testFailure('0 != 0;')).resolves.toMatchInlineSnapshot(
    `"Line 1: Use !== instead of !=."`
  )
})

test('No anonymous function declarations', () => {
  return expect(
    testFailure(
      stripIndent`
    export default function (x) {
      return x * x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(
    `"Line 1: The 'function' keyword needs to be followed by a name."`
  )
})

test('No anonymous function declarations - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    export default function (x) {
      return x * x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 15: The 'function' keyword needs to be followed by a name.
            Function declarations without a name are similar to function expressions, which are banned.
            "
           `)
})

test('Cannot have if without else in chapter <= 2', () => {
  return expect(
    testFailure(
      stripIndent`
    if (true) { 5; }
    `,
      { chapter: Chapter.SOURCE_2 }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing \\"else\\" in \\"if-else\\" statement."`)
})

test('Cannot have if without else in chapter <= 2 - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    if (true) { 5; }
    `,
      { chapter: Chapter.SOURCE_2 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing \\"else\\" in \\"if-else\\" statement.
            This \\"if\\" block requires corresponding \\"else\\" block which will be
            evaluated when true expression evaluates to false.

            Later in the course we will lift this restriction and allow \\"if\\" without
            else.
            "
          `)
})

describe('Cannot use multiple declarations', () => {
  test('let', () => {
    return expect(
      testFailure(
        stripIndent`
      let x = 3, y = 5;
      x;
      `,
        Chapter.LIBRARY_PARSER
      )
    ).resolves.toMatchInlineSnapshot(`"Line 1: Multiple declarations in a single statement."`)
  })

  test('let - verbose', () => {
    return expect(
      testFailure(
        stripIndent`
      "enable verbose";
      let x = 3, y = 5;
      x;
      `,
        Chapter.LIBRARY_PARSER
      )
    ).resolves.toMatchInlineSnapshot(`
      "Line 2, Column 0: Multiple declarations in a single statement.
      Split the variable declaration into multiple lines as follows

        let x = 3;
        let y = 5;

      "
    `)
  })

  test('const - verbose', () => {
    return expect(
      testFailure(
        stripIndent`
        "enable verbose";
        const x = 3, y = 5;
        `
      )
    ).resolves.toMatchInlineSnapshot(`
        "Line 2, Column 0: Multiple declarations in a single statement.
        Split the variable declaration into multiple lines as follows

          const x = 3;
          const y = 5;

        "
    `)
  })
})

test('Cannot use destructuring declarations', () => {
  return expect(
    testFailure(
      stripIndent`
    let x = [1, 2];
    let [a, b] = x;
    a;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Array patterns are not allowed"`)
})

test('Cannot use destructuring declarations - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x = [1, 2];
    let [a, b] = x;
    a;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 4: Array patterns are not allowed
            You are trying to use Array patterns, which is not allowed (yet).
            "
          `)
})

test('No declaration without assignment', () => {
  return expect(
    testFailure(
      stripIndent`
    let x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing value in variable declaration."`)
})

test('No declaration without assignment - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 4: Missing value in variable declaration.
            A variable declaration assigns a value to a name.
            For instance, to assign 20 to x, you can write:

              let x = 20;

              x + x; // 40
            "
          `)
})

test('No var statements', () => {
  return expect(
    testFailure(
      stripIndent`
    var x = 1;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Variable declaration using \\"var\\" is not allowed."`)
})

test('No var statements - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    var x = 1;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Variable declaration using \\"var\\" is not allowed.
            Use keyword \\"let\\" instead, to declare a variable:

            	let x = 1;
            "
          `)
})

test('Cannot use update statements (+=)', () => {
  return expect(
    testFailure(
      stripIndent`
    let x = 3;
    x += 5;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(
    `"Line 2: The assignment operator += is not allowed. Use = instead."`
  )
})

test('Cannot use update statements (+=) - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x = 3;
    x += 5;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 0: The assignment operator += is not allowed. Use = instead.

            	x = x + 5;
            "
          `)
})

test('No default exports', () => {
  return expect(
    testFailure('const a = 0; export { a as default };', Chapter.SOURCE_4)
  ).resolves.toMatchInlineSnapshot(`"Line 1: Export default declarations are not allowed."`)
})

test('Cannot use update statements (<<=)', () => {
  return expect(
    testFailure(
      stripIndent`
    let x = 3;
    x <<= 5;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(
    `"Line 2: The assignment operator <<= is not allowed. Use = instead."`
  )
})

test('Cannot use update statements (<<=) - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x = 3;
    x <<= 5;
    x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 0: The assignment operator <<= is not allowed. Use = instead.

            "
          `)
})

test('Cannot use function expressions', () => {
  return expect(
    testFailure(
      stripIndent`
    (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
    `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Function expressions are not allowed"`)
})

test('Cannot use function expressions - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
    `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 1: Function expressions are not allowed
            You are trying to use Function expressions, which is not allowed (yet).
            "
          `)
})

test('if needs braces', () => {
  return expect(
    testFailure(
      stripIndent`
    if (true)
      true;
    else
      false;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 1: Missing curly braces around \\"if\\" block.
            Line 1: Missing curly braces around \\"else\\" block."
          `)
})

test('if needs braces - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    if (true)
      true;
    else
      false;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing curly braces around \\"if\\" block.
            if block need to be enclosed with a pair of curly braces.

            if (true) {
              true;
            }

            An exception is when you have an \\"if\\" followed by \\"else if\\", in this case
            \\"else if\\" block does not need to be surrounded by curly braces.

            if (someCondition) {
              // ...
            } else /* notice missing { here */ if (someCondition) {
              // ...
            } else {
              // ...
            }

            Rationale: Readability in dense packed code.

            In the snippet below, for instance, with poor indentation it is easy to
            mistaken hello() and world() to belong to the same branch of logic.

            if (someCondition) {
              2;
            } else
              hello();
            world();

            Line 2, Column 0: Missing curly braces around \\"else\\" block.
            else block need to be enclosed with a pair of curly braces.

            else {
              false;
            }

            An exception is when you have an \\"if\\" followed by \\"else if\\", in this case
            \\"else if\\" block does not need to be surrounded by curly braces.

            if (someCondition) {
              // ...
            } else /* notice missing { here */ if (someCondition) {
              // ...
            } else {
              // ...
            }

            Rationale: Readability in dense packed code.

            In the snippet below, for instance, with poor indentation it is easy to
            mistaken hello() and world() to belong to the same branch of logic.

            if (someCondition) {
              2;
            } else
              hello();
            world();
            "
          `)
})

test('for needs braces', () => {
  return expect(
    testFailure(
      stripIndent`
    for (let i = 0; i < 1; i = i + 1)
      i;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Missing curly braces around \\"for\\" block."`)
})

test('for needs braces - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (let i = 0; i < 1; i = i + 1)
      i;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing curly braces around \\"for\\" block.
            Remember to enclose your \\"for\\" block with braces:

             	for (let i = 0; i < 1; i = i + 1) {
            		//code goes here
            	}
            "
          `)
})

test('while needs braces', () => {
  return expect(
    testFailure(
      stripIndent`
    let i = 0;
    while (i < 1)
      i = i + 1;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Missing curly braces around \\"while\\" block."`)
})

test('while needs braces - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let i = 0;
    while (i < 1)
      i = i + 1;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 0: Missing curly braces around \\"while\\" block.
            Remember to enclose your \\"while\\" block with braces:

             	while (i < 1) {
            		//code goes here
            	}
            "
          `)
})

test('No empty statements', () => {
  return expect(
    testFailure(
      stripIndent`
    ;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Empty statements are not allowed"`)
})

test('No empty statements - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    ;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Empty statements are not allowed
            You are trying to use Empty statements, which is not allowed (yet).
            "
          `)
})

test('No array expressions in chapter 2', () => {
  return expect(
    testFailure(
      stripIndent`
    [];
    `,
      { chapter: Chapter.SOURCE_2 }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Array expressions are not allowed"`)
})

test('No array expressions in chapter 2 - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    [];
    `,
      { chapter: Chapter.SOURCE_2 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Array expressions are not allowed
            You are trying to use Array expressions, which is not allowed (yet).
            "
          `)
})

test('No spread in array expressions', () => {
  return expect(
    testFailure(
      stripIndent`
    [...[]];
    `,
      { chapter: Chapter.SOURCE_3 }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Spread syntax is not allowed in arrays."`)
})

test('No trailing commas in arrays', () => {
  return expect(
    testFailure(
      stripIndent`
    [1,];
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Trailing comma"`)
})

test('No trailing commas in arrays - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    [1,];
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 2: Trailing comma
            Please remove the trailing comma
            "
          `)
})

test('No trailing commas in objects', () => {
  return expect(
    testFailure(
      stripIndent`
    ({
      a: 1,
      b: 2,
    });
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 3: Trailing comma"`)
})

test('No try statements', () => {
  return expect(
    testFailure(
      stripIndent`
    function f(x, y) {
      return x + y;
    }
    try {
      f([1, 2]);
    } catch (e) {
      display(e);
    }
    `,
      { chapter: Chapter.SOURCE_3 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 6: Catch clauses are not allowed
            Line 4: Try statements are not allowed"
          `)
})

test('No try statements - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    function f(x, y) {
      return x + y;
    }
    try {
      f([1, 2]);
    } catch (e) {
      display(e);
    }
    `,
      { chapter: Chapter.SOURCE_3 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 7, Column 2: Catch clauses are not allowed
            You are trying to use Catch clauses, which is not allowed (yet).

            Line 5, Column 0: Try statements are not allowed
            You are trying to use Try statements, which is not allowed (yet).
            "
          `)
})

test('No for of loops', () => {
  return expect(
    testFailure(
      stripIndent`
    for (let i of list()) {
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: For of statements are not allowed"`)
})

test('No for of loops - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (let i of list()) {
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: For of statements are not allowed
            You are trying to use For of statements, which is not allowed (yet).
            "
          `)
})

test('No for in loops', () => {
  return expect(
    testFailure(
      stripIndent`
    for (let i in { a: 1, b: 2 }) {
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: For in statements are not allowed"`)
})

test('No for in loops - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    for (let i in { a: 1, b: 2 }) {
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: For in statements are not allowed
            You are trying to use For in statements, which is not allowed (yet).
            "
          `)
})

test('No generator functions', () => {
  return expect(
    testFailure(
      stripIndent`
    function* gen() {
      yield 2;
      return 1;
    }
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Yield expressions are not allowed"`)
})

test('No generator functions - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    function* gen() {
      yield 2;
      return 1;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 2: Yield expressions are not allowed
            You are trying to use Yield expressions, which is not allowed (yet).
            "
          `)
})

test('No classes', () => {
  return expect(
    testFailure(
      stripIndent`
    class Box {
    }
    `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 1: Class bodys are not allowed
            Line 1: Class declarations are not allowed"
          `)
})

test('No classes - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    class Box {
    }
    `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 10: Class bodys are not allowed
            You are trying to use Class bodys, which is not allowed (yet).

            Line 2, Column 0: Class declarations are not allowed
            You are trying to use Class declarations, which is not allowed (yet).
            "
          `)
})

test('No super', () => {
  return expect(
    testFailure(
      stripIndent`
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
    `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3: Supers are not allowed
            Line 2: Function expressions are not allowed
            Line 2: Method definitions are not allowed
            Line 1: Class bodys are not allowed
            Line 1: Class declarations are not allowed"
          `)
})

test('No super - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
  `,
      // @ts-expect-error Intentional type error
      { chapter: 5 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 4, Column 4: Supers are not allowed
            You are trying to use Supers, which is not allowed (yet).

            Line 3, Column 13: Function expressions are not allowed
            You are trying to use Function expressions, which is not allowed (yet).

            Line 3, Column 2: Method definitions are not allowed
            You are trying to use Method definitions, which is not allowed (yet).

            Line 2, Column 29: Class bodys are not allowed
            You are trying to use Class bodys, which is not allowed (yet).

            Line 2, Column 0: Class declarations are not allowed
            You are trying to use Class declarations, which is not allowed (yet).
            "
          `)
})

test('No sequence expression', () => {
  return expect(
    testFailure(
      stripIndent`
    (1, 2);
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Sequence expressions are not allowed"`)
})

test('No sequence expression - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    (1, 2);
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 1: Sequence expressions are not allowed
            You are trying to use Sequence expressions, which is not allowed (yet).
            "
          `)
})

test('No interface', () => {
  return expect(
    testFailure(
      stripIndent`
    interface Box {
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(
    `"Line 1: SyntaxError: The keyword 'interface' is reserved (1:0)"`
  )
})

test('No interface - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    interface Box {
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: SyntaxError: The keyword 'interface' is reserved (2:0)
            There is a syntax error in your program
            "
          `)
})

test('No expressions in template literals', () => {
  return expect(testFailure(stripIndent('`hi${0}`;'))).resolves.toMatchInlineSnapshot(
    `"Line 1: Expressions are not allowed in template literals (\`multiline strings\`)"`
  )
})

test('No regexp', () => {
  return expect(
    testFailure(
      stripIndent`
    /pattern/
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 1: Missing semicolon at the end of statement
            Line 1: 'RegExp' literals are not allowed."
          `)
})

test('No regexp - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    /pattern/
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 9: Missing semicolon at the end of statement
            Every statement must be terminated by a semicolon.

            Line 2, Column 0: 'RegExp' literals are not allowed.

            "
          `)
})

test('No this, no new', () => {
  return expect(
    testFailure(
      stripIndent`
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 4: TypeError: Box is not a constructor"`)
})

test('No this, no new - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`""`)
})

test('No unspecified operators', () => {
  return expect(
    testFailure(
      stripIndent`
    1 << 10;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Operator '<<' is not allowed."`)
})

test('No unspecified operators - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    1 << 10;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: Operator '<<' is not allowed.

            "
          `)
})

test('No unspecified unary operators', () => {
  return expect(
    testFailure(
      stripIndent`
    let x = 5;
    typeof x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Operator 'typeof' is not allowed."`)
})

test('No unspecified unary operators - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let x = 5;
    typeof x;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 0: Operator 'typeof' is not allowed.

            "
          `)
})

test('No implicit undefined return', () => {
  return expect(
    testFailure(
      stripIndent`
    function f() {
      return;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 2: Missing value in return statement."`)
})
test('No implicit undefined return - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    function f() {
      return;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 3, Column 2: Missing value in return statement.
            This return statement is missing a value.
            For instance, to return the value 42, you can write

              return 42;
            "
          `)
})

test('No repeated params', () => {
  return expect(
    testFailure(
      stripIndent`
    function f(x, x) {
      return x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: SyntaxError: Argument name clash (1:14)"`)
})

test('No repeated params - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    function f(x, x) {
      return x;
    }
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 14: SyntaxError: Argument name clash (2:14)
            There is a syntax error in your program
            "
          `)
})

test('No declaring reserved keywords', () => {
  return expect(
    testFailure(
      stripIndent`
    let yield = 5;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'yield' is reserved (1:4)"`)
})

test('No declaring reserved keywords - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    let yield = 5;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 4: SyntaxError: The keyword 'yield' is reserved (2:4)
            There is a syntax error in your program
            "
          `)
})

test('No assigning to reserved keywords', () => {
  return expect(
    testFailure(
      stripIndent`
    package = 5;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'package' is reserved (1:0)"`)
})

test('No assigning to reserved keywords - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    package = 5;
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: SyntaxError: The keyword 'package' is reserved (2:0)
            There is a syntax error in your program
            "
          `)
})

test('No holes in arrays', () => {
  return expect(
    testFailure(
      stripIndent`
    [1, , 3];
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: No holes are allowed in array literals."`)
})

test('No holes in arrays - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    [1, , 3];
    `,
      { chapter: Chapter.LIBRARY_PARSER }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 0: No holes are allowed in array literals.
            No holes (empty slots with no content inside) are allowed in array literals.
            You probably have an extra comma, which creates a hole.
            "
          `)
})

test('No namespace imports', () => {
  return expect(
    testFailure(
      stripIndent`
    import * as x from "one_module";
    `,
      { chapter: Chapter.SOURCE_4 }
    )
  ).resolves.toMatchInlineSnapshot(`"Line 1: Namespace imports are not allowed"`)
})

test('No namespace imports - verbose', () => {
  return expect(
    testFailure(
      stripIndent`
    "enable verbose";
    import * as x from "one_module";
    `,
      { chapter: Chapter.SOURCE_4 }
    )
  ).resolves.toMatchInlineSnapshot(`
            "Line 2, Column 7: Namespace imports are not allowed
            You are trying to use Namespace imports, which is not allowed (yet).
            "
          `)
})

test('No reexports', () =>
  expect(testFailure('export { a } from "./hi.js";')).resolves.toMatchInlineSnapshot(`
    "Line 1: Export named declarations are not allowed
    Line 1: exports of the form \`export { a } from \\"./file.js\\";\` are not allowed."
  `))

describe('No reexports - verbose', () => {
  test('single export', () =>
    expect(
      testFailure(
        stripIndent`
    "enable verbose";
    export { a } from "./hi.js";
  `
      )
    ).resolves.toMatchInlineSnapshot(`
    "Line 2, Column 0: Export named declarations are not allowed
    You are trying to use Export named declarations, which is not allowed (yet).

    Line 2, Column 0: exports of the form \`export { a } from \\"./file.js\\";\` are not allowed.
    Import what you are trying to export, then export it again, like this:
    import { a } from \\"./hi.js\\";
    export { a };
    "
  `))

  test('multiple exports', () =>
    expect(
      testFailure(
        stripIndent`
      "enable verbose";
      export { a, b } from "./hi.js";
    `
      )
    ).resolves.toMatchInlineSnapshot(`
    "Line 2, Column 0: Export named declarations are not allowed
    You are trying to use Export named declarations, which is not allowed (yet).

    Line 2, Column 0: exports of the form \`export { a } from \\"./file.js\\";\` are not allowed.
    Import what you are trying to export, then export it again, like this:
    import { a, b } from \\"./hi.js\\";
    export { a, b };
    "
  `))

  test('aliased exports', () =>
    expect(
      testFailure(
        stripIndent`
      "enable verbose";
      export { a as x, b } from "./hi.js";
      `
      )
    ).resolves.toMatchInlineSnapshot(`
    "Line 2, Column 0: Export named declarations are not allowed
    You are trying to use Export named declarations, which is not allowed (yet).

    Line 2, Column 0: exports of the form \`export { a } from \\"./file.js\\";\` are not allowed.
    Import what you are trying to export, then export it again, like this:
    import { a, b } from \\"./hi.js\\";
    export { a as x, b };
    "
  `))
})
