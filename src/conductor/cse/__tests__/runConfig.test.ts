import type { IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { describe, expect, test } from 'vitest';

import { fetchRunConfig } from '../runConfig';

/** A host that serves the given files, and answers nothing for the others as a host does. */
function hostWith(files: Record<string, string>): IRunnerPlugin {
  return {
    requestFile: (name: string) => Promise.resolve(files[name]),
  } as unknown as IRunnerPlugin;
}

describe('fetchRunConfig', () => {
  test('reads /__run_config__', async () => {
    const host = hostWith({ '/__run_config__': JSON.stringify({ breakpointLines: [2] }) });
    expect(await fetchRunConfig(host)).toEqual({ breakpointLines: [2] });
  });

  test('reads /__cse_config__ from a host that has not been renamed', async () => {
    const host = hostWith({ '/__cse_config__': JSON.stringify({ breakpointLines: [4] }) });
    expect(await fetchRunConfig(host)).toEqual({ breakpointLines: [4] });
  });

  test('prefers the new name when a host serves both', async () => {
    const host = hostWith({
      '/__run_config__': JSON.stringify({ stepLimit: 5 }),
      '/__cse_config__': JSON.stringify({ stepLimit: 9 }),
    });
    expect(await fetchRunConfig(host)).toEqual({ stepLimit: 5 });
  });

  test('is empty when there is no file, or it is not JSON', async () => {
    expect(await fetchRunConfig(hostWith({}))).toEqual({});
    expect(await fetchRunConfig(hostWith({ '/__run_config__': 'not json' }))).toEqual({});
  });
});
