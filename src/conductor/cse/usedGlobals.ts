/**
 * Works out which global names a program actually touches, so the CSE machine's global frame can
 * show those instead of the whole standard library.
 *
 * js-slang binds every builtin into the *global environment's own head*, so that frame arrives
 * with ~40 entries, each rendered with its full source text. The host used to prune it
 * (`CseMachineLayout.removeUnreferencedGlobalFns`), but that step bails out on the Conductor path
 * — it was written for py-slang, whose global frame is empty because its builtins live elsewhere.
 * See source-academy/frontend#4401.
 *
 * Pruning here rather than in the host is the better fit: the evaluator has the program's AST, no
 * protocol change is needed, and it keeps ~40 full function bodies out of *every* snapshot rather
 * than filtering them after they have already crossed the channel.
 *
 * **Deliberately over-approximate.** Scopes are not tracked, so a local named `display` keeps the
 * builtin `display` on screen. Showing one binding too many is a cosmetic cost; hiding one the
 * student is actually using would be a wrong picture, and this is a visualisation. The host's
 * version did track scopes — this trades that precision for a failure mode that is safe.
 */

import type es from 'estree';

import Closure from '../../cse-machine/closure';
import type { Frame } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

/** Every identifier name appearing anywhere in an AST, including nested function bodies. */
function identifiersIn(root: AnyNode, out: Set<string> = new Set()): Set<string> {
  const seen = new Set<unknown>();
  const walk = (node: AnyNode): void => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node.type === 'string' && typeof node.name === 'string') {
      out.add(node.name);
    }
    for (const key of Object.keys(node)) {
      // `loc`/`range` carry no identifiers and dominate the walk on a large program.
      if (key === 'loc' || key === 'range') continue;
      walk(node[key]);
    }
  };
  walk(root);
  return out;
}

/**
 * The global/prelude names `program` needs, closed over the prelude's own use of them.
 *
 * A program calling `map` never mentions `is_null`, but `map`'s body does — so the frame would be
 * missing a name the student can see being applied. Prelude functions are `Closure`s with real
 * ASTs here, so their bodies are walked directly rather than regexed out of `toString()` as the
 * host had to do.
 */
export function collectUsedGlobalNames(
  program: es.Program,
  globalHead: Frame,
  preludeHead: Frame = {},
): Set<string> {
  const available = new Set([...Object.keys(globalHead), ...Object.keys(preludeHead)]);
  const used = new Set<string>();
  const worklist: string[] = [];

  for (const name of identifiersIn(program)) {
    if (available.has(name) && !used.has(name)) {
      used.add(name);
      worklist.push(name);
    }
  }

  while (worklist.length > 0) {
    const name = worklist.pop()!;
    const value = (preludeHead[name] ?? globalHead[name]) as unknown;
    // Only a Closure has a body to inspect; a builtin is a native function, so its dependencies
    // are not discoverable from here — the same limit the host's version had.
    if (!(value instanceof Closure)) continue;
    for (const dependency of identifiersIn(value.node)) {
      if (available.has(dependency) && !used.has(dependency)) {
        used.add(dependency);
        worklist.push(dependency);
      }
    }
  }

  return used;
}
