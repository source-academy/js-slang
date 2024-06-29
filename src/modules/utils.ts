/**
 * Checks if the given string refers to a Source module instead of a local module
 */
export const isSourceModule = (path: string) => !path.startsWith('.') && !path.startsWith('/')
