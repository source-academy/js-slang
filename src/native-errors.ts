/* tslint:disable:max-classes-per-file */
import { stripIndent } from 'common-tags'
import * as es from 'estree'
import { JSSLANG_PROPERTIES } from './constants'
import { RuntimeSourceError } from './interpreter-errors'
import { ErrorSeverity, ErrorType } from './types'

function getWarningMessage() {
  const from = JSSLANG_PROPERTIES.maxExecTime / 1000
  const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy
  return stripIndent`If you are certain your code is correct, press run again without editing your code.
      The time limit will be increased from ${from} to ${to} seconds.
      This page may be unresponsive for up to ${to} seconds if you do so.`
}

export class PotentialInfiniteLoopError extends RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(node?: es.Node) {
    super(node)
  }

  public explain() {
    return stripIndent`Potential infinite loop detected.
    ${getWarningMessage()}`
  }

  public elaborate() {
    return this.explain()
  }
}

export class PotentialInfiniteRecursionError extends RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(node: es.Node, private calls: Array<[string, any[]]>) {
    super(node)
  }

  public explain() {
    const formattedCalls = []
    for (let i = 0; i < 3; i++) {
      const [executedName, executedArguments] = this.calls.pop()!
      formattedCalls.push(`${executedName}(${executedArguments})`)
    }
    return stripIndent`Potential infinite recursion detected: ${formattedCalls.join(' ... ')}.
      ${getWarningMessage()}`
  }

  public elaborate() {
    return this.explain()
  }
}
