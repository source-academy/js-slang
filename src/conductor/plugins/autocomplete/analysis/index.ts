import { parse as acornLooseParse } from 'acorn-loose';
import type es from 'estree';

import { ACORN_PARSE_OPTIONS } from '../../../../constants';
import { findDeclarationNode, findIdentifierNode } from './finder';
import { getAllOccurrencesInScopeHelper, getScopeHelper } from './scope-refactoring';

/**
 * Where something is in the code as acorn has it: `line` is 1-based, `column` is 0-based. (The
 * analysis protocol of the editor is 0-based throughout, as LSP is; the plugin converts.)
 */
export type SourcePosition = { line: number; column: number };

/**
 * The code as a program, tolerantly: the buffer is normally *invalid* Source while a student is
 * mid-keystroke, and the analysis has to keep working through that, as the completions do. With
 * the locations that the analysis is about.
 */
export function looseParse(code: string): es.Program {
  return acornLooseParse(code, {
    ...ACORN_PARSE_OPTIONS,
    locations: true,
  });
}

/**
 * Where the name at `loc` is declared; that is `loc` itself if it is on a declaration. `null` if it
 * is not at a name, or the name is not declared in the code (a name of the language's library, say).
 */
export function findDeclaration(code: string, loc: SourcePosition): es.SourceLocation | null {
  const program = looseParse(code);
  const identifierNode = findIdentifierNode(program, loc);
  if (!identifierNode) {
    return null;
  }
  return findDeclarationNode(program, identifierNode)?.loc ?? null;
}

/** The ranges of the scope of the name that is declared at `loc`; none if `loc` is not a declaration. */
export function getScope(code: string, loc: SourcePosition): es.SourceLocation[] {
  const program = looseParse(code);
  const identifierNode = findIdentifierNode(program, loc);
  if (!identifierNode) {
    return [];
  }
  const declarationNode = findDeclarationNode(program, identifierNode);
  if (!declarationNode || declarationNode.loc == null || identifierNode !== declarationNode) {
    return [];
  }
  return getScopeHelper(declarationNode.loc, program, identifierNode.name);
}

/** Every occurrence, within its scope, of the name at `loc`; none if it is not declared in the code. */
export function getAllOccurrencesInScope(code: string, loc: SourcePosition): es.SourceLocation[] {
  const program = looseParse(code);
  const identifierNode = findIdentifierNode(program, loc);
  if (!identifierNode) {
    return [];
  }
  const declarationNode = findDeclarationNode(program, identifierNode);
  if (declarationNode == null || declarationNode.loc == null) {
    return [];
  }
  return getAllOccurrencesInScopeHelper(declarationNode.loc, program, identifierNode.name);
}
