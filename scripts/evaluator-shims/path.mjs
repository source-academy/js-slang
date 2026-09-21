// js-slang's module preprocessor uses `posix` path joining only (see
// src/modules/preprocessor/resolver.ts), so path-browserify is a faithful stand-in.
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
