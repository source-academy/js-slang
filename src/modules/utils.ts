import * as _ from 'lodash'

import { RecursivePartial } from '../types'
import { ImportOptions } from './moduleTypes'
import { defaultAnalysisOptions } from './preprocessor/analyzer'

const exportDefaultStr = 'export default'
export function removeExportDefault(text: string) {
  if (text.startsWith(exportDefaultStr)) {
    text = text.substring(exportDefaultStr.length).trim()
  }

  if (text.endsWith(';')) {
    text = text.slice(0, -1)
  }

  return text
}

export function mergeImportOptions(src?: RecursivePartial<ImportOptions>): ImportOptions {
  const baseOptions = _.cloneDeep(defaultAnalysisOptions)
  return _.merge(baseOptions, src as any)
}

/**
 * Checks if the given string refers to a Source module instead of a local module
 */
export const isSourceModule = (path: string) => !path.startsWith('.') && !path.startsWith('/')
