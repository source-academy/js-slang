import { StepperVariableDeclarator } from './nodes/Statement/VariableDeclaration'

/*
Generate new name for alpha renaming
X -> X_1 -> X_2 -> X_3 -> ...
*/
export function getFreshName(targetName: string[], protectedNames: string[]): string[] {
  const usedNames = new Set([protectedNames, targetName].flat())
  return targetName.map(name => {
    const regex = /(.*)_(\d+)$/ // identify underscore index
    let currentName = name
    do {
      const match = currentName.match(regex)
      if (match) {
        const nextOrder = parseInt(match[2], 10) + 1
        currentName = match[1] + '_' + nextOrder.toString()
      } else {
        currentName = name + '_1'
      }
    } while (usedNames.has(currentName))
    usedNames.add(currentName)
    return currentName
  })
}

// Assign mu term for arrow function expression
export function assignMuTerms(
  declarations: StepperVariableDeclarator[]
): StepperVariableDeclarator[] {
  // Scan out arrow function expression and assign mu term
  return declarations.map(declarator =>
    declarator.init && declarator.init.type === 'ArrowFunctionExpression'
      ? new StepperVariableDeclarator(declarator.id, declarator.init.assignName(declarator.id.name))
      : declarator
  )
}
