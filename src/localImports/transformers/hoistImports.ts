import es from 'estree'

import { isImportDeclaration } from '../typeGuards'

export const hoistImports = (program: es.Program): void => {
  const importDeclarations = program.body.filter(isImportDeclaration)
  const nonImportDeclarations = program.body.filter(
    (node: es.Directive | es.Statement | es.ModuleDeclaration): boolean =>
      !isImportDeclaration(node)
  )
  program.body = [...importDeclarations, ...nonImportDeclarations]
}
