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

export function stripIndent(content: TemplateStringsArray | string, ...variables: any[]): string {
  const result = templateToString(content, variables)
  const match = result.match(/^[^\S\n]*(?=\S)/gm)
  const indent = match && Math.min(...match.map(el => el.length))
  if (indent) {
    return result.replace(new RegExp(`^.{${indent}}`, 'gm'), '').trim()
  }
  return result.trim()
}
