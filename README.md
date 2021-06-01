Open-source implementations of the programming language *Source*. Source
is a series of small subsets of JavaScript, designed for teaching
university-level programming courses for computer science majors,
following Structure and Interpretation of Computer Programs, JavaScript
Adaptation (<https://source-academy.github.io/sicp/>).

Usage
=====

To build,

``` {.}
$ git clone https://github.com/source-academy/js-slang.git
$ cd js-slang
$ yarn
$ yarn build
```

To add \"js-slang\" to your PATH, build it as per the above
instructions, then run

``` {.}
$ cd dist
$ npm link
```

If you do not wish to add \"js-slang\" to your PATH, replace
\"js-slang\" with \"node dist/repl/repl.js\" in the following examples.

To try out *Source* in a REPL, run

``` {.}
$ js-slang -c [chapter] # default: 1
```

You can set additional options:

``` {.}
Usage: js-slang [PROGRAM_STRING] [OPTION]

  -c, --chapter=CHAPTER set the Source chapter number (i.e., 1-4)                                                              (default: 1)
  -v, --variant=VARIANT set the Source variant (i.e., default, interpreter, substituter, lazy, non-det, concurrent, wasm, gpu) (default: default)
  -h, --help            display this help
  -e, --eval            don't show REPL, only display output of evaluation
```

Currently, valid CHAPTER/VARIANT combinations are:
* `--chapter=1 --variant=default`
* `--chapter=1 --variant=wasm`
* `--chapter=1 --variant=lazy`
* `--chapter=1 --variant=substituter`
* `--chapter=1 --variant=interpreter`
* `--chapter=2 --variant=default`
* `--chapter=2 --variant=lazy`
* `--chapter=2 --variant=substituter`
* `--chapter=2 --variant=interpreter`
* `--chapter=3 --variant=default`
* `--chapter=3 --variant=concurrent`
* `--chapter=3 --variant=non-det`
* `--chapter=3 --variant=interpreter`
* `--chapter=4 --variant=default`
* `--chapter=4 --variant=gpu`
* `--chapter=4 --variant=interpreter`

Hint: In `bash` you can take the `PROGRAM_STRING` out
of a file as follows:

``` {.}
$ js-slang -n --chapter=1 -e "$(< my_source_program.js)"
```

Documentation
=============

Source is documented here: <https://source-academy.github.io/source/>

## Requirements
* `bash`: known working version: GNU bash, version 5.0.16
* `latexmk`: Version 4.52c
* `pdflatex`: known working versions
  * pdfTeX 3.14159265-2.6-1.40.18 (TeX Live 2017)

To build the documentation, run

``` {.}
$ git clone https://github.com/source-academy/js-slang.git
$ cd js-slang
$ yarn
$ yarn install 
$ yarn jsdoc  # to make the web pages in js-slang/docs/source
$ cd docs/source_language_specs 
$ make        # to make the PDF documents using LaTeX
```

Note: The documentation may not build on Windows, depending on your bash setup, [see above](https://github.com/source-academy/js-slang#requirements).

Documentation on the Source libraries are generated from inline
documentation in the library sources, a copy of which are kept in
`docs/lib/*.js`. The command `yarn jsdoc` generates the 
documentation and places it in the folder `docs/source`. The script
`jsdoc` provides an installation command to deploy the
documentation via `scp` to a web server:
``` {.}
$ yarn jsdoc install
```
You can test the documentation using a local server:
``` {.}
$ cd docs/source;  python -m http.server 8000
```

Documentation of libraries is displayed in autocomplete in the frontend.
This documentation is generated by `./scripts/updateAutocompleteDocs.py`
and placed in
`src/editors/ace/docTooltip/*.json` files. This script is run by `yarn
build`prior to`tsc`. To add a Source variant to the frontend autocomplete, edit `src/editors/ace/docTooltip/index.ts` and`./scripts/updateAutocompleteDocs.py`.



Testing
=======

`js-slang` comes with an extensive test suite. To run the tests after you made your modifications, run 
`yarn test`. Regression tests are run automatically when you want to push changes to this repository. 
The regression tests are generated using `jest` and stored as snapshots in `src/\_\_tests\_\_`.  After modifying `js-slang`, carefully inspect any failing regression tests reported in red in the command line. If you are convinced that the regression tests and not your changes are at fault, you can update the regression tests as follows:  
``` {.}
$ yarn test -- --updateSnapshot
```



Error messages
==============

To enable verbose messages, have the statement `"enable verbose";` as the first line of your program. This also causes the program to be run by the interpreter.

There are two main kinds of error messages: those that occur at runtime
and those that occur at parse time. The first can be found in
`interpreter-errors.ts`, while the second can be found in `rules/`.

Each error subclass will have `explain()` and `elaborate()`. Displaying the
error will always cause the first to be called; the second is only
called when verbose mode is enabled. As such, `explain()` should be made
to return a string containing the most basic information about what the
error entails. Any additional details about the error message, including
specifics and correction guides, should be left to `elaborate()`.

Please remember to write test cases to reflect your added
functionalities. The god of this repository is self-professed to be very
particular about test cases.

Using your js-slang in local Source Academy
===========================================

A common issue when developing modifications to js-slang is how to test
it using your own local frontend. Assume that you have built your own
cadet-frontend locally, here is how you can make it use your own
js-slang, instead of the one that the Source Academy team has deployed
to npm.

First, build and link your local js-slang:
``` {.}
$ cd js-slang
$ yarn build
$ yarn link
```
Then, from your local copy of cadet-frontend:
``` {.}
$ cd cadet-frontend
$ yarn link "js-slang"
```

Then start the frontend and the new js-slang will be used. 
