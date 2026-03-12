import * as _ from 'lodash'

import type { RecursivePartial } from '../types'
import type { ModuleContext, ImportOptions } from './moduleTypes'
import { defaultAnalysisOptions } from './preprocessor/analyzer'

export function mergeImportOptions(src?: RecursivePartial<ImportOptions>): ImportOptions {
  const baseOptions = _.cloneDeep(defaultAnalysisOptions)
  return _.merge(baseOptions, src as any)
}

/**
 * Checks if the given string refers to a Source module instead of a local module
 */
export const isSourceModule = (path: string) => !path.startsWith('.') && !path.startsWith('/')

/**
 * Creates an empty module contexts object
 */
export const createEmptyModuleContexts = () =>
  new Proxy({} as Record<string, ModuleContext>, {
    get: (obj, prop) => {
      if (typeof prop !== 'string') return undefined

      if (!(prop in obj)) {
        obj[prop] = {
          state: null,
          tabs: null
        }
      }

      return obj[prop]
    }
  })
