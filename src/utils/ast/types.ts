import type * as es from 'estree'

export type ExportDeclaration = Exclude<es.ModuleDeclaration, es.ImportDeclaration>
export type SourcedModuleDeclaration = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

export interface BlockArrowFunctionExpression
  extends Omit<es.ArrowFunctionExpression, 'body' | 'expression'> {
  body: es.BlockStatement
  expression: false
}

export * from 'estree'
