/**
 * Serialises js-slang's CSE machine state into the language-agnostic `CseSnapshot` protocol.
 *
 * For Source this is a round trip rather than a translation: the host's
 * `CseSnapshotAdapter` (frontend, `src/features/cseMachine/CseSnapshotAdapter.ts`) rebuilds
 * *js-slang-shaped* objects from what is sent here, and hands them to the same renderer the
 * non-conductor CSE tab uses. So the adapter — not the protocol's type definitions — is the real
 * contract, and anything dropped here is a visible regression against the tab this replaces.
 *
 * Three ordering/shape conventions the adapter depends on, all easy to get silently wrong:
 *  - `control` and `stash` are serialised **top-first**; the adapter reverses both back.
 *  - `InstrType` is a *string* enum in js-slang (`'Application'`, `'Environment'`, ...) and the
 *    frontend imports that same enum, so the raw value is passed through untouched.
 *  - an `ENVIRONMENT` instruction is matched by the adapter on `displayText === 'ENVIRONMENT'`
 *    (case-insensitively) together with `metadata.envId` — not on its `instrType`.
 */

import type { Identifier, RestElement } from 'estree';

import Closure from '../../cse-machine/closure';
import { InstrType } from '../../cse-machine/types';
import type { Environment, Node, Value } from '../../types';
import { stringify } from '../../utils/stringify';
import type {
  CseSerializedBinding,
  CseSerializedEnvFrame,
  CseSerializedInstruction,
  CseSerializedValue,
} from '@sourceacademy/common-cse-machine';

/** Arrays nest arbitrarily; cap the walk so a cyclic structure cannot hang the worker.
 * Chosen deliberately high: the adapter renders whatever depth it receives, and truncating
 * shallowly (as #2004 did, at 2) silently flattens ordinary Source list programs. */
const MAX_ARRAY_DEPTH = 100;

function closureParamNames(closure: Closure): string[] {
  return closure.node.params.map((p: Identifier | RestElement) =>
    p.type === 'RestElement' ? '...' + (p.argument as Identifier).name : p.name,
  );
}

/**
 * One runtime value.
 *
 * The `label` is what the adapter dispatches on, so the vocabulary here is fixed by that file
 * rather than by taste: `number`, `string`, `boolean`, `undefined`, `unassigned`, `array`,
 * `closure`, `builtin`.
 */
export function serializeValue(
  value: Value,
  depth = 0,
  seen = new Set<unknown>(),
): CseSerializedValue {
  if (value instanceof Closure) {
    const params = closureParamNames(value);
    const funcName = value.declaredName ?? value.functionName;
    return {
      // The machine's own rendering of the closure (its source text), so the stash reads
      // identically to the non-conductor tab. `funcName`/`params` travel in metadata, which is
      // what the host adapter actually rebuilds the closure from.
      displayValue: stringify(value),
      label: 'closure',
      metadata: { closureFrameId: value.environment.id, params, funcName },
    };
  }

  if (Array.isArray(value)) {
    const arr = value as Value[] & { id?: string; environment?: Environment };
    // A cycle (`const xs = list(1); set_tail(xs, xs);`) or a pathological nesting depth must not
    // take the worker down; the adapter renders the elements it is given and stops there.
    if (depth > MAX_ARRAY_DEPTH || seen.has(arr)) {
      return { displayValue: '...', label: 'array', metadata: { id: arr.id, elements: [] } };
    }
    seen.add(arr);
    const elements = arr.map(el => serializeValue(el, depth + 1, seen));
    seen.delete(arr);
    return {
      displayValue: stringify(value),
      label: 'array',
      metadata: {
        elements,
        id: arr.id,
        envId: arr.environment?.id ?? null,
      },
    };
  }

  if (value === null) {
    // Source's empty list. Deliberately *not* labelled 'null': the adapter maps that label to a
    // Python `None` stand-in (`toReplString: () => 'None'`), which is wrong here and also
    // suppresses the empty-list visual Source expects. See the note in SourceCseEvaluator.ts.
    return { displayValue: 'null', label: 'empty_list' };
  }
  if (value === undefined) return { displayValue: 'undefined', label: 'undefined' };

  switch (typeof value) {
    case 'number':
      return { displayValue: String(value), label: 'number' };
    case 'string':
      return { displayValue: stringify(value), label: 'string' };
    case 'boolean':
      return { displayValue: String(value), label: 'boolean' };
    case 'symbol':
      // js-slang's uninitialised-const sentinel. The adapter turns this label back into a
      // Symbol so the renderer shows the binding as declared-but-empty.
      return { displayValue: '', label: 'unassigned' };
    case 'function':
      // A builtin: a plain function rather than a Closure. Labelled so the adapter does not try
      // to rebuild it as a closure, which would give it a null defining environment.
      return { displayValue: stringify(value), label: 'builtin' };
    default:
      return { displayValue: stringify(value), label: typeof value };
  }
}

