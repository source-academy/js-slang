_The below is a first-person account of how the transpiler got to be, written by @openorclose. It is not meant to be a one-to-one representation of how the transpiler works, but rather the motivation and explanation behind each transformation taken._

_A formal code documention rather than a first-person thought process might be in the works._

---------------------

## Foreword
Read this to find out what worked and what failed during the process of development. Of course, stuff that failed might just mean I didn't put more thought into how to get it to work, so don't let it deter you from exploring paths that didn't work for me. Similarly, you can try figuring out how to break stuff with the methods I say do work, and the maintainers of this repository will hopefully fix it.

I hope this page helps anyone who reads my code to understand what I'm trying to accomplish more clearly.
 

-------------------

# Development of the transpiler

## Problems with JavaScript

### Bad operators

Most will agree that that the `==` and `!=` operators are harmful, leading to hard-to-catch bugs. These operators are banned in _Source_. 

Other operators, such as `*`, like to play nice and force both their operands into numbers if possible. This is not desired by _Source_, so something must be done to enforce the correct types for operands.

### Majority rules

While proper tail calls is a requirement since the ES2015 specifications, most browsers have come to an agreement to not support it. (Since then, major browser support is a requirement for a feature to be included in that year's specs, so such a problem is unlikely to occur again.) Source requires this feature for the concept of iterative and recursive processes, however.

## Solutions:

### 1st try: Interpret

(Supposedly there's a 0th try, a virtual machine, but I don't know too much about that.) The current _Source_ is interpreted on an interpreter written in Javascript. An interpreter that runs on a (mostly) interpreted language. While for most code this is reasonably fast, it slows down to a crawl for more intensive tasks. Some code that runs in a negligble amount of time in Chrome's console takes up to a minute to run in the interpreter. _Can we do better?_  

### 2nd try: Instrument

__Since running it in the console is so fast, why not just `eval` it?__ This is the main motive to deviate from the interpreter idea and to switch to code instrumentation instead, to take advantage of the fast JavaScript implementation in current browsers. The rest of this article shall focus on the implementation of this idea.

Just a note, the disallowed constructs such as `==`, classes syntax etc are already being caught in the parser used by the current interpreter. It will be reused because it works just fine.

## Instrumentation

Liberal instrumentation of code is needed to nudge JavaScript to interpret _Source_ code the right way. These are somewhat simplified versions of what is actually done, such as omitting the ugly passing of line numbers around in code to throw nice error messages for certain detectable errors.

### Line numbers of error messages

As you will see in later instrumented code, the line number shown should an error occur would be different from the original one. Fortunately, this is a solved problem, as minified code poses the same issue as well. [Source Map](https://github.com/mozilla/source-map) s is a way that maps your transformed code back into the original one (and vice versa). Some simple parsing of the error stack is done, and then more simple detection of what the error and an appropriate message is returned. This does not catch all errors though, so if they can't be parsed properly the original error message gets shown.

### Variable storage

One major problem of using `eval` is that `eval('const a = 1;');` does not let us access the variable `a` again as it is not declared in the same scope. This would not allow the REPL to work, so there needs to be another way. The first idea that came to mind worked out well for the most part.

Store declared global variables in a global constant named `STUDENT_GLOBALS`.

Code will be appended to the end of the student's code to store the currently declared global variables into `STUDENT_GLOBALS`.

e.g.

```javascript
//Student's main code
const PI = 3;
let sum = 0;
sum = sum + 1;
```

```javascript
//Transpiled code
//reset STUDENT_GLOBALS
// student's main code
const PI = 3;
let sum = 0;
sum = sum + 1;
//end of student's main code
//save declared studentglobals
STUDENT_GLOBALS["PI"] = {kind: "const", value: PI};
STUDENT_GLOBALS["sum"] = {kind: "let", value: sum};
```

Before exectution of REPL code in the same context (so previously declared global variables have to be accessible), all keys of `STUDENT_GLOBALS` will be looped through and `<kind> <key> = STUDENT_GLOBALS["<key>"];` will be prepended. For all variables (those declared with `let`), `STUDENT_GLOBALS["<key>"] = <key>;` will be appended to student's code to update the variable's value at the end of the code's execution.

Assuming the previous "main" code has been executed already, `PI` and `sum` will have already been saved.

So for the following code in the REPL:

```javascript
// student's repl code
sum = sum + PI;
```

```javascript
// transpiled code
const PI = STUDENT_GLOBALS["PI"].value; // we need to put back these variables 
let sum = STUDENT_GLOBALS["sum"].value; // this too
// student's repl code
sum = sum + PI;
// end of student's code
STUDENT_GLOBALS["sum"] = {kind: 'let', value: sum}; // store back variable sum
// PI does not need to be copied back since it's constant.
```

#### Minor Problem 

```js
const one = 1;
if (true) {
  1;
} else {
  one;
}
```

should result in `1` being returned as it's the value of the last statement evaluated. However, because of the the statements to store back the variables,

```js
const one = 1;
if (true) {
  1;
} else {
  one;
}
STUDENT_GLOBALS['one'] = {kind: 'const', value: one};
```

the last line value is now incorrect. Luckily `eval` is here yet again. All that needs to be done is to save the value of the last statement and then return it at the end, so we do that by transforming the last statement into a string and then `eval`ing it:

```js
const one = 1;
const lastLineResult = eval(`if (true) {
  1;
} else {
  one;
}
`);
STUDENT_GLOBALS['one'] = {kind: 'const', value: one};
lastLineResult;
```

and boom, problem solved...

not. 

#### Minorer problem

If the last line is a variable declaration statement, it would get transformed into:

```js
const lastLineResult = eval('const two = 2;'); // last line transformed into eval
STUDENT_GLOBALS['two'] = {kind: 'const', value: two};
lastLineResult;
```

But then two is not defined in the outer scope, it's defined only within the `eval` scope, so its value wouldn't get saved. Luckily again, the return value of a declaration is undefined, so if the last line of code is a declaration statement it does not get changed into eval, and we append `undefined;` at the end of the code:
```js
const two = 2; // last line not transformed into eval
STUDENT_GLOBALS['two'] = {kind: 'const', value: two};
undefined;
```

Phew.

### Builtins

This is basically saying there are predefined constants, so the same method as above works.
Store all builtins in a global constant named `BUILTINS`. e.g.

```javascript

const BUILTINS = {
  is_null: testee => testee === null,
  is_string: testee => typeof testee === string,
  //...
};

```

```javascript
// Student's code
is_null(null);
```

```javascript
// Transpiled code
const is_null = BUILTINS["is_null"];
const is_string = BUILTINS["is_string"];
//...
// Student's code
is_null(null);
```

Nothing much to say here... If there's a problem with this then the above way of storing globals wouldn't work as well.

## Strict types

In JavaScript, most operators can be used with all types, sometimes producing garbage results. In Source, strict types for operators are enforced. All operators will be transpiled into functions. There will be a global constant named OPERATORS, like: 

```javascript
const OPERATORS = {
  "+": (left, right) => {
    if (validOperands) {
      return left + right;
    } else {
      throw new Error();
    }
  },
  callIfFunctionElseError(f, ...args) {
    if (typeof f === 'function') {
      return f(...args);
    } else {
       throw new Error();
    }
  },
  itselfIfBooleanElseError(candidate) {
      if (typeof candidate === 'boolean') {
         return candidate;
      } else {
         throw new Error();
      }
};
```

Then student's code will be transpiled from
```javascript
1 + 2;
1 + "string";
1(123); //not a functoin
'string' ? 1: 2; // conditional test must be boolean
```
into
```javascript
OPERATORS["+"](1, 2);
OPERATORS["+"](1, "string");
callIfFunctionElseError(1, 123);
itselfIfBooleanElseError('string') ? 1 : 2;
```

## Proper tail calls

As said earlier, _Source_ requires tail-recursive functions to give rise to an iterative process. This does not happen natively in most browsers. As such, some magic needs to happen.

[Click here if you would like to skip the failed attempts](#two-wrongs-make-a-right-the-final-working-solution)

### Failed attempt 1: Wishful thinking

Assume that a function `enableProperTailCalls` exists. There is a working prototype [here](https://repl.it/@daryltan/tail-recursion).

Then, all functions that students have declared, 

```javascript
function sumTo(n, sum) {
  return n === 0 ? sum : sumTo(n - 1, sum + n);
}

const factorial = (n, total) => {
  return n === 0 ? total : factorial(n - 1, n * total);
}

const squared = map(list(1, 2, 3), x => x * x);
```

will be transpiled into

```javascript
const sumTo = enableProperTailCalls((n, sum) => {
  return n === 0 ? sum : sumTo(n - 1, sum + n);
});

const factorial = enableProperTailCalls((n, total) => {
  return n === 0 ? total : factorial(n - 1, n * total);
});

const squared = map(list(1, 2, 3), enableProperTailCalls(x => x * x));
```

#### How enableProperTailCalls works
```javascript
const enableProperTailCalls2 = (() => {
  const tailValue = Symbol("value to return to check if call is in tail position");
  return fn => {
    let isFunctionBeingEvaluated = false;
    let returnValue = undefined;
    const argumentsStack = [];
    let originalArguments = undefined;
    const reset = () => {
      isFunctionBeingEvaluated = false;
      originalArguments = undefined;
      isPossbilyFunctionWithTailCalls = true;
    };
    return function (...args) {
      if (!isPossbilyFunctionWithTailCalls) {
        return fn.apply(this, args);
      }
      argumentsStack.push(args);
      if (!isFunctionBeingEvaluated) {
        isFunctionBeingEvaluated = true;
        originalArguments = args;
        while (argumentsStack.length > 0) {
          let hasError = false;
          try {
            returnValue = fn.apply(this, argumentsStack.shift());
          } catch (e) {
            hasError = true;
          }
          const isTailCall = returnValue === tailValue;
          const hasRemainingArguments = argumentsStack.length > 0;
          if (hasError || (!isTailCall && hasRemainingArguments)) {
            isPossbilyFunctionWithTailCalls = false;
            returnValue = fn.apply(this, originalArguments);
            reset();
            return returnValue;
          }
        }
        reset();
        return returnValue;
      }
      return tailValue;
    };
  };
})();
```
It takes in a function, and returns a dummy function that when first called, starts a while loop. All subsequent calls do not start a while loop and instead pushes its processed values onto an argument stack, much like how tail calls are supposed to work. This works fine for _most_ functions that involve iterative processes. It detects tail calls by having the function return a specific value, so if a function call is indeed in a tail position it would definitely return that specific value. Otherwise, we say that that function cannot be tail call optimised and rerun the original function without modifications.

But.

#### Major problem 1

It doesn't differentiate between a "new" call to the same function and a "recursive" call. Take

```js
function f(x, y, z) {
  if (x <= 0) {
    return y;
  } else {
    return f(x-1, y+ /* the coming f should start another "first" f call*/ f(0, z, 0), z);
  }
}
f(5000, 5000, 2); // "first" f call
```

Once the while loop is entered, it can't differentiate between the above two calls and don't both start their own while loop to evaluate the function, when they should.

#### Major problem 2

Variables don't work.

```js
let sum = 0;
function f() {
  sum += 1;
}
f();
sum;
```

1. we try to see if f can be tail call optimised.
2. `sum` gets incremented.
3. f cannot be tail call optimised.
4. f is rerun since the tail call optimisation failed.
5. *`sum` gets incrememented again.*

...

#### Aftermath

In retrospect this was a horrible idea, and now it looks so painfully obvious this wouldn't work. I leaned towards it because it seemed so simple and dreamy. Ah well.

### Failed attempt 2: Trampolines are fun only if everyone jumps

We use a trampoline. All return statements are transformed into objects (so they do not perform recursive calls that can blow the stack).

```js
function factorial (n, acc) { //simple factorial
  if (n <= 1) {
    return acc;
  } else {
    return factorial(n - 1, acc * n);
  }
}
```

becomes
```js
function factorial (n, acc) { //simple factorial
  if (n <= 1) {
    return { value: acc, isTail: false};
  } else {
    return { f:factorial, args: [n - 1, acc * n], isTail: true };
  }
}
```

Special checks are done to make sure conditional and logical expressions can behave too:

```js
const toZero = n => {
  return n === 0 ? 0 : toZero(n - 1);
}
````

becomes 
```js
const toZero = n => {
  return n === 0 ? {isTail: false, value: 0} : {isTail:true, f:toZero, args:[n - 1]};
};
 ```

And then we transform all function calls from `f(arg1, arg2, ...)` into `call(f, [arg1, arg2, ...])`.

Where `call` is

```js

function call(f, args) {
  let result;
  while (true) {
    result = f(...args);
    if (result.isTail) {
      f = result.f;
      args = result.args;
    } else {
      return result.value;
    }
  }
}
```

#### Problem

Builtins exist. Predefined functions. They do not and cannot play nice and follow this way of returning their results. They also have no idea on how to call these functions, should these transformed functions be passed to them. While a possible soution would be to rewrite all these builtins to use the same object-returing style, it would become unfeasible should external libraries be needed.

### Two wrongs make a right: The final working solution

We keep Failed Attempt 2's transformation of return values into objects, and the call function to actually be able to execute it. We also keep Failed Attempt 1's transformation of the original function into another one.

So the above example

```js
const toZero = n => {
  return n === 0 ? {isTail: false, value: 0} : {isTail:true, f:toZero, args:[n - 1]};
};
```

gets transformed into

```js
const toZero = wrap(n => {
  return n === 0 ? {isTail: false, value: 0} : {isTail:true, f:toZero, args:[n - 1]};
});
```
where `wrap` is

```js
const wrap = f => {
  const wrapped = (...args) => call(f, ...args)
  wrapped.transformedFunction = f
  return wrapped
}
```

and with a small modification to `call`:

```js

function call(f, args) {
  let result;
  while (true) {
    if (f.transformedFunction !== undefined) { // retrieve the real function that returns { isTail: etc }
      f = f.transformedFunction;
    } // else it's a builtin function like alert, prompt and we call it normally
    result = f(...args);
    if (result.isTail === true) {
      f = result.f;
      args = result.args;
    } else if (result.isTail === false) {
      return result.value;
    } else {
      return result // isTail does not exist on result, it must be from a builtin and so we just return it.
    }
  }
}
```

This allows them to be called as normal functions, and they can also play nice with builtins.

#### Small almost negligible issue

_Source_ does not allow objects (`{}`), so the above works. If objects do get introduced we would have to make the return value an instance of a class and then check for it. But the essence of this solution still works, so that bridge will be crossed if that bridge needs to be crossed.

## Infinite loops 

```js
while (true) {
  
}
```

gives rise to an infinite loop. `eval` this and your browser hangs. This is even more of a problem with a new feature coming up in the Source Academy, where code is automatically run if it is syntactically valid. 

```js
let i = 0;
while (i < 10) {
  // i = i + 1; not yet typed
}
```

is definitely not an uncommon way to start writing a loop. 
This hanging the browser is not acceptable.
Therefore, a simple timeout is used.

```js
let i = 0;
const startTime = Date.now();
while (i < 10) {
  if (Date.now() - startTime < 1000) {
    throw new Error("Infinite recursion");
  }
  // i = i + 1; not yet typed
}
```

We augment the code with a check, and if the code has been running for >1s we throw an error:
```
Line x: Potential infinite loop detected.
If you are certain your code is correct, press run again without editing your code.
The time limit will be increased from 1 to 10 seconds.
This page may be unresponsive for up to 10 seconds if you do so.
```

If the exact same string of code is executed again, the time limit will be increased by a factor of 10 to 10s.
This should be enough for most, if not all correct code to run while protecting against infinite loops that crash the browser.
1s is still a long time to be unresponsive when code is being typed though.
Maybe a starting time limit of 100ms is better, but more tests need to be done to determine if 100ms will create too many false positives.

## Sandboxing

While not entirely needed, if done right this would solve any potential questions of code that manages to run but are not valid _Source_, such as `eval`, `Function` constructor etc.

The first issue is that eval has scope. This means:

```js
const a = 123;
///... other code
return eval(transpiled_code);
// assuming code is 'a;' without having a being declared.
```
allows access of these variables in its surrounding scope. Ignoring any security risks if they exist (since autograder actually executes these codes there is a chance there may be), this might lead to lots of confusion. Javascript code gets minified, and so there'll be many one-letter variable names throughout the code. Accidentally referring to such variables in _Source_ without having first been declared might lead to the values from the outside leaking, and not throwing an undefined variable error as expected.

Thankfully, as long as eval is used in an indirect scope (such as `window.eval`) and not those 4 leters proceeded by a left parentheses, it will be executed in the global scope.

Which just leads to the hiding of global variables. For this, we just loop through all the keys in `window` and filter them to see if they're valid identifiers:

```js
function isValidIdentifier(candidate) {
  try {
    eval(`"use strict";{const ${candidate} = 1;}`)
    return true
  } catch {
    return false
  }
}
const globals = Object.getOwnPropertyNames(window).filter(isValidIdentifier);
```

And then we wrap the transpiled code with an immediately invoked arrow function expression, with these globals as parameters and setting them to undefined by not passing in arguments:

```js
((eval, window, Number, parseInt, isNaN, ... et) => {
  transpied code...
})();
```

This also lets _Source_ be able to use all these previously unsuable names such as Number as variable names.


## Nice function strings
Small note, since not getting into the implementation details.

Obviously, we can't output the transformed body of the function when turning them into a string. So, we store the original stringified function somewhere else first, and then change the toString method of all the functions to use the original stringified function.
