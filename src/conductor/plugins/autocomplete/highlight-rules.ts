/**
 * Adapted from ace-builds' own `javascript_highlight_rules.js`
 * (https://github.com/ajaxorg/ace-builds/blob/master/src/mode-javascript.js), by way of the
 * pre-Conductor `src/editors/ace/modes/source.ts` (itself an adaptation of the same file — see
 * `git log --all -- src/editors/ace/modes/source.ts`), trimmed to what Source's own, considerably
 * smaller grammar actually needs:
 *
 * - No regex literals: `no-unspecified-literal` (`src/parser/source/rules`) rejects every literal
 *   that isn't a boolean, string or number, so `/` is always division — never the start of a regex
 *   — and ace's own `start`/`no_regex`/`regex`/`regex_character_class` states, which exist
 *   entirely to disambiguate that, collapse into a single state here.
 * - Template literals, but no interpolation: `syntaxBlacklist` (`src/parser/source/syntax.ts`)
 *   allows `TemplateLiteral` from chapter 1, but `noTemplateExpression`
 *   (`src/parser/source/rules`) rejects any `${...}` inside one — Source treats a template literal
 *   purely as a backtick-delimited "multiline string" (that error's own wording), not JS's real
 *   templating feature. `qtemplate` below matches that: a plain string state, no `${` handling.
 * - No JSX, no classes, no generators/`yield`, no `var`: none of these are part of Source's
 *   grammar (see `docs/specs`), so the states and rules ace's mode carries for them are simply
 *   absent.
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of Ajax.org B.V. nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import type { AceRules } from '@sourceacademy/common-autocomplete';

import { Chapter } from '../../../langs';
import arrayJSON from './builtins/array.json';
import listJSON from './builtins/list.json';
import mathJSON from './builtins/math.json';
import mceJSON from './builtins/mce.json';
import miscJSON from './builtins/misc.json';
import pairmutatorJSON from './builtins/pairmutator.json';
import streamJSON from './builtins/stream.json';
import { getKeywords } from './keywords';

// `¡-￿` is the same deliberately-approximate "anything non-ASCII" range ace's own JS
// mode — and the pre-Conductor source.ts before it — used in place of a real Unicode
// ID_Start/ID_Continue table; acorn's own identifier grammar (which Source doesn't narrow) accepts
// non-ASCII names, so an ASCII-only pattern here would leave e.g. `über`/`π` unstyled. Exported so
// resolver.ts's own identifier-prefix regex matches the same character set, rather than drifting.
export const identifierCharRe = 'a-zA-Z_$\\u00a1-\\uffff';
const identifierRe = `[${identifierCharRe}][${identifierCharRe}0-9]*`;

/** Every builtin visible at `chapter`, split by the JSDoc-derived `meta` py-slang's own
 * `highlight-rules.ts` splits the same way: a `func` colors as `support.function` (a call), a
 * `var` — `Infinity`, `NaN`, `undefined`, `math_PI`, ... — colors as `constant.language` (a
 * predefined value, not something you call). Single source of truth with the autocomplete entries
 * themselves and with `resolver.ts`'s own `getBuiltins`, rather than a hand-maintained duplicate
 * list (which is exactly how the pre-Conductor version of this file drifted enough to need
 * per-chapter manual upkeep). */
function builtinsByMeta(chapter: Chapter): { functions: string[]; constants: string[] } {
  const symbols = [...miscJSON, ...mathJSON];
  if (chapter >= Chapter.SOURCE_2) symbols.push(...listJSON);
  if (chapter >= Chapter.SOURCE_3) symbols.push(...streamJSON, ...arrayJSON, ...pairmutatorJSON);
  if (chapter >= Chapter.SOURCE_4) symbols.push(...mceJSON);

  const functions: string[] = [];
  const constants: string[] = [];
  for (const { name, meta } of symbols) {
    (meta === 'func' ? functions : constants).push(name);
  }
  return { functions, constants };
}

