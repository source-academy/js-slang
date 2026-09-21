export enum Chapter {
  SOURCE_1 = 1,
  SOURCE_2 = 2,
  SOURCE_3 = 3,
  SOURCE_4 = 4,
  FULL_JS = -1,
  HTML = -2,
  FULL_C = -14,
  FULL_JAVA = -15,
  LIBRARY_PARSER = 100,
}

export type ChapterStrings = keyof typeof Chapter;

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

// Only the default variant remains. The typed, wasm and explicit-control variants were dropped
// with their engines (the type checker, src/vm, and the explicit-control dispatch) when js-slang
// became a Conductor-only runner — see the tracking issue for what was kept and why. Conductor
// evaluators for them are filed as #2053, #2054 and #2055; until those exist, the variants are
// deliberately unsupported rather than half-present.
export const { languages: sourceLanguages, typeguard: isSupportedLanguageCombo } = defineLanguages([
  { chapter: Chapter.SOURCE_1, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_2, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_3, variant: Variant.DEFAULT },
  { chapter: Chapter.SOURCE_4, variant: Variant.DEFAULT },
]);

export type SourceLanguages = (typeof sourceLanguages)[number];
