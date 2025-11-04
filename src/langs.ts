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

export enum Variant {
  DEFAULT = 'default',
  TYPED = 'typed',
  NATIVE = 'native',
  WASM = 'wasm',
  EXPLICIT_CONTROL = 'explicit-control'
}

export type LanguageOptions = Record<string, string>

export interface Language {
  chapter: Chapter
  variant: Variant
  languageOptions?: LanguageOptions
}

function defineLanguages<T extends Language[]>(languages: T) {
  return {
    languages,
    typeguard: (lang: Language): lang is T[number] => {
      return languages.some(
        ({ chapter, variant }) => lang.chapter === chapter && lang.variant === variant
      )
    }
  }
}

export const { languages: sourceLanguages, typeguard: isSourceLanguage } = defineLanguages([
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

export type SourceLanguages = (typeof sourceLanguages)[number]

export const { languages: scmLanguages, typeguard: isSchemeLanguage } = defineLanguages([
  { chapter: Chapter.SCHEME_1, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_2, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_3, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.SCHEME_4, variant: Variant.EXPLICIT_CONTROL },
  { chapter: Chapter.FULL_SCHEME, variant: Variant.EXPLICIT_CONTROL }
])

export type SchemeLanguages = (typeof scmLanguages)[number]

export const { languages: pyLanguages, typeguard: isPythonLanguage } = defineLanguages([
  { chapter: Chapter.PYTHON_1, variant: Variant.DEFAULT }
])

export type PythonLanguages = (typeof pyLanguages)[number]

export function isSupportedLanguageCombo(lang: Language) {
  return isSourceLanguage(lang) || isPythonLanguage(lang) || isSchemeLanguage(lang)
}
