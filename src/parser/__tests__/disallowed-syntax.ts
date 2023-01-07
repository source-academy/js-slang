import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError } from '../../utils/testing'

test('Cannot leave blank init in for loop', () => {
  return expectParsedError(
    stripIndent`
    for (; i < 3; i = i + 1) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing init expression in for statement."`)
})

test('Cannot leave blank init in for loop - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (; i < 3; i = i + 1) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing init expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank test in for loop', () => {
  return expectParsedError(
    stripIndent`
    for (let i = 0; ; i = i + 1) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing test expression in for statement."`)
})

test('Cannot leave blank test in for loop - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (let i = 0; ; i = i + 1) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing test expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank update in for loop', () => {
  return expectParsedError(
    stripIndent`
    for (let i = 0; i < 3;) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing update expression in for statement."`)
})

test('Cannot leave blank update in for loop - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (let i = 0; i < 3;) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing update expression in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave blank expressions in for loop', () => {
  return expectParsedError(
    stripIndent`
    for (;;) {
      break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing init, test, update expressions in for statement."`)
})

test('Cannot leave blank expressions in for loop - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (;;) {
    break;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing init, test, update expressions in for statement.
            This for statement requires all three parts (initialiser, test, update) to be present.
            "
          `)
})

test('Cannot leave while loop predicate blank', () => {
  return expectParsedError(
    stripIndent`
    while () {
      x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: Unexpected token (1:7)"`)
})

test('Cannot leave while loop predicate blank - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    while () {
      x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 7: SyntaxError: Unexpected token (2:7)
            There is a syntax error in your program
            "
          `)
})

test('Cannot use update expressions', () => {
  return expectParsedError(
    stripIndent`
    let x = 3;
    x++;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Update expressions are not allowed"`)
})

test('Cannot use update expressions - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = 3;
    x++;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 0: Update expressions are not allowed
            You are trying to use Update expressions, which is not allowed (yet).
            "
          `)
})

test('Cannot have incomplete statements', () => {
  return expectParsedError(
    stripIndent`
    5
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing semicolon at the end of statement"`)
})

test('Cannot have incomplete statements - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    5
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 1: Missing semicolon at the end of statement
            Every statement must be terminated by a semicolon.
            "
          `)
})

test('no anonymous function declarations', () => {
  return expectParsedError(
    stripIndent`
    export default function (x) {
      return x * x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: The 'function' keyword needs to be followed by a name."`)
})

test('no anonymous function declarations - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    export default function (x) {
      return x * x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 15: The 'function' keyword needs to be followed by a name.
            Function declarations without a name are similar to function expressions, which are banned.
            "
           `)
})

test('Cannot have if without else in chapter <= 2', () => {
  return expectParsedError(
    stripIndent`
    if (true) { 5; }
    `,
    { chapter: Chapter.SOURCE_2 }
  ).toMatchInlineSnapshot(`"Line 1: Missing \\"else\\" in \\"if-else\\" statement."`)
})

test('Cannot have if without else in chapter <= 2 - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    if (true) { 5; }
    `,
    { chapter: Chapter.SOURCE_2 }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing \\"else\\" in \\"if-else\\" statement.
            This \\"if\\" block requires corresponding \\"else\\" block which will be
            evaluated when true expression evaluates to false.

            Later in the course we will lift this restriction and allow \\"if\\" without
            else.
            "
          `)
})

test('Cannot use multiple declarations', () => {
  return expectParsedError(
    stripIndent`
    let x = 3, y = 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Multiple declaration in a single statement."`)
})

test('Cannot use multiple declarations - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = 3, y = 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Multiple declaration in a single statement.
            Split the variable declaration into multiple lines as follows

            	let x = 3;
            	let y = 5;

            "
          `)
})

test('Cannot use destructuring declarations', () => {
  return expectParsedError(
    stripIndent`
    let x = [1, 2];
    let [a, b] = x;
    a;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Array patterns are not allowed"`)
})

