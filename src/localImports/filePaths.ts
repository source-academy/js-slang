/**
 * Maps characters that are legal in file paths but illegal in
 * function names to strings which are legal in function names.
 */
const charEncoding: Record<string, string> = {
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
  const encodeChars = Object.entries(charEncoding).reduce(
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
