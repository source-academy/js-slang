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

export const checkEditorBreakpoints = (context: Context, node: Node): void => {
  if (node.loc) {
    const currentLine = node.loc.start.line - 1
    if (context.runtime.debuggerOn && breakpoints[currentLine] !== undefined) {
      if (context.debugger.prevStoppedLine === currentLine) {
        context.runtime.break = false
        return
      }
      context.debugger.prevStoppedLine = currentLine
      context.runtime.break = true
    }
  }
}

export const areBreakpointsSet = () => breakpoints.length > 0
