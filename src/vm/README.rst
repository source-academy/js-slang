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
