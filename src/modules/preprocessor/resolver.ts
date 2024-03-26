import { memoizedGetModuleManifestAsync } from '../loader'
import { isSourceModule } from '../utils'
import { resolve, type AbsolutePosixPath, type PosixPath } from '../paths'
import type { FileGetter } from '../moduleTypes'

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

export type ResolverResult =
  | {
      type: 'source'
    }
  | {
      type: 'local'
      absPath: AbsolutePosixPath
      contents: string
    }

/**
 * Resolve a relative module path to an absolute path.
 *
 * @returns A tuple of `[string, boolean]`. The string value
 * represents the absolute path the relative path resolved to. The boolean
 * value indicates if the file at the absolute path exists.
 */
export default async function resolveFile(
  fromPath: PosixPath,
  toPath: PosixPath,
  fileGetter: FileGetter,
  options: Partial<ImportResolutionOptions> = defaultResolutionOptions
): Promise<ResolverResult | undefined> {
  if (isSourceModule(toPath)) {
    const manifest = await memoizedGetModuleManifestAsync()
    return toPath in manifest ? { type: 'source' } : undefined
  }

  const absPath = resolve(fromPath, '..', toPath)
  let contents: string | undefined = await fileGetter(absPath)

  if (contents !== undefined) {
    return {
      type: 'local',
      absPath: absPath,
      contents
    }
  }

  if (options.extensions) {
    for (const ext of options.extensions) {
      const extPath = `${absPath}.${ext}` as AbsolutePosixPath
      contents = await fileGetter(extPath)

      if (contents !== undefined) {
        return {
          type: 'local',
          absPath: extPath,
          contents
        }
      }
    }
  }

  return undefined
}
