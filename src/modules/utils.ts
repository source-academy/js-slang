/**
 * For tabs that are export default declarations, we need to remove
 * the `export default` bit from the front before they can be loaded
 * by js-slang
 */
export function evalRawTab(text: string) {
  if (text.startsWith('export default')) {
    text = text.substring(14)
  }

  return eval(text)
}
