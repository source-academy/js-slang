import { annotateProgram } from '../annotator'
import * as es from 'estree'
import { simple } from 'acorn-walk/dist/walk'
import { stripIndent } from '../../utils/formatters'
import { TypeVariableAnnotatedNode } from '../../types'
import { toValidatedAst } from '../../utils/testing'

// gets annotated AST
async function toAnnotatedAst(code: string) {
  const validatedAst = await toValidatedAst(code)
  return annotateProgram(validatedAst)
}

function checkConstantDeclarationAnnotation(
  declaration: TypeVariableAnnotatedNode<es.VariableDeclarator>
) {
  const id: TypeVariableAnnotatedNode<es.Pattern> = declaration.id
  expect(id.typeVariableId).not.toBe(undefined)
  if (declaration.init !== null && declaration.init !== undefined) {
    const init: TypeVariableAnnotatedNode<es.Expression> = declaration.init
    expect(init.typeVariableId).not.toBe(undefined)
    expect(id.typeVariableId! + 1).toEqual(init.typeVariableId!)
  }
}

test('constant declarations will have identifier and value annotated', async () => {
  const code = stripIndent`
  const x = 1;
  const y = 2;
  `

  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    VariableDeclarator: checkConstantDeclarationAnnotation
  })
})
