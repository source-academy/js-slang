import { Context } from '..'
import { Stack } from '../cse-machine/utils'
import { Value } from '../types'
import { UnknownInstructionError } from './error'
import { evaluateBinaryOp } from './lib/binaryOp'
import {
  BinaryExpression,
  BinaryOp,
  CommandType,
  ExpressionStatement,
  Instruction,
  Literal,
  SourceFile,
  UnaryExpression,
  UnaryOp
} from './types'

export function evaluate(program: SourceFile, context: Context): Value {
  const C = new Stack<Instruction>()
  const S = new Stack<any>()

  // push the program onto the control stack
  C.push(program)

  while (!C.isEmpty()) {
    const inst = C.pop() as Instruction

    if (!interpreter.hasOwnProperty(inst.type)) {
      context.errors.push(new UnknownInstructionError(inst.type))
      return undefined
    }
    interpreter[inst.type](inst, C, S)
  }

  // return the top of the stash
  return S.pop()
}

const interpreter: {
  [key: string]: (arg0: Instruction, arg1: Stack<Instruction>, arg2: Stack<any>) => void
} = {
  Literal: (inst: Literal, _C, S) => S.push(inst.value),

  UnaryExpression: (inst: UnaryExpression, C, _S) => {
    C.push({ type: CommandType.UnaryOp, operator: inst.operator })
    C.push(inst.argument)
  },

  UnaryOp: (inst: UnaryOp, _, S) => {
    const operand = S.pop()
    S.push(inst.operator === '-' ? -operand : operand)
  },

  BinaryExpression: (inst: BinaryExpression, C, _S) => {
    C.push({ type: CommandType.BinaryOp, operator: inst.operator })
    C.push(inst.right)
    C.push(inst.left)
  },

  BinaryOp: (inst: BinaryOp, _C, S) => {
    const right = S.pop()
    const left = S.pop()
    S.push(evaluateBinaryOp(inst.operator, left, right))
  },

  ExpressionStatement: (inst: ExpressionStatement, C, _S) => C.push(inst.expression)
}
