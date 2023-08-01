// Reexport the type definitions from estree, but with several helper types as well

import type * as es from 'estree'

import type { Replace } from '../../types'

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
  }
>

export type ExportNamedClassDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    declaration: ClassDeclarationWithId
  }
>

/**
 * Represents exports of the form `export function a() {}`
 */
export type ExportNamedFunctionDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    declaration: FunctionDeclarationWithId
  }
>

/**
 * Represents exports of the form `export { a, b }`
 */
export type ExportNamedLocalDeclaration = Replace<
  es.ExportNamedDeclaration,
  {
    source: null | undefined
    declaration: null | undefined
  }
>

/**
 * Represents exports of the form `export { a, b } from './a.js';`
 */
export type ExportNamedDeclarationWithSource = Replace<
  es.ExportNamedDeclaration,
  {
    source: es.Literal
  }
>

export type ExportDeclaration = Exclude<es.ModuleDeclaration, es.ImportDeclaration>

/**
 * Represents module declarations that have a `source` field
 */
export type ModuleDeclarationWithSource =
  | es.ImportDeclaration
  | es.ExportAllDeclaration
  | ExportNamedDeclarationWithSource

export * from 'estree'
