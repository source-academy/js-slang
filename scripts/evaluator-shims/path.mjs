// Browser `path` shim for the evaluator bundle. The rollup node polyfill's `path` does not expose
// the `posix` named export that js-slang imports (`import { posix } from 'path'`), so we wrap
// path-browserify and provide `posix`/`win32` ourselves.
import pathBrowserify from 'path-browserify';

const path = pathBrowserify.default ?? pathBrowserify;

export default path;
export const posix = path.posix ?? path;
export const win32 = path.win32 ?? path;
export const {
  basename,
  delimiter,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
  sep,
} = path;
