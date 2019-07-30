All names in the JavaScript `Math` library are predeclared in Source. The
complete specifications are given in 
<a href="https://www.ecma-international.org/ecma-262/9.0/index.html#sec-math-object">ECMAScript
Specification, Section 20.2</a>, and a summary is available here, by clicking
on the names on the right.
<B>As learner of Source, you are not expected to learn all of these, right away. But
you might want to remember where you can look for them: Here!</B>
Click on a name to see how it is defined and used.
<P/>
Note that we expect
all arguments of `math_...`
functions to be numbers, as defined by the function `is_number`. An implementation
of Source does not need to check whether all arguments of `math_...`
functions are indeed numbers.
<P/>
Two of the specifications make use of the function ToUint32, which is defined as follows:
ToUint32 converts argument to one of 2<SUP>32</SUP> integer values in the
range 0 through 2<SUP>32</SUP>-1, inclusive. This operation functions as follows:

If the argument x is NaN, +0, -0, +∞, or -∞, ToUint32(x) return +0.
Otherwise, let `int` be the mathematical value that is the same sign as number and
whose magnitude is `math_floor(math_abs(x))`. ToUint32(x) returns `int` modulo 2<SUP>32</SUP>.
