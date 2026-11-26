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

  describe('analysis', () => {
    const code = 'const x = 1;\nfunction f(y) {\n  return x + y;\n}\nx + f(x);\ndisplay(x);';
    const range = (line: number, from: number, to: number) => ({
      start: { line, character: from },
      end: { line, character: to },
    });

    /** A plugin whose analysis channel is the third one, and what it sends on it. */
    function makeAnalysingPlugin() {
      vi.useFakeTimers();
      const sent: unknown[] = [];
      let deliver: ((message: unknown) => void) | undefined;
      const analysisChannel = {
        ...fakeChannel(),
        send: (message: unknown) => sent.push(message),
        subscribe: (handler: (message: unknown) => void) => {
          deliver = handler;
        },
      };

      const channels: any[] = [fakeChannel(), fakeChannel(), analysisChannel];

      const plugin = new AutoCompletePlugin({} as any, channels, Chapter.SOURCE_4);
      return { plugin, sent, deliver: (message: unknown) => deliver!(message) };
    }

    test('announces that it provides all three analyses', () => {
      expect(makeAnalysingPlugin().sent).toEqual([
        {
          type: 'capabilities',
          capabilities: { occurrences: true, definition: true, scope: true },
        },
      ]);
    });

    test('answers a request over the channel, in the 0-based positions of the protocol', () => {
      const { sent, deliver } = makeAnalysingPlugin();
      sent.length = 0;

      deliver({
        type: 'request',
        requestId: 5,
        kind: 'definition',
        code,
        position: { line: 4, character: 0 },
      });

      expect(sent).toEqual([
        { type: 'response', requestId: 5, kind: 'definition', range: range(0, 6, 7) },
      ]);
    });

    test('occurrences are every use of the name within its scope, in the order of the code', () => {
      const { plugin } = makeAnalysingPlugin();
      const everyUseOfX = [
        range(0, 6, 7),
        range(2, 9, 10),
        range(4, 0, 1),
        range(4, 6, 7),
        range(5, 8, 9),
      ];
      // From the declaration, and from a use inside a function.
      expect(plugin.occurrences(code, { line: 0, character: 6 })).toEqual(everyUseOfX);
      expect(plugin.occurrences(code, { line: 2, character: 9 })).toEqual(everyUseOfX);
      // A parameter is another name, with a scope of its own.
      expect(plugin.occurrences(code, { line: 2, character: 13 })).toEqual([
        range(1, 11, 12),
        range(2, 13, 14),
      ]);
    });

    test('the definition is where the name is declared, and the declaration itself on it', () => {
      const { plugin } = makeAnalysingPlugin();
      expect(plugin.definition(code, { line: 4, character: 0 })).toEqual(range(0, 6, 7));
      expect(plugin.definition(code, { line: 0, character: 6 })).toEqual(range(0, 6, 7));
    });

    test('there is no definition for a name of the library, or where there is no name', () => {
      const { plugin } = makeAnalysingPlugin();
      expect(plugin.definition(code, { line: 5, character: 2 })).toBeNull();
      expect(plugin.definition(code, { line: 3, character: 0 })).toBeNull();
      expect(plugin.definition('', { line: 0, character: 0 })).toBeNull();
    });

    test('the scope is that of the name declared at the position, and none elsewhere', () => {
      const { plugin } = makeAnalysingPlugin();
      // A constant of the program is in scope from the start of the program to its end.
      expect(plugin.scope(code, { line: 0, character: 6 })).toEqual([
        { start: { line: 0, character: 0 }, end: { line: 5, character: 11 } },
      ]);
      // The scope of a parameter is the body of its function.
      expect(plugin.scope(code, { line: 1, character: 11 })).toEqual([
        { start: { line: 1, character: 14 }, end: { line: 3, character: 1 } },
      ]);
      // A use is not a declaration.
      expect(plugin.scope(code, { line: 4, character: 0 })).toEqual([]);
    });

    test('a name imported under another name is declared by that name', () => {
      const { plugin } = makeAnalysingPlugin();
      const imported = 'import { foo as bar } from "m";\nbar(1);\nbar(2);';
      expect(plugin.definition(imported, { line: 1, character: 0 })).toEqual(range(0, 16, 19));
      expect(plugin.occurrences(imported, { line: 2, character: 1 })).toEqual([
        range(0, 16, 19),
        range(1, 0, 3),
        range(2, 0, 3),
      ]);
    });

    test('a variable of a for loop is in scope in all of the loop, not only its body', () => {
      const { plugin } = makeAnalysingPlugin();
      const loop = 'for (let i = 0; i < 3; i = i + 1) {\n  display(i);\n}';
      expect(plugin.scope(loop, { line: 0, character: 9 })).toEqual([
        { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      ]);
      // Its uses in the condition and the update are found as well as the one in the body.
      expect(plugin.occurrences(loop, { line: 1, character: 10 })).toEqual([
        range(0, 9, 10),
        range(0, 16, 17),
        range(0, 23, 24),
        range(0, 27, 28),
        range(1, 10, 11),
      ]);
    });

    test('a position right after a name is on it, as an editor has its cursor after what is typed', () => {
      const { plugin } = makeAnalysingPlugin();
      // `x` of `const x = 1;` is characters 6 up to 7: the cursor at 7 is on it, and at 8 is not.
      expect(plugin.definition(code, { line: 0, character: 7 })).toEqual(range(0, 6, 7));
      expect(plugin.definition(code, { line: 0, character: 8 })).toBeNull();
    });

    test('works on code that does not parse, as a student has it mid-keystroke', () => {
      const { plugin } = makeAnalysingPlugin();
      expect(plugin.occurrences('const x = ;\nx + x', { line: 1, character: 0 })).toEqual([
        range(0, 6, 7),
        range(1, 0, 1),
        range(1, 4, 5),
      ]);
      expect(plugin.occurrences('', { line: 0, character: 0 })).toEqual([]);
    });
  });
});
