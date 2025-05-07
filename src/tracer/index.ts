import { StepperBaseNode } from './interface'

export let redex: { preRedex: StepperBaseNode[]; postRedex: StepperBaseNode[] } = {
  preRedex: [],
  postRedex: []
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
