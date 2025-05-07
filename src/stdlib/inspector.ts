import type { Context, Node } from '../types'

export const setBreakpointAtLine = (lines: string[]): void => {
  breakpoints = lines
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
