import { describe, expect, test } from 'vitest';

import createContext from '../../createContext';
import { Chapter, Variant } from '../../langs';
import { parse } from '../../parser/parser';
import { sandboxedEval } from '../evalContainer';
import { transpile } from '../transpiler';

/**
 * End-to-end proof that async/dual-mode compilation — on its own, with no module involved — is
 * *observationally identical* to the ordinary sync path: same values, same errors, same proper-tail-
 * call behaviour. This is the mechanism `SourceEvaluator` will force on for any chunk that might
 * reach a module binding (source-academy/js-slang#2081); it must not change what a plain, module-free
 * program computes.
 */
function runAsync(code: string, chapter: Chapter = Chapter.SOURCE_4): Promise<unknown> {
  const context = createContext(chapter, Variant.DEFAULT, {}, []);
  const program = parse(code, context)!;
  expect(program, `failed to parse: ${code}`).not.toBeNull();
  const { transpiled } = transpile(program, context, false, false, true);
  // `sandboxedEval` returns whatever eval() produces — a real Promise for an async-mode program,
  // since the transpiled code's own last statement is a call to the async IIFE. No `await` is
  // needed *here*; this function's job is just to hand that Promise back to the caller.
  return sandboxedEval(transpiled, context.nativeStorage);
}

function runSync(code: string, chapter: Chapter = Chapter.SOURCE_4) {
  const context = createContext(chapter, Variant.DEFAULT, {}, []);
  const program = parse(code, context)!;
  const { transpiled } = transpile(program, context, false, false, false);
  return sandboxedEval(transpiled, context.nativeStorage);
}

describe('async-mode transpilation', () => {
  test('the async IIFE actually returns a Promise', async () => {
    const context = createContext(Chapter.SOURCE_4, Variant.DEFAULT, {}, []);
    const program = parse('1 + 1;', context)!;
    const { transpiled } = transpile(program, context, false, false, true);
    const result = sandboxedEval(transpiled, context.nativeStorage);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(2);
  });

  test('a plain arithmetic program computes the same value as sync mode', async () => {
    const code = 'const a = 3; const b = 4; a * a + b * b;';
    await expect(runAsync(code)).resolves.toBe(runSync(code));
  });

  test('closures and higher-order functions work the same as sync mode', async () => {
    const code = stripIndent(`
      function make_adder(x) {
        return y => x + y;
      }
      const add5 = make_adder(5);
      add5(10);
    `);
    await expect(runAsync(code)).resolves.toBe(runSync(code));
  });

  test('the proper-tail-call trampoline still avoids stack overflow', async () => {
    const code = stripIndent(`
      function count_down(n) {
        return n === 0 ? "done" : count_down(n - 1);
      }
      count_down(100000);
    `);
    await expect(runAsync(code)).resolves.toBe('done');
  });

  test('a runtime error reports the same as sync mode', async () => {
    const code = 'head(null);';
    await expect(runAsync(code)).rejects.toThrow();
    expect(() => runSync(code)).toThrow();
  });

  // The construct the completion-value transform exists for: a program's own reported value must
  // match sync mode even when it ends in a construct whose "value" only exists via completion
  // propagation (an if-statement, here), not a plain trailing expression.
  test("a program ending in an if-statement reports the taken branch's value, matching sync mode", async () => {
    const code = 'const x = 10; if (x > 5) { "big"; } else { "small"; }';
    await expect(runAsync(code)).resolves.toBe(runSync(code));
    await expect(runAsync(code)).resolves.toBe('big');
  });

  test('display() output still reaches the host in async mode', async () => {
    const output: string[] = [];
    const context = createContext(Chapter.SOURCE_4, Variant.DEFAULT, {}, [], undefined, {
      rawDisplay: (v: unknown, s: string) => {
        output.push((s === undefined ? '' : s + ' ') + String(v));
        return v;
      },
    });
    const program = parse('display(1 + 1);', context)!;
    const { transpiled } = transpile(program, context, false, false, true);
    await sandboxedEval(transpiled, context.nativeStorage);
    expect(output).toContain('2');
  });
});

function stripIndent(code: string): string {
  return code
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
