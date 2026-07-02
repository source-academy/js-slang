import { describe, expect, test } from 'vitest';
import { ModuleConnectionError, WrongChapterForModuleError } from '../errors';
import { ErrorSeverity, ErrorType } from '../../errors/base';
import { locationDummyNode } from '../../utils/ast/astCreator';
import { Chapter } from '../../langs';

describe(ModuleConnectionError, () => {
  const dummy = locationDummyNode(1, 1, null);
  const error = new ModuleConnectionError(dummy as any);

  test('properties', () => {
    expect(error.type).toEqual(ErrorType.IMPORT);
    expect(error.severity).toEqual(ErrorSeverity.ERROR);
  });
});

describe(WrongChapterForModuleError, () => {
  test('properties', () => {
    const error = new WrongChapterForModuleError('module0', Chapter.SOURCE_3, Chapter.SOURCE_1);

    expect(error.type).toEqual(ErrorType.IMPORT);
    expect(error.severity).toEqual(ErrorSeverity.ERROR);

    expect(error.explain()).toEqual('module0 needs at least SOURCE_3, but you are using SOURCE_1');
  });
});
