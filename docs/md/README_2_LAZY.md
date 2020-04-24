Source §2 Lazy is a small programming language, designed for the first chapter
of the textbook
<a href="https://sicp.comp.nus.edu.sg">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).
Instead of the more common evaluation order of applicative order reduction
employed by Source §2, the language Source §2 Lazy uses a variant of
normal order reduction called <EM>lazy evaluation</EM>.

## What is lazy  evaluation?

In most programming languages, the arguments of primitive operations
or functions are fully evaluated before the operation or the 
the function is applied. This is called <EM>applicative order reduction</EM>.
<a href="https://sicp.comp.nus.edu.sg/chapters/84">Section 1.1.5</a>
of Structure and Interpretation of Computer Programs, JavaScript Adaptation
(SICP JS), introduces an alternative, called normal order reduction. In
this scheme, the argument expressions of functions are passed un-evaluated
to the function to which they are applied. The function then evaluates
these expressions whenever their values are required. If functions
do not have any side-effects, there is no need to evaluate such an expression
multiple times, as the result is guaranteed to be the same. This observation
leads to the variant of normal order reduction, called <EM>lazy evaluation</EM>.
In lazy evaluation, the evaluator remembers the result of evaluating the
argument expressions for the first time, and simply retrieves this result
whenever it is required again.

## What can you do in Source §2 Lazy?

You can use all features of
<a href="../source_1/">Source §1</a>, but with the added
benefit of lazy evaluation. For example, lists in
Source §1 Lazy are lazy: They can be infinite, as shown
in 
<a href="https://sicp.comp.nus.edu.sg/chapters/84">Section 4.2.3</a>
of Structure and Interpretation of Computer Programs, JavaScript Adaptation
(SICP JS).

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_2_lazy.pdf">Specification of Source §2 Lazy</a>.
Feel free to take a peek!


