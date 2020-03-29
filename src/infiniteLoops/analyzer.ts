import * as es from 'estree'
import * as stype from './symTypes'
import { Environment } from '../types'
import { serialize } from './serializer'
import { symbolicExecute } from './symbolicExecutor'

function makeUnaryChecker(
  name1: string,
  constant: number,
  direction: number
): stype.infiniteLoopChecker {
  const test: {
    [num: string]: stype.infiniteLoopChecker
  } = {
    '-1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] < constant
    },
    '1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] > constant
    },
    '0'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] === constant
    }
  }
  return test[direction.toString()]
}
function simpleCheck(symLists: stype.SSymbol[]): stype.infiniteLoopChecker | undefined {
  if (
    symLists.length === 3 &&
    symLists[0].type === 'FunctionSymbol' &&
    symLists[1].type === 'InequalitySymbol' &&
    symLists[2].type === 'FunctionSymbol' &&
    symLists[0].name === symLists[0].name &&
    symLists[0].args.length === 1
  ) {
    // TODO make more general
    const to = symLists[2].args[0]
    const direction = symLists[1].direction
    if (to.type === 'NumberSymbol' && to.constant * direction > 0) {
      return makeUnaryChecker(symLists[0].name, symLists[1].constant, direction)
    }
  }
  return undefined
}
function getFirstCall(node: es.FunctionDeclaration): stype.SSymbol {
  function doParam(param: es.Node) {
    if (param.type === 'Identifier') {
      return stype.makeNumberSymbol(param.name, 0)
    }
    return stype.unusedSymbol
  }
  const id = node.id as es.Identifier
  const args = node.params.map(doParam)
  return stype.makeFunctionSymbol(id.name, args)
}
export function toName(node: es.FunctionDeclaration, env: Environment) {
  const firstCall = getFirstCall(node)
  const symTree = symbolicExecute(node.body, [new Map()], env)
  const symLists = serialize(symTree).map(x => [firstCall].concat(x))
  const util = require('util')
  return symLists.map(simpleCheck).filter(x => x !== undefined) as stype.infiniteLoopChecker[]
}
