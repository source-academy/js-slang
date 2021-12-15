Source §3 is a small programming language, designed for the third chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).

## What names are predeclared in Source §3?

On the right, you see all predeclared names of Source §3, in alphabetical
order. Click on a name to see how it is defined and used. They come in these groups:
  <ul>
    <li>
      <a href="../MISC/index.html">MISC</a>: Miscellaneous constants and functions
    </li>
    <li>
      <a href="../MATH/index.html">MATH</a>: Mathematical constants and functions
    </li>
    <li>
      <a href="../LISTS/index.html">LISTS</a>: Support for lists
    </li>
    <li>
      <a href="../PAIRMUTATORS/index.html">PAIRMUTATORS</a>: Mutating pairs
    </li>
    <li>
      <a href="../ARRAYS/index.html">ARRAYS</a>: Support for arrays
    </li>
    <li>
      <a href="../STREAMS/index.html">STREAMS</a>: Support for streams
    </li>
  </ul>

## What can you do in Source §3?

You can use all features of
<a href="../source_2/">Source §2</a> and all
features that are introduced in
<a href="https://sourceacademy.org/sicpjs/3">chapter 3</a> of the
textbook.
Below are the features that Source §3 adds to Source §2.


### Variable declaration statements

In Source §3, variables are declared as in:

<CODE>let my_variable = x * 4;</CODE>

The scope of names declared with `let` is the
same as
the scope of names declared with `const`: the closest
surrounding block. The difference is that variables
can be used in assignment statements.

### Variable assignment statements

Variables can be assigned to as in: <PRE><CODE>let x = 1;
display(x); // x is still 1
x = x + 1;
diplay(x);  // now x is 2</CODE></PRE>
Read more on variable declaration and assignment in
<a href="https://sourceacademy.org/sicpjs/3.1.1">section 3.1.1 Local State Variables</a>
of the textbook.

### While loops

A while loop repeatedly evaluates a predicate and if the predicate returns `true`,
evaluates a given block. The evaluation terminates when the predicate returns `false`.
Example:

<PRE><CODE>let x = 0;
while (x &lt; 10) {
    display(x);
    x = x + 1;
}</CODE></PRE>

will display the numbers from 0 to 9.

While loops are not covered in the textbook.

### For loops

The pattern of repeatedly testing and changing a particular variable is
supported by for loops. The same program can be written shorter as:

<PRE><CODE>let x = 0;
for (x = 0; x &lt; 10; x = x + 1) {
    display(x);
}</CODE></PRE>
The increment statement <CODE>x = x + 1</CODE> is always
evaluated after the body of the loop.

You can limit the scope of the variable to just the for loop, by writing
`let` after the parenthesis: <PRE><CODE>for (let x = 0; x &lt; 10; x = x + 1) {
    display(x);
}</CODE></PRE>
For loops are not covered in the textbook.

### Arrays, array access and array assignment

Arrays are created using literal array expressions, as follows:

<CODE>const my_array = [10, 20, 30];</CODE>

The constant `my_array` now refers to an array with three elements.
The elements in such a literal array expressions have implicit
keys. The first element has key 0, the second has key 1, the third
has key 2 and so on.

An array can be accessed using array access expressions, with
a given key:

<CODE>my_array[0] + my_array[1] + my_array[2]; // 60</CODE>

Like pairs, arrays can be changed in Source §3. This is done
using array assignment:

<CODE>my_array[1] = 200;</CODE>

Array assignment and array access in Source §3 are restricted
to integers (numbers with no fractional component) larger than or
equal to 0 and less than 2<SUP>32</SUP>-1. We call such numbers <EM>array indices</EM>.

You can use any array index in array assignment; the array will
automatically adjust its size. Accessing an array at an array
index that has not been assigned yet (using a literal array
expression or an array assignment) will return `undefined`.

Arrays are not covered in the textbook.

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_3.pdf">Specification of Source §3</a>. Feel free to
take a peek!


