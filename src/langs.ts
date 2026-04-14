export enum Chapter {
  SOURCE_1 = 1,
  SOURCE_2 = 2,
  SOURCE_3 = 3,
  SOURCE_4 = 4,
  FULL_JS = -1,
  HTML = -2,
  FULL_TS = -3,
  FULL_C = -14,
  FULL_JAVA = -15,
  LIBRARY_PARSER = 100,
}

export enum Variant {
  DEFAULT = 'default',
  TYPED = 'typed',
  NATIVE = 'native',
  WASM = 'wasm',
  EXPLICIT_CONTROL = 'explicit-control',
}

export type LanguageOptions = Record<string, string>;

export interface Language {
  chapter: Chapter;
  variant: Variant;
  languageOptions?: LanguageOptions;
}

function defineLanguages<T extends Language[]>(languages: T) {
  return {
    languages,
    typeguard: (lang: Language): lang is T[number] => {
      return languages.some(
        ({ chapter, variant }) => lang.chapter === chapter && lang.variant === variant,
      );
    },
  };
}

export const { languages: sourceLanguages, typeguard: isSupportedLangaugeCombo } = defineLanguages([
  { chapter: Chapter.SOURCE_1, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_1, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_1, variant: Variant.WASM },
  { chapter: Chapter.SOURCE_2, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_2, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_3, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_3, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_4, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_4, variant: Variant.TYPED },
  { chapter: Chapter.SOURCE_4, variant: Variant.EXPLICIT_CONTROL },
]);

export type SourceLanguages = (typeof sourceLanguages)[number];
