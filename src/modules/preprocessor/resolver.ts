import { posix as posixPath } from 'path'
import { memoizedGetModuleManifestAsync } from '../loader'
import { isSourceModule } from '../utils'
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
      absPath: string
      contents: string
    }

/**
 * Resolve a relative module path to an absolute path.
 */
export default async function resolveFile(
  fromPath: string,
  toPath: string,
  fileGetter: FileGetter,
  options: Partial<ImportResolutionOptions> = defaultResolutionOptions
): Promise<ResolverResult | undefined> {
  if (isSourceModule(toPath)) {
    const manifest = await memoizedGetModuleManifestAsync()
    return toPath in manifest ? { type: 'source' } : undefined
  }

  const absPath = posixPath.resolve(fromPath, '..', toPath)
  let contents: string | undefined = await fileGetter(absPath)

  if (contents !== undefined) {
    return {
      type: 'local',
      absPath,
      contents
    }
  }

  if (options.extensions) {
    for (const ext of options.extensions) {
      const extPath = `${absPath}.${ext}`
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
