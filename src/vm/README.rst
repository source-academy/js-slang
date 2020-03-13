VM
==

Execute Rules
^^^^^^^^^^^^^

Notes
-----

- for simplicity, heap is not represented in the rules
- ``v1`` and ``v2`` are function values, hereafter known as (concurrent) threads, and may be represented as ``(<>, pc1, e1, prs1)`` and ``(<>, pc2, e2, prs2)`` respectively
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
- ``p``, a register which is a list of thread suspensions
- ``n``, a register initialized with ``0``, that indicates how many instructions are left for a thread to run
-  Where ``the registers`` are ``os``, ``pc``, ``e``, and ``rs``, there is the structure ``seq``, a register initialized with ``<>``, that stores the registers when ``EXECUTE`` starts, and from which the registers are restored when ``EXECUTE`` ends. The register ``seq`` is named after the fact that the registers are only used in the sequential context.

The tuple representing our VM will have three more corresponding structures:

.. code-block::

   (os, pc, e, rs, p, n, seq)

Starting ``EXECUTE``, loading thread frames into register ``p``:

.. code-block::

   s(pc) = EXECUTE n
   ---------
   ((<>, pc1, e1).(<>, pc2, e2).os, pc, e, rs, p, 0, <>) -> (<>, <>, <>, <>, ((<>, pc1, e1).prs1).((<>, pc2, e2).prs2).p, 0, (os, pc+1, e).rs)

Beginning thread execution:

.. code-block::

   pc = <>
   ---------
   (<>, <>, <>, <>, ((os, pc, e).prs).p, 0, seq) -> (os, pc, e, prs, p, c, seq)
where ``c`` is a constant timeout value.

Running thread:

.. code-block::

   s(pc) /= RET /\ n > 0
   ---------
   (os, pc, e, prs, p, n, seq) -> (os', pc', e', prs, p, n-1, seq)
where the primed values are just like normal VM code execution.

Thread timeout:

.. code-block::

   ---------
   (os, pc, e, prs, p, 0, seq) -> (<>, <>, <>, <>, p.((os, pc, e).prs), 0, seq)

Returning from thread:

.. code-block::

   s(pc) = RET /\ n > 0
   ---------
   (os, pc, e, prs, p, n, seq) -> (<>, <>, <>, <>, p, 0, seq)

Ending ``EXECUTE``:

.. code-block::

   ---------
   (<>, <>, <>, <>, <>, 0, (os, pc, e).rs) -> (os, pc, e, rs, <>, 0, <>)

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
