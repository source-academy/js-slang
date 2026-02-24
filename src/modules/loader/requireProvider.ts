import * as jsslang from '../..'
import * as interpreter from '../../cse-machine/interpreter'
import * as parser from '../../parser/parser'
import * as stdlib from '../../stdlib'
import type { Context } from '../../types'
import * as types from '../../types'
import * as assert from '../../utils/assert'
import * as stringify from '../../utils/stringify'
import * as errorBase from '../../errors/base'
import * as errors from '../../errors/errors'

/**
 * Returns a function that simulates the job of Node's `require`. The require
 * provider is then used by Source modules to access the context and js-slang standard
 * library
 */
export const getRequireProvider = (context: Context) => (x: string) => {
  const pathSegments = x.split('/')

  const recurser = (obj: Record<string, any>, segments: string[]): any => {
    if (segments.length === 0) return obj
    const currObj = obj[segments[0]]
    if (currObj !== undefined) return recurser(currObj, segments.splice(1))
    throw new Error(`Dynamic require of ${x} is not supported`)
  }

  const exports = {
    'js-slang': {
      ...jsslang,
      dist: {
        'cse-machine': {
          interpreter
        },
        errors: {
          base: errorBase,
          errors
        },
        parser: {
          parser
        },
        stdlib,
        types,
        utils: {
          assert,
          stringify
        }
      },
      context
    }
  }

  return recurser(exports, pathSegments)
}

export type RequireProvider = ReturnType<typeof getRequireProvider>
