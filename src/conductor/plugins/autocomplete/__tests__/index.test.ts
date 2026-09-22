import { afterEach, describe, expect, test, vi } from 'vitest';

import { Chapter } from '../../../../langs';
import AutoCompletePlugin from '../index';

/** A minimal fake `IChannel` — enough for `BaseAutoCompleteRunnerPlugin`'s constructor to run
 * (it subscribes on both channels and starts a periodic mode-push timer), without a real conduit. */
function fakeChannel() {
  return {
    name: 'fake',
    send: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    close: () => {},
  };
}

describe('AutoCompletePlugin', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makePlugin(chapter: Chapter): AutoCompletePlugin {
    // BaseAutoCompleteRunnerPlugin's constructor starts a setInterval pushing mode data; fake
    // timers keep that from actually firing/leaking across tests.
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new AutoCompletePlugin({} as any, [fakeChannel(), fakeChannel()], chapter);
  }

  /** Splits `code` on a `|` cursor marker into (code without the marker, 1-based line, 0-based
   * column) — avoids hand-counting characters when writing test cases. */
  function withCursor(code: string): [string, number, number] {
    const cursor = code.indexOf('|');
    if (cursor === -1) throw new Error('code must contain a | marking the cursor position');
    const withoutMarker = code.slice(0, cursor) + code.slice(cursor + 1);
    const lines = withoutMarker.slice(0, cursor).split('\n');
    return [withoutMarker, lines.length, lines[lines.length - 1].length];
  }

  test('mode is gated by chapter, matching highlight-rules.ts', () => {
    const plugin = makePlugin(Chapter.SOURCE_1);
    expect(plugin.mode.id).toBe('ace/mode/source1');
  });

  test('autocomplete suggests a real builtin by subsequence', () => {
    const plugin = makePlugin(Chapter.SOURCE_2);
    const [code, line, column] = withCursor('acc|');
    expect(plugin.autocomplete(code, line, column).map(e => e.name)).toContain('accumulate');
  });

  test('autocomplete suggests a local declaration', () => {
    const plugin = makePlugin(Chapter.SOURCE_1);
    const [code, line, column] = withCursor('const accountBalance = 0;\nacc|');
    expect(plugin.autocomplete(code, line, column).map(e => e.name)).toContain('accountBalance');
  });

  // The real point of using acorn-loose: a student mid-keystroke has invalid code far more often
  // than valid code, and completions must keep working through that.
  test('autocomplete tolerates invalid, mid-edit syntax', () => {
    const plugin = makePlugin(Chapter.SOURCE_1);
    const [code, line, column] = withCursor('const accountBalance = 0;\ndisplay(acc|,');
    expect(plugin.autocomplete(code, line, column).map(e => e.name)).toContain('accountBalance');
  });
});
