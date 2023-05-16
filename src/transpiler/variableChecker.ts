import type * as es from 'estree'

import { UndefinedVariable } from '../errors/errors'
import assert from '../utils/assert'
import { extractIdsFromPattern, processExportDefaultDeclaration } from '../utils/ast/astUtils'
import { isPattern } from '../utils/ast/typeGuards'

function checkPattern(pattern: es.Pattern, scope: Set<string>): void {
  if (pattern.type === 'MemberExpression') {
    checkExpression(pattern, scope)
    return
  }

  extractIdsFromPattern(pattern).forEach(id => checkExpression(id, scope))
}

/**
 * Check a function node for undefined variables. The name of the function should be included in the `identifiers` set
 * passed in.
 */
function checkFunction(
  input: es.ArrowFunctionExpression | es.FunctionDeclaration | es.FunctionExpression,
  outerScope: Set<string>
): void {
  // Add the names of the parameters for each function into the set
  // of identifiers that should be checked against
  const innerScope = new Set(outerScope)
  input.params.forEach(pattern =>
    extractIdsFromPattern(pattern).forEach(({ name }) => innerScope.add(name))
  )

  if (input.body.type === 'BlockStatement') {
    checkForUndefinedVariables(input.body, innerScope)
  } else {
    checkExpression(input.body, innerScope)
  }
}

function checkExpression(
  node: es.Expression | es.RestElement | es.SpreadElement | es.Property,
  scope: Set<string>
): void {
  const checkMultiple = (items: (typeof node | null)[]) =>
    items.forEach(item => {
      if (item) checkExpression(item, scope)
    })

  switch (node.type) {
    case 'ArrayExpression': {
      checkMultiple(node.elements)
      break
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression': {
      checkFunction(node, scope)
      break
    }
    case 'ClassExpression': {
      checkClass(node, scope)
      break
    }
    case 'AssignmentExpression':
    case 'BinaryExpression':
    case 'LogicalExpression': {
      checkExpression(node.right, scope)
      if (isPattern(node.left)) {
        checkPattern(node.left, scope)
      } else {
        checkExpression(node.left, scope)
      }
      break
    }
    case 'MemberExpression': {
      // TODO handle super
      checkExpression(node.object as es.Expression, scope)
      if (node.computed) checkExpression(node.property as es.Expression, scope)
      break
    }
    case 'CallExpression':
    case 'NewExpression': {
      // TODO handle super
      checkExpression(node.callee as es.Expression, scope)
      checkMultiple(node.arguments)
      break
    }
    case 'ConditionalExpression': {
      checkMultiple([node.alternate, node.consequent, node.test])
      break
    }
    case 'Identifier': {
      if (!scope.has(node.name)) {
        throw new UndefinedVariable(node.name, node)
      }
      break
    }
    case 'ImportExpression': {
      checkExpression(node.source, scope)
      break
    }
    case 'ObjectExpression': {
      checkMultiple(node.properties)
      break
    }
    case 'Property': {
      if (isPattern(node.value)) checkPattern(node.value, scope)
      else checkExpression(node.value, scope)

      if (node.computed) checkExpression(node.key as es.Expression, scope)
      break
    }
    case 'SpreadElement':
    case 'RestElement': {
      if (isPattern(node.argument)) {
        checkPattern(node.argument, scope)
        break
      }
      // Case falls through!
    }
    case 'AwaitExpression':
    case 'UnaryExpression':
    case 'UpdateExpression':
    case 'YieldExpression': {
      if (node.argument) checkExpression(node.argument as es.Expression, scope)
      break
    }
    case 'TaggedTemplateExpression': {
      checkExpression(node.tag, scope)
      checkExpression(node.quasi, scope)
      break
    }
    case 'SequenceExpression': // Comma operator
    case 'TemplateLiteral': {
      checkMultiple(node.expressions)
      break
    }
  }
}

function checkClass(
  { body: { body } }: es.ClassDeclaration | es.ClassExpression,
  scope: Set<string>
) {
  const classScope = new Set(scope)

  body.forEach(item => {
    if (item.type === 'StaticBlock') {
      checkForUndefinedVariables(item, classScope)
      return
    }

    if (item.computed) {
      assert(
        item.key.type !== 'PrivateIdentifier',
        'Computed property should not have PrivateIdentifier key type'
      )
      checkExpression(item.key, classScope)
    }

    if (item.type === 'MethodDefinition') {
      checkFunction(item.value, classScope)
    } else if (item.value) {
      checkExpression(item.value, classScope)
    }
  })
}

/**
 * Check statements for undefined variables
 */
