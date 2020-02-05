import * as es from 'estree'
import {
  BlockFrame,
  DefinitionNode,
} from './types'

export function scopeVariables(program: es.Program): (BlockFrame|void) {
  if (program == null) {
    return;
  }

  const programBlock: BlockFrame = {
    loc: {
      // Hardcoded
      start: {line: 0, column: 0},
      end: {line: 10000, column: 0},
    },
    children: []
  }

  const definitionStatements: Array<es.Statement|es.ModuleDeclaration> =
    getDefinitionStatements(program.body)
  const blockStatements: Array<es.Statement|es.ModuleDeclaration> =
    getBlockStatments(program.body);
}

function getBlockStatments(nodes: Array<es.Statement|es.ModuleDeclaration>):
  Array<es.Statement|es.ModuleDeclaration> {
    return nodes.filter(statement => statement.type === "BlockStatement");
}

function getDefinitionStatements(nodes: Array<es.Statement|es.ModuleDeclaration>):
  Array<es.Statement|es.ModuleDeclaration> {
  return nodes.filter(statement => statement.type === "FunctionDeclaration"
    || statement.type === "VariableDeclaration")
}

export function scopeVariableDeclaration(node: es.VariableDeclaration): DefinitionNode {
  const definitionNode: DefinitionNode = {
    name: node.declarations[0].id.name;
  }
}

export function scopeFunctionDeclaration(node: es.FunctionDeclaration): DefinitionNode {

}

export function scopeVariablesHelper(block: es.BlockStatement): BlockFrame {

}

export function lookupDefinition(variableName: string, line: number): DefinitionNode|void {

}
