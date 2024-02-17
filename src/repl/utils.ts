import { Option } from '@commander-js/extra-typings'
import { Chapter, Variant } from '../types'

export function chapterParser(str: string): Chapter {
  let foundChapter: string | undefined

  if (/^[0-9]$/.test(str)) {
    // Chapter is fully numeric
    const value = parseInt(str)
    foundChapter = Object.keys(Chapter).find(chapterName => Chapter[chapterName] === value)
  } else {
    foundChapter = str
  }

  if (foundChapter === undefined) {
    throw new Error(`Invalid chapter value: ${str}`)
  }

  return Chapter[foundChapter]
}

export const chapterOption = new Option('--chapter <chapter>')
  .default(Chapter.SOURCE_4)
  .argParser(chapterParser)

export const variantOption = new Option('--variant <variant>')
  .default(Variant.DEFAULT)
  .choices(Object.values(Variant))
