import { FunctionType, List, Pair, Primitive, Variable } from '../types'

export function primitive(name: Primitive['name']): Primitive {
  return {
    kind: 'primitive',
    name
  }
}

export function variable(name: Variable['name']): Variable {
  return {
    kind: 'variable',
    name
  }
}

export function fn(
  parameterTypes: FunctionType['parameterTypes'],
  returnType: FunctionType['returnType']
): FunctionType {
  return {
    kind: 'function',
    parameterTypes,
    returnType
  }
}

export function list(elementType: List['elementType']): List {
  return {
    kind: 'list',
    elementType
  }
}

export function pair(headType: Pair['headType'], tailType: Pair['tailType']): Pair {
  return {
    kind: 'pair',
    headType,
    tailType
  }
}
