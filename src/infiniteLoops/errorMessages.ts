export enum InfiniteLoopErrorMessage {
  no_base_case = 'Did you forget your base case?',
  input_out_of_domain = 'Did you call a value that is outside the range of your function?',
  no_state_change = 'Check your recursive function calls.',
  source_protection_loop = 'Potential infinite loop detected',
  source_protection_recursion = 'Potential infinite recursion detected'
}

export enum StackOverflowMessages {
  firefox = 'InternalError: too much recursion',
  // webkit: chrome + safari
  webkit = 'RangeError: Maximum call stack size exceeded',
  edge = 'Error: Out of stack space'
}

/**
 * Parses the error and determines whether it is an infinite loop and
 * if so, what kind of infinite loop.
 *
 * @returns {string} string containing the infinite loop classification.
 * @returns {string} empty string, if the error is not an infinite loop.
 */
export function infiniteLoopErrorType(
  errorString: string
): keyof typeof InfiniteLoopErrorMessage | 'stack_overflow' | '' {
  const infiniteLoopTypes = Object.entries(InfiniteLoopErrorMessage)
  const stackOverflowStrings = Object.values(StackOverflowMessages)
  for (const [type, message] of infiniteLoopTypes) {
    if (errorString.includes(message)) return type as keyof typeof InfiniteLoopErrorMessage
  }
  for (const message of stackOverflowStrings) {
    if (errorString === message) return 'stack_overflow'
  }
  return ''
}
