import type es from 'estree'

import type { Node } from '../../types'

export const isImportDeclaration = (
  node: es.Program['body'][number]
): node is es.ImportDeclaration => node.type === 'ImportDeclaration'

// It is necessary to write this type guard like this as the 'type' of both
// 'Directive' & 'ExpressionStatement' is 'ExpressionStatement'.
//
// export interface Directive extends BaseNode {
//   type: "ExpressionStatement";
//   expression: Literal;
//   directive: string;
// }
//
// export interface ExpressionStatement extends BaseStatement {
//   type: "ExpressionStatement";
//   expression: Expression;
// }
//
// As such, we check whether the 'directive' property exists on the object
// instead in order to differentiate between the two.
export const isDirective = (node: Node): node is es.Directive => {
  return 'directive' in node
}

export const isModuleDeclaration = (node: Node): node is es.ModuleDeclaration => {
  return [
    'ImportDeclaration',
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
    'ExportAllDeclaration'
  ].includes(node.type)
}

export const isStatement = (
  node: es.Directive | es.Statement | es.ModuleDeclaration
): node is es.Statement => {
  return !isDirective(node) && !isModuleDeclaration(node)
}

export function isDeclaration(node: Node): node is es.Declaration {
  // export type Declaration =
  //       FunctionDeclaration | VariableDeclaration | ClassDeclaration;
  return (
    node.type === 'VariableDeclaration' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration'
  )
}

export const isIdentifier = (node: es.Node): node is es.Identifier => node.type === 'Identifier'

export const isVariableDeclaration = (node: es.Node): node is es.VariableDeclaration =>
  node.type === 'VariableDeclaration'

export const isNamespaceSpecifier = (node: es.Node): node is es.ImportNamespaceSpecifier =>
  node.type === 'ImportNamespaceSpecifier'
