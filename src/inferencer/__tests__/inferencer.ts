import { inferProgram } from '../inferencer'
import * as es from 'estree'
import { simple } from 'acorn-walk/dist/walk'
import { stripIndent } from '../../utils/formatters'
import { TypeAnnotatedNode } from '../../types'
import { toValidatedAst } from '../../utils/testing'

// gets typedInferred AST
async function toTypeInferredAst(code: string) {
  const validatedAst = await toValidatedAst(code)
  return inferProgram(validatedAst)
}

function checkIfIntegerInferred(literal: TypeAnnotatedNode<es.Literal>) {
  const valueOfLiteral = literal.value
  if (typeof valueOfLiteral === 'number' && Number.isInteger(valueOfLiteral)) {
    expect(literal.inferredType).toEqual({
      kind: 'primitive',
      name: 'integer'
    })
    expect(literal.typability).toEqual('Typed')
  }
}

test('all Literals whose values are integers are inferred as integers', async () => {
  const code = stripIndent`
  1;
  const x = 1;
  `

  const typedInferredAst = await toTypeInferredAst(code)
  //   expect(typedInferredAst).toMatchSnapshot()
  simple(typedInferredAst, {
    Literal: checkIfIntegerInferred
  })
})

test('other nodes other than int literals are NotYetTyped', async () => {
  const code = stripIndent`
    true;
    false;
    1.90;
    `
  const typedInferredAst = await toTypeInferredAst(code)
  expect(typedInferredAst).toMatchSnapshot()
  simple(typedInferredAst, {
    Literal: checkIfIntegerInferred
  })
})

test('values equal to integers are integers', async () => {
  // 1.0 is an integer
  const code = stripIndent`
    1.0;
    0.0;
    `

  const typedInferredAst = await toTypeInferredAst(code)
  expect(typedInferredAst).toMatchSnapshot()
  simple(typedInferredAst, {
    Literal: checkIfIntegerInferred
  })
})
