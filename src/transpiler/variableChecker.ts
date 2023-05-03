import type * as es from 'estree'

import { UndefinedVariable } from '../errors/errors'
import assert from '../utils/assert'
import { extractIdsFromPattern } from '../utils/ast/astUtils'
import {
  isDeclaration,
  isFunctionNode,
  isModuleDeclaration,
  isPattern
} from '../utils/ast/typeGuards'

function isModuleOrRegDeclaration(node: es.Node): node is es.ModuleDeclaration | es.Declaration {
  return isDeclaration(node) || isModuleDeclaration(node)
}

function checkPattern(pattern: es.Pattern, identifiers: Set<string>): void {
  extractIdsFromPattern(pattern).forEach(id => {
    if (!identifiers.has(id.name)) throw new UndefinedVariable(id.name, id)
  })
}

/**
 * Check a function node for undefined variables. The name of the function should be included in the `identifiers` set
 * passed in.
 */
function checkFunction(
  input: es.ArrowFunctionExpression | es.FunctionDeclaration | es.FunctionExpression,
  identifiers: Set<string>
): void {
  // Add the names of the parameters for each function into the set
  // of identifiers that should be checked against
  const newIdentifiers = new Set(identifiers)
  input.params.forEach(pattern =>
    extractIdsFromPattern(pattern).forEach(({ name }) => newIdentifiers.add(name))
  )

  if (input.body.type === 'BlockStatement') {
    checkForUndefinedVariables(input.body, newIdentifiers)
  } else checkExpression(input.body, newIdentifiers)
}

function checkExpression(
  node: es.Expression | es.RestElement | es.SpreadElement | es.Property,
  identifiers: Set<string>
): void {
  const checkMultiple = (items: (typeof node | null)[]) =>
    items.forEach(item => {
      if (item) checkExpression(item, identifiers)
    })

  switch (node.type) {
    case 'ArrayExpression': {
      checkMultiple(node.elements)
      break
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression': {
      checkFunction(node, identifiers)
      break
    }
    case 'ClassExpression': {
      checkClass(node, identifiers)
      break
    }
    case 'AssignmentExpression':
    case 'BinaryExpression':
    case 'LogicalExpression': {
      checkExpression(node.right, identifiers)
      if (isPattern(node.left)) {
        checkPattern(node.left, identifiers)
      } else {
        checkExpression(node.left, identifiers)
      }
      break
    }
    case 'MemberExpression': {
      // TODO handle super
      checkExpression(node.object as es.Expression, identifiers)
      if (node.computed) checkExpression(node.property as es.Expression, identifiers)
      break
    }
    case 'CallExpression':
    case 'NewExpression': {
      // TODO handle super
      checkExpression(node.callee as es.Expression, identifiers)
      checkMultiple(node.arguments)
      break
    }
    case 'ConditionalExpression': {
      checkMultiple([node.alternate, node.consequent, node.test])
      break
    }
    case 'Identifier': {
      if (!identifiers.has(node.name)) {
        throw new UndefinedVariable(node.name, node)
      }
      break
    }
    case 'ImportExpression': {
      checkExpression(node.source, identifiers)
      break
    }
    case 'ObjectExpression': {
      checkMultiple(node.properties)
      break
    }
    case 'Property': {
      if (isPattern(node.value)) checkPattern(node.value, identifiers)
      else checkExpression(node.value, identifiers)
      break
    }
    case 'SpreadElement':
    case 'RestElement': {
      if (isPattern(node.argument)) {
        checkPattern(node.argument, identifiers)
        break
      }
      // Case falls through!
    }
    case 'AwaitExpression':
    case 'UnaryExpression':
    case 'UpdateExpression':
    case 'YieldExpression': {
      if (node.argument) checkExpression(node.argument as es.Expression, identifiers)
      break
    }
    case 'TaggedTemplateExpression': {
      checkExpression(node.tag, identifiers)
      checkExpression(node.quasi, identifiers)
      break
    }
    case 'SequenceExpression': // Comma operator
    case 'TemplateLiteral': {
      checkMultiple(node.expressions)
      break
    }
  }
}

