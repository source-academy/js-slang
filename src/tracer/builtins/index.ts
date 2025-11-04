import * as es from 'estree'
import { StepperExpression } from '../nodes'
import { StepperIdentifier } from '../nodes/Expression/Identifier'
import { StepperLiteral } from '../nodes/Expression/Literal'
import { convert } from '../generator'
import { listBuiltinFunctions } from './lists'
import { miscBuiltinFunctions } from './misc'
import { auxiliaryBuiltinFunctions } from './auxiliary'

const builtinFunctions = {
  ...listBuiltinFunctions,
  ...miscBuiltinFunctions,
  ...auxiliaryBuiltinFunctions
}

export function prelude(node: es.BaseNode) {
  node = node.type === 'Program' ? removeDebuggerStatements(node as es.Program) : node
  // check program for undefined variables
  // checkProgramForUndefinedVariables(node as es.Program, createContext());
  let inputNode = convert(node)
  // Substitute math constant
  Object.getOwnPropertyNames(Math)
    .filter(name => name in Math && typeof Math[name as keyof typeof Math] !== 'function')
    .forEach(name => {
      inputNode = inputNode.substitute(
        new StepperIdentifier('math_' + name),
        new StepperLiteral(Math[name as keyof typeof Math] as number)
      )
    })
  return inputNode
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

export function getBuiltinFunction(name: string, args: StepperExpression[]): StepperExpression {
  if (name.startsWith('math_')) {
    const mathFnName = name.split('_')[1]

    if (mathFnName in Math) {
      const fn = (Math as any)[mathFnName]
      const argVal = args.map(arg => (arg as StepperLiteral).value)
      argVal.forEach(arg => {
        if (typeof arg !== 'number' && typeof arg !== 'bigint') {
          throw new Error('Math functions must be called with number arguments')
        }
      })
      const result = fn(...argVal)
      return new StepperLiteral(result, result)
    }
  }

  const calledFunction = builtinFunctions[name as keyof typeof builtinFunctions]
  if (calledFunction.arity != args.length && name !== 'list') {
    // brute force way to fix this issue
    throw new Error(`Expected ${calledFunction.arity} arguments, but got ${args.length}.`)
  }
  return calledFunction.definition(args)
}

export function isBuiltinFunction(name: string): boolean {
  return name.startsWith('math_') || Object.keys(builtinFunctions).includes(name)
}
