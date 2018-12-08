/* tslint:disable: max-classes-per-file */
import {MaximumStackLimitExceeded} from './interpreter-errors'
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
            const stacks: any = []
            for (let i = 1; i <= 3; i++) {
              let currentFrame = context.runtime.frames[i - 1]
              while (!currentFrame.callExpression) {
                if (currentFrame.parent) {
                  currentFrame = currentFrame.parent
                } else {
                  break
                }
              }
              stacks.push(currentFrame.callExpression || {callee: "unknown", args: []})
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
