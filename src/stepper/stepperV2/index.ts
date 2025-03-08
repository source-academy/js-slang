import { StepperBaseNode } from './interface';

export let redex: { preRedex: StepperBaseNode | null; postRedex: StepperBaseNode | null } = {
  preRedex: null,
  postRedex: null
}

export interface Marker {
  redex: StepperBaseNode | null, // area of highlighted ast
  redexType: "beforeMarker" | "afterMarker"
  explanation?: string 
}

export interface IStepperPropContents {
  ast: StepperBaseNode,
  markers?: Marker[]
}
