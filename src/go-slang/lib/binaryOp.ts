import { BinaryOperator } from "../types"

function evaluateArthmeticOp(operator: BinaryOperator, left: any, right: any): any {
    let result = undefined

    switch (operator) {
        case '+':
          result = left + right
          break
        case '-':
          result = left - right
          break
        case '*':
          result = left * right
          break
        case '/':
          // NOTE: this calculates the quotient
          result = Math.floor(left / right)
          break
        case '%':
          result = left % right
          break
    }

    return result
}

function evaluateBitwiseOp(operator: BinaryOperator, left: any, right: any): any {
    let result = undefined

    switch (operator) {
        case '|':
          result = left | right
          break
        case '^':
          result = left ^ right
          break
    }

    return result
} 

export function evaluateBinaryOp(operator: BinaryOperator,left: any, right: any): any {
    let result = undefined

    switch (operator) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          result = evaluateArthmeticOp(operator, left, right)
          break
        case '|':
        case '^':
          result = evaluateBitwiseOp(operator, left, right)
          break
    }

    return result
}
