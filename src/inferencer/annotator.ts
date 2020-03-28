import { ancestor } from 'acorn-walk/dist/walk'
import { TypeVariableAnnotatedNode } from '../types'
import * as es from 'estree'

let typeVariableId = 1
// // main function that will infer a program
export function annotateProgram(program: es.Program): es.Program {
  function annotateConstantDeclaration(
    declaration: TypeVariableAnnotatedNode<es.VariableDeclarator>
  ) {
    const id: TypeVariableAnnotatedNode<es.Pattern> = declaration.id
    id.typeVariableId = typeVariableId
    typeVariableId += 1

    if (declaration.init !== null && declaration.init !== undefined) {
      const init: TypeVariableAnnotatedNode<es.Expression> = declaration.init
      init.typeVariableId = typeVariableId
      typeVariableId += 1
    }
  }

  ancestor(program as es.Node, {
    VariableDeclarator: annotateConstantDeclaration
  })

  return program
}
