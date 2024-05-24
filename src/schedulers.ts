import { saveState } from './stdlib/inspector'
import type { Context, Result, Scheduler, Value } from './types'

export class AsyncScheduler implements Scheduler {
  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, _reject) => {
      context.runtime.isRunning = true
      let itValue = it.next()
      try {
        while (!itValue.done) {
          itValue = it.next()
          if (context.runtime.break) {
            saveState(context, it, this)
            itValue.done = true
          }
        }
      } catch (e) {
        resolve({ status: 'error' })
      } finally {
        context.runtime.isRunning = false
      }
      if (context.runtime.break) {
        resolve({
          status: 'suspended',
          it,
          scheduler: this,
          context
        })
      } else {
        resolve({ status: 'finished', context, value: itValue.value })
      }
    })
  }
}
