export default (() => {
  const tailValue = Symbol('value to return to check if call is in tail position')
  return (fn: (...args: any[]) => any) => {
    let isFunctionBeingEvaluated = false
    let returnValue: any
    const argumentsStack: any[] = []
    let isPossbilyFunctionWithTailCalls = true
    let originalArguments
    const reset = () => {
      isFunctionBeingEvaluated = false
      originalArguments = undefined
      isPossbilyFunctionWithTailCalls = true
    }
    return function(this: any, ...args: any[]) {
      if (!isPossbilyFunctionWithTailCalls) {
        return fn.apply(this, args)
      }
      argumentsStack.push(args)
      if (!isFunctionBeingEvaluated) {
        isFunctionBeingEvaluated = true
        originalArguments = args
        while (argumentsStack.length > 0) {
          let hasError = false
          try {
            returnValue = fn.apply(this, argumentsStack.shift())
          } catch (e) {
            hasError = true
          }
          const isTailCall = returnValue === tailValue
          const hasRemainingArguments = argumentsStack.length > 0
          if (hasError || (!isTailCall && hasRemainingArguments)) {
            isPossbilyFunctionWithTailCalls = false
            returnValue = fn.apply(this, originalArguments)
            reset()
            return returnValue
          }
        }
        reset()
        return returnValue
      }
      return tailValue
    }
  }
})()
