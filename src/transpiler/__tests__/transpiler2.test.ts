import { expect, test } from 'vitest';
import { generate } from 'astring';
import { parse } from '../../parser/parser';
import { mockContext } from '../../utils/testing/mocks';
import { Chapter } from '../../langs';
import { transformProgram } from '../transpiler2';
import { sandboxedEval } from '../evalContainer';

test('oh no', () => {
  const context = mockContext(Chapter.LIBRARY_PARSER);
  const program = parse(
    `
      const obj= {
        name: 'death',
        foo() {
          return this.name;
        }
      };
      const bar = () => obj;
      bar[0]();
    `,
    context,
  );

  expect(program).not.toBeNull();
  const { program: transformed } = transformProgram(program!, context, false);
  const code = generate(transformed);
  console.log(code);
  const result = sandboxedEval(code, context.nativeStorage);

  console.log(result);
});
