import { JSSLANG_PROPERTIES } from '../constants'
import type { Node } from '../types'
import { stripIndent } from '../utils/formatters'
import { stringify } from '../utils/stringify'
import { RuntimeSourceError } from './base'

function getWarningMessage(maxExecTime: number) {
  const from = maxExecTime / 1000
  const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy
  return stripIndent`If you are certain your program is correct, press run again without editing your program.
      The time limit will be increased from ${from} to ${to} seconds.
      This page may be unresponsive for up to ${to} seconds if you do so.`
}

export abstract class TimeoutError extends RuntimeSourceError<Node | undefined> {}

export class PotentialInfiniteLoopError extends TimeoutError {
  constructor(
    node: Node,
    private readonly maxExecTime: number
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
  constructor(
    node: Node,
    private readonly calls: [string, any[]][],
    private readonly maxExecTime: number
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
