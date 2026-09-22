import { type AutoCompleteEntry, CompletionItemKind } from '@sourceacademy/common-autocomplete';
import type es from 'estree';

import type { Chapter } from '../../../langs';
import { fullAncestor } from '../../../utils/ast/walkers';
import arrayJSON from './builtins/array.json';
import listJSON from './builtins/list.json';
import mathJSON from './builtins/math.json';
import mceJSON from './builtins/mce.json';
import miscJSON from './builtins/misc.json';
import pairmutatorJSON from './builtins/pairmutator.json';
import streamJSON from './builtins/stream.json';
import { getKeywords } from './keywords';

/** acorn attaches real `start`/`end` char offsets to every node it parses, but the plain `estree`
 * types this file otherwise uses don't declare them — same mismatch `utils/ast/walkers.ts`'s own
 * doc comment calls out. Narrow casts to this, not to `any`, at the handful of places that need
 * the offsets, rather than losing type-checking over the whole file. */
type Located = { start: number; end: number };

function range(node: es.Node): Located {
  return node as unknown as Located;
}

/** One level of the scope chain surrounding the cursor, innermost first once {@link buildScopeChain}
 * reverses it — mirrors py-slang's `resolver.ts` `Environment`, adapted from a linked list to a
 * flat array since there's no equivalent to Python's single nested-scope walk here: acorn already
 * hands back the full ancestor chain in one call. */
interface ScopeLevel {
  variables: string[];
  functions: string[];
}

function collectBlockDeclarations(body: es.Statement[]): ScopeLevel {
  const variables: string[] = [];
  const functions: string[] = [];
  for (const stmt of body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type === 'Identifier') variables.push(decl.id.name);
      }
    } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      functions.push(stmt.id.name);
    }
  }
  return { variables, functions };
}

/** Builds the scope chain from an ancestor path (root to the node at the cursor, as
 * {@link fullAncestor} reports it), then reverses it so the innermost scope comes first — matching
 * py-slang's own scoring convention: the closer scope should win. */
function buildScopeChain(ancestors: es.Node[]): ScopeLevel[] {
  const chain: ScopeLevel[] = [];
  for (const node of ancestors) {
    if (node.type === 'Program' || node.type === 'BlockStatement') {
      chain.push(collectBlockDeclarations(node.body as es.Statement[]));
    } else if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      const variables: string[] = [];
      for (const param of node.params) {
        if (param.type === 'Identifier') variables.push(param.name);
      }
      chain.push({ variables, functions: [] });
    } else if (node.type === 'ForStatement' && node.init?.type === 'VariableDeclaration') {
      const variables: string[] = [];
      for (const decl of node.init.declarations) {
        if (decl.id.type === 'Identifier') variables.push(decl.id.name);
      }
      chain.push({ variables, functions: [] });
    }
  }
  return chain.reverse();
}

/** Finds the smallest node whose range contains `pos`, and returns the ancestor chain
 * {@link fullAncestor} reported for it (root first, that node last). Falls back to just `[program]`
 * if nothing matched (an empty program, or `pos` past the end of it). */
function findAncestorsAt(program: es.Program, pos: number): es.Node[] {
  let best: { node: es.Node; ancestors: es.Node[] } | null = null;
  fullAncestor(
    program as never,
    (node, _state, ancestors) => {
      const { start, end } = range(node as unknown as es.Node);
      if (typeof start !== 'number' || typeof end !== 'number') return;
      if (pos < start || pos > end) return;
      if (!best || end - start < range(best.node).end - range(best.node).start) {
        best = { node: node as unknown as es.Node, ancestors: [...ancestors] as es.Node[] };
      }
    },
    undefined,
  );
  return best ? (best as { node: es.Node; ancestors: es.Node[] }).ancestors : [program];
}

/** Checks if `sub` is a subsequence of `str` — all of `sub`'s characters appear in `str` in order,
 * not necessarily contiguously (so `"acc"` matches `"accumulate"`, but also, less usefully, matches
 * `"a_couple_of_chars"` — the same tradeoff py-slang's identical helper makes). */
