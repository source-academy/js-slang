import { describe, expect, test } from 'vitest';
import { createEmptyModuleContexts, isSourceModule } from '../utils';

describe(isSourceModule, () => {
  test.each([
    ['Relative paths are not source modules', './module.js', false],
    ['Absolute paths are not source modules', '/module.js', false],
    ['Bare paths are source modules', 'module.js', true],
  ])('%#: %s', (_, moduleName, expected) => expect(isSourceModule(moduleName)).toEqual(expected));
});

describe(createEmptyModuleContexts, () => {
  test('Accessing a property that does not exist creates it', () => {
    const contexts = createEmptyModuleContexts();
    expect(contexts.moduleA).toEqual({ state: null, tabs: null });
  });

  test('Accessing a property that already exists does not overwrite it', () => {
    const contexts = createEmptyModuleContexts();
    contexts['moduleA'] = { state: 'some state', tabs: ['some tab'] };
    expect(contexts.moduleA).toEqual({ state: 'some state', tabs: ['some tab'] });
  });

  test('Accessing a non-string property returns undefined', () => {
    const contexts = createEmptyModuleContexts();
    expect(contexts[Symbol('symbol') as any]).toBeUndefined();
  });
});
