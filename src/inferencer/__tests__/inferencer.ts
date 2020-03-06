import { inferProgram } from '../inferencer'
import * as es from 'estree'
import { simple } from 'acorn-walk/dist/walk'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { validateAndAnnotate } from '../../validator/validator'
import { stripIndent } from '../../utils/formatters'
import { TypeAnnotatedNode } from '../../types'

// gets typedInferred AST
async function toTypeInferredAst(code: string) {
  const context = mockContext(1)
  const ast = parse(code, context)
  const validatedAst = validateAndAnnotate(ast as es.Program, context)
  return inferProgram(validatedAst)
}

function checkIfIntegerInferred(literal: TypeAnnotatedNode<es.Literal>) {
    expect(literal.typability).toEqual('Typed')
    const valueOfLiteral = literal.value
    if (typeof valueOfLiteral === 'number' && Number.isInteger(valueOfLiteral)) {
        expect(literal.inferredType).toEqual({
            kind: 'primitive',
            name: 'integer',
        })
    }
}

test('all Literals whose values are integers are inferred as integers', async () => {
  const code = stripIndent`
  1;
  const x = 1;
  `

  const typedInferredAst = await toTypeInferredAst(code)
  expect(typedInferredAst).toMatchSnapshot()
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
