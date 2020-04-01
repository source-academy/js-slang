import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode } from '../types'
import { annotateProgram } from './annotator'
import * as es from 'estree'

// // main function that will infer a program
export function inferProgram(program: es.Program): TypeAnnotatedNode<es.Program> {
  function inferLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    const valueOfLiteral = literal.value
    if (typeof valueOfLiteral === 'number') {
      if (Number.isInteger(valueOfLiteral)) {
        // annotate as int
        literal.inferredType = {
          kind: 'primitive',
          name: 'integer'
        }
        literal.typability = 'Typed'
      }
    }
  }
  // annotate program
  program = annotateProgram(program)
  // visit Literals and type check them
  ancestor(program as es.Node, {
    Literal: inferLiteral
  })
  // return the AST with annotated types
  return program
}
