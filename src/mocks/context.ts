import { parse } from 'acorn'
import * as es from 'estree'

import { createContext } from '../index'
import { Closure, Context, Frame } from '../types'
import { TypeError } from '../utils/rttc'

export function mockContext(chapter = 1): Context {
  return createContext(chapter)
}

export function mockRuntimeContext(): Context {
  const context = createContext()
  context.runtime = {
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
  return new Closure({} as es.FunctionExpression, {} as Frame, {} as Context)
}

export function mockTypeError(): TypeError {
  return new TypeError(parse('', { sourceType: 'script' }) as es.Node, '', '', '')
}
