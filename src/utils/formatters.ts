function templateToString(content: TemplateStringsArray | string, variables: any[]): string {
  if (typeof content === 'string') {
    return content
  }
  return variables.reduce(
    (built: string, fragment: string, index: number) => built + fragment + content[index + 1],
    content[0]
  )
}

export function oneLine(content: TemplateStringsArray | string, ...variables: any[]): string {
  return templateToString(content, variables)
    .replace(/(?:\n(?:\s*))+/g, ' ')
    .trim()
}

// Strips the "minimum indent" from every line in content,
// then trims whitespace at the beginning and end of the string.
//
// two spaces of "indent" removed from both lines:
//   stripIndent('  a\n  b') == 'a\nb'
// only one space of "indent" removed from both lines,
// because the first line only contains a single space of indent:
//   stripIndent(' a\n  b') == 'a\n b'
// first trims one space of indent from both lines,
// but later trims another space from the first line
// as it's at the beginning of the string:
//   stripIndent('  a\n b') == 'a\nb'
export function stripIndent(content: TemplateStringsArray | string, ...variables: any[]): string {
  const result = templateToString(content, variables)
  const match = result.match(/^[^\S\n]*(?=\S)/gm)
  const indent = match && Math.min(...match.map(el => el.length))
  if (indent) {
    return result.replace(new RegExp(`^.{${indent}}`, 'gm'), '').trim()
  }
  return result.trim()
}

export function simplify(content: string, maxLength = 15, separator = '...') {
  if (content.length < maxLength) {
    return content
  }
  const charsToTake = Math.ceil(maxLength - separator.length / 2)
  return content.slice(0, charsToTake) + ' ... ' + content.slice(charsToTake)
}