function isSubsequence(sub: string, str: string): boolean {
  let i = 0;
  for (const char of str) {
    if (char === sub[i]) i++;
    if (i === sub.length) return true;
  }
  return sub.length === 0;
}

/** Converts a 1-based line and 0-based column to a 0-based char offset into `doc`, clamping to the
 * nearest valid position if the line/column is out of bounds — mirrors py-slang's identical helper. */
function convertPosToIndex(doc: string, line: number, column: number): number {
  let pos = 0;
  while (line > 0) {
    const newlineIndex = doc.indexOf('\n', pos);
    if (newlineIndex === -1) return doc.length;
    pos = newlineIndex + 1;
    line--;
  }
  const lineEnd = doc.indexOf('\n', pos);
  const limit = lineEnd === -1 ? doc.length : lineEnd;
  return Math.min(pos + column, limit);
}

/** The identifier prefix the student is actively typing, read directly off the source text rather
 * than resolved via the AST: mid-typed code is exactly the case where acorn-loose's dummy-node
 * recovery is least reliable, and every realistic case is "some word characters immediately before
 * the cursor" — a plain regex needs no tree lookup to get that right. Doesn't distinguish "inside a
 * string/comment" from real code, unlike py-slang's tree-based query (a position inside a Python
 * string resolves to a String node, not VariableName) — a known, accepted gap; the query is what
 * makes an irrelevant location's suggestion list a no-op in the from-inside-a-string case anyway,
 * as long as the string doesn't itself end in an identifier-shaped run of characters. */
function getQueryAt(doc: string, pos: number): string {
  const before = doc.slice(0, pos);
  const match = /[a-zA-Z_$][a-zA-Z0-9_$]*$/.exec(before);
  return match?.[0] ?? '';
}

function getBuiltins(chapter: Chapter): (typeof miscJSON)[number][] {
  const symbols = [...miscJSON, ...mathJSON];
  if (chapter >= 2) symbols.push(...listJSON);
  if (chapter >= 3) symbols.push(...streamJSON, ...arrayJSON, ...pairmutatorJSON);
  if (chapter >= 4) symbols.push(...mceJSON);
  return symbols;
}

/**
 * Gets the names in scope at the given position in the document, plus matching builtins, prelude
 * functions, and keywords — the js-slang counterpart of py-slang's identically-named `getNames`.
 *
 * @param program The parsed program (see `looseParse`/`acorn-loose` — this must tolerate invalid,
 * mid-edit syntax, since that's the normal state of the buffer while a student is actively typing).
 * @param doc The document text.
 * @param line The 1-based line number of the cursor.
 * @param column The 0-based column number of the cursor.
 * @param chapter The Source chapter, for gating keywords and builtins.
 */
export function getNames(
  program: es.Program,
  doc: string,
  line: number,
  column: number,
  chapter: Chapter,
): AutoCompleteEntry[] {
  const pos = convertPosToIndex(doc, line - 1, column);
  const query = getQueryAt(doc, pos);
  if (query === '') return [];

  const chain = buildScopeChain(findAncestorsAt(program, pos));
  const entries: AutoCompleteEntry[] = [];
  let score = 1;
  for (const level of chain) {
    const symbols = [
      ...level.variables.map(name => ({ name, meta: CompletionItemKind.Variable, score })),
      ...level.functions.map(name => ({ name, meta: CompletionItemKind.Function, score })),
    ];
    symbols
      .filter(s => isSubsequence(query, s.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(s => entries.push(s));
    score++;
  }

  getKeywords(chapter)
    .map(name => ({ name, meta: CompletionItemKind.Keyword, score }))
    .filter(s => isSubsequence(query, s.name))
    .forEach(s => entries.push(s));

  getBuiltins(chapter)
    .map(v => ({
      name: v.name,
      meta: v.meta === 'func' ? CompletionItemKind.Function : CompletionItemKind.Variable,
      docHTML: `<h4>${v.title}</h4><p>${v.description}</p>`,
    }))
    .filter(s => isSubsequence(query, s.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => entries.push(s));

  return entries;
}
