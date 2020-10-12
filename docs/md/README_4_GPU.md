Source §4 GPU is a small programming language, designed to allow users to accelerate their programs 
by making use of their GPUs!

## What names are predeclared in Source §4 GPU?

On the right, you see all predeclared names of Source §4, in alphabetical
order. Click on a name to see how it is used. They come in these two groups:
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
      <a href="../MCE/index.html">MCE</a>: Support for the meta-circular evaluator
    </li>
  </ul>

The <a href="https://sourceacademy.nus.edu.sg">Source Academy</a>,
a learning environment that uses SICP JS and Source, comes with the following 
<a href="External libraries/">external libraries</a>:
  <ul>
    <li>
      <a href="../RUNES/index.html">RUNES</a>: Library for runes graphics
    </li>
    <li>
      <a href="../CURVES/index.html">CURVES</a>: Library for curve graphics
    </li>
    <li>
      <a href="../SOUNDS/index.html">SOUNDS</a>: Library for sound processing
    </li>
    <li>
      <a href="../BINARYTREES/index.html">BINARYTREES</a>: Library for binary trees
    </li>
    <li>
    <a href="../PIXNFLIX/index.html">PIXNFLIX</a>: image and video processing
    </li>
    <li>
      <a href="../GAME/index.html">GAME</a>: Library for Source Academy game
    </li>
    <li>
      <a href="../EV3/index.html">EV3</a>: Library for EV3 Lego Mindstorms robots
    </li>
  </ul>

## What can you do in Source §4 GPU?

You can write for loops as per normal source and if certain conditions are met, the GPU will 
be invoked to run the program!

### Example:

```=javascript
const size = 100;

const L = [];
const R = [];
for (let r = 0; r < size; r = r + 1) {
    L[r] = [];
    R[r] = [];
    for (let c = 0; c < size; c = c + 1) {
        L[r][c] = r*c;
        R[r][c] = r + c;
    }
}

const res = [];
for (let r = 0; r < size; r = r + 1) {
    res[r] = [];
}

const startTime = get_time();
for (let r = 0; r < size; r = r + 1) {
    for (let c = 0; c < size; c = c + 1) {
        let sum = 0;
        for (let i = 0; i < size; i = i + 1) {
            sum = sum + L[r][i] * R[i][c];
        }
        res[r][c] = sum;
    }
}

const endTime = get_time();
const elapsed = endTime - startTime;

display(res);
display(elapsed, "Time taken: ");
```

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_4_gpu.pdf">Specification of Source §4 GPU</a>. Feel free to
take a peek!


