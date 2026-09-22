import { Chapter } from '../../../langs';

/**
 * Reserved words Source actually accepts, gated by chapter — a small, deliberately curated list
 * (not every JS/ES reserved word; Source forbids most of them entirely, see `docs/lib`'s own
 * README specs and the pre-Conductor `src/editors/ace/modes/source.ts`, which this mirrors).
 */
const chapterKeywords: Partial<Record<Chapter, readonly string[]>> = {
  // ImportDeclaration/DebuggerStatement are both gated from chapter 1, ExportNamedDeclaration
  // from chapter 2 — see src/parser/source/syntax.ts's syntaxBlacklist, the actual restriction
  // this list needs to track (default/namespace imports and default/`export *` are excluded
  // there as library-only, so `import`/`export` cover only the forms a student can actually write).
  [Chapter.SOURCE_1]: ['const', 'else', 'if', 'return', 'function', 'import', 'debugger'],
  [Chapter.SOURCE_2]: ['export'],
  [Chapter.SOURCE_3]: ['while', 'for', 'break', 'continue', 'let'],
};

export function getKeywords(chapter: Chapter): string[] {
  const keywords: string[] = [];
  for (const [gate, words] of Object.entries(chapterKeywords)) {
    if (chapter >= Number(gate)) {
      keywords.push(...words);
    }
  }
  return keywords;
}
