import * as es from 'estree'

import createContext, { EnvTree } from '../createContext'
import Closure from '../interpreter/closure'
import { createBlockEnvironment } from '../interpreter/interpreter'
import { Context, Environment, Frame, Variant } from '../types'

export function mockContext(chapter = 1, variant: Variant = 'default'): Context {
  return createContext(chapter, variant)
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
    ]
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
