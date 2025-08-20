export enum Variant {
  DEFAULT = 'default',
  TYPED = 'typed',
  NATIVE = 'native',
  WASM = 'wasm',
  EXPLICIT_CONTROL = 'explicit-control'
}

export enum Chapter {
  SOURCE_1 = 1,
  SOURCE_2 = 2,
  SOURCE_3 = 3,
  SOURCE_4 = 4,
  FULL_JS = -1,
  HTML = -2,
  FULL_TS = -3,
  PYTHON_1 = -4,
  PYTHON_2 = -5,
  PYTHON_3 = -6,
  PYTHON_4 = -7,
  FULL_PYTHON = -8,
  SCHEME_1 = -9,
  SCHEME_2 = -10,
  SCHEME_3 = -11,
  SCHEME_4 = -12,
  FULL_SCHEME = -13,
  FULL_C = -14,
  FULL_JAVA = -15,
  LIBRARY_PARSER = 100
}

interface LanguageCombo {
  chapter: Chapter
  variant: Variant
  languageOptions?: LanguageOptions
}

export type LanguageOptions = Record<string, string>

/**
 * Helper to make defining languages type-safe
 */
function defineLanguages<T extends LanguageCombo[]>(langs: T) {
  function typeguard(lang: LanguageCombo): lang is T[number] {
    const { chapter, variant } = lang

    for (const lang of sourceLanguages) {
      if (lang.chapter === chapter && lang.variant === variant) return true
    }

    return false
  }

  return { langs, typeguard }
}

export const { langs: sourceLanguages, typeguard: isSourceLanguage } = defineLanguages([
  { chapter: Chapter.SOURCE_1, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_1, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_1, variant: Variant.WASM },
  { chapter: Chapter.SOURCE_2, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_2, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_3, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_3, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_4, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_4, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL }
])
export type SourceLanguage = (typeof sourceLanguages)[number]

export const { langs: scmLanguages, typeguard: isSchemeLanguage } = defineLanguages([
  { chapter: Chapter.SCHEME_1, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_2, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_3, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_4, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }
])
export type SchemeLanguage = (typeof scmLanguages)[number]

export const { langs: pyLanguages, typeguard: isPythonLanguage } = defineLanguages([
  { chapter: Chapter.PYTHON_1, variant: Variant.DEFAULT }
])
export type PythonLanguage = (typeof pyLanguages)[number]

export type Language = SourceLanguage | SchemeLanguage | PythonLanguage

/**
 * Returns true iff the given chapter and variant combination is supported.
 */
export function isValidChapterVariant(language: LanguageCombo): language is Language {
  return isSourceLanguage(language) || isSchemeLanguage(language) || isPythonLanguage(language)
}
