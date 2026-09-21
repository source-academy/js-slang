/**
 * Cross-engine conformance: does the CSE machine agree with the transpiler on operator typing?
 *
 * The companion suite (`operator-conformance.test.ts`) pins the transpiler against the spec
 * tables in `docs/specs/source_typing{,_3}.tex`. This one deliberately does **not** read those
 * tables again. It takes its expected value by running the *transpiler* fresh on each program and
 * requires the CSE machine to match, so the two engines are pinned to each other rather than to
 * two independent transcriptions that could drift apart while both still looking correct.
 *
 * That is how py-slang keeps six engines in agreement — see its `operator-conformance-py2js`,
 * `-pvml`, `-wasm` and `-pynter` suites, each of which derives its expectations from the CSE
 * machine (its own reference engine) rather than from the spec.
 *
 * Only §3/§4: those are the chapters the CSE evaluator serves, since the frontend gates the CSE
 * tab at `chapter >= Chapter.SOURCE_3`.
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
  type SourceType,
  UNARY_OPS,
  universeForChapter,
} from '../utils/testing/operatorSpec';

const CHAPTERS = [Chapter.SOURCE_3, Chapter.SOURCE_4];

/** Reduces a run to one comparable token: a type name in the specs' vocabulary, or `'error'`. */
async function observe(
  code: string,
  chapter: Chapter,
  executionMethod: 'native' | 'cse-machine',
): Promise<string> {
  const context = mockContext(chapter);
  const result = await runInContext(code, context, { executionMethod });
  if (result.status !== 'finished') return 'error';
  const type = typeOf(result.value);
  return type === 'boolean' ? 'bool' : type;
}

describe.each(CHAPTERS)('Source chapter %i: CSE machine matches the transpiler', chapter => {
  const universe = universeForChapter(chapter);

  const binaryCases = BINARY_OPS.flatMap(op =>
    universe.flatMap(left =>
      universe.map(right => [op, left, right] as [string, SourceType, SourceType]),
    ),
  );

  test.each(binaryCases)('%s applied to %s and %s', async (op, left, right) => {
    const code = `${literalFor(left)} ${op} ${literalFor(right)};`;
    const expected = await observe(code, chapter, 'native');
    await expect(observe(code, chapter, 'cse-machine')).resolves.toBe(expected);
  });

  const logicalCases = LOGICAL_OPS.flatMap(op =>
    universe.flatMap(operand => [
      [op, operand, true] as [string, SourceType, boolean],
      [op, operand, false] as [string, SourceType, boolean],
    ]),
  );

  test.each(logicalCases)('%s with %s (%s side)', async (op, operand, onRight) => {
    const code = onRight
      ? `${op === '&&' ? 'true' : 'false'} ${op} ${literalFor(operand)};`
      : `${literalFor(operand)} ${op} true;`;
    const expected = await observe(code, chapter, 'native');
    await expect(observe(code, chapter, 'cse-machine')).resolves.toBe(expected);
  });

  const unaryCases = UNARY_OPS.flatMap(({ op }) =>
    universe.map(operand => [op, operand] as [string, SourceType]),
  );

  test.each(unaryCases)('%s applied to %s', async (op, operand) => {
    const code = `${op}${literalFor(operand)};`;
    const expected = await observe(code, chapter, 'native');
    await expect(observe(code, chapter, 'cse-machine')).resolves.toBe(expected);
  });
});
