import { posix as posixPath } from 'path'

import { memoizedGetModuleManifestAsync } from '../loader'
import { isSourceModule } from '../utils'

/**
 * Options for resolving modules given a path
 */
export type ImportResolutionOptions = {
  /**
   * If `null`, the resolver will only match exact files
   * Otherwise, the resolver will first try to match an exact path,
   * then paths ending with the given extensions
   *
   * For the given path: `./a`, `null` will only match `./a`
   * Otherwise, providing an array like :`['js', 'ts']` will try
   * match `./a`, `./a.js` and then `./a.ts`
   */
  extensions: string[] | null
}

export const defaultResolutionOptions: ImportResolutionOptions = {
  extensions: ['js']
}

/**
 * Resolve a relative module path to an absolute path.
 *
 * @returns A tuple of `[string, boolean]`. The string value
 * represents the absolute path the relative path resolved to. The boolean
 * value indicates if the file at the absolute path exists.
 */
export default async function resolveFile(
  fromPath: string,
  toPath: string,
  filePredicate: (str: string) => Promise<boolean>,
  options: Partial<ImportResolutionOptions> = defaultResolutionOptions
): Promise<[string, boolean]> {
  if (isSourceModule(toPath)) {
    const manifest = await memoizedGetModuleManifestAsync()
    if (toPath in manifest) return [toPath, true]
    return [toPath, false]
  }

  const absPath = posixPath.resolve(fromPath, '..', toPath)

  if (await filePredicate(absPath)) {
    return [absPath, true]
  }

  if (options.extensions) {
    for (const ext of options.extensions) {
      if (await filePredicate(`${absPath}.${ext}`)) {
        return [`${absPath}.${ext}`, true]
      }
    }
  }

  return [absPath, false]
}
