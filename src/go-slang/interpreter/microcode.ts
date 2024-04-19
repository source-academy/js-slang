import { HeapVal, ValType, ValTypeToString } from '../heap/heapVals'
import * as Token from '../tokens/tokens'

export const binop_microcode: Map<Token.token, (arg0: HeapVal, arg1: HeapVal) => HeapVal> = new Map(
  [
    [
      Token.token.ADD,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) + (y.val as number), ValType.Int32)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) + (y.val as string), ValType.String)
        }
        throw new BinOpTypeMismatchError(
          '+',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.MUL,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) * (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '*',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.SUB,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) - (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '-',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.QUO,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) / (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '/',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.REM,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) % (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '%',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.AND,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) & (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '&',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.OR,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) | (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '|',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.XOR,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) ^ (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '^',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.SHL,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) << (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '<<',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.SHR,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) >> (y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '>>',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.AND_NOT,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) & ~(y.val as number), ValType.Int32)
        }
        throw new BinOpTypeMismatchError(
          '&^',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.EQL,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) === (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) === (y.val as string), ValType.Boolean)
        } else if (x.type === ValType.Boolean && y.type === ValType.Boolean) {
          return new HeapVal((x.val as boolean) === (y.val as boolean), ValType.Boolean)
        } else if (x.type === ValType.Pointer && y.type === ValType.Pointer) {
          return new HeapVal((x.val as number) === (y.val as number), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '==',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.NEQ,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) !== (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) !== (y.val as string), ValType.Boolean)
        } else if (x.type === ValType.Boolean && y.type === ValType.Boolean) {
          return new HeapVal((x.val as boolean) !== (y.val as boolean), ValType.Boolean)
        } else if (x.type === ValType.Pointer && y.type === ValType.Pointer) {
          return new HeapVal((x.val as number) !== (y.val as number), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '!=',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.LSS,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) < (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) < (y.val as string), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '<',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.GTR,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) > (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) > (y.val as string), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '>',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.LEQ,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) <= (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) <= (y.val as string), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '<=',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ],
    [
      Token.token.GEQ,
      (x: HeapVal, y: HeapVal) => {
        if (x.type === ValType.Int32 && y.type === ValType.Int32) {
          return new HeapVal((x.val as number) >= (y.val as number), ValType.Boolean)
        } else if (x.type === ValType.String && y.type === ValType.String) {
          return new HeapVal((x.val as string) >= (y.val as string), ValType.Boolean)
        }
        throw new BinOpTypeMismatchError(
          '>=',
          ValTypeToString.at(x.type) as string,
          ValTypeToString.at(y.type) as string
        )
      }
    ]
  ]
)

class BinOpTypeMismatchError extends Error {
  constructor(op: string, xType: string, yType: string) {
    super(`${op} operation cannot be applied on types ${xType} and ${yType}`)
  }
}

export const unop_microcode: Map<Token.token, (arg0: HeapVal) => HeapVal> = new Map([
  [
    Token.token.NOT,
    (x: HeapVal) => {
      if (x.type === ValType.Boolean) {
        return new HeapVal(!(x.val as boolean), ValType.Boolean)
      }
      throw new UnOpTypeError('!', ValTypeToString.at(x.type) as string)
    }
  ],
  [
    Token.token.ADD,
    (x: HeapVal) => {
      if (x.type === ValType.Int32 && (x.val as number) >= 0) {
        return new HeapVal(x.val as number, ValType.Int32)
      }
      throw new UnOpTypeError('+', ValTypeToString.at(x.type) as string)
    }
  ],
  [
    Token.token.SUB,
    (x: HeapVal) => {
      if (x.type === ValType.Int32 && (x.val as number) >= 0) {
        return new HeapVal(-(x.val as number), ValType.Int32)
      }
      throw new UnOpTypeError('-', ValTypeToString.at(x.type) as string)
    }
  ],
  [
    Token.token.XOR,
    (x: HeapVal) => {
      if (x.type === ValType.Int32) {
        return new HeapVal((x.val as number) ^ ((1 << 32) - 1), ValType.Int32)
      }
      throw new UnOpTypeError('^', ValTypeToString.at(x.type) as string)
    }
  ]
])

class UnOpTypeError extends Error {
  constructor(op: string, xType: string) {
    super(`${op} operation cannot be applied on type ${xType}`)
  }
}
