/**
 * A generic mapper for all languages.
 * If required, maps the final result produced by js-slang to
 * the required representation for the language.
 */

import { Context, Result } from ".."
import { Chapter } from "../langs"
import { mapErrorToScheme, mapResultToScheme } from "./scheme/scheme-mapper"

/**
 * A representation of a value in a language.
 * This is used to represent the final value produced by js-slang.
 * It is separate from the actual value of the result.
 */
export class Representation {
  constructor(public representation: string) {}
  toString() {
    return this.representation
  }
}

export function mapResult(context: Context): (x: Result) => Result {
  switch (context.chapter) {
    case Chapter.SCHEME_1:
    case Chapter.SCHEME_2:
    case Chapter.SCHEME_3:
    case Chapter.SCHEME_4:
    case Chapter.FULL_SCHEME:
      return x => {
        if (x.status === 'finished') {
          return mapResultToScheme(x)
        } else if (x.status === "error") {
          context.errors = context.errors.map(mapErrorToScheme)
        }
        return x
      }
    default:
      // normally js-slang.
      // there is no need for a mapper in this case.
      return x => x
  }
}

export const isSchemeLanguage = (context: Context) =>
  context.chapter === Chapter.SCHEME_1 ||
    context.chapter === Chapter.SCHEME_2 ||
    context.chapter === Chapter.SCHEME_3 ||
    context.chapter === Chapter.SCHEME_4 ||
    context.chapter === Chapter.FULL_SCHEME