test('Cannot use destructuring declarations - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = [1, 2];
    let [a, b] = x;
    a;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 4: Array patterns are not allowed
            You are trying to use Array patterns, which is not allowed (yet).
            "
          `)
})

test('no declaration without assignment', () => {
  return expectParsedError(
    stripIndent`
    let x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing value in variable declaration."`)
})

test('no declaration without assignment - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 4: Missing value in variable declaration.
            A variable declaration assigns a value to a name.
            For instance, to assign 20 to x, you can write:

              let x = 20;

              x + x; // 40
            "
          `)
})

test('no var statements', () => {
  return expectParsedError(
    stripIndent`
    var x = 1;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Variable declaration using \\"var\\" is not allowed."`)
})

test('no var statements - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    var x = 1;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Variable declaration using \\"var\\" is not allowed.
            Use keyword \\"let\\" instead, to declare a variable:

            	let x = 1;
            "
          `)
})

test('Cannot use update statements', () => {
  return expectParsedError(
    stripIndent`
    let x = 3;
    x += 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: The assignment operator += is not allowed. Use = instead."`)
})

test('Cannot use update statements - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = 3;
    x += 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 0: The assignment operator += is not allowed. Use = instead.

            	x = x + 5;
            "
          `)
})

test('Cannot use update statements', () => {
  return expectParsedError(
    stripIndent`
    let x = 3;
    x <<= 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: The assignment operator <<= is not allowed. Use = instead."`)
})

test('Cannot use update statements - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = 3;
    x <<= 5;
    x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 0: The assignment operator <<= is not allowed. Use = instead.

            "
          `)
})

test('Cannot use function expressions', () => {
  return expectParsedError(
    stripIndent`
    (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`"Line 1: Function expressions are not allowed"`)
})

test('Cannot use function expressions - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 1: Function expressions are not allowed
            You are trying to use Function expressions, which is not allowed (yet).
            "
          `)
})

test('Cannot use function expressions', () => {
  return expectParsedError(
    stripIndent`
    (function(x) { return x + 1; })(4);
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`"Line 1: Function expressions are not allowed"`)
})

test('Cannot use function expressions - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    (function(x) { return x + 1; })(4);
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 1: Function expressions are not allowed
            You are trying to use Function expressions, which is not allowed (yet).
            "
          `)
})

test('if needs braces', () => {
  return expectParsedError(
    stripIndent`
    if (true)
      true;
    else
      false;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 1: Missing curly braces around \\"if\\" block.
            Line 1: Missing curly braces around \\"else\\" block."
          `)
})

test('if needs braces - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    if (true)
      true;
    else
      false;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
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
  return expectParsedError(
    stripIndent`
    for (let i = 0; i < 1; i = i + 1)
      i;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Missing curly braces around \\"for\\" block."`)
})

test('for needs braces - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (let i = 0; i < 1; i = i + 1)
      i;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Missing curly braces around \\"for\\" block.
            Remember to enclose your \\"for\\" block with braces:

             	for (let i = 0; i < 1; i = i + 1) {
            		//code goes here
            	}
            "
          `)
})

test('while needs braces', () => {
  return expectParsedError(
    stripIndent`
    let i = 0;
    while (i < 1)
      i = i + 1;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Missing curly braces around \\"while\\" block."`)
})

test('while needs braces - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let i = 0;
    while (i < 1)
      i = i + 1;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 0: Missing curly braces around \\"while\\" block.
            Remember to enclose your \\"while\\" block with braces:

             	while (i < 1) {
            		//code goes here
            	}
            "
          `)
})

test('No empty statements', () => {
  return expectParsedError(
    stripIndent`
    ;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Empty statements are not allowed"`)
})

