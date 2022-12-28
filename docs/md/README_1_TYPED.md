Source §1 Typed is a small programming language, designed for the first chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).
Source §1 Typed introduces <EM>type syntax</EM> and <EM>type checking</EM>.

## What is static type checking?

Programming languages handle types in two main ways:
dynamically typed languages, only check types when the code is run (at runtime),
while statically typed languages check types before the code is run (at compile time).
Though Source is a dynamically typed language, we can still introduce type checks
that check the code for errors at compile time.

## What can you do in Source §1 Typed?

You can use all features of
<a href="../source_1/">Source §1</a>, but with the added
option of type checking your code at compile time.

This can be done by annotating functions and variables with <EM>type annotations</EM>:

```
const x = 1; // no type annotation
const x: number = 1; // with type annotation

// no type annotation
function f(x) {
    return x;
}

// with type annotation
function f(x: number): number {
    return x;
}
```

The types available in Source §1 Typed are:
- Basic types: `number`, `string`, `boolean`, `undefined`, `void` (used to annotate the return type of functions that do not return), `any` (skips all typechecks)
- Literal types: specific integer, string or boolean values (e.g. `1`, `'1'`, `true`)
- Function types: used to annotate types of functions (e.g. `(x: number) => number`)
- Union types: used to combine types (e.g. `string | number`)

Additionally, support for the following is added:
- Type alias declarations: used to declare new types to be used elsewhere in the program (e.g. `type x = string | number;`)
- As expressions: used to cast a variable to a specific type (e.g. `const x: number = y as number;`)
- `typeof` operations: used to get the type of a variable

The addition of type annotations is optional, i.e. if there are no type annotations, type checks will be skipped (the type is assumed to be `any`).

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_1_typed.pdf">Specification of Source §1 Typed</a>.
Feel free to take a peek!
