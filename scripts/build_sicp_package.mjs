// @ts-check

import { createWriteStream, promises as fsPromises } from 'fs'
import { extname, join } from 'path'
import { parse } from 'acorn'
import { ACORN_PARSE_OPTIONS } from '../dist/constants.js'
import createContext from '../dist/createContext.js'
import { Chapter } from '../dist/langs.js'

const SICP_DIR = 'sicp_publish/dist'

/**
 * Copies Javascript files from the given source directory to the given destination
 * directory, maintaining the same directory structure.
 * @param {string} srcPath 
 * @param {string} dstPath 
 */
async function recursiveDirCopy(srcPath, dstPath) {
  // Copy and keep only necessary files
  const files = await fsPromises.readdir(srcPath, { withFileTypes: true })

  return Promise.all(files.map(async each => {
    const fullSrcPath = join(srcPath, each.name)
    const fullDstPath = join(dstPath, each.name)
    
    if (each.isFile()) {
      const extension = extname(each.name)
      if (extension !== '.js') return
      await fsPromises.copyFile(fullSrcPath, fullDstPath)
    } else if (each.isDirectory()) {
      await fsPromises.mkdir(fullDstPath)
      await recursiveDirCopy(fullSrcPath, fullDstPath)
    }
  }))
}

async function prepare() {
  await fsPromises.rm(SICP_DIR, { recursive: true, force: true })
  await fsPromises.mkdir(SICP_DIR, { recursive: true })
  await recursiveDirCopy('dist', SICP_DIR)

  // Remove unnecessary dependencies
  await Promise.all([
    'finder.js', 'index.js', 'scope-refactoring.js'
  ].map(fileName => fsPromises.rm(join(SICP_DIR, fileName))))
}

function main() {
  const writeStream = createWriteStream(`${SICP_DIR}/sicp.js`, {
    encoding: 'utf-8',
    flags: 'w'
  })
  writeStream.write('"use strict";\n')
  writeStream.write('Object.defineProperty(exports, "__esModule", { value: true });\n')
  writeStream.write('const createContext_1 = require("./createContext");\n')
  writeStream.write('const dict = createContext_1.default(4).nativeStorage.builtins;\n')
  writeStream.write('\n// Declare builtins for prelude\n')

  // @ts-expect-error Something to do with weird stuff going on between cjs and esm
  const context = createContext.default(Chapter.SOURCE_4)
  const builtins = context.nativeStorage.builtins

  for (const builtin of builtins.keys()) {
    if (builtin !== 'undefined' && builtin !== 'NaN' && builtin !== 'Infinity') {
      writeStream.write(`const ${builtin} = dict.get("${builtin}");\n`)
    }
  }

  if (context.prelude !== null) {
    writeStream.write('\n// Prelude\n')
    writeStream.write(context.prelude)

    const prelude = parse(context.prelude, ACORN_PARSE_OPTIONS)

    writeStream.write('\n// Export prelude functions\n')
    for (const func of prelude.body) {
      if (func.type !== 'FunctionDeclaration') {
        throw new Error(`Expected FunctionDeclarations, got '${func.type}' instead`)
      }

      const funcName = func.id.name
      writeStream.write(`exports.${funcName} = ${funcName};\n`)
    }
  }

  writeStream.write('\n// Export builtin functions\n')
  for (const builtin of builtins.keys()) {
    if (builtin !== 'undefined' && builtin !== 'NaN' && builtin !== 'Infinity') {
      writeStream.write(`exports.${builtin} = ${builtin};\n`)
    }
  }
}

await prepare().then(main)
