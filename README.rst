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

To build,

.. code-block::

  $ git clone https://github.com/source-academy/js-slang.git
  $ cd js-slang
  $ yarn
  $ yarn build

To add "js-slang" to your PATH, build it as per the above instructions, then run

.. code-block::

  $ cd dist
  $ npm link

If you do not wish to add "js-slang" to your PATH, replace "js-slang" with "node dist/repl/repl.js" in the following examples.

To try out *Source* in a REPL, run

.. code-block::

  $ js-slang -c [chapter] # default: 1

You can set additional options:

.. code-block::

  Usage: js-slang [PROGRAM_STRING] [OPTION]

    -c, --chapter=CHAPTER set the Source chapter number (i.e., 1-4) (default: 1)
    -s, --use-subst       use substitution
    -h, --help            display this help
    -n, --native          use the native execution method
    -l, --lazy            use lazy evaluation
    -e, --eval            don't show REPL, only display output of evaluation

Documentation
-------------

Source is documented here: https://sicp.comp.nus.edu.sg/source/

To build the documentation, run

.. code-block::

  $ git clone https://github.com/source-academy/js-slang.git
  $ cd js-slang
  $ npm install # If additional permissions are required, run sudo npm install
  $ yarn jsdoc  # to make the web pages in js-slang/doc/source
  $ cd doc
  $ make        # to make the PDF documents using LaTeX

Documentation on the Source libraries are generated from inline documentation
in the library sources. The libraries are in repository ``cadet-frontend``, which
is assumed to be located in ``../cadet-frontend``, from the root of this repo.
The command
``yarn jsdoc``
makes the documentation available in folder and updates the jsons for documentation displayed in the `cadet-frontend`.
``doc/jsdoc/libraries/``.
The script `jsdoc` provides an installation command to deploy the documentation via `scp` on a server:
``yarn jsdoc install``

To update documentation displayed in autocomplete on the frontend, `js-slang` version needs to be bumped and `cadet-frontend` needs to be updated to use the new version.

Testing
-------

js-slang comes with an extensive test suite. To run the tests after you made your modifications, run
``yarn test``. Regression tests are run automatically when you want to push changes to this repository. The regression tests are generated using `jest` and stored as snapshots in ``src/__tests__``.

After modifying js-slang, carefully inspect any failing regression tests reported in red in the command line. If you are convinced that the regression tests and not your changes are at fault, you can update the regression tests as follows:

.. code-block::

  $ yarn test -- --updateSnapshot

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

Using your js-slang in local Source Academy
-------------------------------------------

A common issue when developing modifications to js-slang is how to test it using your own local frontend. Assume that you have built your own cadet-frontend locally, here is how you can make it use your own js-slang, instead of the one that the Source Academy team has deployed to npm:

.. code-block::

  $ cd js-slang
  $ yarn build
  $ cp -r dist ../cadet-frontend/node_modules/js-slang

Then start frontend and the new js-slang will be used.
