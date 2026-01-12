import { JSSLANG_PROPERTIES } from '../constants'
import type { Node } from '../types'
import { stripIndent } from '../utils/formatters'
import { stringify } from '../utils/stringify'
import { ErrorSeverity, ErrorType } from './base'
import { RuntimeSourceError } from './runtimeSourceError'

function getWarningMessage(maxExecTime: number) {
  const from = maxExecTime / 1000
  const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy
  return stripIndent`If you are certain your program is correct, press run again without editing your program.
      The time limit will be increased from ${from} to ${to} seconds.
      This page may be unresponsive for up to ${to} seconds if you do so.`
}

export class TimeoutError extends RuntimeSourceError {}

export class PotentialInfiniteLoopError extends TimeoutError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(
    node: Node,
    private maxExecTime: number
  ) {
    super(node)
  }

  public explain() {
    return stripIndent`${'Potential infinite loop detected'}.
    ${getWarningMessage(this.maxExecTime)}`
  }

  public elaborate() {
    return this.explain()
  }
}

export class PotentialInfiniteRecursionError extends TimeoutError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(
    node: Node,
    private calls: [string, any[]][],
    private maxExecTime: number
  ) {
    super(node)
    this.calls = this.calls.slice(-3)
  }

  public explain() {
    const formattedCalls = this.calls.map(
      ([executedName, executedArguments]) =>
        `${executedName}(${executedArguments.map(arg => stringify(arg)).join(', ')})`
    )
    return stripIndent`${'Potential infinite recursion detected'}: ${formattedCalls.join(' ... ')}.
      ${getWarningMessage(this.maxExecTime)}`
  }

  public elaborate() {
    return this.explain()
  }
}
