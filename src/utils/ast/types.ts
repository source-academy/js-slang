// Reexport the type definitions from estree, but with several helper types as well

import type * as es from 'estree'

import type { Replace } from '../../types'

export type ExportDeclaration = Exclude<es.ModuleDeclaration, es.ImportDeclaration>
export type ImportSpecifiers =
  | es.ImportSpecifier
  | es.ImportDefaultSpecifier
  | es.ImportNamespaceSpecifier
export type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
export type BlockArrowFunctionExpression = Replace<
  es.ArrowFunctionExpression,
  {
    expression: false
    body: es.BlockStatement
  }
>

export type FunctionNode =
  | es.FunctionDeclaration
  | es.FunctionExpression
  | es.ArrowFunctionExpression

export type ForStatements = es.ForInStatement | es.ForOfStatement | es.ForStatement
export type LoopNode = es.WhileStatement | ForStatements

export * from 'estree'
