// =======================================
// Types used in type checker for type inference/type error checker for Source Typed variant
// =======================================

import type es from 'estree'
import type { AllowedDeclarations, Node } from '../utils/ast/node'

export type PrimitiveType = 'boolean' | 'null' | 'number' | 'string' | 'undefined'
export type TSAllowedTypes = 'any' | 'void'
export const disallowedTypes = ['bigint', 'never', 'object', 'symbol', 'unknown'] as const

export type TSDisallowedTypes = (typeof disallowedTypes)[number]

/**
 * All types recognised by type parser as basic types
 */
export type TSBasicType = PrimitiveType | TSAllowedTypes | TSDisallowedTypes

// Types for nodes used in type inference
export type NodeWithInferredType<T extends Node> = InferredType & T

export type InferredType = Untypable | Typed | NotYetTyped

export interface TypedFuncDecl {
  functionInferredType?: Type
}
export interface Untypable {
  typability?: 'Untypable'
  inferredType?: Type
}
export interface NotYetTyped {
  typability?: 'NotYetTyped'
  inferredType?: Type
}
export interface Typed {
  typability?: 'Typed'
  inferredType?: Type
}

// Constraints used in type inference
export type Constraint = 'none' | 'addable'

// Types used by both type inferencer and Source Typed
export type Type =
  | Primitive
  | Variable
  | FunctionType
  | List
  | Pair
  | SArray
  | UnionType
  | LiteralType

export interface Primitive {
  kind: 'primitive'
  name: PrimitiveType | TSAllowedTypes
  // Value is needed for Source Typed type error checker due to existence of literal types
  value?: string | number | boolean
}

// In Source Typed, Variable type is used for
// 1. Type parameters
// 2. Type references of generic types with type arguments
export interface Variable {
  kind: 'variable'
  name: string
  constraint: Constraint
  // Used in Source Typed variant to store type arguments of generic types
  typeArgs?: Type[]
}

// cannot name Function, conflicts with TS
export interface FunctionType {
  kind: 'function'
  parameterTypes: Type[]
  returnType: Type
}

export interface List {
  kind: 'list'
  elementType: Type
  // Used in Source Typed variants to check for type mismatches against pairs
  typeAsPair?: Pair
}
export interface Pair {
  kind: 'pair'
  headType: Type
  tailType: Type
}

export interface SArray {
  kind: 'array'
  elementType: Type
}

// Union types and literal types are only used in Source Typed for typechecking
export interface UnionType {
  kind: 'union'
  types: Type[]
}
export interface LiteralType {
  kind: 'literal'
  value: string | number | boolean
}

// In Source Typed, ForAll type is used for generic types
export interface ForAll {
  kind: 'forall'
  polyType: Type
  // Used in Source Typed variant to store type parameters of generic types
  typeParams?: Variable[]
}
export interface PredicateType {
  kind: 'predicate'
  ifTrueType: Type | ForAll
}
export type BindableType = Type | ForAll | PredicateType
export type PredicateTest = {
  node: NodeWithInferredType<es.CallExpression>
  ifTrueType: Type | ForAll
  argVarName: string
}

/**
 * Each element in the TypeEnvironment array represents a different scope
 * (e.g. first element is the global scope, last element is the closest).
 * Within each scope, variable types/declaration kinds, as well as type aliases, are stored.
 */
export type TypeEnvironment = {
  typeMap: Map<string, BindableType>
  declKindMap: Map<string, AllowedDeclarations>
  typeAliasMap: Map<string, Type | ForAll>
}[]
