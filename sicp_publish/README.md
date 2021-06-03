This JavaScript npm package provides all functions and constants that are assumed to be predeclared in the textbook Structure and Interpretation of Computer Programs, JavaScript Adaptation (<https://source-academy.github.io/sicp/>. This package therefore allows readers of the textbook to run and experiment with all JavaScript programs that appear in the textbook, using Node.js.

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

