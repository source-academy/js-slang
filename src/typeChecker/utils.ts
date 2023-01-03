// =======================================
// Helper functions/constants for type checker and type error checker
// =======================================

import {
  AllowedDeclarations,
  BindableType,
  Chapter,
  ForAll,
  FunctionType,
  List,
  LiteralType,
  Pair,
  PredicateType,
  Primitive,
  SArray,
  TSBasicType,
  Type,
  TypeEnvironment,
  UnionType,
  Variable
} from '../types'
import * as tsEs from './tsESTree'

// Name of Unary negative builtin operator
export const NEGATIVE_OP = '-_1'

// Special name used for saving return type in type environment
export const RETURN_TYPE_IDENTIFIER = '//RETURN_TYPE'

export const typeAnnotationKeywordToBasicTypeMap: Record<tsEs.TSTypeKeyword, TSBasicType> = {
  TSAnyKeyword: 'any',
  TSBigIntKeyword: 'bigint',
  TSBooleanKeyword: 'boolean',
  TSNeverKeyword: 'never',
  TSNullKeyword: 'null',
  TSNumberKeyword: 'number',
  TSObjectKeyword: 'object',
  TSStringKeyword: 'string',
  TSSymbolKeyword: 'symbol',
  TSUndefinedKeyword: 'undefined',
  TSUnknownKeyword: 'unknown',
  TSVoidKeyword: 'void'
}

// Helper functions for dealing with type environment
export function lookupType(name: string, env: TypeEnvironment): BindableType | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i].typeMap.has(name)) {
      return env[i].typeMap.get(name)
    }
  }
  return undefined
}

export function lookupDeclKind(
  name: string,
  env: TypeEnvironment
): AllowedDeclarations | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i].declKindMap.has(name)) {
      return env[i].declKindMap.get(name)
    }
  }
  return undefined
}

export function lookupTypeAlias(name: string, env: TypeEnvironment): Type | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i].typeAliasMap.has(name)) {
      return env[i].typeAliasMap.get(name)
    }
  }
  return undefined
}

export function setType(name: string, type: BindableType, env: TypeEnvironment): void {
  env[env.length - 1].typeMap.set(name, type)
}

export function setDeclKind(name: string, kind: AllowedDeclarations, env: TypeEnvironment): void {
  env[env.length - 1].declKindMap.set(name, kind)
}

export function setTypeAlias(name: string, type: Type, env: TypeEnvironment): void {
  env[env.length - 1].typeAliasMap.set(name, type)
}

export function pushEnv(env: TypeEnvironment): void {
  env.push({ typeMap: new Map(), declKindMap: new Map(), typeAliasMap: new Map() })
}

// Helper functions for formatting types
export function formatTypeString(type: Type, formatAsLiteral?: boolean): string {
  switch (type.kind) {
    case 'function':
      const paramTypes = type.parameterTypes
      const paramTypeString = paramTypes
        .map(type => formatTypeString(type, formatAsLiteral))
        .join(', ')
      return `(${paramTypeString}) => ${formatTypeString(type.returnType, formatAsLiteral)}`
    case 'union':
      // Remove duplicates
      const typeSet = new Set(type.types.map(type => formatTypeString(type, formatAsLiteral)))
      return Array.from(typeSet).join(' | ')
    case 'literal':
      if (typeof type.value === 'string') {
        return `"${type.value.toString()}"`
      }
      return type.value.toString()
    case 'primitive':
      if (!formatAsLiteral || type.value === undefined) {
        return type.name
      }
      if (typeof type.value === 'string') {
        return `"${type.value.toString()}"`
      }
      return type.value.toString()
    case 'pair':
      return `Pair<${formatTypeString(type.headType, formatAsLiteral)}, ${formatTypeString(
        type.tailType,
        formatAsLiteral
      )}>`
    case 'list':
      return `List<${formatTypeString(type.elementType, formatAsLiteral)}>`
    case 'array':
      const elementTypeString = formatTypeString(type.elementType, formatAsLiteral)
      return elementTypeString.includes('|') || elementTypeString.includes('=>')
        ? `(${elementTypeString})[]`
        : `${elementTypeString}[]`
    default:
      return type.kind
  }
}

