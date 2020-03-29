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
    expect(id.typeVariableId!).not.toEqual(init.typeVariableId!)
  }
}

function checkBinaryExpressionAnnotation(
  declaration: TypeVariableAnnotatedNode<es.BinaryExpression | es.LogicalExpression>
) {
  const left: TypeVariableAnnotatedNode<es.Expression> = declaration.left
  const right: TypeVariableAnnotatedNode<es.Expression> = declaration.right
  expect(left.typeVariableId).not.toBe(undefined)
  expect(right.typeVariableId).not.toBe(undefined)
  expect(declaration).not.toBe(undefined)
}

function checkUnaryExpressionAnnotation(
  unaryExpression: TypeVariableAnnotatedNode<es.UnaryExpression>
) {
  const argument: TypeVariableAnnotatedNode<es.Expression> = unaryExpression.argument
  expect(argument.typeVariableId).not.toBe(undefined)
  expect(unaryExpression).not.toBe(undefined)
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

test('binary expressions will be annotated', async () => {
  const code = stripIndent`
    const x = 1 + 1;
    const y = x - 2;
    const z = true && false;
    const a = z || true;
    `
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    BinaryExpression: checkBinaryExpressionAnnotation,
    LogicalExpression: checkBinaryExpressionAnnotation
  })
})

test('unary expressions will be annotated', async () => {
  const code = stripIndent`
      const x = true;
      !x;
      !false;
      `
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    UnaryExpression: checkUnaryExpressionAnnotation
  })
})
