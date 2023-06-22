/*
acorn.Node differs from estree.Node, so we have this file to handle the `as any` type coercions.
 */

import * as walkers from 'acorn-walk'
import { Node } from 'estree'
export type FullWalkerCallback<TState> = (node: Node, state: TState, type: string) => void

type FullAncestorWalkerCallback<TState> = (
  node: Node,
  state: TState | Node[],
  ancestors: Node[],
  type: string
) => void
export type WalkerCallback<TState> = (node: Node, state: TState, type?: string) => void

type SimpleWalkerFn<TState> = (node: Node, state: TState) => void

export type AncestorWalkerFn<TState> = (
  node: Node,
  state: TState | Node[],
  ancestors: Node[]
) => void

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

export const simple: <TState>(
  node: Node,
  visitors: SimpleVisitors<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState
) => void = walkers.simple as any

export const ancestor: <TState>(
  node: Node,
  visitors: AncestorVisitors<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState
) => void = walkers.ancestor as any

export const recursive: <TState>(
  node: Node,
  state: TState,
  functions: RecursiveVisitors<TState>,
  base?: RecursiveVisitors<TState>
) => void = walkers.recursive as any

export const full: <TState>(
  node: Node,
  callback: FullWalkerCallback<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState
) => void = walkers.full as any

export const fullAncestor: <TState>(
  node: Node,
  callback: FullAncestorWalkerCallback<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState
) => void = walkers.fullAncestor as any

export const make: <TState>(
  functions: RecursiveVisitors<TState>,
  base?: RecursiveVisitors<TState>
) => RecursiveVisitors<TState> = walkers.make as any

export const findNodeAt: <TState>(
  node: Node,
  start: number | undefined,
  end: number | undefined,
  type?: FindPredicate,
  base?: RecursiveVisitors<TState>,
  state?: TState
) => Found<TState> | undefined = walkers.findNodeAt as any
export const findNodeAround: typeof findNodeAt = walkers.findNodeAround as any

export const findNodeAfter: typeof findNodeAt = walkers.findNodeAfter as any

export const base: AncestorVisitors<never> = walkers.base as any
