import * as es from 'estree'

import createContext from '../createContext'
import Closure from '../interpreter/closure'
import { Context, Environment } from '../types'

export function mockContext(chapter = 1): Context {
  return createContext(chapter)
}

export function mockRuntimeContext(): Context {
  const context = createContext()
  context.runtime = {
    break: false,
    debuggerOn: true,
    isRunning: true,
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
