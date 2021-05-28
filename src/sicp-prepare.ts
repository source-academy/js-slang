import { dict, default as createContext } from './createContext'
import * as fs from 'fs'

createContext(4)

const a = Object.getOwnPropertyNames(dict)

const file = fs.createWriteStream('sicp_publish/names.txt')

file.on('error', function (e: Error) {
  console.log(e)
})

a.forEach(function (v) {
  file.write(v + '\n')
})

file.end()
