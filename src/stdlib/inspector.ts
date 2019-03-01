import { Context, Result } from '..'
import { Scheduler, Value } from '../types'

/** Register some callback function with the context.
 *  Only the parent context should have this performed.
 *  Any other context (e.g. block frame, function frames) will
 *  result in undefined behaviour.
 */
export const registerObserver = (context: Context, callBack: (arg0: Context) => void): void => {
  context.debugger.observers.callbacks.push(callBack)
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

export const saveState = (
  context: Context,
  it: IterableIterator<Value>,
  scheduler: Scheduler
): void => {
  context.debugger.state.it = it
  context.debugger.state.scheduler = scheduler
  context.debugger.observers.callbacks.forEach(f => f(context))
}
