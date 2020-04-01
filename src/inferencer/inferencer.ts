import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode } from '../types'
import * as es from 'estree'

// // main function that will infer a program
export function inferProgram(program: es.Program): TypeAnnotatedNode<es.Program> {
  function inferLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    const valueOfLiteral = literal.value
    if (typeof valueOfLiteral === 'number') {
      // if (Number.isInteger(valueOfLiteral)) {
      // declare as int
      literal.inferredType = {
        kind: 'primitive',
        name: 'integer'
      }
      literal.typability = 'Typed'
      // }
    }
    else if (typeof valueOfLiteral === 'boolean') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'boolean'
      }
      literal.typability = 'Typed'
    }
    else if (typeof valueOfLiteral === 'string') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'string'
      }
      literal.typability = 'Typed'
    }
    else if (typeof valueOfLiteral === 'undefined') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'undefined'
      }
      literal.typability = 'Typed'
    }
  }
  // visit Literals and type check them
  ancestor(program as es.Node, {
    Literal: inferLiteral
  })
  // return the AST with annotated types
  return program
}