test('No empty statements - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    ;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Empty statements are not allowed
            You are trying to use Empty statements, which is not allowed (yet).
            "
          `)
})

test('No array expressions in chapter 2', () => {
  return expectParsedError(
    stripIndent`
    [];
    `,
    { chapter: Chapter.SOURCE_2 }
  ).toMatchInlineSnapshot(`"Line 1: Array expressions are not allowed"`)
})

test('No array expressions in chapter 2 - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    [];
    `,
    { chapter: Chapter.SOURCE_2 }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Array expressions are not allowed
            You are trying to use Array expressions, which is not allowed (yet).
            "
          `)
})

test('No spread in array expressions', () => {
  return expectParsedError(
    stripIndent`
    [...[]];
    `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`"Line 1: Spread syntax is not allowed in arrays."`)
})

test('No trailing commas in arrays', () => {
  return expectParsedError(
    stripIndent`
    [1,];
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Trailing comma"`)
})

test('No trailing commas in arrays - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    [1,];
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 2: Trailing comma
            Please remove the trailing comma
            "
          `)
})

test('No trailing commas in objects', () => {
  return expectParsedError(
    stripIndent`
    ({
      a: 1,
      b: 2,
    });
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 3: Trailing comma"`)
})

test('no try statements', () => {
  return expectParsedError(
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
  ).toMatchInlineSnapshot(`
            "Line 6: Catch clauses are not allowed
            Line 4: Try statements are not allowed"
          `)
})

test('no try statements - verbose', () => {
  return expectParsedError(
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
  ).toMatchInlineSnapshot(`
            "Line 7, Column 2: Catch clauses are not allowed
            You are trying to use Catch clauses, which is not allowed (yet).

            Line 5, Column 0: Try statements are not allowed
            You are trying to use Try statements, which is not allowed (yet).
            "
          `)
})

test('no for of loops', () => {
  return expectParsedError(
    stripIndent`
    for (let i of list()) {
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 1: Missing value in variable declaration.
            Line 1: For of statements are not allowed"
          `)
})

test('no for of loops - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (let i of list()) {
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 9: Missing value in variable declaration.
            A variable declaration assigns a value to a name.
            For instance, to assign 20 to i, you can write:

              let i = 20;

              i + i; // 40

            Line 2, Column 0: For of statements are not allowed
            You are trying to use For of statements, which is not allowed (yet).
            "
          `)
})

test('no for in loops', () => {
  return expectParsedError(
    stripIndent`
    for (let i in { a: 1, b: 2 }) {
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 1: Missing value in variable declaration.
            Line 1: For in statements are not allowed"
          `)
})

test('no for in loops - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    for (let i in { a: 1, b: 2 }) {
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 9: Missing value in variable declaration.
            A variable declaration assigns a value to a name.
            For instance, to assign 20 to i, you can write:

              let i = 20;

              i + i; // 40

            Line 2, Column 0: For in statements are not allowed
            You are trying to use For in statements, which is not allowed (yet).
            "
          `)
})

test('no generator functions', () => {
  return expectParsedError(
    stripIndent`
    function* gen() {
      yield 2;
      return 1;
    }
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Yield expressions are not allowed"`)
})

test('no generator functions - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    function* gen() {
      yield 2;
      return 1;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 2: Yield expressions are not allowed
            You are trying to use Yield expressions, which is not allowed (yet).
            "
          `)
})

test('no classes', () => {
  return expectParsedError(
    stripIndent`
    class Box {
    }
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
            "Line 1: Class bodys are not allowed
            Line 1: Class declarations are not allowed"
          `)
})

test('no classes - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    class Box {
    }
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 10: Class bodys are not allowed
            You are trying to use Class bodys, which is not allowed (yet).

            Line 2, Column 0: Class declarations are not allowed
            You are trying to use Class declarations, which is not allowed (yet).
            "
          `)
})

test('no super', () => {
  return expectParsedError(
    stripIndent`
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
    `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
            "Line 3: Supers are not allowed
            Line 2: Function expressions are not allowed
            Line 2: Method definitions are not allowed
            Line 1: Class bodys are not allowed
            Line 1: Class declarations are not allowed"
          `)
})

test('no super - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
  `,
    { chapter: 5 }
  ).toMatchInlineSnapshot(`
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

test('no sequence expression', () => {
  return expectParsedError(
    stripIndent`
    (1, 2);
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Sequence expressions are not allowed"`)
})

test('no sequence expression - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    (1, 2);
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 1: Sequence expressions are not allowed
            You are trying to use Sequence expressions, which is not allowed (yet).
            "
          `)
})

test('no interface', () => {
  return expectParsedError(
    stripIndent`
    interface Box {
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'interface' is reserved (1:0)"`)
})

test('no interface - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    interface Box {
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: SyntaxError: The keyword 'interface' is reserved (2:0)
            There is a syntax error in your program
            "
          `)
})

test('no template literals - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    'hi'
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 4: Missing semicolon at the end of statement
            Every statement must be terminated by a semicolon.
            "
          `)
})

