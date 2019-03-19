import { Node } from 'estree'
import { Context, Result } from '..'
import { Scheduler, Value } from '../types'

var breakpoints: string[] = []
var previousBreakpoint: number = -1

export const saveState = (
  context: Context,
  it: IterableIterator<Value>,
  scheduler: Scheduler
): void => {
  context.debugger.state.it = it
  context.debugger.state.scheduler = scheduler
}

export const setBreakpointAtLine = (lines: string[]): void => {
  breakpoints = lines;
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

export const checkEditorBreakpoints = (context: Context, node: Node): void => {
  if(context.runtime.debuggerOn && node.loc) {
    if(previousBreakpoint !== -1) {
      if(node.loc.start.line !== previousBreakpoint) {
        previousBreakpoint = -1;
      }
    } else if(typeof breakpoints[node.loc.start.line - 1] !== typeof undefined) {
      if(node.loc.start.line !== previousBreakpoint) {
        previousBreakpoint = node.loc.start.line;
        context.runtime.break = true;
      }
    }
  }
}
