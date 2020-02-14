import * as es from 'estree'

/**
 * An additional layer of typechecking to be done right after parsing.
 * @param program Parsed Program
 * @param context Additional context such as the week of our source program, comments etc.
 */
export function typeCheck(program: es.Program | undefined): void {
  if (program === undefined || program.body[0] === undefined) {
    return
  }
  // tslint:disable-next-line:no-console
  // console.log(program)
  if (program.body[0].type === 'VariableDeclaration') {
    // tslint:disable-next-line:no-console
    // console.log((program.body[0] as es.VariableDeclaration).declarations)
  } else if (program.body[0].type === 'ExpressionStatement') {
    // tslint:disable-next-line:no-console
    // console.log((program.body[0] as es.ExpressionStatement).expression)
    infer(program.body[0], {})
  }
}

// Type Definitions
interface Env {
  [name: string]: TYPE
}

interface NAMED {
  nodeType: 'Named'
  name: string
}
interface VAR {
  nodeType: 'Var'
  name: string
}
interface FUNCTION {
  nodeType: 'Function'
  fromType: TYPE
  to: TYPE
}
type TYPE = NAMED | VAR | FUNCTION

function infer(node: es.Node, env: Env): TYPE | void {
  switch (node.type) {
    case 'ExpressionStatement': {
      const expression = node.expression
      if (expression.type === 'Literal') {
        const literalVal = expression.value
        const typeOfLiteral = typeof literalVal
        if (
          typeOfLiteral === 'boolean' ||
          typeOfLiteral === 'string' ||
          typeOfLiteral === 'number'
        ) {
          return { nodeType: 'Named', name: typeOfLiteral }
        }
      } else if (expression.type === 'Identifier') {
        const indentifierName = expression.name
        if (env[indentifierName]) {
          return env[indentifierName]
        }
      }
    }
    case 'VariableDeclaration': {
      // if (env[])
    }
    default:
    // throw Error('Error in Type checking program')
  }
}
