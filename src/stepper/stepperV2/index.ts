import { StepperBaseNode } from './interface'
import { StepperExpression, StepperPattern } from './nodes'
import { StepperStatement } from './nodes/Statement';

// Global variables
export let redex: { preRedex: StepperBaseNode[]; postRedex: StepperBaseNode[] } = {
  preRedex: [],
  postRedex: []
}

export class SubstitutionScope {
  static scope: StepperStatement[]
  static reset() {
    SubstitutionScope.scope = []
  }
  static set(scope: StepperStatement[]) {
    SubstitutionScope.scope = scope
  }
  static get() {
    return SubstitutionScope.scope
  }
  static substitute(name: StepperPattern, value: StepperExpression | null | undefined) {
    if (value) {
      SubstitutionScope.scope = SubstitutionScope.scope.map(ast => ast.substitute(name, value) as StepperStatement)
    }
  }
}

export interface Marker {
  redex: StepperBaseNode | null // area of highlighted ast
  redexType: 'beforeMarker' | 'afterMarker'
  explanation?: string
}

export interface IStepperPropContents {
  ast: StepperBaseNode
  markers?: Marker[]
}
