import type * as es from '../types'
import * as utils from '../astUtils'
import * as create from '../astCreator'

const dummyFunc = create.functionDeclaration(
  create.identifier('test'),
  [],
  create.blockStatement([])
)
const dummyClass = create.classDeclaration(create.identifier('test'), [])

describe('processExportDefaultDeclaration', () => {
  function runFunc(node: es.Expression | es.FunctionDeclaration | es.ClassDeclaration) {
    const decl = create.exportDefaultDeclaration(node)
    return utils.processExportDefaultDeclaration(decl, {
      FunctionDeclaration: n => n.id.name,
      ClassDeclaration: n => n.id.name,
      Expression: n => n.type
    })
  }

  it('works with function declarations with IDs', () => expect(runFunc(dummyFunc)).toEqual('test'))

  it('works with class declarations with IDs', () => expect(runFunc(dummyClass)).toEqual('test'))

  it('works with function declarations without IDs', () =>
    expect(
      runFunc({
        type: 'FunctionDeclaration',
        id: null,
        body: {
          type: 'BlockStatement',
          body: []
        },
        params: []
      })
    ).toEqual('FunctionExpression'))

  it('works with class declarations without IDs', () =>
    expect(
      runFunc({
        type: 'ClassDeclaration',
        id: null,
        body: {
          type: 'ClassBody',
          body: []
        }
      })
    ).toEqual('ClassExpression'))

  it('works with expressions', () => expect(runFunc(create.literal(1))).toEqual('Literal'))
})

describe('processExportNamedDeclaration', () => {
  function runFunc(expected: string | null, source?: string): void
  function runFunc(
    expected: string,
    decl: es.VariableDeclaration | es.FunctionDeclaration | es.ClassDeclaration
  ): void
  function runFunc(
    expected: string | null,
    decl?: string | es.VariableDeclaration | es.FunctionDeclaration | es.ClassDeclaration
  ): void {
    let node: es.ExportNamedDeclaration
    if (!decl) {
      node = {
        type: 'ExportNamedDeclaration',
        source: null,
        specifiers: []
      }
    } else if (typeof decl === 'string') {
      node = {
        type: 'ExportNamedDeclaration',
        source: create.literal(decl),
        specifiers: []
      }
    } else {
      node = {
        type: 'ExportNamedDeclaration',
        declaration: decl,
        source: null,
        specifiers: []
      }
    }

    expect(
      utils.processExportNamedDeclaration<string | null>(node, {
        withClass: ({ id: { name } }) => name,
        withFunction: ({ id: { name } }) => name,
        withVarDecl: ({ declarations: [{ id }] }) => (id as es.Identifier).name,
        withSource: ({ source: { value } }) => value as string,
        localExports: () => null
      })
    ).toEqual(expected)
  }

  it('works with function declarations', () => runFunc('test', dummyFunc))
  it('works with class declarations', () => runFunc('test', dummyClass))
  it('works with variable declarations', () =>
    runFunc('test', create.constantDeclaration('test', create.literal(1))))
  it('works with sources', () => runFunc('test', 'test'))
  it('works with local exports', () => runFunc(null))
})
