/* tslint:disable:max-classes-per-file */
import { MaximumStackLimitExceeded } from './errors/errors'
import { saveState } from './stdlib/inspector'
import { Context, Result, Scheduler, Value } from './types'

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

export class NonDetScheduler implements Scheduler {
  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, _reject) => {
      try {
        const itValue = it.next()
        if (itValue.done) {
          resolve({ status: 'finished', context, value: itValue.value })
        } else {
          resolve({
            status: 'suspended-non-det',
            it,
            scheduler: this,
            context,
            value: itValue.value
          } as Result)
        }
      } catch (e) {
        checkForStackOverflow(e, context)
        resolve({ status: 'error' })
      } finally {
        context.runtime.isRunning = false
      }
    })
  }
}

export class PreemptiveScheduler implements Scheduler {
  constructor(public steps: number) {}

  public run(it: IterableIterator<Value>, context: Context): Promise<Result> {
    return new Promise((resolve, _reject) => {
      context.runtime.isRunning = true
      // This is used in the evaluation of the REPL during a paused state.
      // The debugger is turned off while the code evaluates just above the debugger statement.
      let actuallyBreak: boolean = false
      let itValue = it.next()
      const interval = setInterval(() => {
        let step = 0
        try {
          while (!itValue.done && step < this.steps) {
            step++
            itValue = it.next()

            actuallyBreak = context.runtime.break && context.runtime.debuggerOn
            if (actuallyBreak) {
              itValue.done = true
            }
          }
          saveState(context, it, this)
        } catch (e) {
          checkForStackOverflow(e, context)
          context.runtime.isRunning = false
          clearInterval(interval)
          resolve({ status: 'error' })
        }
        if (itValue.done) {
          context.runtime.isRunning = false
          clearInterval(interval)
          if (actuallyBreak) {
            resolve({
              status: 'suspended',
              it,
              scheduler: this,
              context
            })
          } else {
            resolve({ status: 'finished', context, value: itValue.value })
          }
        }
      })
    })
  }
}

/* Checks if the error is a stackoverflow error, and captures it in the
   context if this is the case */
function checkForStackOverflow(error: any, context: Context) {
  if (/Maximum call stack/.test(error.toString())) {
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
}