// Helper functions and constants for parsing types
export function tPrimitive(name: Primitive['name'], value?: string | number | boolean): Primitive {
  return {
    kind: 'primitive',
    name,
    value
  }
}

export function tVar(name: string | number): Variable {
  return {
    kind: 'variable',
    name: `T${name}`,
    constraint: 'none'
  }
}

export function tAddable(name: string): Variable {
  return {
    kind: 'variable',
    name: `${name}`,
    constraint: 'addable'
  }
}

export function tPair(var1: Type, var2: Type): Pair {
  return {
    kind: 'pair',
    headType: var1,
    tailType: var2
  }
}

export function tList(var1: Type, typeAsPair?: Pair): List {
  return {
    kind: 'list',
    elementType: var1,
    // Used in Source Typed variants to check for type mismatches against pairs
    typeAsPair
  }
}

export function tForAll(type: Type): ForAll {
  return {
    kind: 'forall',
    polyType: type
  }
}

export function tArray(var1: Type): SArray {
  return {
    kind: 'array',
    elementType: var1
  }
}

export const tAny = tPrimitive('any')
export const tBool = tPrimitive('boolean')
export const tNumber = tPrimitive('number')
export const tString = tPrimitive('string')
export const tUndef = tPrimitive('undefined')
export const tVoid = tPrimitive('void')
export const tNull = tPrimitive('null')

export function tFunc(...types: Type[]): FunctionType {
  const parameterTypes = types.slice(0, -1)
  const returnType = types.slice(-1)[0]
  return {
    kind: 'function',
    parameterTypes,
    returnType
  }
}

export function tUnion(...types: Type[]): UnionType {
  return {
    kind: 'union',
    types
  }
}

export function tLiteral(value: string | number | boolean): LiteralType {
  return {
    kind: 'literal',
    value
  }
}

export function tPred(ifTrueType: Type | ForAll): PredicateType {
  return {
    kind: 'predicate',
    ifTrueType
  }
}

export const headType = tVar('headType')
export const tailType = tVar('tailType')

// Types for preludes
export const predeclaredNames: [string, BindableType][] = [
  // constants
  ['Infinity', tNumber],
  ['NaN', tNumber],
  ['undefined', tUndef],
  ['math_E', tNumber],
  ['math_LN2', tNumber],
  ['math_LN10', tNumber],
  ['math_LOG2E', tNumber],
  ['math_LOG10E', tNumber],
  ['math_PI', tNumber],
  ['math_SQRT1_2', tNumber],
  ['math_SQRT2', tNumber],
  // is something functions
  ['is_boolean', tPred(tBool)],
  ['is_number', tPred(tNumber)],
  ['is_string', tPred(tString)],
  ['is_undefined', tPred(tUndef)],
  ['is_function', tPred(tForAll(tFunc(tVar('T'), tVar('U'))))],
  // math functions
  ['math_abs', tFunc(tNumber, tNumber)],
  ['math_acos', tFunc(tNumber, tNumber)],
  ['math_acosh', tFunc(tNumber, tNumber)],
  ['math_asin', tFunc(tNumber, tNumber)],
  ['math_asinh', tFunc(tNumber, tNumber)],
  ['math_atan', tFunc(tNumber, tNumber)],
  ['math_atan2', tFunc(tNumber, tNumber, tNumber)],
  ['math_atanh', tFunc(tNumber, tNumber)],
  ['math_cbrt', tFunc(tNumber, tNumber)],
  ['math_ceil', tFunc(tNumber, tNumber)],
  ['math_clz32', tFunc(tNumber, tNumber)],
  ['math_cos', tFunc(tNumber, tNumber)],
  ['math_cosh', tFunc(tNumber, tNumber)],
  ['math_exp', tFunc(tNumber, tNumber)],
  ['math_expm1', tFunc(tNumber, tNumber)],
  ['math_floor', tFunc(tNumber, tNumber)],
  ['math_fround', tFunc(tNumber, tNumber)],
  ['math_hypot', tForAll(tVar('T'))],
  ['math_imul', tFunc(tNumber, tNumber, tNumber)],
  ['math_log', tFunc(tNumber, tNumber)],
  ['math_log1p', tFunc(tNumber, tNumber)],
  ['math_log2', tFunc(tNumber, tNumber)],
  ['math_log10', tFunc(tNumber, tNumber)],
  ['math_max', tForAll(tVar('T'))],
  ['math_min', tForAll(tVar('T'))],
  ['math_pow', tFunc(tNumber, tNumber, tNumber)],
  ['math_random', tFunc(tNumber)],
  ['math_round', tFunc(tNumber, tNumber)],
  ['math_sign', tFunc(tNumber, tNumber)],
  ['math_sin', tFunc(tNumber, tNumber)],
  ['math_sinh', tFunc(tNumber, tNumber)],
  ['math_sqrt', tFunc(tNumber, tNumber)],
  ['math_tan', tFunc(tNumber, tNumber)],
  ['math_tanh', tFunc(tNumber, tNumber)],
  ['math_trunc', tFunc(tNumber, tNumber)],
  // misc functions
  ['parse_int', tFunc(tString, tNumber, tNumber)],
  ['prompt', tFunc(tString, tString)],
  ['get_time', tFunc(tNumber)],
  ['stringify', tForAll(tFunc(tVar('T'), tString))],
  ['display', tForAll(tVar('T'))],
  ['error', tForAll(tVar('T'))]
]

