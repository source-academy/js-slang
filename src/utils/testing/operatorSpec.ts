/**
 * Operator typing tables for Source, transcribed from the language specifications.
 *
 * The specs are the human source of truth:
 *
 *   docs/specs/source_typing.tex    - `\input` by source_1.tex, source_2.tex (and source_0,
 *                                     source_0_subst, and the typed/wasm variants)
 *   docs/specs/source_typing_3.tex  - `\input` by source_3.tex, source_4.tex (and
 *                                     source_3_typed, source_4_explicitcontrol)
 *
 * When a `.tex` table changes, update the transcription here in the same PR.
 * Deliberately do NOT parse the `.tex` at test time: a LaTeX parser in the test harness buys a
 * guarantee that only looks stronger than a reviewed transcription, and costs a fragile parser.
 * (This mirrors py-slang's `src/tests/operator-spec.ts`, which learned the same lesson.)
 *
 * The one thing the tables do not state directly is which types exist at all. The prose above
 * each table does: source_typing.tex opens "Expressions evaluate to numbers, boolean values,
 * strings or function values", and source_typing_3.tex adds arrays. That sentence is the
 * per-chapter type universe encoded in {@link universeForChapter}.
 */

import { Chapter } from '../../langs';

/** The value types Source expressions can produce, as the specs name them. */
export type SourceType = 'number' | 'string' | 'bool' | 'function' | 'array';

/** A result type a spec row can prescribe. `any` is the spec's own wording for `&&`/`||`. */
export type ResultType = SourceType | 'any';

/**
 * A representative literal for each type. Parenthesised so it can be dropped into either operand
 * position of any operator without precedence surprises (`(x => x) + (1)`, not `x => x + 1`).
 */
const LITERAL: Record<SourceType, string> = {
  number: '(1)',
  string: '("a")',
  bool: '(true)',
  function: '(x => x)',
  array: '([1])',
};

export function literalFor(type: SourceType): string {
  return LITERAL[type];
}

/** Per source_typing.tex's opening sentence: no arrays before §3. */
const UNIVERSE_12: SourceType[] = ['number', 'string', 'bool', 'function'];
/** Per source_typing_3.tex's opening sentence: arrays join the universe at §3. */
const UNIVERSE_34: SourceType[] = [...UNIVERSE_12, 'array'];

export function universeForChapter(chapter: Chapter): SourceType[] {
  return chapter >= Chapter.SOURCE_3 ? UNIVERSE_34 : UNIVERSE_12;
}

interface Row {
  ops: string[];
  left: SourceType[];
  right: SourceType[];
  result: ResultType;
}

// Rows common to both tables.
const ARITHMETIC: Row[] = [
  { ops: ['+', '-', '*', '/', '%'], left: ['number'], right: ['number'], result: 'number' },
  { ops: ['+'], left: ['string'], right: ['string'], result: 'string' },
];

const ORDERING: Row[] = [
  { ops: ['>', '<', '>=', '<='], left: ['number'], right: ['number'], result: 'bool' },
  { ops: ['>', '<', '>=', '<='], left: ['string'], right: ['string'], result: 'bool' },
];

// docs/specs/source_typing.tex - §1/§2 restrict ===/!== to number x number and string x string.
// Note the consequence, which surprises people: `true === true` is an error in Source §1.
const EQUALITY_12: Row[] = [
  { ops: ['===', '!=='], left: ['number'], right: ['number'], result: 'bool' },
  { ops: ['===', '!=='], left: ['string'], right: ['string'], result: 'bool' },
];

// docs/specs/source_typing_3.tex - §3/§4 widen ===/!== to any x any.
const EQUALITY_34: Row[] = [
  { ops: ['===', '!=='], left: UNIVERSE_34, right: UNIVERSE_34, result: 'bool' },
];

const TABLE_12: Row[] = [...ARITHMETIC, ...EQUALITY_12, ...ORDERING];
const TABLE_34: Row[] = [...ARITHMETIC, ...EQUALITY_34, ...ORDERING];

function tableForChapter(chapter: Chapter): Row[] {
  return chapter >= Chapter.SOURCE_3 ? TABLE_34 : TABLE_12;
}

/**
 * The binary operators both tables cover, excluding `&&`/`||`. Those two take `bool x any -> any`,
 * so their result type depends on the operands rather than being fixed by the table, and they
 * short-circuit; {@link LOGICAL_OPS} and the conformance suite handle them separately.
 */
export const BINARY_OPS = ['+', '-', '*', '/', '%', '===', '!==', '>', '<', '>=', '<='];

/** `&&` and `||`: `bool x any -> any` in both tables. */
export const LOGICAL_OPS = ['&&', '||'];

/** The unary rows of both tables: `!` takes bool -> bool, prefix `-` takes number -> number. */
export const UNARY_OPS: { op: string; operand: SourceType; result: ResultType }[] = [
  { op: '!', operand: 'bool', result: 'bool' },
  { op: '-', operand: 'number', result: 'number' },
];

/**
 * The spec result type for `left op right` at `chapter`, or `null` when no row admits it — which
 * the specs describe as the case implementations must "generate an error message" for.
 */
export function specResult(
  op: string,
  left: SourceType,
  right: SourceType,
  chapter: Chapter,
): ResultType | null {
  for (const row of tableForChapter(chapter)) {
    if (row.ops.includes(op) && row.left.includes(left) && row.right.includes(right)) {
      return row.result;
    }
  }
  return null;
}
