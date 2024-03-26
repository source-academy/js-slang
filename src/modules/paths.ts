import pathlib, { posix as posixPath } from 'path'

export type PosixPath = string
export type AbsolutePosixPath = `/${PosixPath}`

export function isAbsolute(p: PosixPath): p is AbsolutePosixPath {
  return posixPath.isAbsolute(p)
}

export function toPosixPath(p: string): PosixPath {
  return p.split(pathlib.sep).join(posixPath.sep)
}

export function resolve(...args: PosixPath[]): AbsolutePosixPath {
  return posixPath.resolve(...args) as AbsolutePosixPath
}
