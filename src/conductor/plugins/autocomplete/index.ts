import {
  type AnalysisPosition,
  type AnalysisRange,
  type AutoCompleteEntry,
  type SyntaxHighlightData,
  WEB_PLUGIN_ID,
} from '@sourceacademy/common-autocomplete';
import type { IChannel, IConduit } from '@sourceacademy/conductor/conduit';
import type { IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { BaseAutoCompleteRunnerPlugin } from '@sourceacademy/runner-autocomplete';
import { parse as acornLooseParse } from 'acorn-loose';
import type es from 'estree';

import { ACORN_PARSE_OPTIONS } from '../../../constants';
import type { Chapter } from '../../../langs';
import { findDeclaration, getAllOccurrencesInScope, getScope } from './analysis';
import sourceMode from './mode';
import { getNames } from './resolver';

/** The analysis has acorn's positions (`line` 1-based); the editor's protocol is 0-based, as LSP is. */
const toSourcePosition = ({ line, character }: AnalysisPosition) => ({
  line: line + 1,
  column: character,
});

const toRange = ({ start, end }: es.SourceLocation): AnalysisRange => ({
  start: { line: start.line - 1, character: start.column },
  end: { line: end.line - 1, character: end.column },
});

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

  // The analysis parses tolerantly too (see `analysis/index.ts`), and the same for every chapter:
  // the chapters differ in which syntax they reject, which scope analysis does not care about.

  override occurrences(code: string, position: AnalysisPosition): AnalysisRange[] {
    // In the order of the code: the analysis finds them in the order that it walks the tree.
    return getAllOccurrencesInScope(code, toSourcePosition(position))
      .map(toRange)
      .sort((a, b) => a.start.line - b.start.line || a.start.character - b.start.character);
  }

  /** The declaration of the name, which is the name itself where it is on a declaration. */
  override definition(code: string, position: AnalysisPosition): AnalysisRange | null {
    const declaration = findDeclaration(code, toSourcePosition(position));
    return declaration ? toRange(declaration) : null;
  }

  override scope(code: string, position: AnalysisPosition): AnalysisRange[] {
    return getScope(code, toSourcePosition(position)).map(toRange);
  }
}

export function registerAutoCompletePlugin(conductor: IRunnerPlugin, chapter: Chapter): void {
  conductor.registerPlugin(AutoCompletePlugin, chapter);
  void conductor.hostLoadPlugin(WEB_PLUGIN_ID);
}
