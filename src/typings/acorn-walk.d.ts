declare module 'acorn-walk/dist/walk' {
  import * as es from 'estree'

  namespace AcornWalk {
    export type SimpleWalker<S> = (node: es.Node, state?: S, type?: string) => void
    export interface SimpleWalkers<S> {
      [name: string]: SimpleWalker<S>
    }
    export type AncestorWalker<S> = (node: es.Node, state: S, ancestors: [es.Node]) => void
    export interface AncestorWalkers<S> {
      [name: string]: AncestorWalker<S>
    }
    export type Walker<T extends es.Node, S> = (
      node: T,
      state: S,
      callback: SimpleWalker<S>
    ) => void
    export interface Walkers<S> {
      [name: string]: Walker<any, S>
    }
    type NodeTest = (nodeType: string, node: es.Node) => boolean

    export const base: Walkers<any>

    export function simple<S>(
      node: es.Node,
      visitors: SimpleWalkers<S>,
      base?: SimpleWalkers<S>,
      state?: S
    ): void
    export function ancestor<S>(
      node: es.Node,
      visitors: AncestorWalkers<S>,
      base?: AncestorWalkers<S>,
      state?: S
    ): void
    export function recursive<S>(node: es.Node, state: S, functions: Walkers<S>): void
    export function findNodeAt<S>(
      node: es.Node,
      start: null | number,
      end: null | number,
      test: string | NodeTest,
      base?: SimpleWalkers<S>,
      state?: S
    ): void
    export function findNodeAround<S>(
      node: es.Node,
      pos: es.Position,
      test: string | NodeTest,
      base?: SimpleWalkers<S>,
      state?: S
    ): void
    export function findNodeAfter<S>(
      node: es.Node,
      pos: es.Position,
      test: string | NodeTest,
      base?: SimpleWalkers<S>,
      state?: S
    ): void
  }

  export = AcornWalk
}
