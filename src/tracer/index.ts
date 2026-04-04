import type { StepperBaseNode } from './interface'

export interface RedexInfo {
  preRedex: StepperBaseNode[]
  postRedex: StepperBaseNode[]
}

export interface Marker {
  redex?: StepperBaseNode | null // area of highlighted ast
  redexType?: 'beforeMarker' | 'afterMarker'
  explanation?: string
}

export interface IStepperPropContents {
  ast: StepperBaseNode
  markers?: Marker[]
}
