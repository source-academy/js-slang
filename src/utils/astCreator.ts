import * as es from 'estree'
import {
  astThunkNativeTag,
  identifierType,
  functionShouldBeEagerlyEvaluated,
  nameOfForceFunction,
  astEvalEagerTag
} from '../stdlib/lazy'
import { AllowedDeclarations, BlockExpression, FunctionDeclarationExpression } from '../types'
import { typeOf } from './typeOf'

export const getVariableDecarationName = (decl: es.VariableDeclaration) =>
  (decl.declarations[0].id as es.Identifier).name

export const locationDummyNode = (line: number, column: number) =>
  literal('Dummy', { start: { line, column }, end: { line, column } })

export const identifier = (name: string): es.Identifier => ({
  type: 'Identifier',
  name
})

/**
 * Constructs a new Thunk value for lazy evaluation. This function
 * does this by taking the original Literal in the Abstract Syntax
 * Tree, and changing it into an ArrowFunctionExpression with the
 * literal in its body
 * @param node The Literal to be transformed.
 */
export const mutateToLiteralThunk = (node: es.Literal): es.ObjectExpression => {
  // creates a new copy of node.loc
  function copyLoc() {
    if (!node.loc) {
      return undefined
    } else {
      return {
        start: Object.assign({}, node.loc.start),
        end: Object.assign({}, node.loc.end)
      }
    }
  }
  // make a new object for the new Thunk
  const newNode = node as any
  newNode.type = 'ObjectExpression'
  // get type of literal
  const type = typeOf(node.value)
  // ensure that the raw type becomes a string, not a variable
  const typeRaw = '"' + type + '"'
  // get rid of old value and old raw
  const oldValue = newNode.value
  delete newNode.value
  const oldRaw = newNode.raw
  delete newNode.raw
  newNode.properties = []
  // set Thunk properties
  // first, create type property
  newNode.properties[0] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'type'
    },
    // value of type is a string literal
    value: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: type,
      raw: typeRaw
    },
    kind: 'init'
  }
  // get arrow function
  const arrowFunction = {
    type: 'ArrowFunctionExpression',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    id: null,
    expression: true,
    generator: false,
    params: [],
    body: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: oldValue,
      raw: oldRaw
    }
  }
  // then, create the value property
  // also create lambda function storing original literal
  newNode.properties[1] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'value'
    },
    // value of 'value' is an ArrowFunctionExpression
    value: arrowFunction,
    kind: 'init'
  }
  // get toString to show the normal result
  const toString = {
    type: 'ArrowFunctionExpression',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    id: null,
    expression: true,
    generator: false,
    params: [],
    body: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: JSON.stringify(oldValue),
      raw: JSON.stringify(oldRaw)
    },
    // add tag to prevent toString() from getting wrapped in
    // wrapArrowFunctionsToAllowNormalCallsAndNiceToString
    // (toString is already giving it a nice string representation)
    tag: astThunkNativeTag
  }
  // create the toString property
  // so thunks appear as normal values
  // when stringify is called
  newNode.properties[2] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'toString'
    },
    value: toString,
    kind: 'init'
  }
  // lastly, add the 'evaluated' property
  // to avoid unnecessary memoization of
  // literal thunks
  newNode.properties[3] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'evaluated'
    },
    value: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: true,
      raw: 'true'
    },
    kind: 'init'
  }
  return newNode
}

/**
 * Constructs a new Thunk value for lazy evaluation. Identifiers
 * created from "function", "let", "const" will be transformed
 * to ensure that the name lookup is only done when required
 * (i.e. evaluated lazily, or evaluated by need). The only
 * identifier that will be ignored is "force".
 *
 * @param node The Identifier to be transformed.
 */
