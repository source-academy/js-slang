// @ts-check

import { promises as fsPromises, createWriteStream } from 'fs'
import { join, extname } from 'path'
import { parse } from 'acorn'
import createContext from '../dist/createContext.js'
import { ACORN_PARSE_OPTIONS } from '../dist/constants.js'
import { Chapter } from '../dist/types.js'

async function recursiveDirCopy(srcPath, dstPath) {
  // Copy and keep only necessary files
  const files = await fsPromises.readdir(srcPath)

  return Promise.all(files.map(async fileName => {
    const fullSrcPath = join(srcPath, fileName)
    const fullDstPath = join(dstPath, fileName)
    
    const stats = await fsPromises.stat(fullSrcPath)

    if (stats.isFile()) {
      const extension = extname(fileName)
      if (extension !== '.js') return;
      await fsPromises.copyFile(fullSrcPath, fullDstPath)
    } else if (stats.isDirectory()) {
      await fsPromises.mkdir(fullDstPath)
      await recursiveDirCopy(fullSrcPath, fullDstPath)
    }
  }))
}

async function prepare() {
  await fsPromises.rm('sicp_publish/dist', { recursive: true, force: true })
  await fsPromises.mkdir('sicp_publish/dist', { recursive: true })
  await recursiveDirCopy('dist', 'sicp_publish/dist')

  // Remove unnecessary dependencies
  await Promise.all([
    'finder.js', 'index.js', 'scope-refactoring.js'
  ].map(fileName => fsPromises.rm(`sicp_publish/dist/${fileName}`)))
}

function main() {
  const writeStream = createWriteStream('sicp_publish/dist/sicp.js', {
    encoding: 'utf-8',
    flags: 'w'
  })
  writeStream.write('"use strict";\n')
  writeStream.write('Object.defineProperty(exports, "__esModule", { value: true });\n')
  writeStream.write('const createContext_1 = require("./createContext");\n')
  writeStream.write('const dict = createContext_1.default(4).nativeStorage.builtins;')
  writeStream.write('\n// Declare functions for prelude\n')

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

    writeStream.write('\n // Export prelude functions\n')
    for (const func of prelude.body) {
      if (func.type !== 'FunctionDeclaration') {
        throw new Error(`Expected FunctionDeclarations, got '${func.type}' instead`)
      }

      const funcName = func.id.name;
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
