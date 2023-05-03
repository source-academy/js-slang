import type * as es from 'estree'

import { recursive } from '../walkers'

export function extractIdsFromPattern(pattern: es.Pattern): Set<es.Identifier> {
  const ids = new Set<es.Identifier>()
  recursive(pattern, null, {
    ArrayPattern: ({ elements }: es.ArrayPattern, _state, c) =>
      elements.forEach(elem => {
        if (elem) c(elem, null)
      }),
    AssignmentPattern: (p: es.AssignmentPattern, _state, c) => {
      c(p.left, null)
      c(p.right, null)
    },
    Identifier: (id: es.Identifier) => ids.add(id),
    ObjectPattern: ({ properties }: es.ObjectPattern, _state, c) =>
      properties.forEach(prop => c(prop, null)),
    RestElement: ({ argument }: es.RestElement, _state, c) => c(argument, null)
  })
  return ids
}
