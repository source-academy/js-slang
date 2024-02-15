import { posix as pathlib } from 'path/posix'

import { AbsolutePath } from './moduleTypes'

/**
 * Checks if the given string refers to a Source module instead of a local module
 */
export const isSourceModule = (path: string) => !path.startsWith('.') && !path.startsWith('/')
export const resolvePath = pathlib.resolve as (...p: string[]) => AbsolutePath
export const isAbsolutePath = pathlib.isAbsolute as (p: string) => p is AbsolutePath
