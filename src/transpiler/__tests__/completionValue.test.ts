import { generate } from 'astring';
import { describe, expect, test } from 'vitest';

import { Chapter } from '../../langs';
import { parse } from '../../parser/parser';
import { identifier, program } from '../../utils/ast/astCreator';
import { mockContext } from '../../utils/testing/mocks';
import { transformStatementsToTrackCompletionValue } from '../transpiler';

/**
 * `transformStatementsToTrackCompletionValue` hand-reproduces what `eval()`'s own completion-value
 * tracking does for free — the sync transpiler's whole mechanism for reporting "the value of the
 * program" (see that function's own doc comment). This file checks it against the real thing:
 * parse `code` as Source, run the transform, generate JS from the result, execute
 * `let __result__; <generated>; __result__` and compare that to `eval(code)` directly — for the same
 * `code`, on the same construct, both should agree, the transform having reproduced spec completion
 * semantics by hand rather than approximated it.
 */
function expectMatchesEval(code: string, chapter: Chapter = Chapter.SOURCE_4) {
  const context = mockContext(chapter);
  const parsed = parse(code, context)!;
  expect(parsed, `failed to parse: ${code}`).not.toBeNull();

  const resultId = identifier('__result__');
  const transformed = transformStatementsToTrackCompletionValue(parsed.body as any, resultId);
  const generated = generate(program(transformed));

  const expected = eval(code);
  const actual = eval(`(() => { let __result__; ${generated} return __result__; })()`);

  expect(actual).toEqual(expected);
}

describe('transformStatementsToTrackCompletionValue', () => {
  test('a single expression statement', () => {
    expectMatchesEval('42;');
  });

  test('the last of several expression statements', () => {
    expectMatchesEval('1; 2; 3;');
  });

  test('an if/else with an empty else branch', () => {
    expectMatchesEval('if (true) { 1; } else { }');
  });

  test('an if/else with an empty then branch (else taken)', () => {
    expectMatchesEval('if (false) { } else { 2; }');
  });

  test('nested if/else, propagating through the taken branch', () => {
    expectMatchesEval('if (true) { if (false) { 1; } else { 2; } } else { 3; }');
  });

  // A declaration's own completion is empty — it does not touch the running value, so the
  // PREVIOUS statement's value is what's reported. This is the case naive "reset to undefined on
  // anything I don't recognize" reasoning gets wrong.
  test('a variable declaration as the last statement carries over the previous value', () => {
    expectMatchesEval('1; let x = 2;');
  });

  test('a function declaration as the last statement carries over the previous value', () => {
    expectMatchesEval('1; function f() { return 1; }');
  });

  // Zero iterations: the loop's own completion is `undefined`, NOT "carry over the previous
  // statement" — a genuinely different empty-completion rule than a declaration's, and the one
  // case this transform cannot get right by simply leaving the statement untouched.
  test('a while loop that never executes resets the value to undefined', () => {
    expectMatchesEval('1; while (false) { 2; }');
  });

  test("a for loop reports its last iteration's last value", () => {
    expectMatchesEval('1; for (let i = 0; i < 3; i = i + 1) { i; }');
  });

  test('a for loop with zero iterations resets the value to undefined', () => {
    expectMatchesEval('1; for (let i = 0; i < 0; i = i + 1) { i; }');
  });

  // Two statements needing tracked completion propagation, immediately after each other.
  test('a while loop followed by an if', () => {
    expectMatchesEval('for (let i = 0; i < 3; i = i + 1) { i; } if (true) { 99; } else { }');
  });

  // Per spec, an `IfStatement` whose taken branch's own completion is empty resolves to
  // `undefined` itself — it does NOT carry forward whatever ran before the `if`, even though a
  // bare declaration in a plain (non-`if`) statement list does. Easy to get backwards, since both
  // "a bare declaration" and "an if-branch ending in one" sound like the same empty-completion
  // case; they are not.
  test('an if branch ending in a declaration resets to undefined, not the value before the if', () => {
    expectMatchesEval('5; if (true) { let y = 10; } else { 6; }');
  });

  // The loop analogue of the same rule: a loop body whose last statement is a bare declaration
  // resets the loop's own value to undefined, on every iteration, same as the branch case above.
  test('a for loop whose body ends in a declaration resets to undefined', () => {
    expectMatchesEval('5; for (let i = 0; i < 3; i = i + 1) { let z = i; }');
  });

  // Composition: an if nested inside another if, where the innermost taken branch ends in a
  // declaration, must still reset all the way out to undefined — not stop resetting partway
  // through the nesting.
  test('a declaration-ending if nested inside another if resets to undefined', () => {
    expectMatchesEval('7; if (true) { if (true) { let a = 1; } else { 2; } } else { 3; }');
  });

  // And the same composition the other way: an if inside a loop body, taking the empty-else
  // branch, resets the loop's (and so the program's) value to undefined.
  test('an if with an empty branch inside a loop body resets to undefined', () => {
    expectMatchesEval('for (let i = 0; i < 3; i = i + 1) { if (i === 1) { 99; } else { } }');
  });
});
