import { generate } from 'astring'
import { Node } from 'estree'

export const astToString = (node: Node): string => generate(node)
