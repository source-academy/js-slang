import { test } from 'vitest';
import { runInContext } from '../../index';
import { Chapter } from '../../langs';
import { stripIndent } from '../../utils/formatters';
import { assertFinishedResultValue } from '../../utils/testing/misc';
import { mockContext } from '../../utils/testing/mocks';

test('test proper setting of variables in an outer scope', async () => {
  const context = mockContext(Chapter.SOURCE_3);
  await runInContext(
    stripIndent`
    let a = 'old';
    function f() {
      return a;
    }
  `,
    context,
  );
  const result = await runInContext('a = "new"; f();', context);
  assertFinishedResultValue(result, 'new');
});

test('using internal names still work', async () => {
  const context = mockContext(Chapter.SOURCE_3);
  let result = await runInContext(
    stripIndent`
    const boolOrErr = 1;
    const program = 2;
    function wrap() {
      return boolOrErr;
    }
    wrap();
  `,
    context,
  );
  assertFinishedResultValue(result, 1);
  result = await runInContext('program;', context);
  assertFinishedResultValue(result, 2);
});

test('assigning a = b where b was from a previous program call works', async () => {
  const context = mockContext(Chapter.SOURCE_3);
  const result = await runInContext(
    stripIndent`
    let b = null;
    b = pair;
    b = 1;
  `,
    context,
  );
  assertFinishedResultValue(result, 1);
});
