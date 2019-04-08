js-slang
========

.. image:: https://travis-ci.org/source-academy/js-slang.svg?branch=master
    :target: https://travis-ci.org/source-academy/js-slang
.. image:: https://coveralls.io/repos/github/source-academy/js-slang/badge.svg?branch=master
    :target: https://coveralls.io/github/source-academy/js-slang?branch=master

An open-source interpreter for the *Source* programming language.

Wiki
----

`Click here for the wiki
</doc/wiki>`_

Usage
-----

To enable verbose messages, have the statement ``"enable verbose";`` as the first line of your code.

To run in native, set isNativeRunnable to true here: https://github.com/source-academy/js-slang/blob/master/src/index.ts#L29

To build,

.. code-block::

  $ git clone https://github.com/source-academy/js-slang.git
  $ cd slang
  $ yarn
  $ yarn build

To try out *Source* in a REPL, run

.. code-block::

  $ node dist/repl/repl.js [chapter] # default: 1

or alternatively, install js-slang and run

.. code-block::

  $ npm -g install js-slang   # Install js-slang
  $ js-slang [chapter] # default: 1