test('no regexp', () => {
  return expectParsedError(
    stripIndent`
    /pattern/
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 1: Missing semicolon at the end of statement
            Line 1: 'RegExp' literals are not allowed."
          `)
})

test('no regexp - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    /pattern/
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 9: Missing semicolon at the end of statement
            Every statement must be terminated by a semicolon.

            Line 2, Column 0: 'RegExp' literals are not allowed.

            "
          `)
})

test('no this, no new', () => {
  return expectParsedError(
    stripIndent`
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Expected string as prop, got number."`)
})

test('no this, no new - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 2: Expected string as prop, got number.
            Expected string as prop, got number.
            "
          `)
})

test('no unspecified operators', () => {
  return expectParsedError(
    stripIndent`
    1 << 10;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Operator '<<' is not allowed."`)
})

test('no unspecified operators - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    1 << 10;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: Operator '<<' is not allowed.

            "
          `)
})

test('no unspecified unary operators', () => {
  return expectParsedError(
    stripIndent`
    let x = 5;
    typeof x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Operator 'typeof' is not allowed."`)
})

test('no unspecified unary operators - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let x = 5;
    typeof x;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 0: Operator 'typeof' is not allowed.

            "
          `)
})

test('no implicit undefined return', () => {
  return expectParsedError(
    stripIndent`
    function f() {
      return;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 2: Missing value in return statement."`)
})
test('no implicit undefined return - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    function f() {
      return;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 3, Column 2: Missing value in return statement.
            This return statement is missing a value.
            For instance, to return the value 42, you can write

              return 42;
            "
          `)
})

test('no repeated params', () => {
  return expectParsedError(
    stripIndent`
    function f(x, x) {
      return x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: Argument name clash (1:14)"`)
})

test('no repeated params - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    function f(x, x) {
      return x;
    }
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 14: SyntaxError: Argument name clash (2:14)
            There is a syntax error in your program
            "
          `)
})

test('no declaring reserved keywords', () => {
  return expectParsedError(
    stripIndent`
    let yield = 5;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'yield' is reserved (1:4)"`)
})

test('no declaring reserved keywords - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    let yield = 5;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 4: SyntaxError: The keyword 'yield' is reserved (2:4)
            There is a syntax error in your program
            "
          `)
})

test('no assigning to reserved keywords', () => {
  return expectParsedError(
    stripIndent`
    package = 5;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'package' is reserved (1:0)"`)
})

test('no assigning to reserved keywords - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    package = 5;
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: SyntaxError: The keyword 'package' is reserved (2:0)
            There is a syntax error in your program
            "
          `)
})

test('no holes in arrays', () => {
  return expectParsedError(
    stripIndent`
    [1, , 3];
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: No holes are allowed in array literals."`)
})

test('no assigning to reserved keywords - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    [1, , 3];
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 0: No holes are allowed in array literals.
            No holes (empty slots with no content inside) are allowed in array literals.
            You probably have an extra comma, which creates a hole.
            "
          `)
})

test('no namespace imports', () => {
  return expectParsedError(
    stripIndent`
    import * as x from "module-name";
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`"Line 1: Namespace imports are not allowed"`)
})

test('no namespace imports - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    import * as x from "module-name";
    `,
    { chapter: Chapter.LIBRARY_PARSER }
  ).toMatchInlineSnapshot(`
            "Line 2, Column 7: Namespace imports are not allowed
            You are trying to use Namespace imports, which is not allowed (yet).
            "
          `)
})
