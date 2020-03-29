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

function checkLiteralAnnotation(literal: TypeVariableAnnotatedNode<es.Literal>) {
  expect(literal.typeVariableId).not.toBe(undefined)
}

function checkFunctionDeclarationAnnotation(
  functionDeclaration: TypeVariableAnnotatedNode<es.FunctionDeclaration>
) {
  const params: TypeVariableAnnotatedNode<es.Pattern>[] = functionDeclaration.params
  params.forEach(param => {
    expect(param.typeVariableId).not.toBe(undefined)
    expect(param.isPolymorphic).toBe(true)
  })

  // TODO figure out what to do with the function body.
  const result: TypeVariableAnnotatedNode<es.BlockStatement> = functionDeclaration.body
  expect(result.typeVariableId).not.toBe(undefined)
}

function checkFunctionDefinitionAnnotation(
  functionDefinition: TypeVariableAnnotatedNode<es.ArrowFunctionExpression>
) {
  const params: TypeVariableAnnotatedNode<es.Pattern>[] = functionDefinition.params
  params.forEach(param => {
    expect(param.typeVariableId).not.toBe(undefined)
    expect(param.isPolymorphic).toBe(true)
  })

  // TODO figure out what to do with the function body.
  const result: TypeVariableAnnotatedNode<es.Node> = functionDefinition.body
  expect(result.typeVariableId).not.toBe(undefined)
}

function checkFunctionApplicationAnnotation(
  functionApplication: TypeVariableAnnotatedNode<es.CallExpression>
) {
  functionApplication.arguments.forEach((argument: TypeVariableAnnotatedNode<es.Expression>) => {
    expect(argument.typeVariableId).not.toBe(undefined)
    expect(argument.isPolymorphic).toBe(true)
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
