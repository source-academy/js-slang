import fs from 'fs/promises';
import { Option } from '@commander-js/extra-typings';
import { parseError } from '..';
import {
  Chapter,
  isSupportedLanguageCombo,
  Language,
  LanguageOptions,
  SourceLanguages,
  Variant,
} from '../langs';
import type { Context, Result } from '../types';
import { getChapterName, getVariantName, objectKeys } from '../utils/misc';
import { stringify } from '../utils/stringify';
import { GeneralRuntimeError } from '../errors/base';
import type { FileGetter } from '../modules/moduleTypes';

/**
 * Converts a string to the corresponding Source chapter. Throws an error if the string
 * doesn't represent a valid string.
 */
export function chapterParser(str: string): Chapter {
  let foundChapter: string | undefined;

  if (/^-?[0-9]+$/.test(str)) {
    // Chapter is fully numeric
    const value = parseInt(str);
    foundChapter = objectKeys(Chapter).find(chapterName => Chapter[chapterName] === value);

    if (foundChapter === undefined) {
      throw new GeneralRuntimeError(`Invalid chapter value: ${str}`);
    }
  } else {
    foundChapter = str;
  }

  if (foundChapter in Chapter) {
    return Chapter[foundChapter as keyof typeof Chapter];
  }
  throw new GeneralRuntimeError(`Invalid chapter value: ${str}`);
}

/**
 * Returns an {@link Option} for selecting Source chapters.
 */
export function getChapterOption(): Option<
  '--chapter <chapter>',
  undefined,
  Chapter.SOURCE_4,
  undefined,
  false,
  Chapter
>;
export function getChapterOption<T extends Chapter, U extends T>(
  defaultValue: U,
  argParser: (value: string) => T,
): Option<'--chapter <chapter>', undefined, U, undefined, false, T>;
export function getChapterOption(
  defaultValue: Chapter = Chapter.SOURCE_4,
  argParser: (value: string) => Chapter = chapterParser,
) {
  return new Option('--chapter <chapter>').default(defaultValue).argParser(argParser);
}

export function getVariantOption<T extends Variant>(defaultValue: T, choices: T[]) {
  return new Option('--variant <variant>').default(defaultValue).choices(choices);
}

export const getLanguageOption = <T extends LanguageOptions>() => {
  return new Option('--languageOptions <options>')
    .default({})
    .argParser((value: string): LanguageOptions => {
      const languageOptions = value.split(',').map(lang => {
        const [key, value] = lang.split('=');
        return { [key]: value };
      });
      return Object.assign({}, ...languageOptions);
    });
};

export function handleResult(result: Result, context: Context, verboseErrors: boolean): string {
  if (result.status === 'finished') {
    return stringify(result.value);
  }

  return `Error: ${parseError(context.errors, verboseErrors)}`;
}

export function assertLanguageCombo(combo: Language): asserts combo is SourceLanguages {
  if (isSupportedLanguageCombo(combo)) return;

  const chapterName = getChapterName(combo.chapter);
  const variantName = getVariantName(combo.variant);

  throw new GeneralRuntimeError(
    `Invalid language combo: chapter ${chapterName} and variant ${variantName}`,
  );
}

export const nodeFileGetter: FileGetter = async p => {
  try {
    const text = await fs.readFile(p, 'utf-8');
    return text;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
};
