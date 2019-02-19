import * as es from 'estree'

import Closure from '../closure'
import createContext from '../createContext'
import { Context, Frame } from '../types'

export function mockContext(chapter = 1): Context {
  return createContext(chapter)
}

export function mockRuntimeContext(): Context {
  const context = createContext()
  context.runtime = {
    break: false,
    isRunning: true,
    frames: [],
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
    {} as Frame,
    {} as Context
  )
}