/** Human-readable text for instructions the control shows without further detail. */
const INSTR_DISPLAY: Partial<Record<InstrType, string>> = {
  [InstrType.RESET]: 'return',
  [InstrType.POP]: 'pop',
  [InstrType.ASSIGNMENT]: 'assign',
  [InstrType.UNARY_OP]: 'unary op',
  [InstrType.BINARY_OP]: 'binary op',
  [InstrType.APPLICATION]: 'call',
  [InstrType.BRANCH]: 'branch',
  [InstrType.WHILE]: 'while',
  [InstrType.FOR]: 'for',
  [InstrType.CONTINUE]: 'continue',
  [InstrType.CONTINUE_MARKER]: 'mark',
  [InstrType.BREAK]: 'break',
  [InstrType.BREAK_MARKER]: 'mark',
  [InstrType.ARRAY_LITERAL]: 'arr lit',
  [InstrType.ARRAY_ACCESS]: 'arr acc',
  [InstrType.ARRAY_ASSIGNMENT]: 'arr asgn',
  [InstrType.ARRAY_LENGTH]: 'arr len',
  [InstrType.MARKER]: 'marker',
  [InstrType.SPREAD]: 'spread',
};

/** The source text a node occupies, for control items that display their own code. */
function extractSourceRange(source: string, loc: Node['loc']): string | null {
  if (!loc?.start || !source) return null;
  const lines = source.split('\n');
  const startLine = loc.start.line - 1;
  const endLine = (loc.end?.line ?? loc.start.line) - 1;
  const startCol = loc.start.column ?? 0;
  if (startLine < 0 || startLine >= lines.length) return null;
  if (startLine === endLine) {
    const endCol = loc.end?.column ?? lines[startLine].length;
    return lines[startLine].slice(startCol, endCol).trim() || null;
  }
  const chunks = [lines[startLine].slice(startCol)];
  for (let i = startLine + 1; i < endLine && i < lines.length; i++) chunks.push(lines[i]);
  if (endLine < lines.length) {
    chunks.push(lines[endLine].slice(0, loc.end?.column ?? lines[endLine].length));
  }
  return chunks.join('\n').trim() || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

/** One control item: either a CSE instruction or an AST node awaiting evaluation. */
export function serializeControlItem(item: AnyItem, source: string): CseSerializedInstruction {
  if (item?.instrType !== undefined) {
    const instrType = item.instrType as InstrType;

    // Matched by the adapter on displayText, not instrType — see this file's header.
    if (instrType === InstrType.ENVIRONMENT && item.env?.id) {
      return { displayText: 'ENVIRONMENT', metadata: { envId: item.env.id as string } };
    }
    if (instrType === InstrType.ASSIGNMENT && item.symbol) {
      return {
        displayText: `assign ${item.symbol}`,
        metadata: { instrType, symbol: item.symbol as string },
      };
    }
    if (instrType === InstrType.APPLICATION && item.numOfArgs !== undefined) {
      return {
        displayText: `call ${item.numOfArgs}`,
        metadata: { instrType, numOfArgs: item.numOfArgs as number },
      };
    }
    // ArrLitInstr carries `arity`, not `numOfElements`.
    if (instrType === InstrType.ARRAY_LITERAL && item.arity !== undefined) {
      return {
        displayText: `arr lit ${item.arity}`,
        metadata: { instrType, arity: item.arity as number },
      };
    }
    if ((instrType === InstrType.BINARY_OP || instrType === InstrType.UNARY_OP) && item.symbol) {
      return { displayText: item.symbol as string, metadata: { instrType } };
    }
    return {
      displayText: INSTR_DISPLAY[instrType] ?? String(instrType),
      metadata: { instrType },
    };
  }

  if (item?.type !== undefined) {
    const loc = item.loc as Node['loc'];
    const isBlockLike =
      item.type === 'BlockStatement' ||
      item.type === 'Program' ||
      item.type === 'StatementSequence';

    let displayText: string;
    if (isBlockLike) {
      const body = extractSourceRange(source, loc);
      displayText = body
        ? `{\n${body
            .split('\n')
            .map(l => '  ' + l)
            .join('\n')}\n}`
        : '{ ... }';
    } else {
      displayText = extractSourceRange(source, loc) ?? (item.type as string);
    }

    // The adapter reconstructs a stub node from these so the animation system can dispatch on
    // the real AST type rather than treating every item as a bare Identifier.
    const metadata: Record<string, unknown> = { nodeType: item.type as string };
    if (isBlockLike && Array.isArray(item.body)) {
      metadata.bodyLength = item.body.length;
      metadata.bodyNodeTypes = (item.body as AnyItem[]).map(n => n?.type as string | undefined);
    }
    if (loc?.start && loc?.end) {
      metadata.startLine = loc.start.line;
      metadata.endLine = loc.end.line;
    }
    return { displayText, metadata };
  }

  return { displayText: '<unknown>' };
}

/**
 * Every environment reachable at this step, flattened.
 *
 * Reachability, not just the call stack: a closure captured in a frame keeps that frame alive and
 * the renderer draws it, so the walk follows `tail`, closure environments in each frame's
 * bindings and heap, closures on the stash, and the environments named by `ENVIRONMENT`
 * instructions still on the control.
 */
export function serializeEnvironments(
  callStackEnvs: Environment[],
  stashItems: Value[],
  rawControl: AnyItem[],
  /** Global/prelude names the program actually uses. When given, the global frame is pruned to
   * these — see `usedGlobals.ts` for why that happens here rather than in the host. Omitted, every
   * binding is sent, which is the right default for any caller that has not done the analysis. */
  usedGlobalNames?: ReadonlySet<string>,
): CseSerializedEnvFrame[] {
  const seen = new Set<string>();
  const ordered: Environment[] = [];
  const seenArrays = new Set<unknown>();

  const visit = (env: Environment | null | undefined): void => {
    if (!env || seen.has(env.id)) return;
    seen.add(env.id);
    ordered.push(env);
    visit(env.tail);
    for (const value of Object.values(env.head)) visitValue(value);
    for (const obj of env.heap.getHeap()) visitValue(obj as Value);
  };

  /**
   * Follows a value to the environments it keeps alive.
   *
   * Arrays matter as much as closures here: an array carries the `environment` it was created in,
   * and may hold closures of its own. A function returning an array — `function f() { return
   * [() => 1]; }` — leaves that array on the stash after its frame is popped, and `serializeValue`
   * still emits the frame's id in `envId`/`closureFrameId`. Without following it, the frame is
   * missing from `environments` entirely and the host cannot draw the arrows pointing at it.
   */
  const visitValue = (value: Value): void => {
    if (value instanceof Closure) {
      visit(value.environment);
      return;
    }
    if (Array.isArray(value)) {
      if (seenArrays.has(value)) return;
      seenArrays.add(value);
      visit((value as Value[] & { environment?: Environment }).environment);
      for (const element of value) visitValue(element);
    }
  };

  for (const env of callStackEnvs) visit(env);
  for (const value of stashItems) visitValue(value);
  for (const item of rawControl) {
    if (item?.instrType === InstrType.ENVIRONMENT && item.env) visit(item.env as Environment);
  }

  const callStackIds = new Set(callStackEnvs.map(e => e.id));

  // js-slang's global frame holds every builtin, each rendered with its full source text, so an
  // unpruned frame buries the student's own frame thousands of pixels down the canvas.
  const isGlobal = (env: Environment) => env.name === 'global' && env.tail === null;

  return ordered.map(env => {
    const entries = Object.entries(Object.getOwnPropertyDescriptors(env.head)).filter(
      ([name]) => !(usedGlobalNames && isGlobal(env)) || usedGlobalNames.has(name),
    );
    const bindings: CseSerializedBinding[] = entries.map(([name, descriptor]) => ({
      name,
      value: serializeValue(descriptor.value),
      // `const` is non-writable; the renderer shows `:=` vs `:` off this.
      isConst: descriptor.writable === false,
    }));

    // Closures sitting in a frame's heap without a name of their own — e.g. a function returned
    // before being assigned. The renderer draws these as unbound arrows from the frame.
    const namedValues = new Set(Object.values(env.head));
    const heapObjects = [...env.heap.getHeap()]
      .filter(obj => obj instanceof Closure && !namedValues.has(obj))
      .map(obj => serializeValue(obj as Value));

    return {
      id: env.id,
      name: env.name,
      parentId: env.tail?.id ?? null,
      bindings,
      heapObjects: heapObjects.length > 0 ? heapObjects : undefined,
      isActive: env.id === callStackEnvs[0]?.id,
      isOnCallStack: callStackIds.has(env.id),
    };
  });
}
