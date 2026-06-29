import { describe, expect, it } from 'vitest';
import { docsToHtml } from '..';
import type { FunctionDocumentation } from '../../modules/moduleTypes';
import { importSpecifier } from '../../utils/ast/astCreator';

describe(docsToHtml, () => {
  const dummySpec = importSpecifier('f', 'f');

  it('works for functions with no parameters', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f() → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with 1 parameter', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with 2 parameters', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
        },
        {
          paramType: 'regular',
          type: 'number',
          name: 'param1',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number, param1: number) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with 1 default parameter', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
        },
        {
          paramType: 'regular',
          type: 'number',
          name: 'param1',
          defaultValue: '0',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number, param1: number = 0) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with 2 default parameters', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
          defaultValue: '0',
        },
        {
          paramType: 'regular',
          type: 'number',
          name: 'param1',
          defaultValue: '1',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number = 0, param1: number = 1) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with optional parameter', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
          defaultValue: '0',
        },
        {
          paramType: 'optional',
          type: 'number',
          name: 'param1',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number = 0, param1?: number) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });

  it('works for functions with rest parameter', () => {
    const testDocs: FunctionDocumentation = {
      kind: 'function',
      retType: 'string',
      description: 'A description',
      params: [
        {
          paramType: 'regular',
          type: 'number',
          name: 'param0',
          defaultValue: '0',
        },
        {
          paramType: 'rest',
          type: 'number',
          name: 'param1',
        },
      ],
    };

    expect(docsToHtml(dummySpec, testDocs)).toMatchInlineSnapshot(
      `"<div><h4>f(param0: number = 0, ...param1: number) → {string}</h4><div class=\\"description\\">A description</div></div>"`,
    );
  });
});
