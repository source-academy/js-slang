import { annotateProgram } from '../annotator'
import * as es from 'estree'
import { simple } from 'acorn-walk/dist/walk'
import { stripIndent } from '../../utils/formatters'
import { TypeAnnotatedNode, Variable } from '../../types'
import { toValidatedAst } from '../../utils/testing'

// gets annotated AST
async function toAnnotatedAst(code: string) {
  const validatedAst = await toValidatedAst(code)
  return annotateProgram(validatedAst)
}

function checkConstantDeclarationAnnotation(declaration: TypeAnnotatedNode<es.VariableDeclarator>) {
  const id: TypeAnnotatedNode<es.Pattern> = declaration.id
  expect(id.typeVariable).not.toBe(undefined)
  if (declaration.init !== null && declaration.init !== undefined) {
    const init: TypeAnnotatedNode<es.Expression> = declaration.init
    if (init !== undefined) {
      expect(init.typeVariable).not.toBe(undefined)
      expect((id.typeVariable as Variable).id).not.toEqual((init.typeVariable as Variable).id)
    }
  }
}

function checkBinaryExpressionAnnotation(
  declaration: TypeAnnotatedNode<es.BinaryExpression | es.LogicalExpression>
) {
  const left: TypeAnnotatedNode<es.Expression> = declaration.left
  const right: TypeAnnotatedNode<es.Expression> = declaration.right
  expect((left.typeVariable as Variable).id).not.toBe(undefined)
  expect((right.typeVariable as Variable).id).not.toBe(undefined)
  expect(declaration).not.toBe(undefined)
}

function checkUnaryExpressionAnnotation(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
  const argument: TypeAnnotatedNode<es.Expression> = unaryExpression.argument
  expect((argument.typeVariable as Variable).id).not.toBe(undefined)
  expect(unaryExpression).not.toBe(undefined)
}

function checkLiteralAnnotation(literal: TypeAnnotatedNode<es.Literal>) {
  expect((literal.typeVariable as Variable).id).not.toBe(undefined)
}

function checkFunctionDeclarationAnnotation(
  functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>
) {
  const params: TypeAnnotatedNode<es.Pattern>[] = functionDeclaration.params
  params.forEach(param => {
    expect((param.typeVariable as Variable).id).not.toBe(undefined)
    expect((param.typeVariable as Variable).isPolymorphic).toBe(true)
  })

  // TODO figure out what to do with the function body.
  const result: TypeAnnotatedNode<es.BlockStatement> = functionDeclaration.body
  expect((result.typeVariable as Variable).id).not.toBe(undefined)
}

function checkFunctionDefinitionAnnotation(
  functionDefinition: TypeAnnotatedNode<es.ArrowFunctionExpression>
) {
  const params: TypeAnnotatedNode<es.Pattern>[] = functionDefinition.params
  params.forEach(param => {
    expect((param.typeVariable as Variable).id).not.toBe(undefined)
    expect((param.typeVariable as Variable).isPolymorphic).toBe(true)
  })

  // TODO figure out what to do with the function body.
  const result: TypeAnnotatedNode<es.Node> = functionDefinition.body
  expect((result.typeVariable as Variable).id).not.toBe(undefined)
}

function checkFunctionApplicationAnnotation(
  functionApplication: TypeAnnotatedNode<es.CallExpression>
) {
  functionApplication.arguments.forEach((argument: TypeAnnotatedNode<es.Expression>) => {
    expect((argument.typeVariable as Variable).id).not.toBe(undefined)
  })
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

test('literals are annotated', async () => {
  const code = stripIndent`
    const x = 1;
    1;
    `
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    Literal: checkLiteralAnnotation
  })
})

test('function declarations are annotated', async () => {
  const code = stripIndent`
    function something(x) {
        return x;
    }`
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    FunctionDeclaration: checkFunctionDeclarationAnnotation
  })
})

test('function definitions are annotated', async () => {
  const code = stripIndent`
      const x = x => x;
      y => y + 1;`
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    ArrowFunctionExpression: checkFunctionDefinitionAnnotation
  })
})

test('function applications are annotated', async () => {
  const code = stripIndent`
    somefunction(1);
    `
  const annotatedAst = await toAnnotatedAst(code)
  simple(annotatedAst, {
    CallExpression: checkFunctionApplicationAnnotation
  })
})
