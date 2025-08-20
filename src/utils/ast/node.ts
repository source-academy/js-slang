import type es from 'estree';

/**
 * StatementSequence : A sequence of statements not surrounded by braces.
 * It is *not* a block, and thus does not trigger environment creation when evaluated.
 *
 * The current ESTree specification does not have this node type, so we define it here.
 */
export interface StatementSequence extends es.BaseStatement {
  type: 'StatementSequence'
  body: Array<es.Statement>
  innerComments?: Array<Comment> | undefined
}

/**
 * js-slang's custom Node type - this should be used wherever es.Node is used.
 */
export type Node = { isEnvDependent?: boolean} & (
  es.Node |
  StatementSequence |
  es.MaybeNamedClassDeclaration |
  es.MaybeNamedFunctionDeclaration)

export type ContiguousArrayElementExpression = Exclude<es.ArrayExpression['elements'][0], null>
export type ContiguousArrayElements = ContiguousArrayElementExpression[]

/**
 * Represents the types of {@link es.VariableDeclaration|Variable Declarations} that are allowed.
 */
export type AllowedDeclarations = 'const' | 'let'

