declare module 'acorn-walk/dist/walk' {
  import { Node } from 'estree'
  type FullWalkerCallback<TState> = (node: Node, state: TState, type: string) => void

  type FullAncestorWalkerCallback<TState> = (
    node: Node,
    state: TState | Node[],
    ancestors: Node[],
    type: string
  ) => void
  type WalkerCallback<TState> = (node: Node, state: TState) => void

  type SimpleWalkerFn<TState> = (node: Node, state: TState) => void

  type AncestorWalkerFn<TState> = (node: Node, state: TState | Node[], ancestors: Node[]) => void

  type RecursiveWalkerFn<TState> = (
    node: Node,
    state: TState,
    callback: WalkerCallback<TState>
  ) => void

  interface SimpleVisitors<TState> {
    [type: string]: SimpleWalkerFn<TState>
  }

  interface AncestorVisitors<TState> {
    [type: string]: AncestorWalkerFn<TState>
  }

  interface RecursiveVisitors<TState> {
    [type: string]: RecursiveWalkerFn<TState>
  }

  type FindPredicate = (type: string, node: Node) => boolean

  interface Found<TState> {
    node: Node
    state: TState
  }

  export function simple<TState>(
    node: Node,
    visitors: SimpleVisitors<TState>,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): void

  export function ancestor<TState>(
    node: Node,
    visitors: AncestorVisitors<TState>,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): void

  export function recursive<TState>(
    node: Node,
    state: TState,
    functions: RecursiveVisitors<TState>,
    base?: RecursiveVisitors<TState>
  ): void

  export function full<TState>(
    node: Node,
    callback: FullWalkerCallback<TState>,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): void

  export function fullAncestor<TState>(
    node: Node,
    callback: FullAncestorWalkerCallback<TState>,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): void

  export function make<TState>(
    functions: RecursiveVisitors<TState>,
    base?: RecursiveVisitors<TState>
  ): RecursiveVisitors<TState>

  export function findNodeAt<TState>(
    node: Node,
    start: number | undefined,
    end: number | undefined,
    type: string,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): Found<TState> | undefined

  export function findNodeAt<TState>(
    node: Node,
    start: number | undefined,
    end: number | undefined,
    type?: FindPredicate,
    base?: RecursiveVisitors<TState>,
    state?: TState
  ): Found<TState> | undefined

  export const findNodeAround: typeof findNodeAt

  export const findNodeAfter: typeof findNodeAt

  export const base: AncestorVisitors<never>
}
