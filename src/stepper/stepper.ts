import { generate } from 'astring'
import type * as es from 'estree'

import { type IOptions } from '..'
import * as errors from '../errors/errors'
import { UndefinedImportError } from '../modules/errors'
import { initModuleContextAsync, loadModuleBundleAsync } from '../modules/moduleLoaderAsync'
import type { ImportTransformOptions } from '../modules/moduleTypes'
import { parse } from '../parser/parser'
import { checkProgramForUndefinedVariables } from '../transpiler/transpiler'
import {
  BlockExpression,
  Context,
  ContiguousArrayElementExpression,
  ContiguousArrayElements,
  FunctionDeclarationExpression,
  substituterNodes
} from '../types'
import assert from '../utils/assert'
import { filterImportDeclarations } from '../utils/ast/helpers'
import * as ast from '../utils/astCreator'
import {
  dummyBlockExpression,
  dummyBlockStatement,
  dummyExpression,
  dummyProgram,
  dummyStatement,
  dummyVariableDeclarator
} from '../utils/dummyAstCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import { nodeToValue, objectToString, valueToExpression } from './converter'
import * as builtin from './lib'
import {
  currentEnvironment,
  declareIdentifier,
  defineVariable,
  getDeclaredNames,
  handleRuntimeError,
  isAllowedLiterals,
  isBuiltinFunction,
  isImportedFunction,
  isNegNumber
} from './util'

const irreducibleTypes = new Set<string>([
  'Literal',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ArrayExpression'
])

function isIrreducible(node: substituterNodes, context: Context) {
  return (
    isBuiltinFunction(node) ||
    isImportedFunction(node, context) ||
    isAllowedLiterals(node) ||
    isNegNumber(node) ||
    irreducibleTypes.has(node.type)
  )
}

function isStatementsReducible(progs: es.Program, context: Context): boolean {
  if (progs.body.length === 0) return false
  if (progs.body.length > 1) return true

  const [lastStatement] = progs.body

  if (lastStatement.type !== 'ExpressionStatement') {
    return true
  }
  return !isIrreducible(lastStatement.expression, context)
}

type irreducibleNodes =
  | es.FunctionExpression
  | es.ArrowFunctionExpression
  | es.Literal
  | es.ArrayExpression

function scanOutBoundNames(
  node: es.BlockStatement | BlockExpression | es.Expression
): es.Identifier[] {
  const declaredIds: es.Identifier[] = []
  if (node.type == 'ArrowFunctionExpression') {
    for (const param of node.params) {
      declaredIds.push(param as es.Identifier)
    }
  } else if (node.type == 'BlockExpression' || node.type == 'BlockStatement') {
    for (const stmt of node.body) {
      // if stmt is assignment or functionDeclaration
      // add stmt into a set of identifiers
      // return that set
      if (stmt.type === 'VariableDeclaration') {
        stmt.declarations
          .map(decn => (decn as es.VariableDeclarator).id as es.Identifier)
          .forEach(name => declaredIds.push(name))
        for (const decn of stmt.declarations) {
          if (
            decn.init !== null &&
            decn.init !== undefined &&
            decn.init.type == 'ArrowFunctionExpression'
          ) {
            for (const param of decn.init.params) {
              declaredIds.push(param as es.Identifier)
            }
          }
        }
      } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
        declaredIds.push(stmt.id)
        stmt.params.forEach(param => declaredIds.push(param as es.Identifier))
      }
    }
  }
  return declaredIds
}

function scanOutDeclarations(
  node: es.BlockStatement | BlockExpression | es.Expression | es.Program
): es.Identifier[] {
  const declaredIds: es.Identifier[] = []
  if (
    node.type === 'BlockExpression' ||
    node.type === 'BlockStatement' ||
    node.type === 'Program'
  ) {
    for (const stmt of node.body) {
      // if stmt is assignment or functionDeclaration
      // add stmt into a set of identifiers
      // return that set
      if (stmt.type === 'VariableDeclaration') {
        stmt.declarations
          .map(decn => (decn as es.VariableDeclarator).id as es.Identifier)
          .forEach(name => declaredIds.push(name))
      } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
        declaredIds.push(stmt.id)
      }
    }
  }
  return declaredIds
}

function getFreshName(
  paramName: string,
  counter: number,
  freeTarget: string[],
  freeReplacement: string[],
  boundTarget: es.Identifier[],
  boundUpperScope: string[],
  boundReplacement: es.Identifier[]
): string {
  let added = true
  while (added) {
    added = false
    for (const f of freeTarget) {
      if (paramName + '_' + counter === f) {
        counter++
        added = true
      }
    }
    for (const free of freeReplacement) {
      if (paramName + '_' + counter === free) {
        counter++
        added = true
      }
    }
    for (const notFree of boundTarget) {
      if (paramName + '_' + counter === notFree.name) {
        counter++
        added = true
      }
    }
    for (const boundName of boundUpperScope) {
      if (paramName + '_' + counter === boundName) {
        counter++
        added = true
      }
    }
    for (const identifier of boundReplacement) {
      if (paramName + '_' + counter === identifier.name) {
        counter++
        added = true
      }
    }
  }
  return paramName + '_' + counter
}

function findMain(
  target:
    | es.FunctionExpression
    | es.ArrowFunctionExpression
    | es.BlockStatement
    | BlockExpression
    | es.FunctionDeclaration
    | es.Program,
  seenBefore: Map<substituterNodes, substituterNodes>
): string[] {
  const params: string[] = []
  if (
    target.type == 'FunctionExpression' ||
    target.type == 'ArrowFunctionExpression' ||
    target.type === 'FunctionDeclaration'
  ) {
    if (target.type == 'FunctionExpression' || target.type === 'FunctionDeclaration') {
      params.push(target.id!.name)
    }
    for (let i = 0; i < target.params.length; i++) {
      params.push((target.params[i] as es.Identifier).name)
    }
  }

  const freeNames: any[] = []

  const finders = {
    Identifier(target: es.Identifier): void {
      seenBefore.set(target, target)
      let bound = false
      for (let i = 0; i < params.length; i++) {
        if (target.name == params[i]) {
          bound = true
          break
        }
      }
      if (!bound) {
        freeNames.push(target.name)
      }
    },

    ExpressionStatement(target: es.ExpressionStatement): void {
      seenBefore.set(target, target)
      find(target.expression)
    },

    BinaryExpression(target: es.BinaryExpression): void {
      seenBefore.set(target, target)
      find(target.left)
      find(target.right)
    },

    UnaryExpression(target: es.UnaryExpression): void {
      seenBefore.set(target, target)
      find(target.argument)
    },

    ConditionalExpression(target: es.ConditionalExpression): void {
      seenBefore.set(target, target)
      find(target.test)
      find(target.consequent)
      find(target.alternate)
    },

    LogicalExpression(target: es.LogicalExpression): void {
      seenBefore.set(target, target)
      find(target.left)
      find(target.right)
    },

    CallExpression(target: es.CallExpression): void {
      seenBefore.set(target, target)
      for (let i = 0; i < target.arguments.length; i++) {
        find(target.arguments[i])
      }
      find(target.callee)
    },

    FunctionDeclaration(target: es.FunctionDeclaration): void {
      seenBefore.set(target, target)
      const freeInNested = findMain(target, seenBefore)
      for (const free of freeInNested) {
        let bound = false
        for (const param of params) {
          if (free === param) {
            bound = true
          }
        }
        if (!bound) {
          freeNames.push(free)
        }
      }
    },

    ArrowFunctionExpression(target: es.ArrowFunctionExpression): void {
      seenBefore.set(target, target)
      const freeInNested = findMain(target, seenBefore)
      for (const free of freeInNested) {
        let bound = false
        for (const param of params) {
          if (free === param) {
            bound = true
          }
        }
        if (!bound) {
          freeNames.push(free)
        }
      }
    },

    Program(target: es.Program): void {
      seenBefore.set(target, target)
      target.body.forEach(stmt => {
        find(stmt)
      })
    },

    BlockStatement(target: es.BlockStatement): void {
      seenBefore.set(target, target)
      const declaredNames: Set<string> = getDeclaredNames(target)
      for (const item of declaredNames.values()) {
        params.push(item)
      }
      target.body.forEach(stmt => {
        find(stmt)
      })
    },

    BlockExpression(target: BlockExpression): void {
      seenBefore.set(target, target)
      const declaredNames: Set<string> = getDeclaredNames(target)
      for (const item of declaredNames.values()) {
        params.push(item)
      }
      target.body.forEach(stmt => {
        find(stmt)
      })
    },

    ReturnStatement(target: es.ReturnStatement): void {
      seenBefore.set(target, target)
      find(target.argument!)
    },

    VariableDeclaration(target: es.VariableDeclaration): void {
      seenBefore.set(target, target)
      target.declarations.forEach(dec => {
        find(dec)
      })
    },

    VariableDeclarator(target: es.VariableDeclarator): void {
      seenBefore.set(target, target)
      find(target.init!)
    },

    IfStatement(target: es.IfStatement): void {
      seenBefore.set(target, target)
      find(target.test)
      find(target.consequent)
      find(target.alternate)
    },

    ArrayExpression(target: es.ArrayExpression): void {
      seenBefore.set(target, target)
      target.elements.forEach(ele => {
        find(ele)
      })
    }
  }

  function find(target: any): void {
    const result = seenBefore.get(target)
    if (!result) {
      const finder = finders[target.type]
      if (finder === undefined) {
        seenBefore.set(target, target)
      } else {
        return finder(target)
      }
    }
  }
  find(target.body)
  return freeNames
}

