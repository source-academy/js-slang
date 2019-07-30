js-slang
========

.. image:: https://travis-ci.org/source-academy/js-slang.svg?branch=master
    :target: https://travis-ci.org/source-academy/js-slang
.. image:: https://coveralls.io/repos/github/source-academy/js-slang/badge.svg?branch=master
    :target: https://coveralls.io/github/source-academy/js-slang?branch=master

Open-source implementations of the programming language *Source*. Source is a series of
small subsets of JavaScript, designed for teaching university-level programming courses
for computer science majors, following Structure and Interpretation of Computer Programs, JavaScript Adaptation (https://sicp.comp.nus.edu.sg).

Usage
-----

To run in native, set isNativeRunnable to true here: https://github.com/source-academy/js-slang/blob/master/src/index.ts#L29

To build,

.. code-block::

  $ git clone https://github.com/source-academy/js-slang.git
  $ cd js-slang
  $ yarn
  $ yarn build

To try out *Source* in a REPL, run

.. code-block::

  $ node dist/repl/repl.js [chapter] # default: 1

or alternatively, install js-slang and run

.. code-block::

  $ npm -g install js-slang   # Install js-slang
  $ js-slang [chapter] # default: 1

Documentation
-------------

Source is documented here: https://sicp.comp.nus.edu.sg

To build the documentation, run

..code-block::

  $ git clone https://github.com/source-academy/js-slang.git
  $ cd js-slang
  $ make           # to make the PDF documents using LaTeX
  $ yarn run jsdoc # to make the web pages in js-slang/doc/source

Error messages
--------------

To enable verbose messages, have the statement ``"enable verbose";`` as the first line of your code.

There are two main kinds of error messages: those that occur at runtime and those that occur at parse time. 
The first can be found in interpreter-errors.ts, while the second can be found in rules/.

Each error subclass will have explain() and elaborate(). Displaying the error will always cause the first to be
called; the second is only called when verbose mode is enabled. As such, explain() should be made to return a string
containing the most basic information about what the error entails. Any additional details about the error message,
including specifics and correction guides, should be left to elaborate().

Please remember to write test cases to reflect your added functionalities. The god of this repository is self-professed
to be very particular about test cases.

Documentation
-------------

Documentation on Source §x is generated from LaTeX sources in folder ``doc``.
Currently the documents are generated as follows:
``
cd doc; make 
``

Documentation on the Source libraries are generated from inline documentation
in the library sources. The libraries are in repository ``cadet-frontend``, which
is assumed to be located in ``../cadet-frontend``, from the root of this repo.
The documentation is generated as follows:
``
yarn run jsdoc
``
This command makes the documentation available in folder
``
doc/jsdoc/libraries/
``

