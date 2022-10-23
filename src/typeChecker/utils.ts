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
  Pair,
  PredicateType,
  Primitive,
  PrimitiveType,
  SArray,
  TSTypeAnnotationType,
  Type,
  TypeEnvironment,
  UnionType,
  Variable
} from '../types'

// Name of Unary negative builtin operator
export const NEGATIVE_OP = '-_1'

// Special name used for saving return type in type environment
export const RETURN_TYPE_IDENTIFIER = '//RETURN_TYPE'

export const typeAnnotationKeywordToPrimitiveTypeMap = {
  [TSTypeAnnotationType.TSAnyKeyword]: PrimitiveType.ANY,
  [TSTypeAnnotationType.TSBooleanKeyword]: PrimitiveType.BOOLEAN,
  [TSTypeAnnotationType.TSNullKeyword]: PrimitiveType.NULL,
  [TSTypeAnnotationType.TSNumberKeyword]: PrimitiveType.NUMBER,
  [TSTypeAnnotationType.TSStringKeyword]: PrimitiveType.STRING,
  [TSTypeAnnotationType.TSUndefinedKeyword]: PrimitiveType.UNDEFINED,
  [TSTypeAnnotationType.TSUnknownKeyword]: PrimitiveType.UNKNOWN,
  [TSTypeAnnotationType.TSVoidKeyword]: PrimitiveType.VOID
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

export function setType(name: string, type: BindableType, env: TypeEnvironment): void {
  env[env.length - 1].typeMap.set(name, type)
}

export function setDeclKind(name: string, kind: AllowedDeclarations, env: TypeEnvironment): void {
  env[env.length - 1].declKindMap.set(name, kind)
}

export function pushEnv(env: TypeEnvironment): void {
  env.push({ typeMap: new Map(), declKindMap: new Map() })
}

// Helper functions for formatting types
export function formatTypeString(type: Type): string {
  switch (type.kind) {
    case 'function':
      return formatFunctionTypeString(type)
    case 'union':
      return type.types.map(formatTypeString).join(' | ')
    default:
      return (type as Primitive).name
  }
}

export function formatFunctionTypeString(fnType: FunctionType): string {
  const paramTypes = fnType.parameterTypes
  const paramTypeString =
    paramTypes.length === 0
      ? ''
      : paramTypes.length === 1
      ? formatTypeString(paramTypes[0])
      : paramTypes.reduce((prev, curr) => prev + ', ' + formatTypeString(curr), '')
  return `(${paramTypeString}) => ${formatTypeString(fnType.returnType)}`
}

// Helper functions and constants for parsing types
export function tPrimitive(name: Primitive['name']): Primitive {
  return {
    kind: 'primitive',
    name
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

export function tList(var1: Type): List {
  return {
    kind: 'list',
    elementType: var1
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

export const tAny = tPrimitive(PrimitiveType.ANY)
export const tBool = tPrimitive(PrimitiveType.BOOLEAN)
export const tNumber = tPrimitive(PrimitiveType.NUMBER)
export const tString = tPrimitive(PrimitiveType.STRING)
export const tUndef = tPrimitive(PrimitiveType.UNDEFINED)
export const tUnknown = tPrimitive(PrimitiveType.UNKNOWN)
export const tVoid = tPrimitive(PrimitiveType.VOID)

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
      declKindMap: new Map(initialTypeMappings.map(val => [val[0], 'const']))
    }
  ]
}
