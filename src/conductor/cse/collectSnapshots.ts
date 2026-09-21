/**
 * Drives js-slang's CSE machine one step at a time and captures a `CseSnapshot` per step.
 *
 * The machine stays **synchronous**. In js-slang the CSE machine exists for visualisation — the
 * transpiler is the workhorse — so unlike py-slang, whose CSE machine is its primary engine and
 * is async throughout, there is nothing here that needs to await the host.
 * `generateCSEMachineStateStream` is a plain `function*` and is used as one.
 */

import type { CseSnapshot } from '@sourceacademy/common-cse-machine';

import {
  type Control,
  generateCSEMachineStateStream,
  type Stash,
} from '../../cse-machine/interpreter';
import type { Context } from '../../types';
import { serializeControlItem, serializeEnvironments, serializeValue } from './serialize';

export interface CollectedSnapshots {
  snapshots: CseSnapshot[];
  /** 0-based step indices at which a `debugger;` sits on top of the control, for the host's
   * breakpoint navigation. */
  breakpointSteps: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

/**
 * True when the item about to be evaluated should stop the user's breakpoint navigation: either a
 * literal `debugger;`, or any node starting on a line carrying an editor gutter breakpoint.
 */
function isBreakpointItem(item: AnyItem, breakpointLines: ReadonlySet<number>): boolean {
  if (item?.type === 'DebuggerStatement') return true;
  const line = item?.loc?.start?.line as number | undefined;
  return line !== undefined && breakpointLines.has(line);
}

function snapshotOf(
  stepIndex: number,
  context: Context,
  rawControl: AnyItem[],
  rawStash: unknown[],
  source: string,
  currentLine: number | undefined,
): CseSnapshot {
  return {
    stepIndex,
    // Both are serialised top-first; the host's adapter reverses them back. Getting this
    // backwards renders the control upside down and makes the animation system pick the wrong
    // stash item as the closure being applied.
    control: rawControl
      .slice()
      .reverse()
      .map(item => serializeControlItem(item, source)),
    stash: rawStash
      .slice()
      .reverse()
      .map(value => serializeValue(value)),
    environments: serializeEnvironments(context.runtime.environments, rawStash, rawControl),
    currentLine,
  };
}

/**
 * Runs the machine to completion or to `maxSnapshots`, whichever comes first.
 *
 * Deliberately **not** deduplicated. #2004 collapsed consecutive steps whose rendered text
 * matched, which loses genuine steps — two steps can look identical in the control and stash
 * while differing in the environments, and the step counter the user scrubs through then no
 * longer matches the machine's own step numbering.
 */
export function collectSnapshots(
  context: Context,
  control: Control,
  stash: Stash,
  source: string,
  maxSnapshots: number,
  breakpointLines: readonly number[] = [],
): CollectedSnapshots {
  const breakpoints = new Set(breakpointLines);
  const snapshots: CseSnapshot[] = [];
  const breakpointSteps: number[] = [];

  // The same node can sit on top of the control across consecutive steps; without this the
  // navigation controls would stop repeatedly on what the user sees as one breakpoint.
  let lastBreakpointNode: unknown;
  const recordIfBreakpoint = (rawControl: AnyItem[], stepIndex: number) => {
    const top = rawControl[rawControl.length - 1];
    if (!isBreakpointItem(top, breakpoints)) {
      lastBreakpointNode = undefined;
      return;
    }
    if (top === lastBreakpointNode) return;
    lastBreakpointNode = top;
    breakpointSteps.push(stepIndex);
  };

  // Step 0, before the generator runs: the Program node is still on the control, so the user's
  // first step shows the whole program rather than the already-opened block the generator's
  // first yield would give.
  const initialControl = control.getStack();
  const initialStash = stash.getStack();
  const initialTop = initialControl[initialControl.length - 1] as AnyItem;
  snapshots.push(
    snapshotOf(0, context, initialControl, initialStash, source, initialTop?.loc?.start?.line),
  );
  recordIfBreakpoint(initialControl, 0);

  // envSteps/stepLimit of -1 mean "no limit" to the machine itself; the cap below is ours, so
  // that the limit counts *snapshots the user can scrub through* rather than internal steps.
  const stream = generateCSEMachineStateStream(context, control, stash, -1, -1);

  for (const { stash: s, control: c, steps } of stream) {
    if (snapshots.length >= maxSnapshots) break;

    const rawControl = c.getStack();
    const rawStash = s.getStack();
    // Mirrors the non-conductor CSE machine's own `updateInspector`, which reads
    // `context.runtime.nodes[0]` to drive the editor's current-line highlight.
    const currentNode = context.runtime.nodes[0] as AnyItem;
    // `steps` is incremented *before* each yield, so the first yield reports 1 — which is exactly
    // the index after the step-0 snapshot pushed above. Subtracting one would collide with it,
    // giving every run two snapshots numbered 0 and leaving every recorded breakpoint step
    // pointing one position behind the state it describes.
    const stepIndex = steps;
    snapshots.push(
      snapshotOf(stepIndex, context, rawControl, rawStash, source, currentNode?.loc?.start?.line),
    );
    recordIfBreakpoint(rawControl, stepIndex);
  }

  return { snapshots, breakpointSteps };
}

/** Exported for the conformance tests: the final value left on the stash, if any. */
export function finalStashValue(stash: Stash): unknown {
  const items = stash.getStack();
  return items[items.length - 1];
}
