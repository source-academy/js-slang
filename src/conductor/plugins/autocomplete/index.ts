import {
  type AutoCompleteEntry,
  type SyntaxHighlightData,
  WEB_PLUGIN_ID,
} from '@sourceacademy/common-autocomplete';
import type { IChannel, IConduit } from '@sourceacademy/conductor/conduit';
import type { IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { BaseAutoCompleteRunnerPlugin } from '@sourceacademy/runner-autocomplete';
import { parse as acornLooseParse } from 'acorn-loose';

import { ACORN_PARSE_OPTIONS } from '../../../constants';
import type { Chapter } from '../../../langs';
import sourceMode from './mode';
import { getNames } from './resolver';

export default class AutoCompletePlugin extends BaseAutoCompleteRunnerPlugin {
  private readonly chapter: Chapter;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channels: IChannel<any>[],
    chapter: Chapter,
  ) {
    super(_conduit, channels);
    this.chapter = chapter;
  }

  get mode(): SyntaxHighlightData {
    return sourceMode(this.chapter);
  }

  autocomplete(code: string, row: number, column: number): AutoCompleteEntry[] {
    // Tolerant, not the real parser: the buffer is normally *invalid* Source while a student is
    // mid-keystroke (an unclosed paren, a dangling comma, a statement that hasn't been finished
    // yet), and completions need to keep working through that, not just on code that would
    // actually run. Same parser js-slang's own editor tooling already uses for this reason
    // (`parser/utils.ts`'s `looseParse`) — called directly here rather than through that wrapper,
    // since this call site has no `Context` to hand it and doesn't need one: nothing here reports
    // the recovered syntax errors `looseParse` would otherwise push onto `context.errors`.
    const program = acornLooseParse(code, ACORN_PARSE_OPTIONS);
    return getNames(program, code, row, column, this.chapter);
  }
}

export function registerAutoCompletePlugin(conductor: IRunnerPlugin, chapter: Chapter): void {
  conductor.registerPlugin(AutoCompletePlugin, chapter);
  void conductor.hostLoadPlugin(WEB_PLUGIN_ID);
}
