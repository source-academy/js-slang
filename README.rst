slang
=====
An open-source interpreter for *The Source*.

Usage
-----
The REPL is still under development.

To install,

.. code-block::

  $ git clone https://github.com/ningyuansg/slang.git
  $ cd slang
  $ npm install
  $ npm run build

To evaluate a source program, we access the `runInContext` function,

.. code-block::

  $ node  # or nodejs if debian or similar 
  > const source = require('./lib/index.js');
  > const ctxt = source.createContext();
  > const promise = source.runInContext('2 + 2 - 1;', ctxt);
  > promise.then((result) => { 
      console.log(result);
    });
