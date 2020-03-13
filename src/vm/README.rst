VM
==

General Notes
^^^^^^^^^^^^^

- Since ``CALLP`` is not yet finalized as of this writing, we refer to the primitive function with ``id`` as ``(OP.RTN)``, where ``OP`` is the opcode of the primitive function.

Execute Rules
^^^^^^^^^^^^^

Notes
-----

- for simplicity, heap is not represented in the rules
- ``v1`` and ``v2`` are function values, hereafter known as (concurrent) threads, and may be represented as ``(<>, pc1, e1, prs1)`` and ``(<>, pc2, e2, prs2)`` respectively
- ``execute(...)`` cannot appear in either of ``v1`` or ``v2``

Compiling
---------

.. code-block::

   E1 -> s1 /\ E2 -> s2
   ---------
   execute(E1,E2) -> s1.s2.CALLP (EXECUTE.RTN) 2

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

   s(pc) = EXECUTE
   ---------
   ((<>, pc1, e1).(<>, pc2, e2).os, pc, e, rs, p, 0, <>) -> (<>, <>, <>, <>, ((<>, pc1, e1).prs1).((<>, pc2, e2).prs2).p, 0, (os, pc+2, e).rs)

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

Mutex Semantic Domain
^^^^^^^^^^^^^^^^^^^^^

To prevent mutexes from being mutated outside of the current scope, we need to do something like

.. code-block::

   const x = mutex();
To do this, we need to define a new semantic domain. Let us call this domain **Mut**, with definition **Bool**.

Semantic Function
-----------------

Where ``m`` is a value in domain **Mut**,

.. code-block::

   ---------
   mutex() -> *true*

.. code-block::

   ---------
   wait(m) -> *false*

.. code-block::

   ---------
   signal(m) -> *true*

Mutex Rules
^^^^^^^^^^^

Notes
-----

- for simplicity, ``p``, ``n`` and ``seq`` registers are not represented in the rules
- ``Id`` is the name of a variable

Compiling
---------

.. code-block::

   ---------
   mutex() -> CALLP (MUTEX.RTN) 0
where (MUTEX.RTN) is the instructions of the mutex allocation function.

.. code-block::

   ---------
   wait(Id) -> LGCS Id.CALLP (WAIT.RTN) 1
where (WAIT.RTN) is the instructions of the wait function.

.. code-block::

   ---------
   signal(Id) -> LGCS Id.CALLP (SIGNAL.RTN) 1
where (SIGNAL.RTN) is the instructions of the signal function.

Running
-------

.. code-block::

   s(pc) = MUTEX
   ---------
   (os, pc, e, rs, h) -> (m.os, pc, e, rs, h')
where
``h' = update(m, v, 1, h'')``,
``(m, h'') = newnode(h)``

.. code-block::

   s(pc) = WAIT /\ deref(Id, v, h) = 1
   ---------
   (m.os, pc, e, rs, h) -> (os, pc+1, e, rs, h')
where
``h' = update(m, v, 0, h)``

.. code-block::

   s(pc) = WAIT /\ deref(Id, v, h) = 0
   ---------
   (m.os, pc, e, rs, h) -> (m.os, pc, e, rs, h')
where
``h' = update(m, v, 0, h)``

.. code-block::

   s(pc) = SIGNAL
   ---------
   (m.os, pc, e, rs, h) -> (os, pc, e, rs, h')
where
``h' = update(m, v, 1, h)``