export const pairFuncs: [string, BindableType][] = [
  ['pair', tForAll(tFunc(headType, tailType, tPair(headType, tailType)))],
  ['head', tForAll(tFunc(tPair(headType, tailType), headType))],
  ['tail', tForAll(tFunc(tPair(headType, tailType), tailType))],
  ['is_pair', tPred(tForAll(tPair(headType, tailType)))],
  ['is_null', tPred(tForAll(tList(tVar('T'))))],
  ['is_list', tPred(tForAll(tList(tVar('T'))))]
]

export const mutatingPairFuncs: [string, BindableType][] = [
  ['set_head', tForAll(tFunc(tPair(headType, tailType), headType, tUndef))],
  ['set_tail', tForAll(tFunc(tPair(headType, tailType), tailType, tUndef))]
]

export const arrayFuncs: [string, BindableType][] = [
  ['is_array', tPred(tForAll(tArray(tVar('T'))))],
  ['array_length', tForAll(tFunc(tArray(tVar('T')), tNumber))]
]

export const listFuncs: [string, BindableType][] = [['list', tForAll(tVar('T1'))]]

export const primitiveFuncs: [string, BindableType][] = [
  [NEGATIVE_OP, tFunc(tNumber, tNumber)],
  ['!', tFunc(tBool, tBool)],
  ['&&', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  ['||', tForAll(tFunc(tBool, tVar('T'), tVar('T')))],
  ['<', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['<=', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['>', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['>=', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['+', tForAll(tFunc(tAddable('A'), tAddable('A'), tAddable('A')))],
  ['%', tFunc(tNumber, tNumber, tNumber)],
  ['-', tFunc(tNumber, tNumber, tNumber)],
  ['*', tFunc(tNumber, tNumber, tNumber)],
  ['/', tFunc(tNumber, tNumber, tNumber)]
]

// Source 2 and below restricts === to addables
export const preS3equalityFuncs: [string, BindableType][] = [
  ['===', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))],
  ['!==', tForAll(tFunc(tAddable('A'), tAddable('A'), tBool))]
]

// Source 3 and above allows any values as arguments for ===
export const postS3equalityFuncs: [string, BindableType][] = [
  ['===', tForAll(tFunc(tVar('T1'), tVar('T2'), tBool))],
  ['!==', tForAll(tFunc(tVar('T1'), tVar('T2'), tBool))]
]

export const temporaryStreamFuncs: [string, BindableType][] = [
  ['is_stream', tForAll(tFunc(tVar('T1'), tBool))],
  ['list_to_stream', tForAll(tFunc(tList(tVar('T1')), tVar('T2')))],
  ['stream_to_list', tForAll(tFunc(tVar('T1'), tList(tVar('T2'))))],
  ['stream_length', tForAll(tFunc(tVar('T1'), tNumber))],
  ['stream_map', tForAll(tFunc(tVar('T1'), tVar('T2')))],
  ['build_stream', tForAll(tFunc(tNumber, tFunc(tNumber, tVar('T1')), tVar('T2')))],
  ['stream_for_each', tForAll(tFunc(tFunc(tVar('T1'), tVar('T2')), tBool))],
  ['stream_reverse', tForAll(tFunc(tVar('T1'), tVar('T1')))],
  ['stream_append', tForAll(tFunc(tVar('T1'), tVar('T1'), tVar('T1')))],
  ['stream_member', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_remove', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_remove_all', tForAll(tFunc(tVar('T1'), tVar('T2'), tVar('T2')))],
  ['stream_filter', tForAll(tFunc(tFunc(tVar('T1'), tBool), tVar('T2'), tVar('T2')))],
  ['enum_stream', tForAll(tFunc(tNumber, tNumber, tVar('T1')))],
  ['integers_from', tForAll(tFunc(tNumber, tVar('T1')))],
  ['eval_stream', tForAll(tFunc(tVar('T1'), tNumber, tList(tVar('T2'))))],
  ['stream_ref', tForAll(tFunc(tVar('T1'), tNumber, tVar('T2')))]
]

// Prelude function type overrides for Source Typed variant
// No need to override predicate functions as they are automatically handled by type checker
export const source1TypeOverrides: [string, BindableType][] = [
  // constants
  ['Infinity', tPrimitive('number', Infinity)],
  ['NaN', tPrimitive('number', NaN)],
  ['math_E', tPrimitive('number', Math.E)],
  ['math_LN2', tPrimitive('number', Math.LN2)],
  ['math_LN10', tPrimitive('number', Math.LN10)],
  ['math_LOG2E', tPrimitive('number', Math.LOG2E)],
  ['math_LOG10E', tPrimitive('number', Math.LOG10E)],
  ['math_PI', tPrimitive('number', Math.PI)],
  ['math_SQRT1_2', tPrimitive('number', Math.SQRT1_2)],
  ['math_SQRT2', tPrimitive('number', Math.SQRT2)],
  // math functions
  // TODO: Add support for type checking of functions with variable no. of args
  ['math_hypot', tForAll(tNumber)],
  ['math_max', tForAll(tNumber)],
  ['math_min', tForAll(tNumber)],
  // misc functions
  ['stringify', tFunc(tAny, tString)],
  ['arity', tFunc(tAny, tNumber)],
  ['char_at', tFunc(tString, tNumber, tUnion(tString, tUndef))],
  // TODO: Add support for type checking of functions with variable no. of args
  ['display', tForAll(tAny)],
  ['error', tForAll(tAny)]
]

export const source2TypeOverrides: [string, BindableType][] = [
  // list library functions
  ['accumulate', tFunc(tFunc(tAny, tAny, tAny), tAny, tList(tAny), tAny)],
  ['append', tFunc(tList(tAny), tList(tAny), tList(tAny))],
  ['build_list', tFunc(tFunc(tAny, tAny), tNumber, tList(tAny))],
  ['enum_list', tFunc(tNumber, tNumber, tList(tNumber))],
  ['filter', tFunc(tFunc(tAny, tBool), tList(tAny), tList(tAny))],
  ['for_each', tFunc(tFunc(tAny, tAny), tList(tAny), tBool)],
  ['length', tFunc(tList(tAny), tNumber)],
  ['list_ref', tFunc(tList(tAny), tNumber, tAny)],
  ['list_to_string', tFunc(tList(tAny), tString)],
  ['map', tFunc(tFunc(tAny, tAny), tList(tAny), tList(tAny))],
  ['member', tFunc(tAny, tList(tAny), tList(tAny))],
  ['remove', tFunc(tAny, tList(tAny), tList(tAny))],
  ['remove_all', tFunc(tAny, tList(tAny), tList(tAny))],
  ['reverse', tFunc(tList(tAny), tList(tAny))],
  // misc functions
  // TODO: Add support for type checking of functions with variable no. of args
  ['display_list', tForAll(tAny)],
  ['draw_data', tForAll(tAny)],
  ['equal', tFunc(tAny, tAny, tBool)]
]

export const source3TypeOverrides: [string, BindableType][] = [
  // array functions
  ['array_length', tFunc(tArray(tAny), tNumber)],
  // mutating pair functions
  ['set_head', tFunc(tPair(tAny, tAny), tAny, tUndef)],
  ['set_tail', tFunc(tPair(tAny, tAny), tAny, tUndef)],
  // stream library functions
  ['build_stream', tFunc(tFunc(tAny, tAny), tNumber, tPair(tAny, tFunc(tAny)))],
  ['enum_stream', tFunc(tNumber, tNumber, tPair(tNumber, tFunc(tAny)))],
  ['eval_stream', tFunc(tPair(tAny, tFunc(tAny)), tNumber, tList(tAny))],
  ['integers_from', tFunc(tNumber, tPair(tNumber, tFunc(tAny)))],
  ['list_to_stream', tFunc(tList(tAny), tPair(tAny, tFunc(tAny)))],
  ['stream', tAny],
  [
    'stream_append',
    tFunc(tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))
  ],
  ['stream_filter', tFunc(tFunc(tAny, tBool), tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_for_each', tFunc(tFunc(tAny, tAny), tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_length', tFunc(tPair(tAny, tFunc(tAny)), tNumber)],
  ['stream_map', tFunc(tFunc(tAny, tAny), tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_member', tFunc(tAny, tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_ref', tFunc(tPair(tAny, tFunc(tAny)), tNumber, tAny)],
  ['stream_remove', tFunc(tAny, tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_remove_all', tFunc(tAny, tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_reverse', tFunc(tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_tail', tFunc(tPair(tAny, tFunc(tAny)), tPair(tAny, tFunc(tAny)))],
  ['stream_to_list', tFunc(tPair(tAny, tFunc(tAny)), tList(tAny))]
]

const predeclaredConstTypes: [string, Type][] = [
  ['Infinity', tLiteral(Infinity)],
  ['NaN', tLiteral(NaN)],
  ['math_E', tLiteral(Math.E)],
  ['math_LN2', tLiteral(Math.LN2)],
  ['math_LN10', tLiteral(Math.LN10)],
  ['math_LOG2E', tLiteral(Math.LOG2E)],
  ['math_LOG10E', tLiteral(Math.LOG10E)],
  ['math_PI', tLiteral(Math.PI)],
  ['math_SQRT1_2', tLiteral(Math.SQRT1_2)],
  ['math_SQRT2', tLiteral(Math.SQRT2)]
]

// Creates type environment for the appropriate Source chapter
export function createTypeEnvironment(chapter: Chapter): TypeEnvironment {
  const initialTypeMappings = [...predeclaredNames, ...primitiveFuncs]
  if (chapter >= 2) {
    initialTypeMappings.push(...pairFuncs, ...listFuncs)
  }
  if (chapter >= 3) {
    initialTypeMappings.push(...postS3equalityFuncs, ...mutatingPairFuncs, ...arrayFuncs)
  } else {
    initialTypeMappings.push(...preS3equalityFuncs)
  }

  return [
    {
      typeMap: new Map(initialTypeMappings),
      declKindMap: new Map(initialTypeMappings.map(val => [val[0], 'const'])),
      typeAliasMap: new Map(predeclaredConstTypes)
    }
  ]
}

export function getTypeOverrides(chapter: Chapter): [string, BindableType][] {
  const typeOverrides = [...source1TypeOverrides]
  if (chapter >= 2) {
    typeOverrides.push(...source2TypeOverrides)
  }
  if (chapter >= 3) {
    typeOverrides.push(...source3TypeOverrides)
  }
  return typeOverrides
}
