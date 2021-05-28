import { dict, default as createContext } from './createContext'
import * as fs from 'fs'

createContext(4)

let a = Object.getOwnPropertyNames(dict)

let file = fs.createWriteStream('sicp_publish/names.txt')

file.on('error', function (e: Error) {
  console.log(e)
})

a.forEach(function (v) {
  file.write(v + '\n')
})

file.end()
