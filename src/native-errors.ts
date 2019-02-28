/* tslint:disable:max-classes-per-file */
import { stripIndent } from 'common-tags'
import * as es from 'estree'
import { JSSLANG_PROPERTIES } from './constants'
import { RuntimeSourceError } from './interpreter-errors'
import { ErrorSeverity, ErrorType } from './types'

export class PotentialInfiniteLoopError extends RuntimeSourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR

  constructor(node?: es.Node) {
    super(node)
  }

  public explain() {
    const from = JSSLANG_PROPERTIES.maxExecTime
    const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy * from
    return stripIndent`Potential infinite loop detected.
      'If you are certain your code is correct, rerun the same code to increase the time limit from ${from} to ${to}.`
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
    const from = JSSLANG_PROPERTIES.maxExecTime
    const to = from * JSSLANG_PROPERTIES.factorToIncreaseBy * from
    for (let i = 0; i < 3; i++) {
      const [executedName, executedArguments] = this.calls.pop()!
      formattedCalls.push(`${executedName}(${executedArguments})`)
    }
    return stripIndent`Potential infinite recursion detected: ${formattedCalls.join(' ... ')}.
      If you are certain your code is correct, rerun the same code to increase the time limit from ${from} to ${to}.`
  }

  public elaborate() {
    return this.explain()
  }
}
