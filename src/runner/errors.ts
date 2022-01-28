import { NullableMappedPosition, RawSourceMap, SourceMapConsumer } from 'source-map'

import { UNKNOWN_LOCATION } from '../constants'
import { ConstAssignment, ExceptionError, UndefinedVariable } from '../errors/errors'
import { SourceError } from '../types'
import { locationDummyNode } from '../utils/astCreator'

const NATIVE_JS_ERROR_REGEX: RegExp = /<anonymous>:(\d+):(\d+)/

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

export async function toSourceError(error: Error, sourceMap?: RawSourceMap): Promise<SourceError> {
  const errorStack: string | undefined = error.stack
  const match: RegExpMatchArray | null = errorStack ? NATIVE_JS_ERROR_REGEX.exec(errorStack) : null
  if (match === null) {
    return new ExceptionError(error, UNKNOWN_LOCATION)
  }

  let line: number = Number(match![1])
  let column: number = Number(match![2])
  let identifier: string = 'UNKNOWN'

  if (sourceMap) {
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
