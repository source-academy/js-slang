import { simple } from '../utils/walkers'
import * as es from 'estree'
import { NativeStorage } from '../types'

export function getUniqueId(usedIdentifiers: Set<string>, uniqueId = 'unique') {
  while (usedIdentifiers.has(uniqueId)) {
    const start = uniqueId.slice(0, -1)
    const end = uniqueId[uniqueId.length - 1]
    const endToDigit = Number(end)
    if (Number.isNaN(endToDigit) || endToDigit === 9) {
      uniqueId += '0'
    } else {
      uniqueId = start + String(endToDigit + 1)
    }
  }
  usedIdentifiers.add(uniqueId)
  return uniqueId
}

export function getIdentifiersInNativeStorage(nativeStorage: NativeStorage) {
  const identifiers = new Set<string>()
  let variableScope = nativeStorage.globals
  while (variableScope !== null) {
    for (const name of variableScope.variables.keys()) {
      identifiers.add(name)
    }
    variableScope = variableScope.previousScope
  }
  return identifiers
}

export function getIdentifiersInProgram(program: es.Program) {
  const identifiers = new Set<string>()
  simple(program, {
    Identifier(node: es.Identifier) {
      identifiers.add(node.name)
    },
    Pattern(node: es.Pattern) {
      if (node.type === 'Identifier') {
        identifiers.add(node.name)
      } else if (node.type === 'MemberExpression') {
        if (node.object.type === 'Identifier') {
          identifiers.add(node.object.name)
        }
      }
    }
  })
  return identifiers
}
