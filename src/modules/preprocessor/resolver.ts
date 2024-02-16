import { memoizedGetModuleManifestAsync } from '../loader/loaders'
import type { AbsolutePath } from '../moduleTypes'
import { isSourceModule, resolvePath } from '../utils'

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
 * Represents the type of module the path resolved to, or `undefined`
 * if the path did not resolve to anything
 */
export type ResolverResult =
  | {
      type: 'local'
      path: AbsolutePath
    }
  | {
      type: 'source'
      path: string
    }
  | undefined

/**
 * Gets the absolute path referred to by `toPath` relative to `fromModule`.
 *
 * @param filePredicate Function that returns a `Promise<boolean>` indicating if the
 * file at the given path exists
 *
 */
export default async function resolveFile(
  fromPath: string,
  toPath: string,
  filePredicate: (str: string) => Promise<boolean>,
  options: Partial<ImportResolutionOptions> = defaultResolutionOptions
): Promise<ResolverResult> {
  if (isSourceModule(toPath)) {
    const manifest = await memoizedGetModuleManifestAsync()
    return toPath in manifest
      ? {
          type: 'source',
          path: toPath
        }
      : undefined
  }

  const absPath = resolvePath(fromPath, '..', toPath)

  if (await filePredicate(absPath)) {
    return {
      type: 'local',
      path: absPath
    }
  }

  if (options.extensions) {
    for (const ext of options.extensions) {
      if (await filePredicate(`${absPath}.${ext}`)) {
        return {
          type: 'local',
          path: `${absPath}.${ext}`
        }
      }
    }
  }

  return undefined
}
