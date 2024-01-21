import * as es from 'estree'

import createContext, { EnvTree } from '../createContext'
import Closure from '../interpreter/closure'
import { createBlockEnvironment } from '../interpreter/interpreter'
import { Chapter, Context, Environment, Frame, Variant } from '../types'

export function mockContext(
  chapter: Chapter = Chapter.SOURCE_1,
  variant: Variant = Variant.DEFAULT
): Context {
  return createContext(chapter, variant)
}

export function mockImportDeclaration(): es.ImportDeclaration {
  const mockImportDecl: es.ImportDeclaration = {
    type: 'ImportDeclaration',
    specifiers: [
      {
        type: 'ImportDefaultSpecifier',
        local: {
          type: 'Identifier',
          name: 'MockName'
        }
      }
    ],
    source: {
      type: 'Literal',
      value: 'mock-path',
      raw: "'mock-path'"
    }
  }
  return mockImportDecl
}

export function mockRuntimeContext(): Context {
  const context = createContext()
  context.runtime = {
    break: false,
    debuggerOn: true,
    isRunning: true,
    environmentTree: new EnvTree(),
    environments: [],
    nodes: [
      {
        type: 'Literal',
        loc: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 }
        },
        value: 0,
        raw: '0',
        range: [0, 1]
      }
    ],
    control: null,
    stash: null,
    envStepsTotal: 0,
    breakpointSteps: []
  }
  return context
}

export function mockClosure(): Closure {
  return new Closure(
    {
      type: 'FunctionExpression',
      loc: null,
      id: null,
      params: [],
      body: {
        type: 'BlockStatement',
        body: []
      }
    } as es.FunctionExpression,
    {} as Environment,
    {} as Context
  )
}

export function mockEnvironment(
  context: Context,
  name = 'blockEnvironment',
  head: Frame = {}
): Environment {
  return createBlockEnvironment(context, name, head)
}
