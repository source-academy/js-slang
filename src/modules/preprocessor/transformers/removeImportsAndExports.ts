import { Program, Statement } from 'estree'

import { processExportDefaultDeclaration } from '../../../utils/ast/astUtils'

export default function removeImportsAndExports(program: Program) {
  const newBody = program.body.reduce((res, node) => {
    switch (node.type) {
      case 'ExportDefaultDeclaration':
        return processExportDefaultDeclaration(node, {
          ClassDeclaration: decl => [...res, decl],
          FunctionDeclaration: decl => [...res, decl],
          Expression: () => res
        })
      case 'ExportNamedDeclaration':
        return node.declaration ? [...res, node.declaration] : res
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
        return res
      default:
        return [...res, node]
    }
  }, [] as Statement[])

  program.body = newBody
}
