/**
 * Maps non-alphanumeric characters that are legal in file paths
 * to strings which are legal in function names.
 */
export const nonAlphanumericCharEncoding: Record<string, string> = {
  // While the underscore character is legal in both file paths
  // and function names, it is the only character to be legal
  // in both that is not an alphanumeric character. For simplicity,
  // we handle it the same way as the other non-alphanumeric
  // characters.
  _: '_',
  '/': '$',
  '.': '$dot$',
  '-': '$dash$'
}

/**
 * Transforms the given file path to a valid function name. The
 * characters in a valid function name must be either an
 * alphanumeric character, the underscore (_), or the dollar ($).
 *
 * In addition, the returned function name has underscores appended
 * on both ends to make it even less likely that the function name
 * will collide with a user-inputted name.
 *
 * @param filePath The file path to transform.
 */
export const transformFilePathToValidFunctionName = (filePath: string): string => {
  const encodeChars = Object.entries(nonAlphanumericCharEncoding).reduce(
    (
      accumulatedFunction: (filePath: string) => string,
      [charToReplace, replacementString]: [string, string]
    ) => {
      return (filePath: string): string =>
        accumulatedFunction(filePath).replaceAll(charToReplace, replacementString)
    },
    (filePath: string): string => filePath
  )
  return `__${encodeChars(filePath)}__`
}

/**
 * Transforms the given function name to the expected name that
 * the variable holding the result of invoking the function should
 * have. The main consideration of this transformation is that
 * the resulting name should not conflict with any of the names
 * that can be generated by `transformFilePathToValidFunctionName`.
 *
 * @param functionName The function name to transform.
 */
export const transformFunctionNameToInvokedFunctionResultVariableName = (
  functionName: string
): string => {
  return `_${functionName}_`
}

const isAlphanumeric = (char: string): boolean => {
  return /[a-zA-Z0-9]/i.exec(char) !== null
}

/**
 * Returns whether the given file path is valid. A file path is
 * valid if it only contains alphanumeric characters and the
 * characters defined in `charEncoding`.
 *
 * @param filePath The file path to check.
 */
export const isFilePathValid = (filePath: string): boolean => {
  for (const char of filePath) {
    if (isAlphanumeric(char)) {
      continue
    }
    if (char in nonAlphanumericCharEncoding) {
      continue
    }
    return false
  }
  return true
}

/**
 * Returns whether a string is a file path. We define a file
 * path to be any string containing the '/' character.
 *
 * @param value The value of the string.
 */
export const isFilePath = (value: string): boolean => {
  return value.includes('/')
}
