import { Node } from 'estree'

import { Context, Result } from '..'
import { Scheduler, Value } from '../types'

export const saveState = (
  context: Context,
  it: IterableIterator<Value>,
  scheduler: Scheduler
): void => {
  context.debugger.state.it = it
  context.debugger.state.scheduler = scheduler
}

export const setBreakpointAtLine = (lines: string[]): void => {
  breakpoints = lines
}

export const manualToggleDebugger = (context: Context): Result => {
  context.runtime.break = true
  return {
    status: 'suspended',
    scheduler: context.debugger.state.scheduler,
    it: context.debugger.state.it,
    context
  }
}

let breakpoints: string[] = []
let moved: boolean = true
let prevStoppedLine: number = -1

export const checkEditorBreakpoints = (context: Context, node: Node): void => {
  if (node.loc) {
    const currentLine = node.loc.start.line - 1
    if (!moved && currentLine !== prevStoppedLine) {
      moved = true
    }
    if (context.runtime.debuggerOn && breakpoints[currentLine] !== undefined && moved) {
      moved = false
      prevStoppedLine = currentLine
      context.runtime.break = true
    }
  }
}

export const areBreakpointsSet = () => breakpoints.length > 0
