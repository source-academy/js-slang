import type es from 'estree'

import createContext, { EnvTree } from '../../createContext'
import Closure from '../../cse-machine/closure'
import { Transformers } from '../../cse-machine/interpreter'
import { createBlockEnvironment } from '../../cse-machine/utils'
import { Chapter, type LanguageOptions, Variant } from '../../langs'
import type { Context, Environment } from '../../types'

export function mockContext(
  chapter: Chapter = Chapter.SOURCE_1,
  variant: Variant = Variant.DEFAULT,
  languageOptions: LanguageOptions = {}
): Context {
  return createContext(chapter, variant, languageOptions)
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
    changepointSteps: [],
    streamsPointSteps: []
  }
  return context
}

export function mockClosure(): Closure {
  const context = createContext()
  return new Closure(
    {
      type: 'ArrowFunctionExpression',
      expression: true,
      loc: null,
      params: [],
      body: {
        type: 'BlockStatement',
        body: []
      }
    } as es.ArrowFunctionExpression,
    mockEnvironment(context),
    mockTransformers(),
    context
  )
}

export function mockEnvironment(context: Context, name = 'blockEnvironment'): Environment {
  return createBlockEnvironment(context, name)
}

export function mockTransformers(): any {
  return new Transformers()
}
