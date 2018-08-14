# Compile all .ts files, then
# copy the only .js file, parser.js, to dist.
# This is required because it is not possible to both inlcude .js
# files (allowJs = true) and export type declarations (declarations = true) 
# in tsconfig. See https://github.com/Microsoft/TypeScript/issues/7546
tsc && cp src/stdlib/parser.js dist/stdlib
