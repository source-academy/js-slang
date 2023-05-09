import { Program, Statement } from 'estree'

import assert from '../../../utils/assert'
import { isDeclaration } from '../../../utils/ast/typeGuards'

export default function removeImportsAndExports(program: Program) {
  const newBody = program.body.reduce((res, node) => {
    switch (node.type) {
      case 'ExportDefaultDeclaration': {
        if (isDeclaration(node.declaration)) {
          assert(
            node.declaration.type !== 'VariableDeclaration',
            'ExportDefaultDeclarations should not have variable declarations'
          )
          if (node.declaration.id) {
            return [...res, node.declaration]
          }
        }
        return res
      }
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