export const mutateToIdentifierThunk = (
  node: es.Identifier | any
): es.ObjectExpression | es.Identifier => {
  if (
    functionShouldBeEagerlyEvaluated(node.name) ||
    // check whether this identifier has the eager tag
    (node.tag && node.tag === astEvalEagerTag)
  ) {
    // cannot thunk force functions as it will result in non-evaluation
    return node
  } else {
    // creates a new copy of node.loc
    function copyLoc() {
      if (!node.loc) {
        return undefined
      } else {
        return {
          start: Object.assign({}, node.loc.start),
          end: Object.assign({}, node.loc.end)
        }
      }
    }
    // make a new object for the new Thunk
    const newNode = node as any
    newNode.type = 'ObjectExpression'
    newNode.properties = []
    // set Thunk properties
    // first, create type property
    newNode.properties[0] = {
      type: 'Property',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      method: false,
      shorthand: false,
      computed: false,
      key: {
        type: 'Identifier',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        name: 'type'
      },
      // value of type is a string literal 'identifier'
      //
      // this is because we cannot know type of identifier
      // until it is accessed (at runtime, only when value is needed)
      value: {
        type: 'Literal',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        value: identifierType,
        raw: JSON.stringify(identifierType)
      },
      kind: 'init'
    }
    // get the call expression for force(name)
    const callForceFunction = {
      type: 'CallExpression',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      callee: {
        type: 'Identifier',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        name: 'force'
      },
      arguments: [
        {
          type: 'Identifier',
          start: newNode.start,
          end: newNode.end,
          loc: copyLoc(),
          name: node.name
        }
      ]
    }
    // get arrow function
    const arrowFunction = {
      type: 'ArrowFunctionExpression',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      id: null,
      expression: true,
      generator: false,
      params: [],
      body: callForceFunction
    }
    // then, create the value property
    newNode.properties[1] = {
      type: 'Property',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      method: false,
      shorthand: false,
      computed: false,
      key: {
        type: 'Identifier',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        name: 'value'
      },
      // value of 'value' is an ArrowFunctionExpression
      value: arrowFunction,
      kind: 'init'
    }
    // get toString to show the normal result
    const toString = {
      type: 'ArrowFunctionExpression',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      id: null,
      expression: true,
      generator: false,
      params: [],
      body: {
        type: 'Literal',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        value: JSON.stringify(node.name),
        raw: JSON.stringify(node.name)
      },
      // add tag to prevent toString() from getting wrapped in
      // wrapArrowFunctionsToAllowNormalCallsAndNiceToString
      // (toString is already giving it a nice string representation)
      tag: astThunkNativeTag
    }
    // create the toString property
    // so thunks appear as the variable names
    // when stringify is called
    newNode.properties[2] = {
      type: 'Property',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      method: false,
      shorthand: false,
      computed: false,
      key: {
        type: 'Identifier',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        name: 'toString'
      },
      value: toString,
      kind: 'init'
    }
    // lastly, add the 'evaluated' property set to false
    // (since Identifier is not a primitive value)
    newNode.properties[3] = {
      type: 'Property',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      method: false,
      shorthand: false,
      computed: false,
      key: {
        type: 'Identifier',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        name: 'evaluated'
      },
      value: {
        type: 'Literal',
        start: newNode.start,
        end: newNode.end,
        loc: copyLoc(),
        value: false,
        raw: 'false'
      },
      kind: 'init'
    }
    return newNode
  }
}

/**
 * Constructs a new Thunk value for undefined. This
 * is because the word undefined is parsed into an
 * identifier for the name 'undefined' instead of
 * the actual undefined value.
 *
 * @param node The Identifier to be transformed.
 */
