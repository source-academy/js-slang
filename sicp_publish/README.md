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
A new file called `package.json` will be created. Add `"type": "module"` into the end of this file to be able to use SICP library. After added, the end your `package.json` file will look somehow like this
```{.}
  "license": "ISC",
  "type": "module"
}
```

To use SICP library, you need to import by 
``` {.}
import 'sicp';
```
For example,
``` {.}
import 'sicp';

const p = list("I", "love", "sicp");
display(head(tail(p)));
```
Constants and functions to use can be found here: <https://source-academy.github.io/source/source_4/global.html>
