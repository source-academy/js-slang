import { Value } from '../types'
import { toString } from '../interop'

export function display(value: Value) {
  const output = toString(value)
  console.log(output)
}

// tslint:disable-next-line:no-any
export function timed(this: any, f: Function) {
  var self = this
  var timerType = Date

  return function() {
    var start = timerType.now()
    var result = f.apply(self, arguments)
    var diff = timerType.now() - start
    display('Duration: ' + Math.round(diff) + 'ms')
    return result
  }
}
timed.__SOURCE__ = 'timed(f)'

export function is_number(v: Value) {
  return typeof v === 'number'
}
is_number.__SOURCE__ = 'is_number(v)'

export function array_length(xs: Value[]) {
  return xs.length
}
array_length.__SOURCE__ = 'array_length(xs)'
