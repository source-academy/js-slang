import { Option } from '@commander-js/extra-typings'

import { pyLanguages, scmLanguages, sourceLanguages } from '../constants'
import { Chapter, type Language, Variant, type Result } from '../types'
import { stringify } from '../utils/stringify'
import Closure from '../cse-machine/closure'
import { parseError, type Context } from '..'
import { objectKeys } from '../utils/misc'

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
    return Chapter[foundChapter]
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

export function validateChapterAndVariantCombo(language: Language) {
  for (const { chapter, variant } of sourceLanguages) {
    if (language.chapter === chapter && language.variant === variant) return true
  }
  return false
}

/**
 * Returns true iff the given chapter and variant combination is supported.
 */
export function validChapterVariant(language: Language) {
  const { chapter, variant } = language

  for (const lang of sourceLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }
  for (const lang of scmLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }
  for (const lang of pyLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }

  return false
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
