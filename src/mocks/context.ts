import type es from 'estree'

import createContext, { EnvTree } from '../createContext'
import { createBlockEnvironment } from '../cse-machine/utils'
import Closure from '../cse-machine/closure'
import { Chapter, type Context, type Environment, Variant } from '../types'

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
    objectCount: 0,
    envStepsTotal: 0,
    breakpointSteps: [],
    changepointSteps: []
  }
  return context
}

export function mockClosure(): Closure {
  const context = mockContext()

  return new Closure(
    {
      type: 'ArrowFunctionExpression',
      loc: null,
      params: [],
      expression: false,
      body: {
        type: 'BlockStatement',
        body: []
      }
    },
    mockEnvironment(context),
    context
  )
}

export function mockEnvironment(context: Context, name = 'blockEnvironment'): Environment {
  return createBlockEnvironment(context, name)
}
