VM
==

Execute Rules
^^^^^^^^^^^^^

Notes
-----

- for simplicity, heap is not represented in the rules
- ``g`` represents garbage value: its value is not important to the rule
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
- ``tq``, a register which is a queue of thread suspensions
- ``to``, a register initialized with ``0``, that indicates how many instructions are left for a thread to run
- ``seq``, a register initialized with ``<>``, that represents an empty sequential runtime stack. When entering the concurrent context, ``os``, ``pc``, ``e``, and ``rs`` are copied onto ``seq``, and when exiting the concurrent context, they are popped from ``seq``.

The tuple representing our VM will have three more corresponding structures:

.. code-block::

   (os, pc, e, rs, tq, to, seq)

Starting ``EXECUTE``, loading thread frames into register ``tq``:

.. code-block::

   s(pc) = EXECUTE n
   ---------
   (((<>, pc1, e1).<>). ... .((<>, pcn, en).<>).os, pc, e, rs, <>, 0, <>) -> (g, <>, g, g, ((<>, pc1, e1).<>). ... .((<>, pcn, en).<>), 0, (os, pc+1, e).rs)
Each thread is a four-tuple of ``os``, ``pc``, ``e``, and ``rs``. Initially, threads have empty ``os`` and empty ``rs``. Note the transition from empty ``seq`` to nonempty ``seq``: this disambiguates concurrent execution rules from sequential execution rules, so that we know we are executing in the concurrent context.

Beginning thread execution:

.. code-block::

   ---------
   (g, <>, g, g, ((os, pc, e).trs).tq, 0, seq) -> (os, pc, e, trs, tq, c, seq)
where ``c`` is a constant timeout value. Note: ``pc`` is ``<>`` to disambiguate this rule from the thread timeout rule.

Running thread:

.. code-block::

   s(pc) /= RET /\ to > 0
   ---------
   (os, pc, e, trs, tq, to, seq) -> (os', pc', e', trs', tq, to-1, seq)
where the primed values are just like normal VM code execution.

Running thread, returning from function:

.. code-block::

   s(pc) = RET /\ to > 0 /\ trs /= <>
   ---------
   (os, pc, e, trs, tq, to, seq) -> (os', pc', e', trs', tq, to-1, seq)
where the primed values are just like normal VM code execution. Note: the thread may execute the ``RET`` statement inside a function, and the thread does the normal thing of popping ``trs`` and so on.

Thread timeout:

.. code-block::

   ---------
   (os, pc, e, trs, tq, 0, seq) -> (g, <>, g, g, tq.((os, pc, e).trs), 0, seq)
When a thread times out and has not finished execution (has not executed the ``RET`` statement), then it is queued on the thread queue.

Returning from thread:

.. code-block::

   s(pc) = RET /\ to > 0 /\ trs = <>
   ---------
   (os, pc, e, trs, tq, to, seq) -> (g, <>, g, g, tq, 0, seq)
When a thread executes the ``RET`` statement, and there are no more thread runtime stacks, the thread is not added back to the thread queue,

Ending ``EXECUTE``:

.. code-block::

   ---------
   (g, <>, g, g, <>, 0, (os, pc, e).rs) -> (os, pc, e, rs, <>, 0, <>)
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
where ``E`` is a list, whose head is a boolean.

.. code-block::

   E -> s
   ---------
   clear(E) -> s.CLEAR
where ``E`` is a list, whose head is a boolean.

Running
-------

.. code-block::

   s(pc) = TEST_AND_SET
   ---------
   (p.os, pc) -> (b.os, pc+1)
where ``p`` is the address of a list stored on the heap. The head of this list is initially ``b``, where ``b`` is a boolean. After this rule executes, the head of this list is set to ``true``.

.. code-block::

   s(pc) = CLEAR
   ---------
   (p.os, pc) -> (os, pc+1)
where ``p`` is the address of a list stored on the heap. The head of this list is updated to ``false``.
