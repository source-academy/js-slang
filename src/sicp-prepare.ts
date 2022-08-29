import { parse } from 'acorn'
import { FunctionDeclaration, Program } from 'estree'
import * as fs from 'fs'

import { default as createContext } from './createContext'
import { Chapter } from './types'

const context = createContext(Chapter.SOURCE_4)

// Generate names.txt
const a = context.nativeStorage.builtins.keys()

const names_file = fs.createWriteStream('sicp_publish/names.txt')

names_file.on('error', function (e: Error) {
  console.log(e)
})

for (const name of a) {
  names_file.write(name + '\n')
}

names_file.end()

// Generate prelude.txt
const prelude_file = fs.createWriteStream('sicp_publish/prelude.txt')

prelude_file.on('error', function (e: Error) {
  console.log(e)
})

prelude_file.write(context.prelude)

prelude_file.end()

// Generate prelude_names.txt
const b = parse(context.prelude || '', { ecmaVersion: 2020 }) as unknown as Program

const prelude_names = fs.createWriteStream('sicp_publish/prelude_names.txt')

prelude_names.on('error', function (e: Error) {
  console.log(e)
})

b.body
  .map(node => (node as FunctionDeclaration).id?.name)
  .map(name => prelude_names.write(name + '\n'))

prelude_names.end()
