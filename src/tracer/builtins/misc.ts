import { isBuiltinFunction } from '.'
import { StepperExpression } from '../nodes'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'
import { StepperIdentifier } from '../nodes/Expression/Identifier'
import { StepperLiteral } from '../nodes/Expression/Literal'
import { listBuiltinFunctions } from './lists'

export const miscBuiltinFunctions = {
  arity: {
    definition: (args: StepperExpression[]): StepperExpression => {
      if (args[0] instanceof StepperArrowFunctionExpression) {
        return new StepperLiteral(args[0].params.length)
      }

      if (args[0] instanceof StepperIdentifier) {
        if (args[0].name.startsWith("math_")) { // Math builtins
            const func = Math[args[0].name.split("_")[1] as keyof typeof Math];
            if (typeof func !== "function") {
                throw new Error("arity expects a function as argument")
            }
            return new StepperLiteral(func.length);
        } 
        if (Object.keys(listBuiltinFunctions).includes(args[0].name)) {
            return new StepperLiteral(listBuiltinFunctions[args[0].name as keyof typeof listBuiltinFunctions].arity);
        }
        if (Object.keys(miscBuiltinFunctions).includes(args[0].name)) {
            return new StepperLiteral(miscBuiltinFunctions[args[0].name as keyof typeof miscBuiltinFunctions].arity);
        }
      }
      return new StepperLiteral(0)
    },
    arity: 1
  },
  char_at: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const str = (args[0] as StepperLiteral).value as string
      const index = (args[1] as StepperLiteral).value as number
      return new StepperLiteral(str.charAt(index))
    },
    arity: 2
  },
  display: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return args[0]
    },
    arity: 1
  },
  error: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const errorMessage = (args[0] as StepperLiteral).value as string
      throw new Error(errorMessage)
    },
    arity: 1
  },
  get_time: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(Date.now())
    },
    arity: 0
  },
  is_boolean: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'boolean')
    },
    arity: 1
  },
  is_function: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(
        args[0] instanceof StepperArrowFunctionExpression || 
        (args[0] instanceof StepperIdentifier && isBuiltinFunction((args[0] as StepperIdentifier).name))
      )
    },
    arity: 1
  },
  is_number: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'number')
    },
    arity: 1
  },
  is_string: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(typeof (args[0] as StepperLiteral).value === 'string')
    },
    arity: 1
  },
  is_undefined: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperLiteral((args[0] as StepperLiteral).value === undefined)
    },
    arity: 1
  },
  parse_int: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const str = (args[0] as StepperLiteral).value as string
      const radix = args.length > 1 ? ((args[1] as StepperLiteral).value as number) : 10
      return new StepperLiteral(parseInt(str, radix))
    },
    arity: 2
  },
  prompt: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const message = (args[0] as StepperLiteral).value as string
      const result = window.prompt(message)
      return new StepperLiteral(result !== null ? result : null)
    },
    arity: 0
  },
  stringify: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const value = args[0]
      let stringified

      if (value instanceof StepperLiteral) {
        stringified = JSON.stringify(value.value)
      } else {
        stringified = value.toString()
      }

      return new StepperLiteral(stringified)
    },
    arity: 1
  }
}
