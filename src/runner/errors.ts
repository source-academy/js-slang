import { NullableMappedPosition, RawSourceMap, SourceMapConsumer } from 'source-map'

import { UNKNOWN_LOCATION } from '../constants'
import { ConstAssignment, ExceptionError, UndefinedVariable } from '../errors/errors'
import { SourceError } from '../types'
import { locationDummyNode } from '../utils/astCreator'

enum BrowserType {
  Chrome = 'Chrome',
  FireFox = 'FireFox',
  Unsupported = 'Unsupported'
}

interface EvalErrorLocator {
  regex: RegExp
  browser: BrowserType
}

const ChromeEvalErrorLocator = {
  regex: /eval at.+<anonymous>:(\d+):(\d+)/gm,
  browser: BrowserType.Chrome
}

const FireFoxEvalErrorLocator = {
  regex: /eval:(\d+):(\d+)/gm,
  browser: BrowserType.FireFox
}

const EVAL_LOCATORS: EvalErrorLocator[] = [ChromeEvalErrorLocator, FireFoxEvalErrorLocator]

const UNDEFINED_VARIABLE_MESSAGES: string[] = ['is not defined']

// brute-forced from MDN website for phrasing of errors from different browsers
// FWIW node and chrome uses V8 so they'll have the same error messages
// unable to test on other engines
const ASSIGNMENT_TO_CONST_ERROR_MESSAGES: string[] = [
  'invalid assignment to const',
  'Assignment to constant variable',
  'Assignment to const',
  'Redeclaration of const'
]

function getBrowserType(): BrowserType {
  const userAgent: string = navigator.userAgent.toLowerCase()
  return userAgent.indexOf('chrome') > -1
    ? BrowserType.Chrome
    : userAgent.indexOf('firefox') > -1
    ? BrowserType.FireFox
    : BrowserType.Unsupported
}

function extractErrorLocation(
  errorStack: string,
  lineOffset: number,
  errorLocator: EvalErrorLocator
): { line: number; column: number } | undefined {
  const evalErrors = Array.from(errorStack.matchAll(errorLocator.regex))
  if (evalErrors.length) {
    const baseEvalError = evalErrors[0]
    const [lineNumStr, colNumStr] = baseEvalError.slice(1, 3)
    return { line: parseInt(lineNumStr) - lineOffset, column: parseInt(colNumStr) }
  }

  return undefined
}

function getErrorLocation(
  error: Error,
  lineOffset: number = 0
): { line: number; column: number } | undefined {
  const browser: BrowserType = getBrowserType()
  const errorLocator: EvalErrorLocator | undefined = EVAL_LOCATORS.find(
    locator => locator.browser === browser
  )
  const errorStack: string | undefined = error.stack!

  if (errorStack && errorLocator) {
    return extractErrorLocation(errorStack, lineOffset, errorLocator)
  } else if (errorStack) {
    // if browser is unsupported try all supported locators until the first success
    return EVAL_LOCATORS.map(locator => extractErrorLocation(errorStack, lineOffset, locator)).find(
      x => x !== undefined
    )
  }

  return undefined
}

/**
 * Converts native errors to SourceError
 *
 * @param error
 * @param sourceMap
 * @returns
 */
export async function toSourceError(error: Error, sourceMap?: RawSourceMap): Promise<SourceError> {
  const errorLocation: { line: number; column: number } | undefined = getErrorLocation(error)
  if (!errorLocation) {
    return new ExceptionError(error, UNKNOWN_LOCATION)
  }

  let { line, column } = errorLocation
  let identifier: string = 'UNKNOWN'

  if (sourceMap && !(line === -1 || column === -1)) {
    // Get original lines, column and identifier
    const originalPosition: NullableMappedPosition = await SourceMapConsumer.with(
      sourceMap,
      null,
      consumer => consumer.originalPositionFor({ line, column })
    )
    line = originalPosition.line ?? -1 // use -1 in place of null
    column = originalPosition.column ?? -1
    identifier = originalPosition.name ?? identifier
  }

  const errorMessage: string = error.message
  const errorMessageContains = (possibleMessages: string[]) =>
    possibleMessages.some(possibleMessage => errorMessage.includes(possibleMessage))

  if (errorMessageContains(ASSIGNMENT_TO_CONST_ERROR_MESSAGES)) {
    return new ConstAssignment(locationDummyNode(line, column), identifier)
  } else if (errorMessageContains(UNDEFINED_VARIABLE_MESSAGES)) {
    return new UndefinedVariable(identifier, locationDummyNode(line, column))
  } else {
    const location =
      line === -1 || column === -1
        ? UNKNOWN_LOCATION
        : {
            start: { line, column },
            end: { line: -1, column: -1 }
          }
    return new ExceptionError(error, location)
  }
}
