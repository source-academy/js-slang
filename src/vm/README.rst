VM
===

Execute Rules
---

Notes
^^^
- for simplicity, heap is not represented in the rules
- `v1` and `v2` are function values, hereafter known as (concurrent) threads, and may be represented as `(<>, pc1, e1)` and `(<>, pc2, e2)` respectively
- `execute(...)` cannot appear in either of `v1` or `v2`

Compiling
^^^

.. code-block::
   E1 -> s1 /\ E2 -> s2
   ---------
   execute(E1,E2) -> s1.s2.CALL 2

Running
^^^

There are additional structures in our VM:
- `p`, a register which is a list of thread suspensions
- `n`, a register initialized with `0`, that indicates how many instructions are left for a thread to run

The tuple representing our VM will have two more corresponding structures:
.. code-block::
   (os, pc, e, rs, p, n)

Starting `EXECUTE`, loading thread frames into register `p`:
.. code-block::
   s(pc) = EXECUTE
   ---------
   ((<>, pc1, e1).(<>, pc2, e2).os, pc, e, rs, p, 0) -> (<>, <>, <>, (os, pc, e).rs, (<>, pc1, e1).(<>, pc2, e2).p, 0)

Beginning thread execution:
.. code-block::
   pc = <>
   ---------
   (<>, <>, <>, rs, (os, pc, e).p, 0) -> (os, pc, e, rs, p, c)
where `c` is a constant timeout value.

Running thread:
.. code-block::
   s(pc) /= RET /\ n > 0
   ---------
   (os, pc, e, rs, p, n) -> (os', pc', e', rs, p, n-1)
where the primed values are just like normal VM code execution.

Thread timeout:
.. code-block::
   ---------
   (os, pc, e, rs, p, 0) -> (<>, <>, <>, rs, p.(os, pc, e), 0)

Returning from thread:
.. code-block::
   s(pc) = RET /\ n > 0
   ---------
   (os, pc, e, rs, p, n) -> (<>, <>, <>, rs, p, 0)

Ending `EXECUTE`:
.. code-block::
   ---------
   (<>, <>, <>, (os, pc, e).rs, <>, 0) -> (os, pc, e, rs, p, 0)

Mutex Semantic Domain
---
To prevent mutexes from being mutated outside of the current scope, we need to do something like
.. code-block::
   const x = mutex();
To do this, we need to define a new semantic domain. Let us call this domain **Mut**, with definition **Bool**.

Semantic Function
^^^

Where `m` is a value in domain **Mut**,

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
---

Notes
^^^
- for simplicity, `p` and `n` registers are not represented in the rules
- `Id` is the name of a variable

Compiling
^^^

.. code-block::
   ---------
   mutex() -> (MUTEX.RTN).CALL 0
where (MUTEX.RTN) is the instructions of the mutex allocation function.

.. code-block::
   ---------
   wait(Id) -> LGCS Id.(WAIT.RTN).CALL 0
where (WAIT.RTN) is the instructions of the wait function.

.. code-block::
   ---------
   signal(Id) -> LGCS Id.(SIGNAL.RTN).CALL 0
where (SIGNAL.RTN) is the instructions of the signal function.

Running
^^^

.. code-block::
   s(pc) = MUTEX
   ---------
   (os, pc, e, rs, h) -> (m.os, pc, e, rs, h')
where
`h' = update(m, v, 1, h'')`,
`(m, h'') = newnode(h)`

.. code-block::
   s(pc) = WAIT /\ deref(Id, v, h) = 1
   ---------
   (m.os, pc, e, rs, h) -> (os, pc+1, e, rs, h')
where
`h' = update(m, v, 0, h)`

.. code-block::
   s(pc) = WAIT /\ deref(Id, v, h) = 0
   ---------
   (m.os, pc, e, rs, h) -> (m.os, pc, e, rs, h')
where
`h' = update(m, v, 0, h)`

.. code-block::
   s(pc) = SIGNAL
   ---------
   (m.os, pc, e, rs, h) -> (os, pc, e, rs, h')
where
`h' = update(m, v, 1, h)`
