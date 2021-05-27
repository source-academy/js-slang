Open-source implementations of the programming language *Source*. Source
is a series of small subsets of JavaScript, designed for teaching
university-level programming courses for computer science majors,
following Structure and Interpretation of Computer Programs, JavaScript
Adaptation (<https://source-academy.github.io/sicp/>).

Setting up and Using SICP library
=================================

First, install the package
``` {.}
$ npm i sicp
```
Remember to create file `package.json` first if you have not by
``` {.}
$ npm init
```

To use SICP library, you need to import by 
``` {.}
import './node_modules/sicp/dist/sicp.js';
```
For example,
``` {.}
import './node_modules/sicp/dist/sicp.js';

const p = list("I", "love", "sicp");
display(head(tail(p)));
```