/**
 * Check that a variable declaration is initialized with defined variables
 * Returns false if there are undefined variables, returns the set of identifiers introduced by the
 * declaration otherwise
 */
function checkVariableDeclaration(
  node: es.VariableDeclaration,
  identifiers: Set<string>
): Set<string> {
  const output = new Set<string>()
  node.declarations.forEach(({ id, init }) => {
    if (init) {
      if (isFunctionNode(init)) {
        assert(
          id.type == 'Identifier',
          'VariableDeclaration for function expressions should be Identifiers'
        )
        // Add the name of the function to the set of identifiers so that
        // recursive calls are possible
        const localIdentifiers = new Set([...identifiers, id.name])
        checkFunction(init, localIdentifiers)
      } else if (init.type === 'ClassExpression') {
        assert(
          id.type == 'Identifier',
          'VariableDeclaration for class expressions should be Identifiers'
        )
        const localIdentifiers = new Set([...identifiers, id.name])
        checkClass(init, localIdentifiers)
      } else {
        checkExpression(init, identifiers)
      }
    }
    extractIdsFromPattern(id).forEach(({ name }) => output.add(name))
  })
  return output
}

function checkClass(node: es.ClassDeclaration | es.ClassExpression, localIdentifiers: Set<string>) {
  node.body.body.forEach(item => {
    if (item.type === 'StaticBlock') {
      checkForUndefinedVariables(item, localIdentifiers)
      return
    }

    if (item.computed) {
      assert(
        item.key.type !== 'PrivateIdentifier',
        'Computed property should not have PrivateIdentifier key type'
      )
      checkExpression(item.key, localIdentifiers)
    }

    if (item.type === 'MethodDefinition') {
      checkFunction(item.value, localIdentifiers)
    } else if (item.value) {
      checkExpression(item.value, localIdentifiers)
    }
  })
}

/**
 * Check that the given declaration contains no undefined variables. Returns the set of identifiers
 * introduced by the node
 * @param node
 * @param identifiers
 * @returns
 */
function checkDeclaration(
  node: es.Declaration | es.ModuleDeclaration,
  identifiers: Set<string>
): Set<string> {
  switch (node.type) {
    case 'ClassDeclaration': {
      const localIdentifiers = new Set([...identifiers, node.id!.name])
      checkClass(node, localIdentifiers)
      return new Set([node.id!.name])
    }
    case 'FunctionDeclaration': {
      // Add the name of the function to the set of identifiers so that
      // recursive calls are possible
      const localIdentifiers = new Set([...identifiers, node.id!.name])
      checkFunction(node, localIdentifiers)
      return new Set([node.id!.name])
    }
    case 'VariableDeclaration':
      return checkVariableDeclaration(node, identifiers)
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
      return new Set()
    case 'ExportDefaultDeclaration': {
      if (isDeclaration(node.declaration)) {
        assert(
          node.declaration.type !== 'VariableDeclaration',
          'ExportDefaultDeclarations should not be associated with VariableDeclarations'
        )

        if (node.declaration.id) {
          return checkDeclaration(node.declaration, identifiers)
        }
        // TODO change declaration node type
      }
      checkExpression(node.declaration as es.Expression, identifiers)
      return new Set()
    }
    case 'ExportNamedDeclaration':
      return !node.declaration ? new Set() : checkDeclaration(node.declaration, identifiers)
  }
}

