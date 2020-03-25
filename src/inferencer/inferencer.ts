// inference.ts
/**
 * Implements type inference for Source 1 and 2.
 * @version 0.0.1
 * @packageDocumentation
 */

import * as t from './types'
import { Environment, Scope, Type } from './types'
import * as es from 'estree'
import { Context, TypeAnnotatedNode } from '../types'
import { createEnv, toJson } from './util'
import {
  ConsequentAlternateMismatchError,
  InvalidArgumentTypesError,
  InvalidTestConditionError
} from '../errors/typeErrors'

function isInternalError(error: any) {
  return error instanceof t.InternalError
}

/**
 * Unifies two types. This might modify the two types.
 *
 * @param a The first type to be unified.
 * @param b The second type to be unified.
 * @param node
 */

// tslint:disable-next-line:cyclomatic-complexity
function unify(a: Type, b: Type) {
  a = prune(a)
  b = prune(b)

  // if either is an internal error, we throw immediately
  if (a instanceof t.InternalError || b instanceof t.InternalError) {
    throw new t.InternalError()
  }

  if (a instanceof t.Var) {
    if (a !== b) {
      if (occursInType(a, b)) {
        /**
         * unify T1 with Pair<T2, T1>
         */
        if (b instanceof t.Pair && prune(b.types[1]) === a) {
          a.instance = new t.List(b.types[0])
        } else {
          throw new Error('Recursive unification in types ' + a + ' ' + b)
        }
      } else if (a.canContain(b)) {
        a.instance = b
      } else if (b instanceof t.Var && b.canContain(a)) {
        b.instance = a
      } else {
        throw new Error('Unable to unify ' + a + ' with ' + b)
      }
    }
  } else if (!(a instanceof t.Var) && b instanceof t.Var) {
    unify(b, a)
  } else if (!(a instanceof t.Var || b instanceof t.Var)) {
    if (a instanceof t.Polymorphic && b instanceof t.Polymorphic) {
      if (a.name !== b.name) {
        if (a instanceof t.List && b instanceof t.Pair) {
          unify(new t.Pair(a.types[0], a), b)
        } else {
          throw new Error('Type error: ' + a.toString() + ' is not ' + b.toString())
        }
      }
      for (let i = 0; i < a.types.length; i++) {
        unify(a.types[i], b.types[i])
      }
    } else if (a instanceof t.Function && b instanceof t.Function) {
      if (a.argTypes.length !== b.argTypes.length) {
        throw new Error('Type error: ' + a.toString() + ' is not ' + b.toString())
      }
      for (let i = 0; i < a.argTypes.length; i++) {
        unify(a.argTypes[i], b.argTypes[i])
      }
      unify(a.retType, b.retType)
    } else if (a.constructor !== b.constructor) {
      throw new Error(`Unable to unify ${a} with ${b}`)
    }
  } else {
    throw new Error(`Unable to unify ${a} with ${b}`)
  }
}

/**
 * Unchains variables until it gets to a type or a variable without an instance. Unused.
 * @param type  The type to be pruned.
 * @returns The pruned type.
 */
export function prune(type: Type): Type {
  if (type instanceof t.Var && type.instance) {
    type.instance = prune(type.instance)
    return type.instance
  }
  return type
}

function fresh(type: Type, mappings = new Map()): Type {
  type = prune(type)
  if (type instanceof t.Var) {
    if (!mappings.has(type.name)) {
      mappings.set(type.name, type.fresh())
    }
    return mappings.get(type.name)
  } else if (type instanceof t.Function) {
    return new t.Function(
      type.argTypes.map(argType => fresh(argType, mappings)),
      fresh(type.retType, mappings)
    )
  } else if (type instanceof t.Polymorphic) {
    const clone = type.fresh()
    clone.types = clone.types.map((elementType: t.Type) => fresh(elementType, mappings))
    return clone
  } else {
    return type
  }
}

function occursInType(t1: Type, t2: Type): boolean {
  t2 = prune(t2)
  if (t2 === t1) {
    return true
  } else if (t2 instanceof t.Function) {
    return occursInTypeArray(t1, t2.argTypes) || occursInType(t1, t2.retType)
  } else if (t2 instanceof t.Polymorphic) {
    return occursInTypeArray(t1, t2.types)
  }
  return false
}

function occursInTypeArray(t1: t.Type, types: t.Type[]) {
  return types.some(t2 => occursInType(t1, t2))
}

