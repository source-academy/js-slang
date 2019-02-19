/* tslint:disable:max-classes-per-file */
import { MaximumStackLimitExceeded } from './interpreter-errors'
import { Context, Result, Scheduler, Value } from './types'

export class AsyncScheduler implements Scheduler {
  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, reject) => {
      context.runtime.isRunning = true
      let itValue = it.next()
      try {
        while (!itValue.done) {
          itValue = it.next()
        }
      } catch (e) {
        resolve({ status: 'error' })
      } finally {
        context.runtime.isRunning = false
      }
      resolve({
        status: 'finished',
        value: itValue.value
      })
    })
  }
}

export class PreemptiveScheduler implements Scheduler {
  constructor(public steps: number) {}

  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, reject) => {
      context.runtime.isRunning = true
      let itValue = it.next()
      let interval: number
      interval = setInterval(() => {
        let step = 0
        try {
          while (!itValue.done && step < this.steps) {
            itValue = it.next()
            step++
          }
        } catch (e) {
          if (/Maximum call stack/.test(e.toString())) {
            const environments = context.runtime.environments
            const stacks: any = []
            let counter = 0
            for (
              let i = 0;
              counter < MaximumStackLimitExceeded.MAX_CALLS_TO_SHOW && i < environments.length;
              i++
            ) {
              if (environments[i].callExpression) {
                stacks.unshift(environments[i].callExpression)
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
          resolve({ status: 'finished', value: itValue.value })
        }
      })
    })
  }
}