export const mutateToUndefinedThunk = (node: es.Identifier | any): es.ObjectExpression => {
  // creates a new copy of node.loc
  function copyLoc() {
    if (!node.loc) {
      return undefined
    } else {
      return {
        start: Object.assign({}, node.loc.start),
        end: Object.assign({}, node.loc.end)
      }
    }
  }
  // make a new object for the new Thunk
  const newNode = node as any
  newNode.type = 'ObjectExpression'
  newNode.properties = []
  // set Thunk properties
  // first, create type property
  newNode.properties[0] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'type'
    },
    // value of type is a string literal 'undefined'
    value: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: 'undefined',
      raw: JSON.stringify('undefined')
    },
    kind: 'init'
  }
  // get arrow function
  const arrowFunction = {
    type: 'ArrowFunctionExpression',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    id: null,
    expression: true,
    generator: false,
    params: [],
    body: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: undefined,
      raw: 'undefined'
    }
  }
  // then, create the value property
  newNode.properties[1] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'value'
    },
    // value of 'value' is an ArrowFunctionExpression
    value: arrowFunction,
    kind: 'init'
  }
  // get toString to show the normal result
  const toString = {
    type: 'ArrowFunctionExpression',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    id: null,
    expression: true,
    generator: false,
    params: [],
    body: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: 'undefined',
      raw: JSON.stringify('undefined')
    },
    // add tag to prevent toString() from getting wrapped in
    // wrapArrowFunctionsToAllowNormalCallsAndNiceToString
    // (toString is already giving it a nice string representation)
    tag: astThunkNativeTag
  }
  // create the toString property
  // so thunks appear as the variable names
  // when stringify is called
  newNode.properties[2] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'toString'
    },
    value: toString,
    kind: 'init'
  }
  // lastly, add the 'evaluated' property set to true
  // (undefined is a primitive value)
  newNode.properties[3] = {
    type: 'Property',
    start: newNode.start,
    end: newNode.end,
    loc: copyLoc(),
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      name: 'evaluated'
    },
    value: {
      type: 'Literal',
      start: newNode.start,
      end: newNode.end,
      loc: copyLoc(),
      value: true,
      raw: 'true'
    },
    kind: 'init'
  }
  return newNode
}

/**
 * Given an expression that is evaluated lazily, change
 * it into an eagerly evaluated expression by wrapping the
 * expression in the pre-defined "force" function from the
 * lazy library which will cause the expression to be
 * evaluated at that point to give an actual value.
 *
 * Currently used to handle "if" conditions in Lazy Source.
 *
 * @param thunk The lazy expression (thunk) to be
 *              evaluated at that instant.
 */
export const forceEagerEvaluationOfLazyExpression = (thunk: es.Expression): es.Expression =>
  callExpression(
    // reference the pre-defined "force" function
    identifier(nameOfForceFunction),
    [thunk],
    thunk.loc || undefined
  )

export const literal = (value: string | number | boolean, loc?: es.SourceLocation): es.Literal => ({
  type: 'Literal',
  value,
  loc
})

export const memberExpression = (
  object: es.Expression,
  propertyString: string
): es.MemberExpression => ({
  type: 'MemberExpression',
  object,
  computed: false,
  property: identifier(propertyString)
})

export const declaration = (
  name: string,
  kind: AllowedDeclarations,
  init: es.Expression,
  loc?: es.SourceLocation
): es.VariableDeclaration => ({
  type: 'VariableDeclaration',
  declarations: [
    {
      type: 'VariableDeclarator',
      id: identifier(name),
      init
    }
  ],
  kind,
  loc
})

export const constantDeclaration = (name: string, init: es.Expression, loc?: es.SourceLocation) =>
  declaration(name, 'const', init, loc)

export const callExpression = (
  callee: es.Expression,
  args: es.Expression[],
  loc?: es.SourceLocation
): es.CallExpression => ({
  type: 'CallExpression',
  callee,
  arguments: args,
  loc
})

export const expressionStatement = (expression: es.Expression): es.ExpressionStatement => ({
  type: 'ExpressionStatement',
  expression
})

export const blockArrowFunction = (
  params: es.Identifier[],
  body: es.Statement[] | es.BlockStatement,
  loc?: es.SourceLocation
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body,
  loc
})

export const functionExpression = (
  params: es.Identifier[],
  body: es.Statement[] | es.BlockStatement,
  loc?: es.SourceLocation
): es.FunctionExpression => ({
  type: 'FunctionExpression',
  id: null,
  async: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body,
  loc
})

export const blockStatement = (body: es.Statement[]): es.BlockStatement => ({
  type: 'BlockStatement',
  body
})

export const program = (body: es.Statement[]): es.Program => ({
  type: 'Program',
  sourceType: 'module',
  body
})