function getFreshTypeIfNeeded(name: string, env: Environment): Type {
  let currentEnv = env
  while (currentEnv !== null) {
    if (currentEnv[0].has(name)) {
      const type = currentEnv[0].get(name)!
      return currentEnv[0].shouldGeneralise() ? type : fresh(type)
    }
    currentEnv = currentEnv[1]
  }
  throw new Error('Undefined name ' + name)
}

// extracts the T out of List<T>
function getListTypeVar(candidate: Type): Type | null {
  const instance = prune(candidate)
  if (instance instanceof t.List) {
    return instance.types[0]
  }
  return null
}

/**
 * Transforms List<T> into Pair<T, List<T>>
 *     and Pair<T, Pair<T, List<T>>> into Pair<T, List<T>>
 * @param type
 */
function normalise(type: Type): Type {
  const listVar = getListTypeVar(type)
  // if it has a list type, return it.
  if (listVar !== null) {
    return new t.Pair(listVar, type)
  }
  const instance = prune(type)
  if (instance instanceof t.Pair) {
    // tail is the tail in Pair<head, tail>
    const tail = (instance.types[1] = prune(instance.types[1]))
    // if tail = Pair<X, List<Y>>
    if (tail instanceof t.Pair && getListTypeVar(tail.types[1]) !== null) {
      try {
        // try to unify X with Y
        unify(tail.types[0], getListTypeVar(tail.types[1])!)
        // and X with head
        unify(tail.types[0], instance.types[0])
        return tail
      } catch {
        // return the original type if unable to unify
        return type
      }
    }
  }
  return type
}

function getParamTypesAndEnv(
  node: es.FunctionDeclaration | es.ArrowFunctionExpression,
  env: Environment
): [Type[], Environment] {
  const scopeMap = new Scope()
  const newEnv: Environment = [scopeMap, env]
  const paramTypes = node.params.map((param: es.Pattern) => {
    param = param as es.Identifier
    const paramType = new t.Var()
    scopeMap.set(param.name, paramType)
    return paramType
  })
  return [paramTypes, newEnv]
}

/**
 * Analyses the types of a program.
 * @param   node        The program.
 * @param context
 * @param   env         The environment in which the program is run.
 * @returns The type of the program.
 */
