import { memoizedGetModuleManifestAsync } from '../loader/loaders'
import type { AbsolutePath, FileGetter } from '../moduleTypes'
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
      code: string
    }
  | {
      type: 'source'
      path: string
    }
  | undefined

/**
 * Gets the absolute path referred to by `toPath` relative to `fromModule`.
 *
 */
export default async function resolveFile(
  fromPath: string,
  toPath: string,
  getter: FileGetter,
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

  let code = await getter(absPath)
  if (code !== undefined) {
    return {
      type: 'local',
      path: absPath,
      code
    }
  }

  if (options.extensions) {
    for (const ext of options.extensions) {
      code = await getter(`${absPath}.${ext}`)
      if (code !== undefined) {
        return {
          type: 'local',
          path: `${absPath}.${ext}`,
          code
        }
      }
    }
  }

  return undefined
}
