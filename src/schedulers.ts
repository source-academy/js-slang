/* tslint:disable:max-classes-per-file */
import { MaximumStackLimitExceeded } from './interpreter-errors'
import { saveState } from './stdlib/inspector'
import { Context, Result, Scheduler, Value } from './types'

export class AsyncScheduler implements Scheduler {
  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, reject) => {
      context.runtime.isRunning = true
      let itValue = it.next()
      try {
        while (!itValue.done) {
          itValue = it.next()
          if (context.runtime.break) {
            saveState(context, it, this)
            itValue.done = true;
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
        resolve({ status: 'finished', value: itValue.value })
      }
    })
  }
}

export class PreemptiveScheduler implements Scheduler {
  constructor(public steps: number) {}

  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, reject) => {
      context.runtime.isRunning = true
      let itValue = it.next()
      const interval: number = setInterval(() => {
        let step = 0
        try {
          while (!itValue.done && step < this.steps) {
            step++
            itValue = it.next()
            if (context.runtime.break) {
              saveState(context, it, this)
              itValue.done = true
            }
          }
        } catch (e) {
          if (/Maximum call stack/.test(e.toString())) {
            const frames = context.runtime.frames
            const stacks: any = []
            let counter = 0
            for (
              let i = 0;
              counter < MaximumStackLimitExceeded.MAX_CALLS_TO_SHOW && i < frames.length;
              i++
            ) {
              if (frames[i].callExpression) {
                stacks.unshift(frames[i].callExpression)
                counter++
              }
            }
            context.errors.push(new MaximumStackLimitExceeded(context.runtime.nodes[0], stacks))
          }
          context.runtime.isRunning = false
          clearInterval(interval)
          resolve({ status: 'error' })
        }
        if (itValue.done) {
          context.runtime.isRunning = false
          clearInterval(interval)
          if (context.runtime.break) {
            resolve({
              status: 'suspended',
              it,
              scheduler: this,
              context
            })
          } else {
            resolve({ status: 'finished', value: itValue.value })
          }
        }
      })
    })
  }
}
