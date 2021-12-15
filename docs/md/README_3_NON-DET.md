Source §3 Non-Det is a small programming language, designed for the fourth chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).

## What is nondeterministic programming?
Source 3 Non-Det is a version of Source 3 with a built-in search mechanism.
Programmers can specify sets of values, and requirements that the values must satisfy.
The program evaluator then automatically identifies the values that meet the requirements.

## What names are predeclared in Source §3 Non-Det?

On the right, you see all predeclared names of Source §3 Non-Det, in alphabetical
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
    <li>
      <a href="../NON-DET/index.html">NON-DET</a>: Support for nondeterminism
    </li>
  </ul>

## What can you do in Source §3 Non-Det?

You can use all features of
<a href="../source_3/">Source §3</a> and all
features that are introduced in
<a href="https://sourceacademy.org/sicpjs/4.3">chapter 4.3</a> of the
textbook.

Below are the features that Source §3 Non-Det adds to Source §3.

### amb operator
A set of values can be specified with the <CODE>amb</CODE> operator.

In the following example, we specify two possible choices for a value we want:<br>
<CODE>amb('hello', 'bye') + 'world!'; // 'hello world!'</CODE>

To obtain the next value, <CODE>'bye'</CODE>, enter the command <CODE>try_again</CODE> in the playground REPL.
This will give the result <CODE>'bye world!'</CODE>.

### ambR operator
The <CODE>ambR</Code> operator functions similarly to <CODE>amb</Code> but makes choices randomly
instead of sequentially.

Upon running the above example, we may randomly obtain the result <CODE>'hello world!'</CODE> first and <CODE>'bye world!</CODE> second<br>
or <CODE>'bye world!</CODE> first and <CODE>'hello world!'</CODE> second.

### require function
Requirements can be specified with the <CODE>require</code> function.

In the following example, we add the requirement that the number chosen should be greater than 3:<br/>
<CODE>const f = amb(1, 2, 3, 4, 5, 6); require(f > 3); f; // 4</CODE>

To obtain the next value <CODE>5</CODE>, enter the command <CODE>try_again</CODE> in the playground REPL.<br>
Entering <CODE>try_again</CODE> once more will give the final value of <CODE>6</CODE>.

### cut operator
In order to obtain only the first possible value which satisfies given requirements,<br>
the <CODE>cut</CODE> operator can be used to prevent backtracking beyond the current statement.

In the following example, we are able to obtain only a single value:<br>
<CODE>const f = amb(1, 2, 3, 4, 5, 6); require(f > 3); cut(); f; // 4</CODE>

Entering <CODE>try_again</CODE> in the playground REPL will not give the subsequent values that were specified,
<CODE>5</CODE> and <CODE>6</CODE>.

### implication function
The <CODE>implication</CODE> function can be used to model logical implication between two boolean expressions.

### bi_implication function
The <CODE>bi_implication</CODE> function can be used to model logical bi-implication between two boolean expressions.

### an_element_of function
The <CODE>an_element_of</CODE> function can be used to nondeterministically obtain an element from a list.<br>
It functions similarly to <CODE>amb</CODE> but takes in a list of choices as argument instead of the choices being arguments themselves.

### an_integer_between function
The <CODE>an_integer_between</CODE> function can be used to nondeterministically obtain an integer between a specified range (inclusively).

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_3_nondet.pdf">Specification of Source §3 Non-Det</a>.
Feel free to take a peek!
