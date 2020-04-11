import * as es from 'estree'
import { Value } from '../types'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as stype from './symTypes'
import { checkBinaryExpression, checkUnaryExpression } from '../utils/rttc'
import { serialize } from './serializer'
import { getFirstCall, symbolicExecute } from './symbolicExecutor'
import { updateCheckers } from './analyzer'
import * as create from '../utils/astCreator'

interface SimpleEnv {
    constants: [string,any][]
    tset: stype.TransitionSet
}
function newEnv() {
    return {constants: [], tset: new Map()} as SimpleEnv
}

function getVariable(envs: SimpleEnv[], name: string){
    for(let env of envs){
        for(let [key,val] of env.constants) {
            if (key === name) {
                return val
            }
        }
    }
    return undefined
}

function setVariable(envs: SimpleEnv[], name: string, value: any){
    envs[0].constants.unshift([name,value])
    return undefined
}

function getConsts(envs: SimpleEnv[]) {
    const encountered: string[] = []
    const result: [string,number][] = []
    for(let env of envs){
        for(let [key,val] of env.constants) {
            if (encountered.indexOf(key)>=0) {
                continue
            }
            if (typeof val === "number") {
                result.unshift([key,val])
            }
        }
    }
    return result
}

function buildTset(node: es.FunctionDeclaration, envs:SimpleEnv[]) {
    const id = node.id as es.Identifier
    const firstCall = getFirstCall(node)
    const symTree = symbolicExecute(node, getConsts(envs))
    const transition = serialize(firstCall, symTree)
    envs[0].tset.set(id.name, transition)
}

function mergeTset(envs: SimpleEnv[]) { // TODO: change Tset from map to something else?
    const t0 = new Map()
    for (const e of envs) {
        for (const [k,v] of e.tset.entries()) {
            if (!t0.has(k)) {
                t0.set(k,v)
            }
        }
    }
    return t0
}

function boolSymToEstree(sym: stype.BooleanSymbol | null, loc: es.SourceLocation) : es.Expression {
    if(sym === null) {
        return create.literal(true)
    }
    if(sym.type === 'InequalitySymbol') {
        const op:es.BinaryOperator = sym.direction > 0? ">" : sym.direction < 0? "<" : "==="
        return create.binaryExpression(op,create.identifier(sym.name),create.literal(sym.constant), loc)
    } else {
        const op:es.LogicalOperator = sym.conjunction ? "&&" : "||"
        return create.logicalExpression(op,boolSymToEstree(sym.left, loc),boolSymToEstree(sym.right, loc), loc)
    }
}

function putError(msg: string, loc: es.SourceLocation) {
    return create.expressionStatement(create.callExpression(create.identifier("error"), [create.literal(msg)], loc) )
}

function addProtection(checker: stype.InfiniteLoopChecker) {
    const loc = checker.loc
    const test = boolSymToEstree(checker.condition, loc)
    return create.ifStatement( test, create.blockStatement([putError(checker.message,loc)]), create.blockStatement([]), loc)
}

function evaluateBlockSatement(envs: SimpleEnv[], node: es.BlockStatement) {
    for (const statement of node.body) {
      if(statement.type === 'FunctionDeclaration') {
        buildTset(statement, envs)
      } else {
        simpleEval(statement, envs)
      }
    }

    const checkers = updateCheckers(mergeTset(envs))
    for (const statement of node.body) {
        if(statement.type === 'FunctionDeclaration') {
            const id = statement.id as es.Identifier
            for (let checker of checkers) {
                if (checker.functionName === id.name) {
                    const toAdd = addProtection(checker)
                    statement.body.body.unshift(toAdd)
                }
            }
        }
      }
    return undefined
}

// tslint:disable:object-literal-shorthand
// prettier-ignore
export const evaluators: { [nodeType: string]: (node:es.Node, envs:SimpleEnv[]) => any } = { // TODO any?
    /** Simple Values */
    Literal: function(node: es.Literal, envs: SimpleEnv[]) {
      return node.value
    },
  
    ArrowFunctionExpression: function(node: es.ArrowFunctionExpression, envs: SimpleEnv[]) {
      return undefined
    },
  
    Identifier: function(node: es.Identifier, envs: SimpleEnv[]) {
      return getVariable(envs, node.name)
    },
  
    CallExpression: function(node: es.CallExpression, envs: SimpleEnv[]) {
      return undefined
    },
  
  
    UnaryExpression: function(node: es.UnaryExpression, envs: SimpleEnv[]) {
      const value =  simpleEval(node.argument, envs)
      if (checkUnaryExpression(node,node.operator,value)) {
        return undefined
      } else {
        return evaluateUnaryExpression(node.operator, value)
      }
    },
  
    BinaryExpression: function(node: es.BinaryExpression, envs: SimpleEnv[]) {
      const left =  simpleEval(node.left, envs)
      const right =  simpleEval(node.right, envs)
      if (checkBinaryExpression(node,node.operator,left,right)) {
        return undefined
      } else {
        return evaluateBinaryExpression(node.operator, left, right)
      }
    },
  
    ConditionalExpression: function(node: es.ConditionalExpression, envs: SimpleEnv[]) {
      return evaluators["IfStatement"](node, envs)
    },
  
    LogicalExpression: function(node: es.LogicalExpression, envs: SimpleEnv[]) {
      const op = node.operator
      const left =  simpleEval(node.left, envs)
      const right =  simpleEval(node.right, envs)
      return left === undefined && right === undefined? undefined : op === '&&' ? left && right : left || right
    },
  
    VariableDeclaration: function(node: es.VariableDeclaration, envs: SimpleEnv[]) {
      const declaration = node.declarations[0]
      const id = declaration.id as es.Identifier
      const value =  simpleEval(declaration.init!, envs)
      setVariable(envs, id.name, value)
      console.log(envs)
      return undefined
    },
  
    FunctionDeclaration: function(node: es.FunctionDeclaration, envs: SimpleEnv[]) {

    },
  
    IfStatement: function(node: es.IfStatement | es.ConditionalExpression, envs: SimpleEnv[]) {
      const test = simpleEval(node.test, envs)
      return test === undefined ? undefined : test ? simpleEval(node.consequent, envs) : node.alternate? simpleEval(node.alternate, envs) : undefined
    },
  
    ExpressionStatement: function(node: es.ExpressionStatement, envs: SimpleEnv[]) {
      return  simpleEval(node.expression, envs)
    },
  
    BlockStatement: function(node: es.BlockStatement, envs: SimpleEnv[]) {
      let result: Value
  
      // Create a new environment (block scoping)
      envs.unshift(newEnv())
      result =  evaluateBlockSatement(envs, node)
      envs.shift()
      return result
    },
  
    Program: function(node: es.BlockStatement, envs: SimpleEnv[]) {
        envs.unshift(newEnv())
      return  evaluateBlockSatement(envs, node)
    }
  }

function simpleEval(node: es.Node, envs: SimpleEnv[]) {
    const fn = evaluators[node.type]
    if(fn !== undefined) {
        return fn(node, envs)
    } else {
        return undefined
    }
}

export function addInfiniteLoopProtection(prog: es.Program) {
    simpleEval(prog, [newEnv()])
}