function checkStatement(node: Exclude<es.Statement, es.BlockStatement>, scope: Set<string>) {
  function checkBody(node: es.Statement, scope: Set<string>) {
    if (node.type === 'BlockStatement') {
      checkForUndefinedVariables(node, scope)
    } else {
      checkStatement(node, scope)
    }
  }

  switch (node.type) {
    case 'ClassDeclaration': {
      checkClass(node, scope)
      break
    }
    case 'DoWhileStatement':
    case 'WhileStatement': {
      checkExpression(node.test, scope)
      checkBody(node.body, scope)
      break
    }
    case 'ExpressionStatement': {
      checkExpression(node.expression, scope)
      break
    }
    case 'ForStatement': {
      const forStatementScope = new Set(scope)
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          checkVariableDeclaration(node.init, forStatementScope)
        } else {
          checkExpression(node.init, forStatementScope)
        }
      }

      if (node.test) checkExpression(node.test, forStatementScope)
      if (node.update) checkExpression(node.update, forStatementScope)

      checkBody(node.body, forStatementScope)
      break
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      const forStatementScope = new Set(scope)
      if (node.left.type === 'VariableDeclaration') {
        checkStatement(node.left, forStatementScope)
      } else {
        checkPattern(node.left, forStatementScope)
      }
      checkExpression(node.right, forStatementScope)
      checkBody(node.body, forStatementScope)
      break
    }
    case 'FunctionDeclaration': {
      checkFunction(node, scope)
      break
    }
    case 'IfStatement': {
      checkBody(node.consequent, scope)
      if (node.alternate) checkBody(node.alternate, scope)
      checkExpression(node.test, scope)
      break
    }
    case 'LabeledStatement': {
      checkBody(node.body, scope)
      break
    }
    case 'SwitchStatement': {
      checkExpression(node.discriminant, scope)
      node.cases.forEach(c => {
        if (c.test) checkExpression(c.test, scope)
        c.consequent.forEach(stmt => checkBody(stmt, scope))
      })
      break
    }
    case 'ReturnStatement': {
      if (!node.argument) break
      // Case falls through!
    }
    case 'ThrowStatement': {
      checkExpression(node.argument!, scope)
      break
    }
    case 'TryStatement': {
      // Check the try block
      checkForUndefinedVariables(node.block, scope)

      // Check the finally block
      if (node.finalizer) checkForUndefinedVariables(node.finalizer, scope)

      // Check the catch block
      if (node.handler) {
        const catchScope = new Set(scope)
        if (node.handler.param) {
          extractIdsFromPattern(node.handler.param).forEach(({ name }) => catchScope.add(name))
        }
        checkForUndefinedVariables(node.handler.body, catchScope)
      }
      break
    }
    case 'VariableDeclaration': {
      checkVariableDeclaration(node, scope)
      break
    }
  }
}

/**
 * Add all the identifiers declared by the VariableDeclaration to the provided scope
 */
function checkVariableDeclaration({ declarations }: es.VariableDeclaration, scope: Set<string>) {
  declarations.forEach(({ id, init }) => {
    extractIdsFromPattern(id).forEach(({ name }) => scope.add(name))
    if (init) checkExpression(init, scope)
  })
}

export default function checkForUndefinedVariables(
  node: es.Program | es.BlockStatement | es.StaticBlock,
  outerScope: Set<string>
) {
  const blockScope = new Set(outerScope)

  // Hoist class and function declarations
  for (const stmt of node.body) {
    switch (stmt.type) {
      case 'ClassDeclaration':
      case 'FunctionDeclaration': {
        assert(
          !!stmt.id,
          `Encountered ${node.type} without an id, this should have been caught during parsing`
        )
        blockScope.add(stmt.id.name)
        break
      }
      case 'VariableDeclaration': {
        // Only var declarations are hoisted
        if (stmt.kind === 'var') {
          checkVariableDeclaration(stmt, blockScope)
        }
        break
      }
      case 'ImportDeclaration': {
        stmt.specifiers.forEach(({ local: { name } }) => blockScope.add(name))
        break
      }
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration': {
        if (!stmt.declaration) break
        switch (stmt.declaration.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration': {
            if (stmt.declaration.id) {
              blockScope.add(stmt.declaration.id.name)
            }
            break
          }
          case 'VariableDeclaration': {
            // Only var declarations are hoisted
            if (stmt.declaration.kind === 'var') {
              checkVariableDeclaration(stmt.declaration, blockScope)
            }
            break
          }
        }
        break
      }
    }
  }

  for (const stmt of node.body) {
    switch (stmt.type) {
      case 'BlockStatement': {
        checkForUndefinedVariables(stmt, blockScope)
        break
      }
      case 'ExportNamedDeclaration': {
        if (stmt.declaration) {
          checkStatement(stmt.declaration, blockScope)
        } else if (!stmt.source) {
          stmt.specifiers.forEach(({ local }) => checkExpression(local, blockScope))
        }
        break
      }
      case 'ExportDefaultDeclaration': {
        processExportDefaultDeclaration(stmt, {
          FunctionDeclaration: decl => checkFunction(decl, blockScope),
          ClassDeclaration: decl => checkClass(decl, blockScope),
          Expression: decl => checkExpression(decl, blockScope)
        })
        break
      }
      case 'ExportAllDeclaration':
      case 'ImportDeclaration':
        break
      default: {
        checkStatement(stmt, blockScope)
        break
      }
    }
  }
}