export const returnStatement = (
  argument: es.Expression,
  loc?: es.SourceLocation
): es.ReturnStatement => ({
  type: 'ReturnStatement',
  argument,
  loc
})

export const property = (key: string, value: es.Expression): es.Property => ({
  type: 'Property',
  method: false,
  shorthand: false,
  computed: false,
  key: identifier(key),
  value,
  kind: 'init'
})

export const objectExpression = (properties: es.Property[]): es.ObjectExpression => ({
  type: 'ObjectExpression',
  properties
})

export const mutateToCallExpression = (
  node: es.Node,
  callee: es.Expression,
  args: es.Expression[]
) => {
  node.type = 'CallExpression'
  node = node as es.CallExpression
  node.callee = callee
  node.arguments = args
}

export const logicalExpression = (
  operator: es.LogicalOperator,
  left: es.Expression,
  right: es.Expression,
  loc?: es.SourceLocation
): es.LogicalExpression => ({
  type: 'LogicalExpression',
  operator,
  left,
  right,
  loc
})

export const conditionalExpression = (
  test: es.Expression,
  consequent: es.Expression,
  alternate: es.Expression,
  loc?: es.SourceLocation
): es.ConditionalExpression => ({
  type: 'ConditionalExpression',
  test,
  consequent,
  alternate,
  loc
})

export const arrayExpression = (elements: es.Expression[]): es.ArrayExpression => ({
  type: 'ArrayExpression',
  elements
})

export const assignmentExpression = (
  left: es.Identifier | es.MemberExpression,
  right: es.Expression
): es.AssignmentExpression => ({
  type: 'AssignmentExpression',
  operator: '=',
  left,
  right
})

export const binaryExpression = (
  operator: es.BinaryOperator,
  left: es.Expression,
  right: es.Expression,
  loc?: es.SourceLocation
): es.BinaryExpression => ({
  type: 'BinaryExpression',
  operator,
  left,
  right,
  loc
})

export const unaryExpression = (
  operator: es.UnaryOperator,
  argument: es.Expression,
  loc?: es.SourceLocation
): es.UnaryExpression => ({
  type: 'UnaryExpression',
  operator,
  prefix: true,
  argument,
  loc
})

// primitive: undefined is a possible value
export const primitive = (value: any): es.Expression => {
  return value === undefined ? identifier('undefined') : literal(value)
}

export const functionDeclarationExpression = (
  id: es.Identifier,
  params: es.Pattern[],
  body: es.BlockStatement,
  loc?: es.SourceLocation
): FunctionDeclarationExpression => ({
  type: 'FunctionExpression',
  id,
  params,
  body,
  loc
})

export const functionDeclaration = (
  id: es.Identifier | null,
  params: es.Pattern[],
  body: es.BlockStatement,
  loc?: es.SourceLocation
): es.FunctionDeclaration => ({
  type: 'FunctionDeclaration',
  id,
  params,
  body,
  loc
})

export const blockExpression = (
  body: es.Statement[],
  loc?: es.SourceLocation
): BlockExpression => ({
  type: 'BlockExpression',
  body,
  loc
})

export const arrowFunctionExpression = (
  params: es.Pattern[],
  body: es.Expression | es.BlockStatement,
  loc?: es.SourceLocation
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: body.type !== 'BlockStatement',
  generator: false,
  params,
  body,
  loc
})

export const variableDeclaration = (
  declarations: es.VariableDeclarator[],
  loc?: es.SourceLocation
): es.VariableDeclaration => ({
  type: 'VariableDeclaration',
  kind: 'const',
  declarations,
  loc
})

export const variableDeclarator = (
  id: es.Pattern,
  init: es.Expression,
  loc?: es.SourceLocation
): es.VariableDeclarator => ({
  type: 'VariableDeclarator',
  id,
  init,
  loc
})

export const ifStatement = (
  test: es.Expression,
  consequent: es.BlockStatement,
  alternate: es.Statement,
  loc?: es.SourceLocation
): es.IfStatement => ({
  type: 'IfStatement',
  test,
  consequent,
  alternate,
  loc
})
