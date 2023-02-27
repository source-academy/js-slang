Source §2 Typed is a small programming language, designed for the first chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).
Source §2 Typed introduces <EM>type syntax</EM> and <EM>type checking</EM>.

## What is static type checking?

Programming languages handle types in two main ways:
dynamically typed languages, only check types when the code is run (at runtime),
while statically typed languages check types before the code is run (at compile time).
Though Source is a dynamically typed language, we can still introduce type checks
that check the code for errors at compile time.

## What can you do in Source §2 Typed?

You can use all features of
<a href="../source_1_typed/">Source §1 Typed</a> and <a href="../source_2/">Source §2</a>, but with the following additional types:

- `null` types
- Pair type (`Pair<headType, tailType>`): takes in two type parameters, head type and tail type
- List type (`List<elemType>`): takes in one type parameter, element type

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_2_typed.pdf">Specification of Source §2 Typed</a>.
Feel free to take a peek!
