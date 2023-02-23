import * as es from 'estree'

import { ConstAssignment } from '../errors/errors'
import { NoAssignmentToForVariable } from '../errors/validityErrors'
import { Context, NodeWithInferredType } from '../types'
import { getVariableDecarationName } from '../utils/astCreator'
import { ancestor, base, FullWalkerCallback } from '../utils/walkers'

class Declaration {
  public accessedBeforeDeclaration: boolean = false
  constructor(public isConstant: boolean) {}
}

export function validateAndAnnotate(
  program: es.Program,
  context: Context
): NodeWithInferredType<es.Program> {
  const accessedBeforeDeclarationMap = new Map<es.Node, Map<string, Declaration>>()
  const scopeHasCallExpressionMap = new Map<es.Node, boolean>()
  function processBlock(node: es.Program | es.BlockStatement) {
    const initialisedIdentifiers = new Map<string, Declaration>()
    for (const statement of node.body) {
      if (statement.type === 'VariableDeclaration') {
        initialisedIdentifiers.set(
          getVariableDecarationName(statement),
          new Declaration(statement.kind === 'const')
        )
      } else if (statement.type === 'FunctionDeclaration') {
        if (statement.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        initialisedIdentifiers.set(statement.id.name, new Declaration(true))
      }
    }
    scopeHasCallExpressionMap.set(node, false)
    accessedBeforeDeclarationMap.set(node, initialisedIdentifiers)
  }
  function processFunction(node: es.FunctionDeclaration | es.ArrowFunctionExpression) {
    accessedBeforeDeclarationMap.set(
      node,
      new Map((node.params as es.Identifier[]).map(id => [id.name, new Declaration(false)]))
    )
    scopeHasCallExpressionMap.set(node, false)
  }

  // initialise scope of variables
  ancestor(program as es.Node, {
    Program: processBlock,
    BlockStatement: processBlock,
    FunctionDeclaration: processFunction,
    ArrowFunctionExpression: processFunction,
    ForStatement(forStatement: es.ForStatement, _ancestors: es.Node[]) {
      const init = forStatement.init!
      if (init.type === 'VariableDeclaration') {
        accessedBeforeDeclarationMap.set(
          forStatement,
          new Map([[getVariableDecarationName(init), new Declaration(init.kind === 'const')]])
        )
        scopeHasCallExpressionMap.set(forStatement, false)
      }
    }
  })

  function validateIdentifier(id: es.Identifier, ancestors: es.Node[]) {
    const name = id.name
    const lastAncestor: es.Node = ancestors[ancestors.length - 2]
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const a = ancestors[i]
      const map = accessedBeforeDeclarationMap.get(a)
      if (map?.has(name)) {
        map.get(name)!.accessedBeforeDeclaration = true
        if (lastAncestor.type === 'AssignmentExpression' && lastAncestor.left === id) {
          if (map.get(name)!.isConstant) {
            context.errors.push(new ConstAssignment(lastAncestor, name))
          }
          if (a.type === 'ForStatement' && a.init !== lastAncestor && a.update !== lastAncestor) {
            context.errors.push(new NoAssignmentToForVariable(lastAncestor))
          }
        }
        break
      }
    }
  }
  const customWalker = {
    ...base,
    VariableDeclarator(node: es.VariableDeclarator, st: never, c: FullWalkerCallback<never>) {
      // don't visit the id
      if (node.init) {
        c(node.init, st, 'Expression')
      }
    }
  }
  ancestor(
    program,
    {
      VariableDeclaration(
        node: NodeWithInferredType<es.VariableDeclaration>,
        ancestors: es.Node[]
      ) {
        const lastAncestor = ancestors[ancestors.length - 2]
        const name = getVariableDecarationName(node)
        const accessedBeforeDeclaration = accessedBeforeDeclarationMap
          .get(lastAncestor)!
          .get(name)!.accessedBeforeDeclaration
        node.typability = accessedBeforeDeclaration ? 'Untypable' : 'NotYetTyped'
      },
      Identifier: validateIdentifier,
      FunctionDeclaration(
        node: NodeWithInferredType<es.FunctionDeclaration>,
        ancestors: es.Node[]
      ) {
        // a function declaration can be typed if there are no function calls in the same scope before it
        const lastAncestor = ancestors[ancestors.length - 2]
        node.typability = scopeHasCallExpressionMap.get(lastAncestor) ? 'Untypable' : 'NotYetTyped'
      },
      Pattern(node: es.Pattern, ancestors: es.Node[]) {
        if (node.type === 'Identifier') {
          validateIdentifier(node, ancestors)
        } else if (node.type === 'MemberExpression') {
          if (node.object.type === 'Identifier') {
            validateIdentifier(node.object, ancestors)
          }
        }
      },
      CallExpression(call: es.CallExpression, ancestors: es.Node[]) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const a = ancestors[i]
          if (scopeHasCallExpressionMap.has(a)) {
            scopeHasCallExpressionMap.set(a, true)
            break
          }
        }
      }
    },
    customWalker
  )

  /*
  simple(program, {
    VariableDeclaration(node: TypeAnnotatedNode<es.VariableDeclaration>) {
      console.log(getVariableDecarationName(node) + " " + node.typability);
    },
    FunctionDeclaration(node: TypeAnnotatedNode<es.FunctionDeclaration>) {
      console.log(node.id!.name + " " + node.typability);
    }
  })

   */
  return program
}
