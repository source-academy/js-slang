// Reexport the type definitions from estree, but with several helper types as well

import type * as es from 'estree'

import type { Replace } from '../../types'

export type ExportDeclaration = Exclude<es.ModuleDeclaration, es.ImportDeclaration>
export type ImportSpecifiers =
  | es.ImportSpecifier
  | es.ImportDefaultSpecifier
  | es.ImportNamespaceSpecifier
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

export type FunctionDeclarationWithId = Replace<es.FunctionDeclaration, { id: es.Identifier }>
export type ClassDeclarationWithId = Replace<es.ClassDeclaration, { id: es.Identifier }>

export type ForStatements = es.ForInStatement | es.ForOfStatement | es.ForStatement
export type LoopNode = es.WhileStatement | ForStatements

export type ExportNamedVariableDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    declaration: es.VariableDeclaration
    source: null
    specifiers: never[]
  }
>

export type ExportNamedFunctionDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    declaration: FunctionDeclarationWithId
    source: null
    specifiers: never[]
  }
>

export type ExportNamedLocalDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    source: null
    declaration: null
  }
>

/**
 * Represents exports of the form `export { a, b } from './a.js';`
 */
export type ExportNamedDeclarationWithSource = Replace<
  es.ExportNamedDeclaration,
  {
    declaration: null
    source: es.Literal
  }
>

export type ModuleDeclarationWithSource =
  | es.ImportDeclaration
  | es.ExportAllDeclaration
  | ExportNamedDeclarationWithSource

export * from 'estree'