export function analyse(
  node: TypeAnnotatedNode<es.Node>,
  context: Context,
  env: Environment = createEnv(context)
): Type {
  function analyseApplication(
    fun: es.Expression | es.BinaryExpression | es.UnaryExpression | es.LogicalExpression,
    args: es.Node[]
  ): Type {
    const argTypes = args.map(arg => analyse(arg, context, env))
    const resultType = new t.Var()
    const funType: t.Function = ('operator' in fun
      ? getFreshTypeIfNeeded(fun.operator, env)
      : analyse(fun, context, env)) as t.Function
    try {
      unify(new t.Function(argTypes, resultType), funType)
    } catch (e) {
      if (!isInternalError(e)) {
        const error = new InvalidArgumentTypesError(
          fun,
          (prune(funType) as t.Function).argTypes.map(toJson),
          argTypes.map(toJson)
        )
        context.errors.push(error)
      }
      return new t.InternalError()
    }
    return resultType
  }
  function analyseIf(conditional: es.ConditionalExpression | es.IfStatement): Type {
    const testType = analyse(conditional.test, context, env)
    try {
      unify(testType, new t.Bool())
    } catch (e) {
      if (!isInternalError(e)) {
        context.errors.push(new InvalidTestConditionError(conditional, toJson(testType)))
      }
      return new t.InternalError()
    }
    const consequentType = analyse(conditional.consequent, context, env)
    const alternateType = analyse(conditional.alternate!, context, env)
    try {
      unify(consequentType, alternateType)
    } catch (e) {
      if (!isInternalError(e)) {
        context.errors.push(
          new ConsequentAlternateMismatchError(
            conditional,
            toJson(consequentType),
            toJson(alternateType)
          )
        )
      }
      return new t.InternalError()
    }
    return consequentType
  }
  let result = (() => {
    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
        const scopeMap = new Scope()

        const body = (node as TypeAnnotatedNode<es.BlockStatement>).body
        // add in variables for all declarations in the scope.
        // once we reach an "Untypable" function declaration, we stop the
        // genericising after the previous Typable function declaration and start instantiation for that scope.
        let hasReachedUntypableFunction = false
        let previousFunctionDeclaration: es.FunctionDeclaration | null = null
        for (const statement of body) {
          if (statement.type === 'VariableDeclaration') {
            scopeMap.set(
              ((statement as es.VariableDeclaration).declarations[0].id as es.Identifier).name,
              new t.Var()
            )
          } else if (statement.type === 'FunctionDeclaration') {
            scopeMap.set((statement as es.FunctionDeclaration).id?.name!, new t.Var())
            if (
              !hasReachedUntypableFunction &&
              (statement as TypeAnnotatedNode<es.FunctionDeclaration>).typability === 'Untypable' &&
              previousFunctionDeclaration !== null
            ) {
              scopeMap.stopGeneralisingAfter(previousFunctionDeclaration)
              hasReachedUntypableFunction = true
            } else {
              previousFunctionDeclaration = statement
            }
          }
        }

        if (previousFunctionDeclaration === null) {
          // if there are no function declarations, we immediately stop generalising and start instantiation.
          scopeMap._shouldGeneralise = false
        } else if (!hasReachedUntypableFunction) {
          // if all function declarations are typable, we choose to stop generalising after the very last
          // function declaration.
          scopeMap.stopGeneralisingAfter(previousFunctionDeclaration)
        }
        const newEnv: Environment = [scopeMap, env]
        const bodyTypes = body.map((statement: es.Node) => analyse(statement, context, newEnv))
        for (const statement of body) {
          if (
            statement.type === 'VariableDeclaration' ||
            statement.type === 'FunctionDeclaration'
          ) {
            const id =
              statement.type === 'VariableDeclaration'
                ? (statement.declarations[0].id as es.Identifier).name
                : statement.id?.name!
            const type = scopeMap.get(id)!
            const annotated = statement as TypeAnnotatedNode<es.VariableDeclaration>
            try {
              annotated.inferredType = toJson(type)
              annotated.typability = 'Typed'
            } catch {
              annotated.typability = 'Untypable'
            }
          }
        }
        // find the first return value, undefined otherwise.
        return bodyTypes.find(type => !(type instanceof t.Undefined)) ?? new t.Undefined()
      case 'Identifier':
        const name = node.name
        return getFreshTypeIfNeeded(name, env)
      case 'VariableDeclaration':
        const declaration = node.declarations[0]
        const valueType: t.Var = env![0].get((declaration.id as es.Identifier).name)! as t.Var
        try {
          unify(valueType, analyse(declaration.init!, context, env))
        } catch {
          valueType.instance = new t.InternalError()
        }
        return new t.Undefined()
      case 'Literal':
        if (node.value === null) {
          return new t.List(new t.Var())
        }
        switch (typeof node.value) {
          case 'boolean':
            return new t.Bool()
          case 'number':
            // below is for integer, not used for now.
            // return Number.isInteger(node.value) ? new t.Number() : new t.Float()
            return new t.Float()
          case 'string':
            return new t.String()
          default:
            throw new Error('Unknown literal ' + node.value)
        }
      case 'FunctionDeclaration': {
        const functionName = node.id?.name!
        const typeName = env![0].get(functionName)! as t.Var
        const [paramTypes, functionEnv] = getParamTypesAndEnv(node, env)
        try {
          const returnType = analyse(node.body, context, functionEnv)
          const functionType = new t.Function(paramTypes, returnType)
          unify(typeName, functionType)
        } catch (e) {
          typeName.instance = new t.InternalError()
        }

        // after each unification of a function declaration, we check to see if we should stop generalisation
        // for the rest of the scope.
        env![0].stopGeneralisation(node)

        return new t.Undefined()
      }
      case 'IfStatement':
      case 'ConditionalExpression':
        return analyseIf(node)
      case 'ReturnStatement':
        return analyse(node.argument as es.Node, context, env)
      case 'ExpressionStatement':
        analyse(node.expression, context, env)
        return new t.Undefined()
      case 'ArrowFunctionExpression': {
        const [paramTypes, functionEnv] = getParamTypesAndEnv(node, env)
        const returnType = analyse(node.body, context, functionEnv)
        return new t.Function(paramTypes, returnType)
      }
      case 'CallExpression':
        return analyseApplication(node.callee as es.Expression, node.arguments as es.Expression[])
      case 'UnaryExpression':
        return analyseApplication(node, [node.argument])
      case 'BinaryExpression':
      case 'LogicalExpression':
        return analyseApplication(node, [node.left, node.right])
      default:
        throw new Error('Unknown node type ' + node.type)
    }
  })()

  result = normalise(result)
  try {
    node.typability = 'Typed'
    node.inferredType = toJson(result)
  } catch {
    node.typability = 'Untypable'
  }
  return result
}