function checkStatement(
  node: Exclude<es.Statement, es.Declaration | es.BlockStatement>,
  identifiers: Set<string>
): void {
  const checkBody = (node: es.Statement, localIdentifiers: Set<string>) => {
    assert(!isDeclaration(node), `${node.type} cannot be found here!`)

    if (node.type === 'BlockStatement') checkForUndefinedVariables(node, localIdentifiers)
    else checkStatement(node, localIdentifiers)
  }

  switch (node.type) {
    case 'ExpressionStatement': {
      checkExpression(node.expression, identifiers)
      break
    }
    case 'ForStatement': {
      const localIdentifiers = new Set(identifiers)
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          // If the init clause declares variables, add them to the list of
          // local identifiers that the for statement should check
          const varDeclResult = checkVariableDeclaration(node.init, identifiers)
          varDeclResult.forEach(id => localIdentifiers.add(id))
        } else {
          checkExpression(node.init, localIdentifiers)
        }
      }

      if (node.test) checkExpression(node.test, localIdentifiers)
      if (node.update) checkExpression(node.update, localIdentifiers)

      checkBody(node.body, localIdentifiers)
      break
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      const localIdentifiers = new Set(identifiers)
      if (node.left.type === 'VariableDeclaration') {
        const varDeclResult = checkVariableDeclaration(node.left, identifiers)
        varDeclResult.forEach(id => localIdentifiers.add(id))
      }
      checkExpression(node.right, localIdentifiers)
      checkBody(node.body, localIdentifiers)
      break
    }
    case 'DoWhileStatement':
    case 'WhileStatement': {
      checkExpression(node.test, identifiers)
      checkBody(node.body, identifiers)
      break
    }
    case 'IfStatement': {
      checkBody(node.consequent, identifiers)
      if (node.alternate) checkBody(node.alternate, identifiers)
      checkExpression(node.test, identifiers)
      break
    }
    case 'SwitchStatement': {
      node.cases.forEach(c => {
        if (c.test) checkExpression(c.test, identifiers)
        c.consequent.forEach(stmt => checkBody(stmt, identifiers))
      })
      break
    }
    case 'LabeledStatement': {
      checkBody(node.body, identifiers)
      break
    }
    case 'ReturnStatement':
    // TODO Check why a return statement has an non expression argument
    case 'ThrowStatement': {
      checkExpression(node.argument as es.Expression, identifiers)
      break
    }
    case 'TryStatement': {
      // Check the try block
      checkForUndefinedVariables(node.block, identifiers)

      // Check the finally block
      if (node.finalizer) checkForUndefinedVariables(node.finalizer, identifiers)

      // Check the catch block
      if (node.handler) {
        const catchIds = new Set(identifiers)
        if (node.handler.param) {
          extractIdsFromPattern(node.handler.param).forEach(({ name }) => catchIds.add(name))
        }
        checkForUndefinedVariables(node.handler.body, catchIds)
      }
      break
    }
  }
}

export default function checkForUndefinedVariables(
  node: es.Program | es.BlockStatement | es.StaticBlock,
  identifiers: Set<string>
) {
  const localIdentifiers = new Set(identifiers)

  // Hoist class and function declarations
  for (const stmt of node.body) {
    switch (stmt.type) {
      case 'ClassDeclaration':
      case 'FunctionDeclaration': {
        localIdentifiers.add(stmt.id!.name)
        break
      }
      case 'ImportDeclaration': {
        stmt.specifiers.forEach(({ local: { name } }) => localIdentifiers.add(name))
        break
      }
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration': {
        if (!stmt.declaration) break
        if (
          (stmt.declaration.type === 'ClassDeclaration' ||
            stmt.declaration.type === 'FunctionDeclaration') &&
          stmt.declaration.id
        ) {
          localIdentifiers.add(stmt.declaration.id.name)
        }
        break
      }
    }
  }

  for (const stmt of node.body) {
    if (isModuleOrRegDeclaration(stmt)) {
      checkDeclaration(stmt, localIdentifiers).forEach(id => localIdentifiers.add(id))
    } else if (stmt.type === 'BlockStatement') {
      checkForUndefinedVariables(stmt, localIdentifiers)
    } else {
      checkStatement(stmt, localIdentifiers)
    }
  }
}
