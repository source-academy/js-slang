import { dict, default as createContext } from './createContext'
import * as fs from 'fs'

const context = createContext(4);

const a = Object.getOwnPropertyNames(dict)

const names_file = fs.createWriteStream('sicp_publish/names.txt')

names_file.on('error', function (e: Error) {
  console.log(e)
})

a.forEach(function (v) {
  names_file.write(v + '\n')
})

names_file.end()


const prelude_file = fs.createWriteStream('sicp_publish/prelude.txt')

prelude_file.on('error', function (e: Error) {
  console.log(e)
})

prelude_file.write(context.prelude);

prelude_file.end()