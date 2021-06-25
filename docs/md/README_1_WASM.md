
Source §1 is a small programming language, designed for the first chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).   Source §1 WebAssembly is an experimental implementation of Source §1 that compiles Source §1 to WebAssembly.


As this implementation is experimental, you may encounter bugs while using it.  Please report bugs to the [Sourceror](https://github.com/source-academy/sourceror) repository.

## Why should I use Source §1 WebAssembly?

It's fast &mdash; many times faster!

Take this code as an example:
```
function f(x){
    return x === 0 ? 1 : f(x-1) + f(x-1);
}
f(24);
```

It takes around 40 seconds on the usual Source §1 transpiler, but just 4 seconds on Source §1 WebAssembly &mdash; a whopping 10x speedup!

## What are the differences between Source §1 WebAssembly and vanilla Source §1?

Efficiency of execution is the main benefit of Source §1 WebAssembly.

Source §1 WebAssembly also supports writing external module files in Source itself, and have them imported by the main module.  These module files may be hosted at any URL (which supports CORS).  In particular, the standard libraries (MISC and MATH) are themselves implemented in Source (with some extensions).

However, standard library names must currently be imported explicitly (e.g. `import { math_sqrt } from "std/math";`).

Proper tail calls are unsupported in Source §1 WebAssembly.  Some programs with lots of tail recursion will lead to a stack overflow in Source §1 WebAssembly but will work in vanilla Source §1.

Runtime type errors are detected, however the line numbers are not reported because the WebAssembly binary produced by the compiler does not currently retain any location information.

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_1_wasm.pdf">Specification of Source §1 WebAssembly</a>. Feel free to
take a peek.

