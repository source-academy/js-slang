import * as _ from 'lodash'

import type { RecursivePartial } from '../types'
import type { ImportOptions } from './moduleTypes'
import { defaultAnalysisOptions } from './preprocessor/analyzer'

export function mergeImportOptions(src?: RecursivePartial<ImportOptions>): ImportOptions {
  const baseOptions = _.cloneDeep(defaultAnalysisOptions)
  return _.merge(baseOptions, src as any)
}

/**
 * Checks if the given string refers to a Source module instead of a local module
 */
export const isSourceModule = (path: string) => !path.startsWith('.') && !path.startsWith('/')
