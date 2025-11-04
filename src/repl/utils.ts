import { Option } from '@commander-js/extra-typings'

import { stringify } from '../utils/stringify'
import Closure from '../cse-machine/closure'
import { parseError } from '..'
import type { Context, Result } from '../types'
import { objectKeys } from '../utils/misc'
import { Chapter, LanguageOptions, Variant } from '../langs'

export function chapterParser(str: string): Chapter {
  let foundChapter: string | undefined

  if (/^-?[0-9]+$/.test(str)) {
    // Chapter is fully numeric
    const value = parseInt(str)
    foundChapter = objectKeys(Chapter).find(chapterName => Chapter[chapterName] === value)

    if (foundChapter === undefined) {
      throw new Error(`Invalid chapter value: ${str}`)
    }
  } else {
    foundChapter = str
  }

  if (foundChapter in Chapter) {
    return Chapter[foundChapter as keyof typeof Chapter]
  }
  throw new Error(`Invalid chapter value: ${str}`)
}

export const getChapterOption = <T extends Chapter>(
  defaultValue: T,
  argParser: (value: string) => T
) => {
  return new Option('--chapter <chapter>').default(defaultValue).argParser(argParser)
}

export const getVariantOption = <T extends Variant>(defaultValue: T, choices: T[]) => {
  return new Option('--variant <variant>').default(defaultValue).choices(choices)
}

export const getLanguageOption = <T extends LanguageOptions>() => {
  return new Option('--languageOptions <options>')
    .default({})
    .argParser((value: string): LanguageOptions => {
      const languageOptions = value.split(',').map(lang => {
        const [key, value] = lang.split('=')
        return { [key]: value }
      })
      return Object.assign({}, ...languageOptions)
    })
}

export function handleResult(result: Result, context: Context, verboseErrors: boolean) {
  if (result.status === 'finished') {
    if (result.representation !== undefined) {
      return result.representation
    }

    if (result.value instanceof Closure || typeof result.value === 'function') {
      return result.value.toString()
    }

    return stringify(result.value)
  }

  return `Error: ${parseError(context.errors, verboseErrors)}`
}
