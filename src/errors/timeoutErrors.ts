/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { JSSLANG_PROPERTIES } from '../constants'
import { stringify } from '../utils/stringify'

import { ErrorSeverity, ErrorType } from '../types'
import { stripIndent } from '../utils/formatters'
import { RuntimeSourceError } from './runtimeSourceError'

function getWarningMessage() {
  const from = JSSLANG_PROPERTIES.maxExecTime / 1000
  const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy
  return stripIndent`If you are certain your program is correct, press run again without editing your program.
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

  constructor(node: es.Node, private calls: [string, any[]][]) {
    super(node)
    this.calls = this.calls.slice(-3)
  }

  public explain() {
    const formattedCalls = this.calls.map(
      ([executedName, executedArguments]) =>
        `${executedName}(${executedArguments.map(arg => stringify(arg)).join(', ')})`
    )
    return stripIndent`Potential infinite recursion detected: ${formattedCalls.join(' ... ')}.
      ${getWarningMessage()}`
  }

  public elaborate() {
    return this.explain()
  }
}
