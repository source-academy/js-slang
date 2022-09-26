This JavaScript npm package provides all functions and constants that are assumed to be predeclared in the textbook [Structure and Interpretation of Computer Programs, JavaScript Edition](https://sourceacademy.org/sicpjs) (SICP JS). This package therefore allows readers of the textbook to run and experiment with all JavaScript programs that appear in the textbook, using Node.js.

Alternatively, you can use the [Source Academy](https://sourceacademy.org), which has all necessary functions and constants predeclared.

Setting up and Using SICP package
=================================

You will need `node` version 16, and `yarn`.

Create the file `package.json` first if you have not done that, by running
``` {.}
$ yarn init
```
Add the following line in the `package.json` file
``` {.}
{
  ...
  "type": "module"
}  
```
Install the package `sicp` as follows:
``` {.}
$ yarn add sicp
```
To use any functions in the `sicp` package, you need to import them in your program by writing
``` {.}
import { <Functions here> } from 'sicp';
```
For example, if your file `test.js` contains:
``` {.}
import { display, head, list, tail } from 'sicp';

const p = list("I", "love", "sicp");
display(head(tail(p)));
```
you can check that everything is in place and then run your program:
```
% ls
node_modules    package.json    test.js         yarn.lock
% node test.js
"love"
```
The documentation of the functions and constants provided by the `sicp` package is
[available here](https://docs.sourceacademy.org/source_4/global.html).

This package is generated from the GitHub repository [`js-slang`](https://github.com/source-academy/js-slang) in the GitHub organization `source-academy`. Please report issues and bugs in this repository, using the prefix `sicp:` in the title.

Developers
==========

To install a new version of `sicp` on `npm`, bump
the version number in `package.json` and then run
```
% cd ..
% yarn build_sicp_package
% cd sicp_publish
% npm publish
```