/* tslint:disable:no-shadowed-variable */
// wrapper function, calls substitute immediately.
function substituteMain(
  name: es.Identifier,
  replacement: irreducibleNodes | es.Identifier,
  target: substituterNodes,
  paths: string[][]
): [substituterNodes, string[][]] {
  const seenBefore: Map<substituterNodes, substituterNodes> = new Map()

  // initialises array to keep track of all paths visited
  // without modifying input path array
  const allPaths: string[][] = []
  let allPathsIndex = 0
  const endMarker = '$'

  if (paths[0] === undefined) {
    allPaths.push([])
  } else {
    allPaths.push([...paths[0]])
  }

  // substituters will stop expanding the path if index === -1
  const pathNotEnded = (index: number) => index > -1

  // branches out path into two different paths,
  // returns array index of branched path
  function branch(index: number): number {
    allPathsIndex++
    allPaths[allPathsIndex] = [...allPaths[index]]
    return allPathsIndex
  }

  // keeps track of names in upper scope so that it doesnt rename to these names
  const boundUpperScope: string[] = []

  /**
   * Substituters are invoked only when the target is not seen before,
   *  therefore each function has the responsbility of registering the
   *  [target, replacement] pair in seenBefore.
   * How substituters work:
   * 1. Create dummy replacement and push [target, dummyReplacement]
   *    into the seenBefore array.
   * 2. [Recursive step] substitute the children;
   *    for each child, branch out the current path
   *    and push the appropriate access string into the path
   * 3. Return the dummyReplacement
   */
  const substituters = {
    // if name to be replaced is found,
    // push endMarker into path
    Identifier(
      target: es.Identifier,
      index: number
    ): es.Identifier | FunctionDeclarationExpression | es.Literal | es.Expression {
      const re = / rename$/
      if (replacement.type === 'Literal') {
        // only accept string, boolean and numbers for arguments
        if (target.name === name.name) {
          if (pathNotEnded(index)) {
            allPaths[index].push(endMarker)
          }
          return ast.primitive(replacement.value)
        } else {
          return target
        }
      } else if (replacement.type === 'Identifier' && re.test(replacement.name)) {
        if (target.name === name.name) {
          if (pathNotEnded(index)) {
            allPaths[index].push(endMarker)
          }
          return ast.identifier(replacement.name.split(' ')[0], replacement.loc)
        } else {
          return target
        }
      } else {
        if (target.name === name.name) {
          if (pathNotEnded(index)) {
            allPaths[index].push(endMarker)
          }
          return substitute(replacement, -1) as FunctionDeclarationExpression
        } else {
          return target
        }
      }
    },

    ExpressionStatement(target: es.ExpressionStatement, index: number): es.ExpressionStatement {
      const substedExpressionStatement = ast.expressionStatement(dummyExpression())
      seenBefore.set(target, substedExpressionStatement)
      if (pathNotEnded(index)) {
        allPaths[index].push('expression')
      }
      substedExpressionStatement.expression = substitute(target.expression, index) as es.Expression
      return substedExpressionStatement
    },

    BinaryExpression(target: es.BinaryExpression, index: number): es.BinaryExpression {
      const substedBinaryExpression = ast.binaryExpression(
        target.operator,
        dummyExpression(),
        dummyExpression(),
        target.loc
      )
      seenBefore.set(target, substedBinaryExpression)
      let nextIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        allPaths[index].push('left')
        allPaths[nextIndex].push('right')
      }
      substedBinaryExpression.left = substitute(target.left, index) as es.Expression
      substedBinaryExpression.right = substitute(target.right, nextIndex) as es.Expression
      return substedBinaryExpression
    },

    UnaryExpression(target: es.UnaryExpression, index: number): es.UnaryExpression {
      const substedUnaryExpression = ast.unaryExpression(
        target.operator,
        dummyExpression(),
        target.loc
      )
      seenBefore.set(target, substedUnaryExpression)
      if (pathNotEnded(index)) {
        allPaths[index].push('argument')
      }
      substedUnaryExpression.argument = substitute(target.argument, index) as es.Expression
      return substedUnaryExpression
    },

    ConditionalExpression(
      target: es.ConditionalExpression,
      index: number
    ): es.ConditionalExpression {
      const substedConditionalExpression = ast.conditionalExpression(
        dummyExpression(),
        dummyExpression(),
        dummyExpression(),
        target.loc
      )
      seenBefore.set(target, substedConditionalExpression)
      let nextIndex = index
      let thirdIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        thirdIndex = branch(index)
        allPaths[index].push('test')
        allPaths[nextIndex].push('consequent')
        allPaths[thirdIndex].push('alternate')
      }
      substedConditionalExpression.test = substitute(target.test, index) as es.Expression
      substedConditionalExpression.consequent = substitute(
        target.consequent,
        nextIndex
      ) as es.Expression
      substedConditionalExpression.alternate = substitute(
        target.alternate,
        thirdIndex
      ) as es.Expression
      return substedConditionalExpression
    },

    LogicalExpression(target: es.LogicalExpression, index: number): es.LogicalExpression {
      const substedLocialExpression = ast.logicalExpression(
        target.operator,
        target.left,
        target.right
      )
      seenBefore.set(target, substedLocialExpression)
      let nextIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        allPaths[index].push('left')
        allPaths[nextIndex].push('right')
      }
      substedLocialExpression.left = substitute(target.left, index) as es.Expression
      substedLocialExpression.right = substitute(target.right, nextIndex) as es.Expression
      return substedLocialExpression
    },

    CallExpression(target: es.CallExpression, index: number): es.CallExpression {
      const dummyArgs = target.arguments.map(() => dummyExpression())
      const substedCallExpression = ast.callExpression(dummyExpression(), dummyArgs, target.loc)
      seenBefore.set(target, substedCallExpression)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 0; i < target.arguments.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('arguments[' + i + ']')
        }
        arr[i] = nextIndex
        dummyArgs[i] = substitute(target.arguments[i], nextIndex) as es.Expression
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('callee')
      }
      substedCallExpression.callee = substitute(target.callee, index) as es.Expression
      return substedCallExpression
    },

    FunctionDeclaration(target: es.FunctionDeclaration, index: number): es.FunctionDeclaration {
      const substedParams: es.Identifier[] = []
      // creates a copy of the params so that the renaming only happens during substitution.
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i] as es.Identifier
        substedParams.push(ast.identifier(param.name, param.loc))
      }
      const re = / rename$/
      let newID: es.Identifier
      let newBody = target.body
      if (replacement.type === 'Identifier' && re.test(replacement.name)) {
        // renaming function name
        newID = ast.identifier(replacement.name.split(' ')[0], replacement.loc)
      } else {
        newID = ast.identifier((target.id as es.Identifier).name, target.loc)
      }
      const substedFunctionDeclaration = ast.functionDeclaration(
        newID,
        substedParams,
        dummyBlockStatement()
      )
      seenBefore.set(target, substedFunctionDeclaration)
      let freeReplacement: any[] = []
      let boundReplacement: es.Identifier[] = []
      if (
        replacement.type == 'FunctionExpression' ||
        replacement.type == 'ArrowFunctionExpression'
      ) {
        freeReplacement = findMain(replacement, new Map())
        boundReplacement = scanOutBoundNames(replacement.body)
      }
      const freeTarget = findMain(target, new Map())
      const boundTarget = scanOutBoundNames(target.body)
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i]
        if (param.type === 'Identifier' && param.name === name.name) {
          substedFunctionDeclaration.body = target.body
          return substedFunctionDeclaration
        }
        if (param.type == 'Identifier') {
          if (freeReplacement.includes(param.name)) {
            // change param name
            const re = /_\d+$/
            let newNum
            if (re.test(param.name)) {
              const num = param.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              newBody = substituteMain(param, changed, target.body, [[]])[0] as es.BlockStatement
              ;(substedFunctionDeclaration.params[i] as es.Identifier).name = changedName
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                param.name,
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              newBody = substituteMain(param, changed, target.body, [[]])[0] as es.BlockStatement
              ;(substedFunctionDeclaration.params[i] as es.Identifier).name = changedName
            }
          }
        }
      }

      for (const param of substedParams) {
        boundUpperScope.push(param.name)
      }

      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedFunctionDeclaration.body = substitute(newBody, index) as es.BlockStatement
      return substedFunctionDeclaration
    },

    FunctionExpression(target: es.FunctionExpression, index: number): es.FunctionExpression {
      const substedParams: es.Identifier[] = []
      // creates a copy of the params so that the renaming only happens during substitution.
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i] as es.Identifier
        substedParams.push(ast.identifier(param.name, param.loc))
      }
      const substedFunctionExpression = target.id
        ? ast.functionDeclarationExpression(target.id, substedParams, dummyBlockStatement())
        : ast.functionExpression(substedParams, dummyBlockStatement())
      seenBefore.set(target, substedFunctionExpression)
      // check for free/bounded variable in replacement
      let freeReplacement: any[] = []
      let boundReplacement: es.Identifier[] = []
      if (
        replacement.type == 'FunctionExpression' ||
        replacement.type == 'ArrowFunctionExpression'
      ) {
        freeReplacement = findMain(replacement, new Map())
        boundReplacement = scanOutBoundNames(replacement.body)
      }
      const freeTarget = findMain(target, new Map())
      const boundTarget = scanOutBoundNames(target.body)
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i]
        if (param.type === 'Identifier' && param.name === name.name) {
          substedFunctionExpression.body = target.body
          return substedFunctionExpression
        }
        if (param.type == 'Identifier') {
          if (freeReplacement.includes(param.name)) {
            // change param name
            const re = /_\d+$/
            let newNum
            if (re.test(param.name)) {
              const num = param.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              target.body = substituteMain(param, changed, target.body, [
                []
              ])[0] as es.BlockStatement
              ;(substedFunctionExpression.params[i] as es.Identifier).name = changedName
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                param.name,
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              target.body = substituteMain(param, changed, target.body, [
                []
              ])[0] as es.BlockStatement
              ;(substedFunctionExpression.params[i] as es.Identifier).name = changedName
            }
          }
        }
      }

      for (const param of substedParams) {
        boundUpperScope.push(param.name)
      }

      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedFunctionExpression.body = substitute(target.body, index) as es.BlockStatement
      return substedFunctionExpression
    },

    Program(target: es.Program, index: number): es.Program {
      const substedBody = target.body.map(() => dummyStatement())
      const substedProgram = ast.program(substedBody)
      seenBefore.set(target, substedProgram)
      const declaredNames: Set<string> = getDeclaredNames(target)
      const re = / same/
      // checks if the replacement is a functionExpression or arrowFunctionExpression and not from within the same block
      if (
        (replacement.type == 'FunctionExpression' ||
          replacement.type == 'ArrowFunctionExpression') &&
        !re.test(name.name)
      ) {
        const freeTarget: string[] = findMain(target, new Map())
        const declaredIds: es.Identifier[] = scanOutDeclarations(target)
        const freeReplacement: string[] = findMain(replacement, new Map())
        const boundReplacement: es.Identifier[] = scanOutDeclarations(replacement.body)
        for (const declaredId of declaredIds) {
          if (freeReplacement.includes(declaredId.name)) {
            const re = /_\d+$/
            let newNum
            if (re.test(declaredId.name)) {
              const num = declaredId.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as es.Program
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                declaredId.name,
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as es.Program
            }
          }
        }
      }

      const re2 = / rename/
      if (declaredNames.has(name.name) && !re2.test(name.name)) {
        substedProgram.body = target.body
        return substedProgram
      }

      // if it is from the same block then the name would be name + " same", hence need to remove " same"
      // if not this statement does nothing as variable names should not have spaces
      name.name = name.name.split(' ')[0]

      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedProgram.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedProgram
    },

    BlockStatement(target: es.BlockStatement, index: number): es.BlockStatement {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockStatement = ast.blockStatement(substedBody)
      seenBefore.set(target, substedBlockStatement)
      const declaredNames: Set<string> = getDeclaredNames(target)
      const re = / same/
      // checks if the replacement is a functionExpression or arrowFunctionExpression and not from within the same block
      if (
        (replacement.type == 'FunctionExpression' ||
          replacement.type == 'ArrowFunctionExpression') &&
        !re.test(name.name)
      ) {
        const freeTarget: string[] = findMain(target, new Map())
        const declaredIds: es.Identifier[] = scanOutDeclarations(target)
        const freeReplacement: string[] = findMain(replacement, new Map())
        const boundReplacement: es.Identifier[] = scanOutDeclarations(replacement.body)
        for (const declaredId of declaredIds) {
          if (freeReplacement.includes(declaredId.name)) {
            const re = /_\d+$/
            let newNum
            if (re.test(declaredId.name)) {
              const num = declaredId.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as es.BlockStatement
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                declaredId.name,
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as es.BlockStatement
            }
          }
        }
      }

      const re2 = / rename/
      if (declaredNames.has(name.name) && !re2.test(name.name)) {
        substedBlockStatement.body = target.body
        return substedBlockStatement
      }

      // if it is from the same block then the name would be name + " same", hence need to remove " same"
      // if not this statement does nothing as variable names should not have spaces
      name.name = name.name.split(' ')[0]

      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedBlockStatement.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedBlockStatement
    },

    BlockExpression(target: BlockExpression, index: number): BlockExpression {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockExpression = ast.blockExpression(substedBody)
      seenBefore.set(target, substedBlockExpression)
      const declaredNames: Set<string> = getDeclaredNames(target)
      const re = / same/
      // checks if the replacement is a functionExpression or arrowFunctionExpression and not from within the same block
      if (
        (replacement.type == 'FunctionExpression' ||
          replacement.type == 'ArrowFunctionExpression') &&
        !re.test(name.name)
      ) {
        const freeTarget: string[] = findMain(target, new Map())
        const declaredIds: es.Identifier[] = scanOutDeclarations(target)
        const freeReplacement: string[] = findMain(replacement, new Map())
        const boundReplacement: es.Identifier[] = scanOutDeclarations(replacement.body)
        for (const declaredId of declaredIds) {
          if (freeReplacement.includes(declaredId.name)) {
            const re = /_\d+$/
            let newNum
            if (re.test(declaredId.name)) {
              const num = declaredId.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as BlockExpression
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                declaredId.name,
                newNum,
                freeTarget,
                freeReplacement,
                declaredIds,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName + ' rename', declaredId.loc)
              const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
              target = substituteMain(newName, changed, target, [[]])[0] as BlockExpression
            }
          }
        }
      }

      const re2 = / rename/
      if (declaredNames.has(name.name) && !re2.test(name.name)) {
        substedBlockExpression.body = target.body
        return substedBlockExpression
      }

      // if it is from the same block then the name would be name + " same", hence need to remove " same"
      // if not this statement does nothing as variable names should not have spaces
      name.name = name.name.split(' ')[0]

      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedBlockExpression.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedBlockExpression
    },

    ReturnStatement(target: es.ReturnStatement, index: number): es.ReturnStatement {
      const substedReturnStatement = ast.returnStatement(dummyExpression(), target.loc)
      seenBefore.set(target, substedReturnStatement)
      if (pathNotEnded(index)) {
        allPaths[index].push('argument')
      }
      substedReturnStatement.argument = substitute(target.argument!, index) as es.Expression
      return substedReturnStatement
    },

    // source 1
    ArrowFunctionExpression(
      target: es.ArrowFunctionExpression,
      index: number
    ): es.ArrowFunctionExpression {
      // creates a copy of the parameters so that renaming only happens during substitution
      const substedParams: es.Identifier[] = []
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i] as es.Identifier
        substedParams.push(ast.identifier(param.name, param.loc))
      }
      let newBody = target.body
      const substedArrow = ast.arrowFunctionExpression(substedParams, dummyBlockStatement())
      seenBefore.set(target, substedArrow)
      // check for free/bounded variable
      let freeReplacement: string[] = []
      let boundReplacement: es.Identifier[] = []
      if (
        replacement.type == 'FunctionExpression' ||
        replacement.type == 'ArrowFunctionExpression'
      ) {
        freeReplacement = findMain(replacement, new Map())
        boundReplacement = scanOutBoundNames(replacement.body)
      }
      for (let i = 0; i < target.params.length; i++) {
        const param = target.params[i]
        if (param.type === 'Identifier' && param.name === name.name) {
          substedArrow.body = target.body
          substedArrow.expression = target.body.type !== 'BlockStatement'
          return substedArrow
        }
        const freeTarget = findMain(target, new Map())
        const boundTarget = scanOutBoundNames(target.body)
        if (param.type == 'Identifier') {
          if (freeReplacement.includes(param.name)) {
            // change param name
            const re = /_\d+$/
            let newNum
            if (re.test(param.name)) {
              const num = param.name.split('_')
              newNum = Number(num[1]) + 1
              const changedName: string = getFreshName(
                num[0],
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              newBody = substituteMain(param, changed, target.body, [[]])[0] as es.BlockStatement
              ;(substedArrow.params[i] as es.Identifier).name = changedName // num[0] + '_' + newNum
            } else {
              newNum = 1
              const changedName: string = getFreshName(
                param.name,
                newNum,
                freeTarget,
                freeReplacement,
                boundTarget,
                boundUpperScope,
                boundReplacement
              )
              const changed = ast.identifier(changedName, param.loc)
              newBody = substituteMain(param, changed, target.body, [[]])[0] as es.BlockStatement
              ;(substedArrow.params[i] as es.Identifier).name = changedName
            }
          }
        }
      }

      for (const param of substedParams) {
        boundUpperScope.push(param.name)
      }

      for (const param of target.params) {
        if (param.type === 'Identifier' && param.name === name.name) {
          substedArrow.body = target.body
          substedArrow.expression = target.body.type !== 'BlockStatement'
          return substedArrow
        }
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedArrow.body = substitute(newBody, index) as es.BlockStatement | es.Expression
      substedArrow.expression = target.body.type !== 'BlockStatement'
      return substedArrow
    },

    VariableDeclaration(target: es.VariableDeclaration, index: number): es.VariableDeclaration {
      const substedVariableDeclaration = ast.variableDeclaration([dummyVariableDeclarator()])
      seenBefore.set(target, substedVariableDeclaration)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.declarations.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('declarations[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('declarations[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedVariableDeclaration.declarations = target.declarations.map(dec => {
        arrIndex++
        return substitute(dec, arr[arrIndex]) as es.VariableDeclarator
      })
      return substedVariableDeclaration
    },

    VariableDeclarator(target: es.VariableDeclarator, index: number): es.VariableDeclarator {
      const subbed = ast.identifier((target.id as es.Identifier).name)
      let substedVariableDeclarator = ast.variableDeclarator(subbed, dummyExpression())
      seenBefore.set(target, substedVariableDeclarator)
      const re = / rename$/
      if (target.id.type === 'Identifier' && name.name === target.id.name) {
        if (replacement.type == 'Identifier' && re.test(replacement.name)) {
          const newName = ast.identifier(replacement.name.split(' ')[0], replacement.loc)
          substedVariableDeclarator = ast.variableDeclarator(newName, dummyExpression())
        }
        substedVariableDeclarator.init = target.init
      } else {
        if (pathNotEnded(index)) {
          allPaths[index].push('init')
        }
        substedVariableDeclarator.init = substitute(target.init!, index) as es.Expression
      }
      return substedVariableDeclarator
    },

    IfStatement(target: es.IfStatement, index: number): es.IfStatement {
      const substedIfStatement = ast.ifStatement(
        dummyExpression(),
        dummyBlockStatement(),
        dummyBlockStatement(),
        target.loc
      )
      seenBefore.set(target, substedIfStatement)
      let nextIndex = index
      let thirdIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        thirdIndex = branch(index)
        allPaths[index].push('test')
        allPaths[nextIndex].push('consequent')
        allPaths[thirdIndex].push('alternate')
      }
      substedIfStatement.test = substitute(target.test, index) as es.Expression
      substedIfStatement.consequent = substitute(target.consequent, nextIndex) as es.BlockStatement
      substedIfStatement.alternate = target.alternate
        ? (substitute(target.alternate, thirdIndex) as es.BlockStatement)
        : null
      return substedIfStatement
    },

    ArrayExpression(target: es.ArrayExpression, index: number): es.ArrayExpression {
      const substedArray = ast.arrayExpression([dummyExpression()])
      seenBefore.set(target, substedArray)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.elements.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('elements[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('elements[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedArray.elements = target.elements.map(ele => {
        arrIndex++
        return substitute(ele as ContiguousArrayElementExpression, arr[arrIndex]) as es.Expression
      })
      return substedArray
    }
  }

  /**
   * For mapper use, maps a [symbol, value] pair to the node supplied.
   * @param name the name to be replaced
   * @param replacement the expression to replace the name with
   * @param node a node holding the target symbols
   * @param seenBefore a list of nodes that are seen before in substitution
   */
  function substitute(target: substituterNodes, index: number): substituterNodes {
    const result = seenBefore.get(target)
    if (result) {
      return result as substituterNodes
    }
    const substituter = substituters[target.type]
    if (substituter === undefined) {
      seenBefore.set(target, target)
      return target // no need to subst, such as literals
    } else {
      // substituters are responsible of registering seenBefore
      return substituter(target, index)
    }
  }

  // after running substitute,
  // find paths that contain endMarker
  // and return only those paths
  const substituted = substitute(target, 0)
  const validPaths: string[][] = []
  for (const path of allPaths) {
    if (path[path.length - 1] === endMarker) {
      validPaths.push(path.slice(0, path.length - 1))
    }
  }
  return [substituted, validPaths]
}

/**
 * Substitutes a call expression with the body of the callee (funExp)
 * and the body will have all ocurrences of parameters substituted
 * with the arguments.
 * @param callee call expression with callee as functionExpression
 * @param args arguments supplied to the call expression
 */
function apply(
  callee: es.FunctionExpression | es.ArrowFunctionExpression,
  args: irreducibleNodes[]
): BlockExpression | es.Expression {
  let substedBody = callee.body
  let substedParams = callee.params
  for (let i = 0; i < args.length; i++) {
    // source discipline requires parameters to be identifiers.
    const arg = args[i]

    if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      const freeTarget: string[] = findMain(
        ast.arrowFunctionExpression(substedParams, substedBody),
        new Map()
      )
      const declaredIds: es.Identifier[] = substedParams as es.Identifier[]
      const freeReplacement: string[] = findMain(arg, new Map())
      const boundReplacement: es.Identifier[] = scanOutDeclarations(arg.body)
      for (const declaredId of declaredIds) {
        if (freeReplacement.includes(declaredId.name)) {
          const re = /_\d+$/
          let newNum
          if (re.test(declaredId.name)) {
            const num = declaredId.name.split('_')
            newNum = Number(num[1]) + 1
            const changedName: string = getFreshName(
              num[0],
              newNum,
              freeTarget,
              freeReplacement,
              declaredIds,
              [],
              boundReplacement
            )
            const changed = ast.identifier(changedName + ' rename', declaredId.loc)
            const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
            substedBody = substituteMain(newName, changed, substedBody, [
              []
            ])[0] as typeof substedBody
            substedParams = substedParams.map(param =>
              (param as es.Identifier).name === declaredId.name ? changed : param
            )
          } else {
            newNum = 1
            const changedName: string = getFreshName(
              declaredId.name,
              newNum,
              freeTarget,
              freeReplacement,
              declaredIds,
              [],
              boundReplacement
            )
            const changed = ast.identifier(changedName + ' rename', declaredId.loc)
            const newName = ast.identifier(declaredId.name + ' rename', declaredId.loc)
            substedBody = substituteMain(newName, changed, substedBody, [
              []
            ])[0] as typeof substedBody
            substedParams = substedParams.map(param =>
              (param as es.Identifier).name === declaredId.name ? changed : param
            )
          }
        }
      }
    }

    // source discipline requires parameters to be identifiers.
    const param = substedParams[i] as es.Identifier
    substedBody = substituteMain(param, arg, substedBody, [[]])[0] as typeof substedBody
  }
  if (callee.type === 'ArrowFunctionExpression' && callee.expression) {
    return substedBody as es.Expression
  }

  const firstStatement: es.Statement = (substedBody as es.BlockStatement).body[0]
  return firstStatement && firstStatement.type === 'ReturnStatement'
    ? (firstStatement.argument as es.Expression)
    : ast.blockExpression((substedBody as es.BlockStatement).body)
}

// Wrapper function to house reduce, explain and bodify
function reduceMain(
  node: substituterNodes,
  context: Context
): [substituterNodes, Context, string[][], string] {
  // variable to control verbosity of bodify
  let verbose = true

  // converts body of code to string
  function bodify(target: substituterNodes): string {
    const bodifiers = {
      Literal: (target: es.Literal): string =>
        target.raw !== undefined ? target.raw : String(target.value),

      Identifier: (target: es.Identifier): string =>
        target.name.startsWith('anonymous_') ? 'anonymous function' : target.name,

      ExpressionStatement: (target: es.ExpressionStatement): string =>
        bodify(target.expression) + ' finished evaluating',

      BinaryExpression: (target: es.BinaryExpression): string =>
        bodify(target.left) + ' ' + target.operator + ' ' + bodify(target.right),

      UnaryExpression: (target: es.UnaryExpression): string =>
        target.operator + bodify(target.argument),

      ConditionalExpression: (target: es.ConditionalExpression): string =>
        bodify(target.test) + ' ? ' + bodify(target.consequent) + ' : ' + bodify(target.alternate),

      LogicalExpression: (target: es.LogicalExpression): string =>
        bodify(target.left) + ' ' + target.operator + ' ' + bodify(target.right),

      CallExpression: (target: es.CallExpression): string => {
        if (target.callee.type === 'ArrowFunctionExpression') {
          return '(' + bodify(target.callee) + ')(' + target.arguments.map(bodify) + ')'
        } else {
          return bodify(target.callee) + '(' + target.arguments.map(bodify) + ')'
        }
      },

      FunctionDeclaration: (target: es.FunctionDeclaration): string => {
        const funcName = target.id !== null ? target.id.name : 'error'
        return (
          'Function ' +
          funcName +
          ' declared' +
          (target.params.length > 0
            ? ', parameter(s) ' + target.params.map(bodify) + ' required'
            : '')
        )
      },

      FunctionExpression: (target: es.FunctionExpression): string => {
        const id = target.id
        return id === null || id === undefined ? '...' : id.name
      },

      ReturnStatement: (target: es.ReturnStatement): string =>
        bodify(target.argument as es.Expression) + ' returned',

      // guards against infinite text generation
      ArrowFunctionExpression: (target: es.ArrowFunctionExpression): string => {
        if (verbose) {
          verbose = false
          const redacted =
            (target.params.length > 0 ? target.params.map(bodify) : '()') +
            ' => ' +
            bodify(target.body)
          verbose = true
          return redacted
        } else {
          return (target.params.length > 0 ? target.params.map(bodify) : '()') + ' => ...'
        }
      },

      VariableDeclaration: (target: es.VariableDeclaration): string =>
        'Constant ' +
        bodify(target.declarations[0].id) +
        ' declared and substituted into rest of block',

      ArrayExpression: (target: es.ArrayExpression): string =>
        '[' +
        bodify(target.elements[0] as ContiguousArrayElementExpression) +
        ', ' +
        bodify(target.elements[1] as ContiguousArrayElementExpression) +
        ']'
    }

    const bodifier = bodifiers[target.type]
    return bodifier === undefined ? '...' : bodifier(target)
  }

  // generates string to explain current step
  function explain(target: substituterNodes): string {
    const explainers = {
      BinaryExpression: (target: es.BinaryExpression): string =>
        'Binary expression ' + bodify(target) + ' evaluated',

      UnaryExpression: (target: es.UnaryExpression): string => {
        return (
          'Unary expression evaluated, ' +
          (target.operator === '!' ? 'boolean ' : 'value ') +
          bodify(target.argument) +
          ' negated'
        )
      },

      ConditionalExpression: (target: es.ConditionalExpression): string => {
        return (
          'Conditional expression evaluated, condition is ' +
          (bodify(target.test) === 'true'
            ? 'true, consequent evaluated'
            : 'false, alternate evaluated')
        )
      },

      LogicalExpression: (target: es.LogicalExpression): string => {
        return target.operator === '&&'
          ? 'AND operation evaluated, left of operator is ' +
              (bodify(target.left) === 'true'
                ? 'true, continue evaluating right of operator'
                : 'false, stop evaluation')
          : 'OR operation evaluated, left of operator is ' +
              (bodify(target.left) === 'true'
                ? 'true, stop evaluation'
                : 'false, continue evaluating right of operator')
      },

      CallExpression: (target: es.CallExpression): string => {
        if (target.callee.type === 'ArrowFunctionExpression') {
          if (target.callee.params.length === 0) {
            return bodify(target.callee) + ' runs'
          } else {
            return (
              target.arguments.map(bodify) +
              ' substituted into ' +
              target.callee.params.map(bodify) +
              ' of ' +
              bodify(target.callee)
            )
          }
        } else if (target.callee.type === 'FunctionExpression') {
          if (target.callee.params.length === 0) {
            return 'Function ' + bodify(target.callee) + ' runs'
          } else {
            return (
              'Function ' +
              bodify(target.callee) +
              ' takes in ' +
              target.arguments.map(bodify) +
              ' as input ' +
              target.callee.params.map(bodify)
            )
          }
        } else {
          return bodify(target.callee) + ' runs'
        }
      },

      Program: (target: es.Program): string => bodify(target.body[0]),

      BlockExpression: (target: BlockExpression): string =>
        target.body.length === 0 ? 'Empty block statement evaluated' : bodify(target.body[0]),

      BlockStatement: (target: es.BlockStatement): string =>
        target.body.length === 0 ? 'Empty block statement evaluated' : bodify(target.body[0]),

      IfStatement: (target: es.IfStatement): string => {
        return (
          'If statement evaluated, ' +
          (bodify(target.test) === 'true'
            ? 'condition true, proceed to if block'
            : 'condition false, proceed to else block')
        )
      }
    }

    const explainer = explainers[target.type]
    return explainer === undefined ? '...' : explainer(target)
  }

  const reducers = {
    // source 0
    Identifier(
      node: es.Identifier,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      // can only be built ins. the rest should have been declared
      if (
        !(isAllowedLiterals(node) || isBuiltinFunction(node) || isImportedFunction(node, context))
      ) {
        throw new errors.UndefinedVariable(node.name, node)
      } else {
        return [node, context, paths, 'identifier']
      }
    },

    ExpressionStatement(
      node: es.ExpressionStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      paths[0].push('expression')
      const [reduced, cont, path, str] = reduce(node.expression, context, paths)
      return [ast.expressionStatement(reduced as es.Expression), cont, path, str]
    },

    BinaryExpression(
      node: es.BinaryExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { operator, left, right } = node
      if (isIrreducible(left, context)) {
        if (isIrreducible(right, context)) {
          // if the ast are the same, then the values are the same
          if (
            builtin.is_function(left).value &&
            builtin.is_function(right).value &&
            operator === '==='
          ) {
            return [valueToExpression(left === right), context, paths, explain(node)]
          }
          const [leftValue, rightValue] = [left, right].map(nodeToValue)
          const error = rttc.checkBinaryExpression(
            node,
            operator,
            context.chapter,
            leftValue,
            rightValue
          )
          if (error === undefined) {
            const lit = evaluateBinaryExpression(operator, leftValue, rightValue)
            return [valueToExpression(lit, context), context, paths, explain(node)]
          } else {
            throw error
          }
        } else {
          paths[0].push('right')
          const [reducedRight, cont, path, str] = reduce(right, context, paths)
          const reducedExpression = ast.binaryExpression(
            operator,
            left,
            reducedRight as es.Expression,
            node.loc
          )
          return [reducedExpression, cont, path, str]
        }
      } else {
        paths[0].push('left')
        const [reducedLeft, cont, path, str] = reduce(left, context, paths)
        const reducedExpression = ast.binaryExpression(
          operator,
          reducedLeft as es.Expression,
          right,
          node.loc
        )
        return [reducedExpression, cont, path, str]
      }
    },

    UnaryExpression(
      node: es.UnaryExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { operator, argument } = node
      if (isIrreducible(argument, context)) {
        // tslint:disable-next-line
        const argumentValue = nodeToValue(argument)
        const error = rttc.checkUnaryExpression(node, operator, argumentValue, context.chapter)
        if (error === undefined) {
          const result = evaluateUnaryExpression(operator, argumentValue)
          return [valueToExpression(result, context), context, paths, explain(node)]
        } else {
          throw error
        }
      } else {
        paths[0].push('argument')
        const [reducedArgument, cont, path, str] = reduce(argument, context, paths)
        const reducedExpression = ast.unaryExpression(
          operator,
          reducedArgument as es.Expression,
          node.loc
        )
        return [reducedExpression, cont, path, str]
      }
    },

    ConditionalExpression(
      node: es.ConditionalExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { test, consequent, alternate } = node
      if (test.type === 'Literal') {
        const error = rttc.checkIfStatement(node, test.value, context.chapter)
        if (error === undefined) {
          return [
            (test.value ? consequent : alternate) as es.Expression,
            context,
            paths,
            explain(node)
          ]
        } else {
          throw error
        }
      } else {
        paths[0].push('test')
        const [reducedTest, cont, path, str] = reduce(test, context, paths)
        const reducedExpression = ast.conditionalExpression(
          reducedTest as es.Expression,
          consequent,
          alternate,
          node.loc
        )
        return [reducedExpression, cont, path, str]
      }
    },

    LogicalExpression(
      node: es.LogicalExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { left, right } = node
      if (isIrreducible(left, context)) {
        if (!(left.type === 'Literal' && typeof left.value === 'boolean')) {
          throw new rttc.TypeError(left, ' on left hand side of operation', 'boolean', left.type)
        } else {
          const result =
            node.operator === '&&'
              ? left.value
                ? right
                : ast.literal(false, node.loc)
              : left.value
              ? ast.literal(true, node.loc)
              : right
          return [result as es.Expression, context, paths, explain(node)]
        }
      } else {
        paths[0].push('left')
        const [reducedLeft, cont, path, str] = reduce(left, context, paths)
        return [
          ast.logicalExpression(
            node.operator,
            reducedLeft as es.Expression,
            right,
            node.loc
          ) as substituterNodes,
          cont,
          path,
          str
        ]
      }
    },

    // core of the subst model
    CallExpression(
      node: es.CallExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const [callee, args] = [node.callee, node.arguments]
      // source 0: discipline: any expression can be transformed into either literal, ident(builtin) or funexp
      // if functor can reduce, reduce functor
      if (!isIrreducible(callee, context)) {
        paths[0].push('callee')
        const [reducedCallee, cont, path, str] = reduce(callee, context, paths)
        return [
          ast.callExpression(reducedCallee as es.Expression, args as es.Expression[], node.loc),
          cont,
          path,
          str
        ]
      } else if (callee.type === 'Literal') {
        throw new errors.CallingNonFunctionValue(callee, node)
      } else if (
        callee.type === 'Identifier' &&
        !(callee.name in context.runtime.environments[0].head)
      ) {
        throw new errors.UndefinedVariable(callee.name, callee)
      } else {
        // callee is builtin or funexp
        if (
          (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') &&
          args.length !== callee.params.length
        ) {
          throw new errors.InvalidNumberOfArguments(node, args.length, callee.params.length)
        } else {
          for (let i = 0; i < args.length; i++) {
            const currentArg = args[i]
            if (!isIrreducible(currentArg, context)) {
              paths[0].push('arguments[' + i + ']')
              const [reducedCurrentArg, cont, path, str] = reduce(currentArg, context, paths)
              const reducedArgs = [...args.slice(0, i), reducedCurrentArg, ...args.slice(i + 1)]
              return [
                ast.callExpression(
                  callee as es.Expression,
                  reducedArgs as es.Expression[],
                  node.loc
                ),
                cont,
                path,
                str
              ]
            }
            if (
              currentArg.type === 'Identifier' &&
              !(currentArg.name in context.runtime.environments[0].head)
            ) {
              throw new errors.UndefinedVariable(currentArg.name, currentArg)
            }
          }
        }
        // if it reaches here, means all the arguments are legal.
        if (['FunctionExpression', 'ArrowFunctionExpression'].includes(callee.type)) {
          return [
            apply(callee as FunctionDeclarationExpression, args as es.Literal[]),
            context,
            paths,
            explain(node)
          ]
        } else {
          if ((callee as es.Identifier).name.includes('math')) {
            return [
              builtin.evaluateMath((callee as es.Identifier).name, ...args),
              context,
              paths,
              explain(node)
            ]
          } else if (typeof builtin[(callee as es.Identifier).name] === 'function') {
            return [builtin[(callee as es.Identifier).name](...args), context, paths, explain(node)]
          }
          return [
            builtin.evaluateModuleFunction((callee as es.Identifier).name, context, ...args),
            context,
            paths,
            explain(node)
          ]
        }
      }
    },

    Program(
      node: es.Program,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      if (node.body.length === 0) {
        return [ast.expressionStatement(ast.identifier('undefined')), context, paths, explain(node)]
      } else {
        const [firstStatement, ...otherStatements] = node.body
        if (firstStatement.type === 'ReturnStatement') {
          return [firstStatement, context, paths, explain(node)]
        } else if (firstStatement.type === 'IfStatement') {
          paths[0].push('body[0]')
          const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
          if (reduced.type === 'BlockStatement') {
            const body = reduced.body as es.Statement[]
            if (body.length > 1) {
              path[1] = [...path[0].slice(0, path[0].length - 1)]
            }
            const wholeBlock = body.concat(...(otherStatements as es.Statement[]))
            return [ast.program(wholeBlock), cont, path, str]
          } else {
            return [
              ast.program([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
              cont,
              path,
              str
            ]
          }
        } else if (firstStatement.type === 'BlockStatement' && firstStatement.body.length === 0) {
          paths[0].push('body[0]')
          paths.push([])
          const stmt = ast.program(otherStatements as es.Statement[])
          return [stmt, context, paths, explain(firstStatement)]
        } else if (
          firstStatement.type === 'ExpressionStatement' &&
          isIrreducible(firstStatement.expression, context)
        ) {
          // Intentionally ignore the remaining statements
          const [secondStatement] = otherStatements

          if (
            secondStatement !== undefined &&
            secondStatement.type == 'ExpressionStatement' &&
            isIrreducible(secondStatement.expression, context)
          ) {
            paths[0].push('body[0]')
            paths.push([])
            const stmt = ast.program(otherStatements as es.Statement[])
            return [stmt, context, paths, explain(node)]
          } else {
            // Reduce the second statement and preserve the first statement
            // Pass in a new path to avoid modifying the original path
            const newPath = [[]]
            const [reduced, cont, path, str] = reducers['Program'](
              ast.program(otherStatements as es.Statement[]),
              context,
              newPath
            )

            // Fix path highlighting after preserving first statement
            path.forEach(pathStep => {
              pathStep.forEach((_, i) => {
                if (i == 0) {
                  pathStep[i] = pathStep[i].replace(/\d+/g, match => String(Number(match) + 1))
                }
              })
            })
            paths[0].push(...path[0])

            const stmt = ast.program([
              firstStatement,
              ...((reduced as es.Program).body as es.Statement[])
            ])
            return [stmt, cont, path, str]
          }
        } else if (firstStatement.type === 'FunctionDeclaration') {
          if (firstStatement.id === null) {
            throw new Error(
              'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
            )
          }
          let funDecExp = ast.functionDeclarationExpression(
            firstStatement.id,
            firstStatement.params,
            firstStatement.body
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
            []
          ])[0] as FunctionDeclarationExpression
          // substitute the rest of the program
          const remainingProgram = ast.program(otherStatements as es.Statement[])
          // substitution within the same program, add " same" so that substituter can differentiate between
          // substitution within the program and substitution from outside the program
          const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
          const subst = substituteMain(newId, funDecExp, remainingProgram, paths)
          // concats paths such that:
          // paths[0] -> path to the program to be substituted, pre-redex
          // paths[1...] -> path(s) to the parts of the remaining program
          // that were substituted, post-redex
          paths[0].push('body[0]')
          const allPaths = paths.concat(subst[1])
          if (subst[1].length === 0) {
            allPaths.push([])
          }
          return [subst[0], context, allPaths, explain(node)]
        } else if (firstStatement.type === 'VariableDeclaration') {
          const { kind, declarations } = firstStatement
          if (kind !== 'const') {
            // TODO: cannot use let or var
            return [dummyProgram(), context, paths, 'cannot use let or var']
          } else if (
            declarations.length <= 0 ||
            declarations.length > 1 ||
            declarations[0].type !== 'VariableDeclarator' ||
            !declarations[0].init
          ) {
            // TODO: syntax error
            return [dummyProgram(), context, paths, 'syntax error']
          } else {
            const declarator = declarations[0] as es.VariableDeclarator
            const rhs = declarator.init!
            if (declarator.id.type !== 'Identifier') {
              // TODO: source does not allow destructuring
              return [dummyProgram(), context, paths, 'source does not allow destructuring']
            } else if (isIrreducible(rhs, context)) {
              const remainingProgram = ast.program(otherStatements as es.Statement[])
              // force casting for weird errors
              // substitution within the same program, add " same" so that substituter can differentiate between
              // substitution within the program and substitution from outside the program
              const newId = ast.identifier(declarator.id.name + ' same', declarator.id.loc)
              const subst = substituteMain(
                newId,
                rhs as es.ArrayExpression,
                remainingProgram,
                paths
              )
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else if (
              rhs.type === 'ArrowFunctionExpression' ||
              rhs.type === 'FunctionExpression'
            ) {
              let funDecExp = ast.functionDeclarationExpression(
                declarator.id,
                rhs.params,
                rhs.body.type === 'BlockStatement'
                  ? rhs.body
                  : ast.blockStatement([ast.returnStatement(rhs.body)])
              ) as FunctionDeclarationExpression
              // substitute body
              funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
                []
              ])[0] as FunctionDeclarationExpression
              // substitute the rest of the program
              const remainingProgram = ast.program(otherStatements as es.Statement[])
              // substitution within the same block, add " same" so that substituter can differentiate between
              // substitution within the block and substitution from outside the block
              const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
              const subst = substituteMain(newId, funDecExp, remainingProgram, paths)
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else {
              paths[0].push('body[0]')
              paths[0].push('declarations[0]')
              paths[0].push('init')
              const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
              return [
                ast.program([
                  ast.declaration(
                    declarator.id.name,
                    'const',
                    reducedRhs as es.Expression
                  ) as es.Statement,
                  ...(otherStatements as es.Statement[])
                ]),
                cont,
                path,
                str
              ]
            }
          }
        }
        paths[0].push('body[0]')
        const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
        return [
          ast.program([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
          cont,
          path,
          str
        ]
      }
    },

    BlockStatement(
      node: es.BlockStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      if (node.body.length === 0) {
        return [ast.expressionStatement(ast.identifier('undefined')), context, paths, explain(node)]
      } else {
        const [firstStatement, ...otherStatements] = node.body
        if (firstStatement.type === 'ReturnStatement') {
          return [firstStatement, context, paths, explain(node)]
        } else if (firstStatement.type === 'IfStatement') {
          paths[0].push('body[0]')
          const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
          if (reduced.type === 'BlockStatement') {
            const body = reduced.body as es.Statement[]
            if (body.length > 1) {
              path[1] = [...path[0].slice(0, path[0].length - 1)]
            }
            const wholeBlock = body.concat(...(otherStatements as es.Statement[]))
            return [ast.blockStatement(wholeBlock), cont, path, str]
          } else {
            return [
              ast.blockStatement([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
              cont,
              path,
              str
            ]
          }
        } else if (firstStatement.type === 'BlockStatement' && firstStatement.body.length === 0) {
          paths[0].push('body[0]')
          paths.push([])
          const stmt = ast.blockStatement(otherStatements as es.Statement[])
          return [stmt, context, paths, explain(firstStatement)]
        } else if (
          firstStatement.type === 'ExpressionStatement' &&
          isIrreducible(firstStatement.expression, context)
        ) {
          // Intentionally ignore the remaining statements
          const [secondStatement] = otherStatements

          if (secondStatement == undefined) {
            const stmt = ast.expressionStatement(firstStatement.expression)
            return [stmt, context, paths, explain(node)]
          } else if (
            secondStatement.type == 'ExpressionStatement' &&
            isIrreducible(secondStatement.expression, context)
          ) {
            paths[0].push('body[0]')
            paths.push([])
            const stmt = ast.blockStatement(otherStatements as es.Statement[])
            return [stmt, context, paths, explain(node)]
          } else {
            // Reduce the second statement and preserve the first statement
            // Pass in a new path to avoid modifying the original path
            const newPath = [[]]
            const [reduced, cont, path, str] = reducers['BlockStatement'](
              ast.blockStatement(otherStatements as es.Statement[]),
              context,
              newPath
            )

            // Fix path highlighting after preserving first statement
            path.forEach(pathStep => {
              pathStep.forEach((_, i) => {
                if (i == 0) {
                  pathStep[i] = pathStep[i].replace(/\d+/g, match => String(Number(match) + 1))
                }
              })
            })
            paths[0].push(...path[0])

            const stmt = ast.blockStatement([
              firstStatement,
              ...((reduced as es.BlockStatement).body as es.Statement[])
            ])
            return [stmt, cont, paths, str]
          }
        } else if (firstStatement.type === 'FunctionDeclaration') {
          let funDecExp = ast.functionDeclarationExpression(
            firstStatement.id!,
            firstStatement.params,
            firstStatement.body
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
            []
          ])[0] as FunctionDeclarationExpression
          // substitute the rest of the blockStatement
          const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
          // substitution within the same block, add " same" so that substituter can differentiate between
          // substitution within the block and substitution from outside the block
          const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
          const subst = substituteMain(newId, funDecExp, remainingBlockStatement, paths)
          // concats paths such that:
          // paths[0] -> path to the program to be substituted, pre-redex
          // paths[1...] -> path(s) to the parts of the remaining program
          // that were substituted, post-redex
          paths[0].push('body[0]')
          const allPaths = paths.concat(subst[1])
          if (subst[1].length === 0) {
            allPaths.push([])
          }
          return [subst[0], context, allPaths, explain(node)]
        } else if (firstStatement.type === 'VariableDeclaration') {
          const { kind, declarations } = firstStatement
          if (kind !== 'const') {
            // TODO: cannot use let or var
            return [dummyBlockStatement(), context, paths, 'cannot use let or var']
          } else if (
            declarations.length <= 0 ||
            declarations.length > 1 ||
            declarations[0].type !== 'VariableDeclarator' ||
            !declarations[0].init
          ) {
            // TODO: syntax error
            return [dummyBlockStatement(), context, paths, 'syntax error']
          } else {
            const declarator = declarations[0] as es.VariableDeclarator
            const rhs = declarator.init!
            if (declarator.id.type !== 'Identifier') {
              // TODO: source does not allow destructuring
              return [dummyBlockStatement(), context, paths, 'source does not allow destructuring']
            } else if (isIrreducible(rhs, context)) {
              const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
              // force casting for weird errors
              // substitution within the same block, add " same" so that substituter can differentiate between
              // substitution within the block and substitution from outside the block
              const newId = ast.identifier(declarator.id.name + ' same', declarator.id.loc)
              const subst = substituteMain(
                newId,
                rhs as es.ArrayExpression,
                remainingBlockStatement,
                paths
              )
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else if (
              rhs.type === 'ArrowFunctionExpression' ||
              rhs.type === 'FunctionExpression'
            ) {
              let funDecExp = ast.functionDeclarationExpression(
                declarator.id,
                rhs.params,
                rhs.body.type === 'BlockStatement'
                  ? rhs.body
                  : ast.blockStatement([ast.returnStatement(rhs.body)])
              ) as FunctionDeclarationExpression
              // substitute body
              funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
                []
              ])[0] as FunctionDeclarationExpression
              // substitute the rest of the blockStatement
              const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
              // substitution within the same block, add " same" so that substituter can differentiate between
              // substitution within the block and substitution from outside the block
              const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
              const subst = substituteMain(newId, funDecExp, remainingBlockStatement, paths)
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else {
              paths[0].push('body[0]')
              paths[0].push('declarations[0]')
              paths[0].push('init')
              const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
              return [
                ast.blockStatement([
                  ast.declaration(
                    declarator.id.name,
                    'const',
                    reducedRhs as es.Expression
                  ) as es.Statement,
                  ...(otherStatements as es.Statement[])
                ]),
                cont,
                path,
                str
              ]
            }
          }
        }
        paths[0].push('body[0]')
        const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
        return [
          ast.blockStatement([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
          cont,
          path,
          str
        ]
      }
    },

    BlockExpression(
      node: BlockExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      if (node.body.length === 0) {
        return [ast.identifier('undefined'), context, paths, explain(node)]
      } else {
        const [firstStatement, ...otherStatements] = node.body
        if (firstStatement.type === 'ReturnStatement') {
          const arg = firstStatement.argument as es.Expression
          return [arg, context, paths, explain(node)]
        } else if (firstStatement.type === 'IfStatement') {
          paths[0].push('body[0]')
          const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
          if (reduced.type === 'BlockStatement') {
            const body = reduced.body as es.Statement[]
            if (body.length > 1) {
              path[1] = [...path[0].slice(0, path[0].length - 1)]
            }
            const wholeBlock = body.concat(...(otherStatements as es.Statement[]))
            return [ast.blockExpression(wholeBlock), cont, path, str]
          } else {
            return [
              ast.blockExpression([
                reduced as es.Statement,
                ...(otherStatements as es.Statement[])
              ]),
              cont,
              path,
              str
            ]
          }
        } else if (firstStatement.type === 'BlockStatement' && firstStatement.body.length === 0) {
          paths[0].push('body[0]')
          paths.push([])
          const stmt = ast.blockExpression(otherStatements as es.Statement[])
          return [stmt, context, paths, explain(firstStatement)]
        } else if (
          firstStatement.type === 'ExpressionStatement' &&
          isIrreducible(firstStatement.expression, context)
        ) {
          // Intentionally ignore the remaining statements
          const [secondStatement] = otherStatements

          if (secondStatement == undefined) {
            const stmt = ast.identifier('undefined')
            return [stmt, context, paths, explain(node)]
          } else if (
            (secondStatement.type == 'ExpressionStatement' &&
              isIrreducible(secondStatement.expression, context)) ||
            secondStatement.type === 'ReturnStatement'
          ) {
            paths[0].push('body[0]')
            paths.push([])
            const stmt = ast.blockExpression(otherStatements as es.Statement[])
            return [stmt, context, paths, explain(node)]
          } else {
            // Reduce the second statement and preserve the first statement
            // Pass in a new path to avoid modifying the original path
            const newPath = [[]]
            const [reduced, cont, path, str] = reducers['BlockExpression'](
              ast.blockExpression(otherStatements as es.Statement[]),
              context,
              newPath
            )

            // Fix path highlighting after preserving first statement
            path.forEach(pathStep => {
              pathStep.forEach((_, i) => {
                if (i == 0) {
                  pathStep[i] = pathStep[i].replace(/\d+/g, match => String(Number(match) + 1))
                }
              })
            })
            paths[0].push(...path[0])

            const stmt = ast.blockExpression([
              firstStatement,
              ...((reduced as es.BlockStatement).body as es.Statement[])
            ])
            return [stmt, cont, paths, str]
          }
        } else if (firstStatement.type === 'FunctionDeclaration') {
          let funDecExp = ast.functionDeclarationExpression(
            firstStatement.id!,
            firstStatement.params,
            firstStatement.body
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
            []
          ])[0] as FunctionDeclarationExpression
          // substitute the rest of the blockExpression
          const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
          // substitution within the same block, add " same" so that substituter can differentiate between
          // substitution within the block and substitution from outside the block
          const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
          const subst = substituteMain(newId, funDecExp, remainingBlockExpression, paths)
          // concats paths such that:
          // paths[0] -> path to the program to be substituted, pre-redex
          // paths[1...] -> path(s) to the parts of the remaining program
          // that were substituted, post-redex
          paths[0].push('body[0]')
          const allPaths = paths.concat(subst[1])
          if (subst[1].length === 0) {
            allPaths.push([])
          }
          return [subst[0], context, allPaths, explain(node)]
        } else if (firstStatement.type === 'VariableDeclaration') {
          const { kind, declarations } = firstStatement
          if (kind !== 'const') {
            // TODO: cannot use let or var
            return [dummyBlockExpression(), context, paths, 'cannot use let or var']
          } else if (
            declarations.length <= 0 ||
            declarations.length > 1 ||
            declarations[0].type !== 'VariableDeclarator' ||
            !declarations[0].init
          ) {
            // TODO: syntax error
            return [dummyBlockExpression(), context, paths, 'syntax error']
          } else {
            const declarator = declarations[0] as es.VariableDeclarator
            const rhs = declarator.init!
            if (declarator.id.type !== 'Identifier') {
              // TODO: source does not allow destructuring
              return [dummyBlockExpression(), context, paths, 'source does not allow destructuring']
            } else if (isIrreducible(rhs, context)) {
              const remainingBlockExpression = ast.blockExpression(
                otherStatements as es.Statement[]
              )
              // forced casting for some weird errors
              // substitution within the same block, add " same" so that substituter can differentiate between
              // substitution within the block and substitution from outside the block
              const newId = ast.identifier(declarator.id.name + ' same', declarator.id.loc)
              const subst = substituteMain(
                newId,
                rhs as es.ArrayExpression,
                remainingBlockExpression,
                paths
              )
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else if (
              rhs.type === 'ArrowFunctionExpression' ||
              rhs.type === 'FunctionExpression'
            ) {
              let funDecExp = ast.functionDeclarationExpression(
                declarator.id,
                rhs.params,
                rhs.body.type === 'BlockStatement'
                  ? rhs.body
                  : ast.blockStatement([ast.returnStatement(rhs.body)])
              ) as FunctionDeclarationExpression
              // substitute body
              funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
                []
              ])[0] as FunctionDeclarationExpression
              // substitute the rest of the blockExpression
              const remainingBlockExpression = ast.blockExpression(
                otherStatements as es.Statement[]
              )
              // substitution within the same block, add " same" so that substituter can differentiate between
              // substitution within the block and substitution from outside the block
              const newId = ast.identifier(funDecExp.id.name + ' same', funDecExp.id.loc)
              const subst = substituteMain(newId, funDecExp, remainingBlockExpression, paths)
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else {
              paths[0].push('body[0]')
              paths[0].push('declarations[0]')
              paths[0].push('init')
              const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
              return [
                ast.blockExpression([
                  ast.declaration(
                    declarator.id.name,
                    'const',
                    reducedRhs as es.Expression
                  ) as es.Statement,
                  ...(otherStatements as es.Statement[])
                ]),
                cont,
                path,
                str
              ]
            }
          }
        }
        paths[0].push('body[0]')
        const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
        return [
          ast.blockExpression([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
          cont,
          path,
          str
        ]
      }
    },

    // source 1
    IfStatement(
      node: es.IfStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { test, consequent, alternate } = node
      if (test.type === 'Literal') {
        const error = rttc.checkIfStatement(node, test.value, context.chapter)
        if (error === undefined) {
          return [
            (test.value ? consequent : alternate) as es.Statement,
            context,
            paths,
            explain(node)
          ]
        } else {
          throw error
        }
      } else {
        paths[0].push('test')
        const [reducedTest, cont, path, str] = reduce(test, context, paths)
        const reducedIfStatement = ast.ifStatement(
          reducedTest as es.Expression,
          consequent as es.BlockStatement,
          alternate as es.IfStatement | es.BlockStatement,
          node.loc
        )
        return [reducedIfStatement, cont, path, str]
      }
    }
  }

  /**
   * Reduces one step of the program and returns
   * 1. The reduced program
   * 2. The path(s) leading to the redex
   *    - If substitution not involved, returns array containing one path
   *    - If substitution is involved, returns array containing
   *      path to program to be substituted pre-redex, as well as
   *      path(s) to the parts of the program that were substituted post-redex
   * 3. String explaining the reduction
   */
  function reduce(
    node: substituterNodes,
    context: Context,
    paths: string[][]
  ): [substituterNodes, Context, string[][], string] {
    const reducer = reducers[node.type]
    if (reducer === undefined) {
      return [ast.program([]), context, [], 'error'] // exit early
    } else {
      return reducer(node, context, paths)
    }
  }
  return reduce(node, context, [[]])
}

// Main creates a scope for us to control the verbosity
function treeifyMain(target: substituterNodes): substituterNodes {
  // recurse down the program like substitute
  // if see a function at expression position,
  //   has an identifier: replace with the name
  //   else: replace with an identifer "=>"
  let verboseCount = 0
  const treeifiers = {
    // Identifier: return
    ExpressionStatement: (target: es.ExpressionStatement): es.ExpressionStatement => {
      return ast.expressionStatement(treeify(target.expression) as es.Expression)
    },

    BinaryExpression: (target: es.BinaryExpression) => {
      return ast.binaryExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    UnaryExpression: (target: es.UnaryExpression): es.UnaryExpression => {
      return ast.unaryExpression(target.operator, treeify(target.argument) as es.Expression)
    },

    ConditionalExpression: (target: es.ConditionalExpression): es.ConditionalExpression => {
      return ast.conditionalExpression(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.Expression,
        treeify(target.alternate) as es.Expression
      )
    },

    LogicalExpression: (target: es.LogicalExpression) => {
      return ast.logicalExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    CallExpression: (target: es.CallExpression): es.CallExpression => {
      return ast.callExpression(
        treeify(target.callee) as es.Expression,
        target.arguments.map(arg => treeify(arg) as es.Expression)
      )
    },

    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      return ast.functionDeclaration(
        target.id,
        target.params,
        treeify(target.body) as es.BlockStatement
      )
    },

    // CORE
    FunctionExpression: (
      target: es.FunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (target.id) {
        return target.id
      } else if (verboseCount < 5) {
        // here onwards is guarding against arrow turned function expressions
        verboseCount++
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verboseCount = 0
        return redacted
      } else {
        // shortens body after 5 iterations
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    Program: (target: es.Program): es.Program => {
      return ast.program(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      return ast.blockStatement(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      return ast.blockStatement(target.body.map(treeify) as es.Statement[])
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      return ast.returnStatement(treeify(target.argument!) as es.Expression)
    },

    // source 1
    // CORE
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (verboseCount < 5) {
        // here onwards is guarding against arrow turned function expressions
        verboseCount++
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verboseCount = 0
        return redacted
      } else {
        // shortens body after 5 iterations
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    VariableDeclaration: (target: es.VariableDeclaration): es.VariableDeclaration => {
      return ast.variableDeclaration(target.declarations.map(treeify) as es.VariableDeclarator[])
    },

    VariableDeclarator: (target: es.VariableDeclarator): es.VariableDeclarator => {
      return ast.variableDeclarator(target.id, treeify(target.init!) as es.Expression)
    },

    IfStatement: (target: es.IfStatement): es.IfStatement => {
      return ast.ifStatement(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.BlockStatement,
        treeify(target.alternate!) as es.BlockStatement | es.IfStatement
      )
    },

    // source 2
    ArrayExpression: (target: es.ArrayExpression): es.ArrayExpression => {
      return ast.arrayExpression(
        (target.elements as ContiguousArrayElements).map(treeify) as es.Expression[]
      )
    }
  }

  function treeify(target: substituterNodes): substituterNodes {
    const treeifier = treeifiers[target.type]
    if (treeifier === undefined) {
      return target
    } else {
      return treeifier(target)
    }
  }

  return treeify(target)
}

function jsTreeifyMain(
  target: substituterNodes,
  visited: Set<substituterNodes>,
  readOnly: boolean
): substituterNodes {
  // recurse down the program like substitute
  // if see a function at expression position,
  //   visited before recursing to this target: replace with the name
  //   else: replace with a FunctionExpression
  let verboseCount = 0
  const treeifiers = {
    Identifier: (target: es.Identifier): es.Identifier => {
      if (readOnly && target.name.startsWith('anonymous_')) {
        return ast.identifier('[Function]')
      }
      return target
    },

    Literal: (target: es.Literal): es.Literal => {
      if (typeof target.value === 'object' && target.value !== null) {
        target.raw = objectToString(target.value)
      }
      return target
    },

    ExpressionStatement: (target: es.ExpressionStatement): es.ExpressionStatement => {
      return ast.expressionStatement(treeify(target.expression) as es.Expression)
    },

    BinaryExpression: (target: es.BinaryExpression) => {
      return ast.binaryExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    UnaryExpression: (target: es.UnaryExpression): es.UnaryExpression => {
      return ast.unaryExpression(target.operator, treeify(target.argument) as es.Expression)
    },

    ConditionalExpression: (target: es.ConditionalExpression): es.ConditionalExpression => {
      return ast.conditionalExpression(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.Expression,
        treeify(target.alternate) as es.Expression
      )
    },

    LogicalExpression: (target: es.LogicalExpression) => {
      return ast.logicalExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    CallExpression: (target: es.CallExpression): es.CallExpression => {
      return ast.callExpression(
        treeify(target.callee) as es.Expression,
        target.arguments.map(arg => treeify(arg) as es.Expression)
      )
    },

    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      return ast.functionDeclaration(
        target.id,
        target.params,
        treeify(target.body) as es.BlockStatement
      )
    },

    // CORE
    FunctionExpression: (target: es.FunctionExpression): es.Identifier | es.FunctionExpression => {
      if (visited.has(target) && target.id) {
        return target.id
      }
      visited.add(target)
      if (readOnly && target.id) {
        return target.id
      } else if (target.id) {
        return ast.functionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement,
          target.loc,
          target.id
        )
      } else {
        return ast.functionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement,
          target.loc
        )
      }
    },

    Program: (target: es.Program): es.Program => {
      return ast.program(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      return ast.blockStatement(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      return ast.blockStatement(target.body.map(node => treeify(node)) as es.Statement[])
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      return ast.returnStatement(treeify(target.argument!) as es.Expression)
    },

    // source 1
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (verboseCount < 5) {
        // here onwards is guarding against arrow turned function expressions
        verboseCount++
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verboseCount = 0
        return redacted
      } else {
        // shortens body after 5 iterations
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    VariableDeclaration: (target: es.VariableDeclaration): es.VariableDeclaration => {
      return ast.variableDeclaration(target.declarations.map(treeify) as es.VariableDeclarator[])
    },

    VariableDeclarator: (target: es.VariableDeclarator): es.VariableDeclarator => {
      return ast.variableDeclarator(target.id, treeify(target.init!) as es.Expression)
    },

    IfStatement: (target: es.IfStatement): es.IfStatement => {
      return ast.ifStatement(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.BlockStatement,
        treeify(target.alternate!) as es.BlockStatement | es.IfStatement
      )
    },

    // source 2
    ArrayExpression: (target: es.ArrayExpression): es.ArrayExpression => {
      return ast.arrayExpression(
        (target.elements as ContiguousArrayElements).map(treeify) as es.Expression[]
      )
    }
  }

  function treeify(target: substituterNodes): substituterNodes {
    const treeifier = treeifiers[target.type]
    if (treeifier === undefined) {
      return target
    } else {
      return treeifier(target)
    }
  }

  return treeify(target)
}

// Mainly kept for testing
export const codify = (node: substituterNodes): string => generate(treeifyMain(node))

export const javascriptify = (node: substituterNodes): string =>
  '(' + generate(jsTreeifyMain(node, new Set(), false)) + ');'

/**
 * Recurses down the tree, tracing path to redex
 * and calling treeifyMain on all other children
 * Once redex is found, extract redex from tree
 * and put redexMarker in its place
 * Returns array containing modified tree and
 * extracted redex
 */
function pathifyMain(
  target: substituterNodes,
  paths: string[][],
  visited: Set<substituterNodes>
): [substituterNodes, substituterNodes] {
  let pathIndex = 0
  let path = paths[0]
  let redex = ast.program([]) as substituterNodes
  let endIndex = path === undefined ? 0 : path.length - 1
  const redexMarker = ast.identifier('@redex') as substituterNodes
  const withBrackets = ast.identifier('(@redex)') as substituterNodes
  const pathifiers = {
    ExpressionStatement: (target: es.ExpressionStatement): es.ExpressionStatement => {
      let exp = jsTreeifyMain(target.expression, visited, true) as es.Expression
      if (path[pathIndex] === 'expression') {
        if (pathIndex === endIndex) {
          redex = exp
          exp =
            target.expression.type === 'ArrowFunctionExpression'
              ? (withBrackets as es.Expression)
              : (redexMarker as es.Expression)
        } else {
          pathIndex++
          exp = pathify(target.expression) as es.Expression
        }
      }
      return ast.expressionStatement(exp)
    },

    BinaryExpression: (target: es.BinaryExpression) => {
      let left = jsTreeifyMain(target.left, visited, true) as es.Expression
      let right = jsTreeifyMain(target.right, visited, true) as es.Expression
      if (path[pathIndex] === 'left') {
        if (pathIndex === endIndex) {
          redex = left
          if (redex.type === 'ConditionalExpression') {
            left = withBrackets as es.Expression
          } else {
            left = redexMarker as es.Expression
          }
        } else {
          pathIndex++
          left = pathify(target.left) as es.Expression
        }
      } else if (path[pathIndex] === 'right') {
        if (pathIndex === endIndex) {
          redex = right
          if (redex.type === 'BinaryExpression' || redex.type === 'ConditionalExpression') {
            right = withBrackets as es.Expression
          } else {
            right = redexMarker as es.Expression
          }
        } else {
          pathIndex++
          right = pathify(target.right) as es.Expression
        }
      }
      return ast.binaryExpression(target.operator, left, right)
    },

    UnaryExpression: (target: es.UnaryExpression): es.UnaryExpression => {
      let arg = jsTreeifyMain(target.argument, visited, true) as es.Expression
      if (path[pathIndex] === 'argument') {
        if (pathIndex === endIndex) {
          redex = arg
          arg = redexMarker as es.Expression
        } else {
          pathIndex++
          arg = pathify(target.argument) as es.Expression
        }
      }
      return ast.unaryExpression(target.operator, arg)
    },

    ConditionalExpression: (target: es.ConditionalExpression): es.ConditionalExpression => {
      let test = jsTreeifyMain(target.test, visited, true) as es.Expression
      let cons = jsTreeifyMain(target.consequent, visited, true) as es.Expression
      let alt = jsTreeifyMain(target.alternate, visited, true) as es.Expression
      if (path[pathIndex] === 'test') {
        if (pathIndex === endIndex) {
          redex = test
          test = redexMarker as es.Expression
        } else {
          pathIndex++
          test = pathify(target.test) as es.Expression
        }
      } else if (path[pathIndex] === 'consequent') {
        if (pathIndex === endIndex) {
          redex = cons
          cons = redexMarker as es.Expression
        } else {
          pathIndex++
          cons = pathify(target.consequent) as es.Expression
        }
      } else if (path[pathIndex] === 'alternate') {
        if (pathIndex === endIndex) {
          redex = alt
          alt = redexMarker as es.Expression
        } else {
          pathIndex++
          alt = pathify(target.alternate) as es.Expression
        }
      }
      return ast.conditionalExpression(test, cons, alt)
    },

    LogicalExpression: (target: es.LogicalExpression) => {
      let left = jsTreeifyMain(target.left, visited, true) as es.Expression
      let right = jsTreeifyMain(target.right, visited, true) as es.Expression
      if (path[pathIndex] === 'left') {
        if (pathIndex === endIndex) {
          redex = left
          left = redexMarker as es.Expression
        } else {
          pathIndex++
          left = pathify(target.left) as es.Expression
        }
      } else if (path[pathIndex] === 'right') {
        if (pathIndex === endIndex) {
          redex = right
          right = redexMarker as es.Expression
        } else {
          pathIndex++
          right = pathify(target.right) as es.Expression
        }
      }
      return ast.logicalExpression(target.operator, left, right)
    },

    CallExpression: (target: es.CallExpression): es.CallExpression => {
      let callee = jsTreeifyMain(target.callee, visited, true) as es.Expression
      const args = target.arguments.map(arg => jsTreeifyMain(arg, visited, true) as es.Expression)
      if (path[pathIndex] === 'callee') {
        if (pathIndex === endIndex) {
          redex = callee
          callee =
            target.callee.type === 'ArrowFunctionExpression'
              ? (withBrackets as es.Expression)
              : (redexMarker as es.Expression)
        } else {
          pathIndex++
          callee = pathify(target.callee) as es.Expression
        }
      } else {
        let argIndex
        const isEnd = pathIndex === endIndex
        for (let i = 0; i < target.arguments.length; i++) {
          if (path[pathIndex] === 'arguments[' + i + ']') {
            argIndex = i
            break
          }
        }
        if (argIndex !== undefined) {
          pathIndex++
          if (isEnd) {
            redex = args[argIndex]
            args[argIndex] = redexMarker as es.Expression
          } else {
            args[argIndex] = pathify(target.arguments[argIndex]) as es.Expression
          }
        }
      }
      return ast.callExpression(callee, args)
    },

    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      let body = jsTreeifyMain(target.body, visited, true) as es.BlockStatement
      if (path[pathIndex] === 'body') {
        if (pathIndex === endIndex) {
          redex = body
          body = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          body = pathify(target.body) as es.BlockStatement
        }
      }
      return ast.functionDeclaration(target.id, target.params, body)
    },

    FunctionExpression: (
      target: es.FunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (target.id) {
        return target.id
      } else {
        let body = jsTreeifyMain(target.body, visited, true) as es.BlockStatement
        if (path[pathIndex] === 'body') {
          if (pathIndex === endIndex) {
            redex = body
            body = redexMarker as es.BlockStatement
          } else {
            pathIndex++
            body = pathify(target.body) as es.BlockStatement
          }
        }
        return ast.arrowFunctionExpression(target.params, body)
      }
    },

    Program: (target: es.Program): es.Program => {
      const body = target.body.map(node => jsTreeifyMain(node, visited, true)) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.program(body)
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      const body = target.body.map(node => jsTreeifyMain(node, visited, true)) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.blockStatement(body)
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      const body = target.body.map(node => jsTreeifyMain(node, visited, true)) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.blockStatement(body)
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      let arg = jsTreeifyMain(target.argument!, visited, true) as es.Expression
      if (path[pathIndex] === 'argument') {
        if (pathIndex === endIndex) {
          redex = arg
          arg = redexMarker as es.Expression
        } else {
          pathIndex++
          arg = pathify(target.argument!) as es.Expression
        }
      }
      return ast.returnStatement(arg)
    },

    // source 1
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression | es.FunctionDeclaration => {
      let body = jsTreeifyMain(target.body, visited, true) as es.BlockStatement
      if (path[pathIndex] === 'body') {
        if (pathIndex === endIndex) {
          redex = body
          body = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          body = pathify(target.body) as es.BlockStatement
        }
      }
      //localhost:8000
      return ast.arrowFunctionExpression(target.params, body)
    },

    VariableDeclaration: (target: es.VariableDeclaration): es.VariableDeclaration => {
      const decl = target.declarations.map(node =>
        jsTreeifyMain(node, visited, true)
      ) as es.VariableDeclarator[]
      let declIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.declarations.length; i++) {
        if (path[pathIndex] === 'declarations[' + i + ']') {
          declIndex = i
          break
        }
      }
      if (declIndex !== undefined) {
        if (isEnd) {
          redex = decl[declIndex]
          decl[declIndex] = redexMarker as es.VariableDeclarator
        } else {
          pathIndex++
          decl[declIndex] = pathify(target.declarations[declIndex]) as es.VariableDeclarator
        }
      }
      return ast.variableDeclaration(decl)
    },

    VariableDeclarator: (target: es.VariableDeclarator): es.VariableDeclarator => {
      let init = jsTreeifyMain(target.init!, visited, true) as es.Expression
      if (path[pathIndex] === 'init') {
        if (pathIndex === endIndex) {
          redex = init
          init = redexMarker as es.Expression
        } else {
          pathIndex++
          init = pathify(target.init!) as es.Expression
        }
      }
      return ast.variableDeclarator(target.id, init)
    },

    IfStatement: (target: es.IfStatement): es.IfStatement => {
      let test = jsTreeifyMain(target.test, visited, true) as es.Expression
      let cons = jsTreeifyMain(target.consequent, visited, true) as es.BlockStatement
      let alt = jsTreeifyMain(target.alternate!, visited, true) as
        | es.BlockStatement
        | es.IfStatement
      if (path[pathIndex] === 'test') {
        if (pathIndex === endIndex) {
          redex = test
          test = redexMarker as es.Expression
        } else {
          pathIndex++
          test = pathify(target.test) as es.Expression
        }
      } else if (path[pathIndex] === 'consequent') {
        if (pathIndex === endIndex) {
          redex = cons
          cons = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          cons = pathify(target.consequent) as es.BlockStatement
        }
      } else if (path[pathIndex] === 'alternate') {
        if (pathIndex === endIndex) {
          redex = alt
          alt = redexMarker as es.BlockStatement | es.IfStatement
        } else {
          pathIndex++
          alt = pathify(target.alternate!) as es.BlockStatement | es.IfStatement
        }
      }
      return ast.ifStatement(test, cons, alt)
    },

    // source 2
    ArrayExpression: (target: es.ArrayExpression): es.ArrayExpression => {
      const eles = (target.elements as ContiguousArrayElements).map(node =>
        jsTreeifyMain(node, visited, true)
      ) as es.Expression[]
      let eleIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.elements.length; i++) {
        if (path[pathIndex] === 'elements[' + i + ']') {
          eleIndex = i
          break
        }
      }
      if (eleIndex !== undefined) {
        if (isEnd) {
          redex = eles[eleIndex]
          eles[eleIndex] = redexMarker as es.Expression
        } else {
          pathIndex++
          eles[eleIndex] = pathify(
            target.elements[eleIndex] as ContiguousArrayElementExpression
          ) as es.Expression
        }
      }
      return ast.arrayExpression(eles)
    }
  }

  function pathify(target: substituterNodes): substituterNodes {
    const pathifier = pathifiers[target.type]
    if (pathifier === undefined) {
      return jsTreeifyMain(target, visited, true)
    } else {
      return pathifier(target)
    }
  }

  if (path === undefined || path[0] === undefined) {
    return [jsTreeifyMain(target, visited, true), ast.program([])]
  } else {
    let pathified = pathify(target)
    // runs pathify more than once if more than one substitution path
    for (let i = 1; i < paths.length; i++) {
      pathIndex = 0
      path = paths[i]
      endIndex = path === undefined ? 0 : path.length - 1
      pathified = pathify(pathified)
    }
    return [pathified, redex]
  }
}

// Function to convert array from getEvaluationSteps into text
export const redexify = (node: substituterNodes, path: string[][]): [string, string] => [
  generate(pathifyMain(node, path, new Set())[0]),
  generate(pathifyMain(node, path, new Set())[1])
]

export const getRedex = (node: substituterNodes, path: string[][]): substituterNodes =>
  pathifyMain(node, path, new Set())[1]

// strategy: we remember how many statements are there originally in program.
// since listPrelude are just functions, they will be disposed of one by one
// we prepend the program with the program resulting from the definitions,
//   and reduce the combined program until the program body
//   has number of statement === original program
// then we return it to the getEvaluationSteps
function substPredefinedFns(program: es.Program, context: Context): [es.Program, Context] {
  if (context.prelude) {
    // replace all occurences of '$' with 'helper_' to
    // prevent collision with redex (temporary solution)
    // context.prelude = context.prelude.replace(/\$/gi, 'helper_')
    // evaluate the list prelude first
    const listPreludeProgram = parse(context.prelude, context)!
    const origBody = program.body as es.Statement[]
    program.body = listPreludeProgram.body
    program.body.push(ast.blockStatement(origBody))
    while (program.body.length > 1) {
      program = reduceMain(program, context)[0] as es.Program
    }
    program.body = (program.body[0] as es.BlockStatement).body
  }
  return [program, context]
}

function substPredefinedConstants(program: es.Program): es.Program {
  const constants = [['undefined', undefined]]
  const mathConstants = Object.getOwnPropertyNames(Math)
    .filter(name => typeof Math[name] !== 'function')
    .map(name => ['math_' + name, Math[name]])
  let substed = program
  for (const nameValuePair of constants.concat(mathConstants)) {
    substed = substituteMain(
      ast.identifier(nameValuePair[0] as string),
      ast.literal(nameValuePair[1] as string | number) as es.Literal,
      substed,
      [[]]
    )[0] as es.Program
  }
  return substed
}

function removeDebuggerStatements(program: es.Program): es.Program {
  // recursively detect and remove debugger statements
  function remove(removee: es.Program | es.Statement | es.Expression) {
    if (removee.type === 'BlockStatement' || removee.type === 'Program') {
      removee.body = removee.body.filter(s => s.type !== 'DebuggerStatement')
      removee.body.forEach(s => remove(s as es.Statement))
    } else if (removee.type === 'VariableDeclaration') {
      removee.declarations.forEach(s => remove(s.init as es.Expression))
    } else if (removee.type === 'FunctionDeclaration') {
      remove(removee.body)
    } else if (removee.type === 'IfStatement') {
      remove(removee.consequent)
      remove(removee.alternate as es.Statement)
    } else if (removee.type === 'ArrowFunctionExpression') {
      remove(removee.body)
    }
  }
  remove(program)
  return program
}

async function evaluateImports(
  program: es.Program,
  context: Context,
  { loadTabs, checkImports, wrapSourceModules }: ImportTransformOptions
) {
  const [importNodeMap, otherNodes] = filterImportDeclarations(program)

  try {
    const environment = currentEnvironment(context)
    await Promise.all(
      Object.entries(importNodeMap).map(async ([moduleName, nodes]) => {
        await initModuleContextAsync(moduleName, context, loadTabs)
        const functions = await loadModuleBundleAsync(
          moduleName,
          context,
          wrapSourceModules,
          nodes[0]
        )
        for (const node of nodes) {
          for (const spec of node.specifiers) {
            assert(
              spec.type === 'ImportSpecifier',
              `Only ImportSpecifiers are supported, got: ${spec.type}`
            )

            if (checkImports && !(spec.imported.name in functions)) {
              throw new UndefinedImportError(spec.imported.name, moduleName, spec)
            }
            declareIdentifier(context, spec.local.name, node, environment)
            defineVariable(context, spec.local.name, functions[spec.imported.name], true, node)
          }
        }
      })
    )
  } catch (error) {
    // console.log(error)
    handleRuntimeError(context, error)
  }
  program.body = otherNodes
}

// the context here is for builtins
export async function getEvaluationSteps(
  program: es.Program,
  context: Context,
  { importOptions, stepLimit }: Pick<IOptions, 'importOptions' | 'stepLimit'>
): Promise<[es.Program, string[][], string][]> {
  const steps: [es.Program, string[][], string][] = []
  try {
    checkProgramForUndefinedVariables(program, context)
    const limit = stepLimit === undefined ? 1000 : stepLimit % 2 === 0 ? stepLimit : stepLimit + 1
    await evaluateImports(program, context, importOptions)
    // starts with substituting predefined constants
    let start = substPredefinedConstants(program)
    // and predefined fns
    start = substPredefinedFns(start, context)[0]
    // and remove debugger statements.
    start = removeDebuggerStatements(start)

    // then add in path and explanation string and push it into steps
    let reducedWithPath: [substituterNodes, Context, string[][], string] = [
      start,
      context,
      [],
      'Start of evaluation'
    ]
    steps.push([
      reducedWithPath[0] as es.Program,
      reducedWithPath[2].length > 1 ? reducedWithPath[2].slice(1) : reducedWithPath[2],
      reducedWithPath[3]
    ])
    steps.push([reducedWithPath[0] as es.Program, [], ''])
    // reduces program until evaluation completes
    // even steps: program before reduction
    // odd steps: program after reduction
    let i = 1
    let limitExceeded = false
    while (isStatementsReducible(reducedWithPath[0] as es.Program, context)) {
      //Should work on isReducibleStatement instead of checking body.length
      if (steps.length === limit) {
        steps[steps.length - 1] = [ast.program([]), [], 'Maximum number of steps exceeded']
        limitExceeded = true
        break
      }
      reducedWithPath = reduceMain(reducedWithPath[0], context)
      steps.push([
        reducedWithPath[0] as es.Program,
        reducedWithPath[2].length > 1 ? reducedWithPath[2].slice(1) : reducedWithPath[2],
        reducedWithPath[3]
      ])
      steps.push([reducedWithPath[0] as es.Program, [], ''])
      if (i > 0) {
        steps[i][1] = reducedWithPath[2].length > 1 ? [reducedWithPath[2][0]] : reducedWithPath[2]
        steps[i][2] = reducedWithPath[3]
      }
      i += 2
    }
    if (!limitExceeded && steps.length > 0) {
      steps[steps.length - 1][2] = 'Evaluation complete'
    }
    if (steps.length === 0) {
      steps.push([reducedWithPath[0] as es.Program, [], 'Nothing to evaluate'])
    }
    return steps
  } catch (error) {
    context.errors.push(error)
    return steps
  }
}

export interface IStepperPropContents {
  code: string
  redex: string
  explanation: string
  function: es.Expression | undefined | es.Super
}

export function isStepperOutput(output: any): output is IStepperPropContents {
  return 'code' in output
}

export function callee(
  content: substituterNodes,
  context: Context
): es.Expression | undefined | es.Super {
  if (content.type === 'CallExpression') {
    let reducedArgs = true
    for (const arg of content.arguments) {
      if (!isIrreducible(arg, context)) {
        reducedArgs = false
      }
    }
    return reducedArgs ? content.callee : undefined
  } else {
    return undefined
  }
}
