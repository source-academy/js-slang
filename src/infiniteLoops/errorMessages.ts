export enum InfiniteLoopErrorMessage {
  no_base_case = 'Did you forget your base case?',
  input_out_of_domain = 'Did you call a value that is outside the range of your function?',
  no_state_change = 'Check your recursive function calls.',
  source_protection_loop = 'Potential infinite loop detected',
  source_protection_recursion = 'Potential infinite recursion detected'
}

enum StackOverflowMessages {
  firefox = 'InternalError: too much recursion',
  // webkit: chrome + safari
  webkit = 'RangeError: Maximum call stack size exceeded',
  edge = 'Error: Out of stack space'
}

export function infiniteLoopErrorType(errorString: string): string {
  const infiniteLoopTypes = Object.keys(InfiniteLoopErrorMessage)
  const stackOverflowStrings = Object.keys(StackOverflowMessages).map(x => StackOverflowMessages[x])
  for (const key of infiniteLoopTypes) {
    if (errorString.includes(InfiniteLoopErrorMessage[key])) return key
  }
  for (const message of stackOverflowStrings) {
    if (errorString === message) return 'stack_overflow'
  }
  return ''
}
