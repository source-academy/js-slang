/**
 * Heavily adapted from https://github.com/source-academy/JSpike/
 *
 * This interpreter implements an explicit-control evaluator.
 */

import { Value } from '../types'
import { Command, Tags } from './types'
import { Stack } from './utils'

/**
 * CSE machine has three registers
 * C: control
 * S: stash
 * E: environment
 */

/**
 * The control is a list of commands that still needs to be executed by the machine.
 * Commands are nodes of the syntax tree or instructions.
 */
class Control extends Stack<Command> {
  constructor() {
    super()
    // Evaluation of last statement is undefined if stash is empty
    this.storage.push({ tag: Tags.PushUndefInstr })

    // TODO: load program in the constructor
  }
}

/**
 * The stash is a list of values that stores intermediate results.
 */
class Stash extends Stack<Value> {
  constructor() {
    super()
  }
}