export default function sourceHighlightRules(chapter: Chapter): AceRules {
  const { functions, constants } = builtinsByMeta(chapter);
  const keywordMapper = {
    map: {
      // `null` alone, not `Infinity`/`NaN`/`undefined` too: those three are already in `constants`
      // (misc.json documents them as builtins), and `null` is the one Source constant that isn't
      // — it's a literal, not something defineBuiltin registers.
      'constant.language': ['null', ...constants].join('|'),
      'constant.language.boolean': 'true|false',
      keyword: getKeywords(chapter).join('|'),
      'storage.type': 'const|let|function',
      'support.function': functions.join('|'),
    },
    defaultToken: 'identifier',
  };

  // hex/oct/bin, then decimal (int or float, with an optional exponent) — longest-alternative-first
  // within each, matching every other rule below: Ace's tokenizer takes the first regex that
  // matches at the current position, not the longest, so a shorter prefix alternative placed first
  // would swallow the rest of a longer token.
  const numberRe =
    '0(?:[xX][0-9a-fA-F]+|[oO][0-7]+|[bB][01]+)|(?:\\d\\d*(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';

  const escapedStringCharRe = '\\\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\\{[0-9a-fA-F]{1,6}\\}|.)';

  return {
    start: [
      { token: 'comment', regex: '//.*$' },
      { token: 'comment', regex: '/\\*', next: 'comment' },
      { token: 'string', regex: "'(?=.)", next: 'qstring' },
      { token: 'string', regex: '"(?=.)', next: 'qqstring' },
      { token: 'string', regex: '`', next: 'qtemplate' },
      { token: 'constant.numeric', regex: numberRe },
      {
        token: ['storage.type', 'text', 'entity.name.function', 'text', 'paren.lparen'],
        regex: `(function)(\\s+)(${identifierRe})(\\s*)(\\()`,
        next: 'function_arguments',
      },
      // `from` only colors as a keyword directly before the module string it introduces
      // (`import { x } from "y"`) — elsewhere it's a perfectly ordinary identifier, unlike every
      // other entry in the keyword mapper. Must come before the keywordMapper rule below, since
      // ace's tokenizer takes the first rule that matches, not the most specific one.
      { token: 'keyword', regex: 'from(?=\\s*([\'"]))' },
      { token: keywordMapper, regex: identifierRe },
      { token: 'punctuation.operator', regex: '\\.(?!\\.)' },
      { token: 'storage.type', regex: '=>' },
      // Longest-alternative-first (===/!== before ==, <=/>= before </>): see the numberRe comment.
      { token: 'keyword.operator', regex: '===|!==|==|=|<=|>=|<|>|!|&&|\\|\\||[%*+\\-/]' },
      { token: 'punctuation.operator', regex: '[?:,;]' },
      { token: 'paren.lparen', regex: '[[({]' },
      { token: 'paren.rparen', regex: '[\\])}]' },
      { token: 'text', regex: '\\s+' },
    ],
    comment: [{ token: 'comment', regex: '\\*/', next: 'start' }, { defaultToken: 'comment' }],
    function_arguments: [
      { token: 'variable.parameter', regex: identifierRe },
      { token: 'punctuation.operator', regex: '[, ]+' },
      { token: 'empty', regex: '', next: 'start' },
    ],
    qstring: [
      { token: 'constant.language.escape', regex: escapedStringCharRe },
      { token: 'string', regex: "'|$", next: 'start' },
      { defaultToken: 'string' },
    ],
    qqstring: [
      { token: 'constant.language.escape', regex: escapedStringCharRe },
      { token: 'string', regex: '"|$', next: 'start' },
      { defaultToken: 'string' },
    ],
    // No `${...}` handling, unlike ace's own template-literal state: Source's own restriction on
    // one (see this file's top doc comment) means a real, literal newline is the only special case
    // worth a rule of its own — everything else, `$` included, is plain string content. Unlike
    // qstring/qqstring, the terminator here does *not* also fire at end-of-line: a template
    // literal is a genuine multiline string, so an embedded newline must stay part of it rather
    // than ending the token the way an unterminated '/" string is treated as doing.
    qtemplate: [
      { token: 'constant.language.escape', regex: escapedStringCharRe },
      { token: 'string', regex: '`', next: 'start' },
      { defaultToken: 'string' },
    ],
  };
}
