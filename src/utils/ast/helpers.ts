import type es from 'estree';

import assert from '../assert';
import { ArrayMap } from '../dict';
import type { ModuleDeclarationWithSource } from '../../modules/moduleTypes';
import { InternalRuntimeError } from '../../errors/base';
import { isDeclaration, isIdentifier, isImportDeclaration } from './typeGuards';

export function getModuleDeclarationSource(node: ModuleDeclarationWithSource): string {
  assert(
    typeof node.source?.value === 'string',
    `Expected ${node.type} to have a source value of type string, got ${node.source?.value}`,
  );
  return node.source.value;
}

export function extractIdsFromPattern(pattern: es.Pattern): es.Identifier[] {
  switch (pattern.type) {
    case 'ArrayPattern':
      return pattern.elements.flatMap(extractIdsFromPattern);
    case 'AssignmentPattern':
      return extractIdsFromPattern(pattern.left);
    case 'Identifier':
      return [pattern];
    case 'ObjectPattern':
      return pattern.properties.flatMap(prop => {
        if (prop.type === 'Property') {
          return extractIdsFromPattern(prop.value);
        }
        return extractIdsFromPattern(prop);
      });
    case 'RestElement':
      return extractIdsFromPattern(pattern.argument);
    default:
      throw new InternalRuntimeError(
        `Should not encounter a ${pattern.type} in ${extractIdsFromPattern.name}`,
        pattern,
      );
  }
}

/**
 * Extracts all the identifiers being declared by a VariableDeclaration
 */
export function extractDeclarations(decl: es.VariableDeclaration) {
  return decl.declarations.flatMap(({ id }) => extractIdsFromPattern(id));
}

/**
 * Gets all the identifiers introduced by a declaration node
 */
export function getIdsFromDeclaration(
  decl: es.Declaration | es.ModuleDeclaration,
): es.Identifier[] {
  switch (decl.type) {
    case 'ExportAllDeclaration':
      return [];
    case 'ExportDefaultDeclaration': {
      switch (decl.declaration.type) {
        case 'ClassDeclaration':
        case 'FunctionDeclaration':
          return decl.declaration.id ? [decl.declaration.id] : [];
      }
      return [];
    }
    case 'ExportNamedDeclaration':
      return decl.declaration ? getIdsFromDeclaration(decl.declaration) : [];
    case 'ImportDeclaration':
      return decl.specifiers.flatMap(spec => spec.local);
    case 'ClassDeclaration':
    case 'FunctionDeclaration':
      return [decl.id];
    case 'VariableDeclaration':
      return extractDeclarations(decl);
  }
}

/**
 * Since Variable declarations in Source programs must be initialized and are guaranteed to only
 * have 1 declarator, this function unwraps variable declarations and its single declarator
 * into its id and init
 */
export function getSourceVariableDeclaration(decl: es.VariableDeclaration) {
  assert(
    decl.declarations.length === 1,
    'Variable Declarations in Source should only have 1 declarator!',
  );

  const [declaration] = decl.declarations;
  assert(
    isIdentifier(declaration.id),
    'Variable Declarations in Source should be declared using an Identifier!',
  );

  assert(!!declaration.init, 'Variable declarations in Source must be initialized!');

  return {
    id: declaration.id,
    init: declaration.init,
    loc: declaration.loc,
  };
}

/**
 * Get the name of an import/export specifier endpoint. ES2022 allows these to be
 * string literals (e.g. `export { x as "y" }`); Source only supports identifier
 * names, so fall back to the literal's stringified value.
 */
export const getSpecifierName = (node: es.Identifier | es.Literal): string =>
  node.type === 'Identifier' ? node.name : `${node.value}`;

export const getImportedName = (
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier,
) => {
  switch (spec.type) {
    case 'ImportDefaultSpecifier':
      return 'default';
    case 'ImportSpecifier':
      return getSpecifierName(spec.imported);
    case 'ExportSpecifier':
      return getSpecifierName(spec.local);
  }
};

export const specifierToString = (
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier,
) => {
  switch (spec.type) {
    case 'ImportSpecifier': {
      if (getSpecifierName(spec.imported) === spec.local.name) {
        return getSpecifierName(spec.imported);
      }
      return `${getSpecifierName(spec.imported)} as ${spec.local.name}`;
    }
    case 'ImportDefaultSpecifier':
      return `default as ${spec.local.name}`;
    case 'ExportSpecifier': {
      if (getSpecifierName(spec.local) === getSpecifierName(spec.exported)) {
        return getSpecifierName(spec.local);
      }
      return `${getSpecifierName(spec.local)} as ${getSpecifierName(spec.exported)}`;
    }
  }
};

type BlockBody = (es.Program | es.BlockStatement)['body'][number];
type BlocKBodyWithoutDeclarations = Exclude<BlockBody, es.Declaration>;

/**
 * Returns true if the array of statements doesn't contain any declarations
 */
export function hasNoDeclarations(stmt: BlockBody[]): stmt is BlocKBodyWithoutDeclarations[] {
  return !stmt.some(isDeclaration);
}

type BlockBodyWithoutImports = Exclude<BlockBody, es.ImportDeclaration>;
/**
 * Returns true if the array of statements doesn't contain any import declarations
 */
export function hasNoImportDeclarations(stmt: BlockBody[]): stmt is BlockBodyWithoutImports[] {
  return !stmt.some(isImportDeclaration);
}

/**
 * Filters out all import declarations from a program, and sorts them by
 * the module they import from
 */
export function filterImportDeclarations({
  body,
}: es.Program): [ArrayMap<string, es.ImportDeclaration>, BlockBodyWithoutImports[]] {
  return body.reduce<[ArrayMap<string, es.ImportDeclaration>, BlockBodyWithoutImports[]]>(
    ([importNodes, otherNodes], node) => {
      if (!isImportDeclaration(node)) return [importNodes, [...otherNodes, node]];

      const moduleName = getModuleDeclarationSource(node);
      importNodes.add(moduleName, node);
      return [importNodes, otherNodes];
    },
    [new ArrayMap(), []],
  );
}
