import * as es from 'estree'

import { ConstAssignment, UndefinedVariable } from '../errors/errors'
import { NoAssignmentToForVariable } from '../errors/validityErrors'
import { parse } from '../parser/parser'
import { Context, Node, NodeWithInferredType } from '../types'
import { getVariableDeclarationName } from '../utils/ast/astCreator'
import {
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getNativeIds,
  NativeIds
} from '../utils/uniqueIds'
import { ancestor, base, FullWalkerCallback } from '../utils/walkers'
import {
  getDeclaredIdentifiers,
  getIdentifiersFromVariableDeclaration,
  mapIdentifiersToNames
} from '../utils/ast/helpers'
import { isVariableDeclaration } from '../utils/ast/typeGuards'

class Declaration {
  public accessedBeforeDeclaration: boolean = false
  constructor(public isConstant: boolean) {}
}

export function validateAndAnnotate(
  program: es.Program,
  context: Context
): NodeWithInferredType<es.Program> {
  const accessedBeforeDeclarationMap = new Map<Node, Map<string, Declaration>>()
  const scopeHasCallExpressionMap = new Map<Node, boolean>()
  function processBlock(node: es.Program | es.BlockStatement) {
    const initialisedIdentifiers = new Map<string, Declaration>()
    for (const statement of node.body) {
      if (statement.type === 'VariableDeclaration') {
        initialisedIdentifiers.set(
          getVariableDeclarationName(statement),
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
  ancestor(program as Node, {
    Program: processBlock,
    BlockStatement: processBlock,
    FunctionDeclaration: processFunction,
    ArrowFunctionExpression: processFunction,
    ForStatement(forStatement: es.ForStatement, _ancestors: Node[]) {
      const init = forStatement.init!
      if (init.type === 'VariableDeclaration') {
        accessedBeforeDeclarationMap.set(
          forStatement,
          new Map([[getVariableDeclarationName(init), new Declaration(init.kind === 'const')]])
        )
        scopeHasCallExpressionMap.set(forStatement, false)
      }
    }
  })

  function validateIdentifier(id: es.Identifier, ancestors: Node[]) {
    const name = id.name
    const lastAncestor: Node = ancestors[ancestors.length - 2]
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
      VariableDeclaration(node: NodeWithInferredType<es.VariableDeclaration>, ancestors: Node[]) {
        const lastAncestor = ancestors[ancestors.length - 2]
        const name = getVariableDeclarationName(node)
        const accessedBeforeDeclaration = accessedBeforeDeclarationMap
          .get(lastAncestor)!
          .get(name)!.accessedBeforeDeclaration
        node.typability = accessedBeforeDeclaration ? 'Untypable' : 'NotYetTyped'
      },
      Identifier: validateIdentifier,
      FunctionDeclaration(node: NodeWithInferredType<es.FunctionDeclaration>, ancestors: Node[]) {
        // a function declaration can be typed if there are no function calls in the same scope before it
        const lastAncestor = ancestors[ancestors.length - 2]
        node.typability = scopeHasCallExpressionMap.get(lastAncestor) ? 'Untypable' : 'NotYetTyped'
      },
      Pattern(node: es.Pattern, ancestors: Node[]) {
        if (node.type === 'Identifier') {
          validateIdentifier(node, ancestors)
        } else if (node.type === 'MemberExpression') {
          if (node.object.type === 'Identifier') {
            validateIdentifier(node.object, ancestors)
          }
        }
      },
      CallExpression(call: es.CallExpression, ancestors: Node[]) {
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

export function checkProgramForUndefinedVariables(program: es.Program, context: Context) {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage)
  ])
  const globalIds = getNativeIds(program, usedIdentifiers)
  return checkForUndefinedVariables(program, context, globalIds, false)
}

export function checkForUndefinedVariables(
  program: es.Program,
  context: Context,
  globalIds: NativeIds,
  skipUndefined: boolean
) {
  const preludes = new Set<string>(
    context.prelude
      ? mapIdentifiersToNames(getDeclaredIdentifiers(parse(context.prelude, context)!))
      : []
  )

  const env = context.runtime.environments[0].head || {}

  const builtins = context.nativeStorage.builtins
  const identifiersIntroducedByNode = new Map<es.Node, Set<string>>()
  function processBlock(node: es.Program | es.BlockStatement) {
    const identifiers = new Set(mapIdentifiersToNames(getDeclaredIdentifiers(node)))
    identifiersIntroducedByNode.set(node, identifiers)
  }
  function processFunction(
    node: es.FunctionDeclaration | es.ArrowFunctionExpression | es.FunctionExpression,
    _ancestors: es.Node[]
  ) {
    identifiersIntroducedByNode.set(
      node,
      new Set(mapIdentifiersToNames(node.params.flatMap(getIdentifiersFromVariableDeclaration)))
    )
  }

  function processFor(node: es.ForOfStatement | es.ForInStatement) {
    if (isVariableDeclaration(node.left)) {
      identifiersIntroducedByNode.set(
        node,
        new Set(mapIdentifiersToNames(getIdentifiersFromVariableDeclaration(node.left)))
      )
    }
  }

  const identifiersToAncestors = new Map<es.Identifier, es.Node[]>()
  ancestor(program, {
    ArrowFunctionExpression: processFunction,
    BlockStatement: processBlock,
    CatchClause(node: es.CatchClause) {
      if (node.param) {
        identifiersIntroducedByNode.set(
          node,
          new Set(mapIdentifiersToNames(getIdentifiersFromVariableDeclaration(node.param)))
        )
      }
    },
    ForStatement(forStatement: es.ForStatement) {
      const init = forStatement.init
      if (init && isVariableDeclaration(init)) {
        identifiersIntroducedByNode.set(
          forStatement,
          new Set(mapIdentifiersToNames(getIdentifiersFromVariableDeclaration(init)))
        )
      }
    },
    ForInStatement: processFor,
    ForOfStatement: processFor,
    FunctionDeclaration: processFunction,
    FunctionExpression: processFunction,
    Identifier(identifier: es.Identifier, ancestors: es.Node[]) {
      identifiersToAncestors.set(identifier, [...ancestors])
    },
    Pattern(node: es.Pattern, ancestors: es.Node[]) {
      if (node.type === 'Identifier') {
        identifiersToAncestors.set(node, [...ancestors])
      } else if (node.type === 'MemberExpression') {
        if (node.object.type === 'Identifier') {
          identifiersToAncestors.set(node.object, [...ancestors])
        }
      }
    },
    Program: processBlock
  })
  const nativeInternalNames = new Set(Object.values(globalIds).map(({ name }) => name))

  for (const [identifier, ancestors] of identifiersToAncestors) {
    const name = identifier.name
    const isCurrentlyDeclared = ancestors.some(a => identifiersIntroducedByNode.get(a)?.has(name))
    if (isCurrentlyDeclared) {
      continue
    }
    const isPreviouslyDeclared = context.nativeStorage.previousProgramsIdentifiers.has(name)
    if (isPreviouslyDeclared) {
      continue
    }
    const isBuiltin = builtins.has(name)
    if (isBuiltin) {
      continue
    }
    const isPrelude = preludes.has(name)
    if (isPrelude) {
      continue
    }
    const isInEnv = name in env
    if (isInEnv) {
      continue
    }
    const isNativeId = nativeInternalNames.has(name)
    if (!isNativeId && !skipUndefined) {
      throw new UndefinedVariable(name, identifier)
    }
  }
}
