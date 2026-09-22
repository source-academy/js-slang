import type { SyntaxHighlightData } from '@sourceacademy/common-autocomplete';

import type { Chapter } from '../../../langs';
import sourceHighlightRules from './highlight-rules';

/**
 * Folding, indentation and outdentation are brace-based, exactly like ace's own JavaScript mode —
 * Source's block structure (`{ ... }`) is JavaScript's, unchanged — so `foldingRules`/`indents`/
 * `outdents`/`autoOutdent` all `hookFrom` ace's existing `javascript`/`cstyle` modules rather than
 * reimplementing them, the same way py-slang's `mode.ts` hooks into ace's own `python` mode for the
 * (very different, indentation-based) parts of Python's folding/indentation. Only `highlightRules`
 * — the token-coloring table, which is genuinely Source-specific (its own restricted keyword and
 * builtin set) — is real, ported data; see `highlight-rules.ts`.
 */
export default (chapter: Chapter): SyntaxHighlightData => ({
  highlightRules: sourceHighlightRules(chapter),
  foldingRules: {
    hookFrom: 'ace/mode/folding/cstyle',
    args: [],
  },
  lineCommentStart: '//',
  pairQuotesAfter: {
    "'": /./,
    '"': /./,
  },
  indents: {
    hookFrom: 'ace/mode/javascript',
  },
  outdents: {
    hookFrom: 'ace/mode/javascript',
  },
  autoOutdent: {
    hookFrom: 'ace/mode/javascript',
  },
  id: `ace/mode/source${chapter}`,
  snippetFileId: 'ace/snippets/javascript',
});
