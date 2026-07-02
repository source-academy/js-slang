import fs from 'fs/promises';
import pathlib from 'path';
import { test, expect, describe } from 'vitest';
import property from 'lodash/property';
import countBy from 'lodash/countBy';
import rules from '..';

test('All rules should be registered', async () => {
  const path = pathlib.join(__dirname, '..');
  const entries = await fs.readdir(path, { withFileTypes: true });

  const ruleFiles = entries.filter(each => {
    if (each.isDirectory()) return false;
    return pathlib.extname(each.name) === '.ts';
  });

  // Account for index.ts
  expect(ruleFiles.length).toEqual(rules.length + 1);
});

describe('All rules should have unique names', () => {
  const ruleNames = countBy(rules, property('name'));

  test.for(Object.entries(ruleNames))('%s', ([, count]) => {
    expect(count).toEqual(1);
  });
});
