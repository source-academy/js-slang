/**
 * Conformance sweep: does the engine actually implement the operator typing tables in
 * `docs/specs/source_typing.tex` (§1/§2) and `docs/specs/source_typing_3.tex` (§3/§4)?
 *
 * For every operator x left-type x right-type combination in each chapter's type universe, the
 * spec either prescribes a result type or admits no row at all; the latter the specs describe as
 * the case where implementations must "generate an error message". This suite asserts exactly
 * that, so no combination can silently fall between the two.
 *
 * Why this is not already covered by `src/utils/__tests__/rttc.test.ts`: that suite unit-tests
 * `checkBinaryExpression` in isolation. Whether the engine *calls* it — for every operator, on
 * both operands, at the right chapter — is a different claim, and it is the one that breaks.
 * `transpileToFullJS` (Chapter.FULL_JS, Variant.NATIVE) skips
 * `transformUnaryAndBinaryOperationsToFunctionCalls` altogether, so an engine can pass every rttc
 * unit test while enforcing none of this table.
 *
 * Runs against the transpiler (`executionMethod: 'native'`), the engine the Conductor evaluators
 * use. As further engines arrive under Conductor (the CSE machine first), each should get its own
 * sweep that takes its expected value by running this engine fresh, rather than reading the table
 * a second time — pinning it to the reference implementation instead of to a second transcription
 * that could drift. That is how py-slang keeps six engines in agreement.
 */

import { describe, expect, test } from 'vitest';

import { runInContext } from '..';
import { Chapter } from '../langs';
import { typeOf } from '../utils/rttc';
import { mockContext } from '../utils/testing/mocks';
import {
  BINARY_OPS,
  literalFor,
  LOGICAL_OPS,
  type ResultType,
  type SourceType,
  specResult,
  UNARY_OPS,
  universeForChapter,
} from '../utils/testing/operatorSpec';

const CHAPTERS = [Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4];

/** What an evaluation produced, in the specs' own vocabulary: a type name, or `'error'`. */
type Observed = ResultType | 'error' | string;

/**
 * Evaluates `code` and reduces the outcome to a single comparable token. Collapsing to one string
 * (rather than asserting on a structured result) keeps every assertion below a plain equality, so
 * a failure diff reads `expected 'error', got 'number'` — which is exactly the spec-level claim.
 */
async function observe(code: string, chapter: Chapter): Promise<Observed> {
  const context = mockContext(chapter);
  const result = await runInContext(code, context, { executionMethod: 'native' });
  if (result.status !== 'finished') return 'error';
  const type = typeOf(result.value);
  // rttc spells booleans "boolean"; the spec tables spell them "bool".
  return type === 'boolean' ? 'bool' : type;
}

describe.each(CHAPTERS)('Source chapter %i operator conformance', chapter => {
  const universe = universeForChapter(chapter);

  describe('binary operators', () => {
    const cases = BINARY_OPS.flatMap(op =>
      universe.flatMap(left =>
        universe.map(right => [op, left, right] as [string, SourceType, SourceType]),
      ),
    );

    test.each(cases)('%s applied to %s and %s', async (op, left, right) => {
      const code = `${literalFor(left)} ${op} ${literalFor(right)};`;
      const expected = specResult(op, left, right, chapter) ?? 'error';
      await expect(observe(code, chapter)).resolves.toBe(expected);
    });
  });

  // Spec row: `bool x any -> any`. The result type is not fixed by the table, so these assert only
  // that the combination is admitted (or rejected), never a particular type.
  describe('logical operators', () => {
    const rightCases = LOGICAL_OPS.flatMap(op =>
      universe.map(right => [op, right] as [string, SourceType]),
    );

    test.each(rightCases)('%s admits a %s on the right', async (op, right) => {
      // Force the right operand to actually be evaluated: `false && x` and `true || x`
      // short-circuit, which would leave the "any" column untested.
      const left = op === '&&' ? 'true' : 'false';
      const observed = await observe(`${left} ${op} ${literalFor(right)};`, chapter);
      expect(observed).not.toBe('error');
    });

    const leftCases = LOGICAL_OPS.flatMap(op =>
      universe.filter(t => t !== 'bool').map(left => [op, left] as [string, SourceType]),
    );

    test.each(leftCases)('%s rejects a %s on the left', async (op, left) => {
      await expect(observe(`${literalFor(left)} ${op} true;`, chapter)).resolves.toBe('error');
    });
  });

  describe('unary operators', () => {
    const cases = UNARY_OPS.flatMap(({ op, operand, result }) =>
      universe.map(
        t => [op, t, t === operand ? result : 'error'] as [string, SourceType, Observed],
      ),
    );

    test.each(cases)('%s applied to %s', async (op, operand, expected) => {
      await expect(observe(`${op}${literalFor(operand)};`, chapter)).resolves.toBe(expected);
    });
  });
});
