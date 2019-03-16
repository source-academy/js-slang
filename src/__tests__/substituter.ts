import { generate } from 'astring'
import { stripIndent } from 'common-tags'
import { parseError } from '../index'
import { mockContext } from '../mocks/context'
import { getEvaluationSteps } from '../substituter'

test('Test basic substitution', () => {
  const code = stripIndent`
    (1 + 2) * (3 + 4);
  `
  const steps = getEvaluationSteps(code, mockContext(4)).map(([reduced]) => reduced)
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * (3 + 4);

3 * (3 + 4);

3 * 7;

21;
"
`)
})

test('Test binary operator error', () => {
  const code = stripIndent`
    (1 + 2) * ('a' + 'string');
  `
  const context = mockContext(4)
  const steps = getEvaluationSteps(code, context).map(([reduced]) => reduced)
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * ('a' + 'string');

3 * ('a' + 'string');

3 * \\"astring\\";
"
`)
  expect(parseError(context.errors)).toBe(
    'Line 1: Expected number on right hand side of operation, got string.'
  )
})

test('Test two statement substitution', () => {
  const code = stripIndent`
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const steps = getEvaluationSteps(code, mockContext(4)).map(([reduced]) => reduced)
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * (3 + 4);
3 * 5;

3 * (3 + 4);
3 * 5;

3 * 7;
3 * 5;

21;
3 * 5;

3 * 5;

15;
"
`)
})
