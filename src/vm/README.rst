VM
==

Execute Rules
^^^^^^^^^^^^^

Notes
-----

- for simplicity, heap is not represented in the rules
- ``v1`` and ``v2`` are function values, hereafter known as (concurrent) threads, and may be represented as ``(<>, pc1, e1, trs1)`` and ``(<>, pc2, e2, trs2)`` respectively
- ``concurrent_execute(...)`` cannot appear in either of ``v1`` or ``v2``

Compiling
---------

.. code-block::

   E1 -> s1 ... En -> sn
   ---------
   concurrent_execute(E1, ... ,En) -> s1. ... .sn.EXECUTE n

Running
-------

There are additional structures in our VM:
- ``t``, a register which is a list of thread suspensions
- ``n``, a register initialized with ``0``, that indicates how many instructions are left for a thread to run
-  Where ``the registers`` are ``os``, ``pc``, ``e``, and ``rs``, there is the structure ``seq``, a register initialized with ``<>``, that stores the registers when ``EXECUTE`` starts, and from which the registers are restored when ``EXECUTE`` ends. The register ``seq`` is named after the fact that the registers are only used in the sequential context.

The tuple representing our VM will have three more corresponding structures:

.. code-block::

   (os, pc, e, rs, t, n, seq)

Starting ``EXECUTE``, loading thread frames into register ``t``:

.. code-block::

   s(pc) = EXECUTE n
   ---------
   ((<>, pc1, e1). ... .(<>, pcn, en).os, pc, e, rs, <>, 0, <>) -> (<>, <>, <>, <>, (<>, pc1, e1). ... .(<>, pcn, en), 0, (os, pc+1, e).rs)
Threads initially don't have runtime stacks. Note the empty ``os``, ``pc``, ``e``, and ``rs`` registers: this disambiguates concurrent execution rules from sequential execution rules, so that we know we are executing in the concurrent context.

Beginning thread execution:

.. code-block::

   ---------
   (<>, <>, <>, <>, ((os, pc, e).trs).t, 0, seq) -> (os, pc, e, trs, t, c, seq)
where ``c`` is a constant timeout value.

Running thread:

.. code-block::

   s(pc) /= RET /\ n > 0
   ---------
   (os, pc, e, trs, t, n, seq) -> (os', pc', e', trs, t, n-1, seq)
where the primed values are just like normal VM code execution.

Thread timeout:

.. code-block::

   ---------
   (os, pc, e, trs, t, 0, seq) -> (<>, <>, <>, <>, t.((os, pc, e).trs), 0, seq)
When a thread times out and has not finished execution (has not executed the ``RET`` statement), then it is queued on the thread queue.

Returning from thread:

.. code-block::

   s(pc) = RET /\ n > 0
   ---------
   (os, pc, e, trs, t, n, seq) -> (<>, <>, <>, <>, t, 0, seq)
When a thread executes the ``RET`` statement, it is not added back to the thread queue,

Ending ``EXECUTE``:

.. code-block::

   ---------
   (<>, <>, <>, <>, <>, 0, (os, pc, e).rs) -> (os, pc, e, rs, <>, 0, <>)
When the thread queue is empty, we restore normal sequential execution.

Test_and_set Rules
^^^^^^^^^^^

Notes
-----

- for simplicity, ``e``, ``rs``, ``p``, ``n`` and ``seq`` registers, and heap are not represented in the rules
- ``test_and_set`` is an atomic operation

Compiling
---------

.. code-block::

   E -> s
   ---------
   test_and_set(E) -> s.TEST_AND_SET
where E is a list, whose head is a boolean.

.. code-block::

   E -> s
   ---------
   clear(E) -> s.CLEAR
where E is a list, whose head is a boolean.

Running
-------

.. code-block::

   s(pc) = TEST_AND_SET /\ b = true
   ---------
   ([b, ...].os, pc) -> (b.os, pc+1)

.. code-block::

   s(pc) = TEST_AND_SET /\ b = false
   ---------
   ([b, ...].os, pc) -> (true.os, pc+1)

.. code-block::

   s(pc) = CLEAR
   ---------
   ([b, ...].os, pc) -> ([false, ...].os, pc+1)
