import { UndefinedVariable } from '../errors/errors'
import assert from '../utils/assert'
import { extractIdsFromPattern } from '../utils/ast/astUtils'
import { isDeclaration } from '../utils/ast/typeGuards'
import type * as es from '../utils/ast/types'
import { recursive, simple, WalkerCallback } from '../utils/ast/walkers'

type Scope = Set<string>
export default function checkForUndefinedVariables(program: es.Program, outerScope: Scope) {
  function processBlock(
    block: es.BlockStatement | es.Program | es.StaticBlock,
    scope: Scope,
    c: WalkerCallback<Scope>
  ) {
    const blockScope = new Set(scope)

    // Recursively walk through all variable declarations in the program
    // and hoist 'var' declarations
    simple(block, {
      VariableDeclaration({ declarations, kind }: es.VariableDeclaration) {
        if (kind === 'var') {
          declarations.forEach(({ id }) => {
            extractIdsFromPattern(id).forEach(({ name }) => blockScope.add(name))
          })
        }
      }
    })

    function hoistStatement(
      stmt: Exclude<es.Declaration | es.ModuleDeclaration, es.VariableDeclaration>
    ) {
      // The default walkers are recursive, but we only want to access the top level declarations
      // So just use a simple switch statement instead
      switch (stmt.type) {
        case 'ImportDeclaration': {
          stmt.specifiers.forEach(({ local: { name } }) => blockScope.add(name))
          break
        }
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration': {
          if (
            !stmt.declaration ||
            !isDeclaration(stmt.declaration) ||
            stmt.declaration.type === 'VariableDeclaration' ||
            !stmt.declaration.id
          ) {
            break
          }
          hoistStatement(stmt.declaration)
          break
        }
        case 'ClassDeclaration':
        case 'FunctionDeclaration': {
          assert(
            !!stmt.id,
            `Encountered a ${stmt.type} without an id, this should've been caught during parsing`
          )
          if (stmt.id) blockScope.add(stmt.id.name)
          break
        }
      }
    }

    block.body.forEach(hoistStatement)
    block.body.forEach(stmt => c(stmt, blockScope))
  }

  function processFunction(
    node: es.FunctionExpression | es.FunctionDeclaration | es.ArrowFunctionExpression,
    scope: Scope,
    c: WalkerCallback<Scope>
  ) {
    const funcScope = new Set(scope)
    node.params.forEach(param => {
      extractIdsFromPattern(param).forEach(({ name }) => funcScope.add(name))
    })
    c(node.body, funcScope)
  }

  function processFor(
    { left, right }: es.ForInStatement | es.ForOfStatement,
    scope: Scope,
    c: WalkerCallback<Scope>
  ) {
    const forStatementScope = new Set(scope)
    c(left, forStatementScope)
    c(right, forStatementScope)
  }

  recursive(program, outerScope, {
    ArrowFunctionExpression: processFunction,
    AssignmentExpression({ left, right }: es.AssignmentExpression, scope, c) {
      // Default walker ignores assignment expressions
      c(left, scope)
      c(right, scope)
    },
    BlockStatement: processBlock,
    CatchClause({ body, param }: es.CatchClause, scope, c) {
      const catchScope = new Set(scope)
      extractIdsFromPattern(param!).forEach(({ name }) => catchScope.add(name))
      c(body, catchScope)
    },
    // Base walker considers the exported name to be an unidentified variable
    ExportAllDeclaration() {},
    FunctionDeclaration: processFunction,
    FunctionExpression: processFunction,
    ForStatement({ init, test, update }: es.ForStatement, scope, c) {
      const forStatementScope = new Set(scope)
      if (init) c(init, forStatementScope)
      if (test) c(test, forStatementScope)
      if (update) c(update, forStatementScope)
    },
    ForInStatement: processFor,
    ForOfStatement: processFor,
    Identifier(id: es.Identifier, scope) {
      if (!scope.has(id.name)) throw new UndefinedVariable(id.name, id)
    },
    Program: processBlock,
    StaticBlock: processBlock,
    VariableDeclaration({ declarations, kind }: es.VariableDeclaration, scope, c) {
      declarations.forEach(({ id, init }) => {
        if (kind !== 'var') {
          extractIdsFromPattern(id).forEach(({ name }) => scope.add(name))
        }
        if (init) c(init, scope)
      })
    }
  })
}
