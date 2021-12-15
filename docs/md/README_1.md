Source §1 is a small programming language, designed for the first chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).

## What names are predeclared in Source §1?

On the right, you see all predeclared names of Source §1, in alphabetical
order. Click on a name to see how it is defined and used.
They come in these groups:
  <ul>
    <li>
      <a href="../MISC/index.html">MISC</a>: Miscellaneous constants and functions
    </li>
    <li>
      <a href="../MATH/index.html">MATH</a>: Mathematical constants and functions
    </li>
  </ul>

## What can you do in Source §1?

You can use all features that are introduced in
<a href="https://sourceacademy.org/sicpjs/1">chapter 1</a> of the
textbook. Below is the list of features, each with a link to the
textbook section that introduces it and a small example.

### Literal values

Literal values are simple expressions that directly evaluate to values. These
include numbers in the usual decimal notation, the two boolean values
`true` and `false`, and the predeclared names
`NaN`, `Infinity` and `undefined`.
More on literal values in <a href="https://sourceacademy.org/sicpjs/1.1">section
1.1 The Elements of Programming</a> of the textbook.

### Constant declarations

Constant declarations are done in Source with <PRE><CODE>const my_name = x + 2;</CODE></PRE>
Here the name `my_name` gets declared within the surrounding block,
and refers to the result of evaluating `x + 2` in the rest of the block.
You can read more about the <EM>scope of names</EM> in
<a href="https://sourceacademy.org/sicpjs/1.1.8">section 1.1.8
Functions as Black-Box Abstractions</a>.

### Conditional statements and conditional expressions

Within expressions, you can let a <EM>predicate</EM> determine whether
a <EM>consequent expression</EM>
gets evaluated or an <EM>alternative expression</EM>. This is done by writing,
for example
<PRE><CODE>return p(x) ? 7 : f(y);</CODE></PRE>
Read more on conditional expressions in
<a href="https://sourceacademy.org/sicpjs/1.1.6">section 1.1.6
Conditional Expressions and Predicates</a>.
<EM>Conditional evaluation</EM> is also possible within statements, for
example the body of a function declaration. For that, you can use <EM>conditional
statements</EM>, for example:<PRE><CODE>if (p(x)) {
    return 7;
} else {
    return f(y);
}</CODE></PRE>
Read about <EM>conditional statements</EM> in
<a href="https://sourceacademy.org/sicpjs/1.3.2">section 1.3.2
Function Definition Expressions</a>.

### Function declarations and function definitions

A function declaration is a statement that declares a name and binds it
to a function. For example
<PRE><CODE>function square(x) {
    return x * x;
}</CODE>
</PRE>
declares the name `square` and binds it to a squaring function, so that it can be applied
as in `square(5);`. You can read about function declaration statements in textbook
<a href="https://sourceacademy.org/sicpjs/1.1.4">section 1.1.4 Functions</a>.

Sometimes, it's not necessary to give a name to a function: You may
want to create a function only to pass it to some other function as argument.
For that, Source
supports function definition expressions. For example
<PRE><CODE>(x => x * x)(3); // returns 9</CODE>
</PRE>
creates a square function just like the function declaration above,
but does not give it a name.
Its only purpose it to be applied to the number 3. See also
textbook
<a href="https://sourceacademy.org/sicpjs/1.3.2">section 1.3.2 Function Definition Expressions</a>.

### Blocks

Blocks make up the bodies of functions and the consequent and alternative statements of
conditional statements. You can use blocks also elsewhere in your program, if you
want to declare constants local to a specific scope. For example in this program
<PRE><CODE>const a = 1;
{
   const a = 2;
   display(a);
}
display(a);</CODE>
</PRE>
the first application of `display` shows the value 2, because the
declaration <B>const</B> `a = 2;` re-declares the constant `a`.
However, the second application
of `display` shows the value 1, because
the declaration <B>const</B> `a = 2;` is limited in scope by its surrounding block.
You can read more about <EM>blocks</EM> in
<a href="https://sourceacademy.org/sicpjs/1.1.8">section 1.1.8
Functions as Black-Box Abstractions</a>.

### Boolean operators

Boolean operators in Source have a special meaning. Usually, an operator combination
evaluates all its arguments and then applies the operation to which the operator refers.
For example, `(2 * 3) + (4 * 5)` evaluates `2 * 3` and `4 * 5` first, before the addition
is carried out. However, the operator `&&` works differently. An expression
`e1 && e2` should be seen as an abbreviation for `e1 ? e2 : false`. The expression
`e2` only gets evaluated if `e1` evaluates to `true`. The behaviour of `||` is similar:
`e1 || e2` should be seen as an abbreviation for `e1 ? true : e2`. More on these
two boolean operators in textbook
<a href="https://sourceacademy.org/sicpjs/1.1.6">section 1.1.6 Conditional
Expressions and Predicates</a>.

### Sequences

A program or the body of a block does not need to consist of a single statement.
You can write multiple statements in a row. In the REPL ("Read-Eval-Print-Loop")
of a Source implementation, you can write
<PRE><CODE>cube(7);
square(5);</CODE></PRE>
The statements in such a sequence are evaluated in the given order. The
result of evaluating the sequence is the result of evaluating the last
statement in the sequence, in this case `square(5);`.
Read more about sequences in
<a href="https://sourceacademy.org/sicpjs/1.1.2">section 1.1.2
Naming and the Environment</a> of the textbook.

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_1.pdf">Specification of Source §1</a>. Feel free to
take a peek.

