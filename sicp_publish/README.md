This JavaScript npm package provides all functions and constants that are assumed to be predeclared in the textbook [Structure and Interpretation of Computer Programs, JavaScript Adaptation](https://source-academy.github.io/sicp). This package therefore allows readers of the textbook to run and experiment with all JavaScript programs that appear in the textbook, using Node.js.

Setting up and Using SICP library
=================================

Create the file `package.json` first if you have not by
``` {.}
$ npm init
```
Add the following line in the `package.json` file
``` {.}
{
  ...
  "type": "module"
}  
```
Next, install the package
``` {.}
$ npm i sicp
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
The documentation of the functions and constants provided by the `sicp` package is
[available here](https://source-academy.github.io/source/source_4/global.html).

This package is generated from the GitHub repository [`js-slang`](https://github.com/source-academy/js-slang) in the GitHub organization `source-academy`. Please report issues and bugs in this repository, using the prefix `sicp:` in the title.