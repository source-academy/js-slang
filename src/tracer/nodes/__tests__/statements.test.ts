import type es from 'estree';
import { describe, expect, expectTypeOf, test as baseTest } from 'vitest';
import { StepperProgram } from '../Program';
import { InternalRuntimeError } from '../../../errors/runtimeErrors';
import { StepperBlockStatement } from '../Statement/BlockStatement';
import * as ast from '../../../utils/ast/astCreator';
import { StepperDebuggerStatement } from '../Statement/DebuggerStatement';
import { undefinedNode } from '..';
import { StepperExpressionStatement } from '../Statement/ExpressionStatement';
import { StepperFunctionDeclaration } from '../Statement/FunctionDeclaration';
import { StepperIfStatement } from '../Statement/IfStatement';
import { convert } from '../../generator';
import { StepperReturnStatement } from '../Statement/ReturnStatement';
import { StepperVariableDeclaration } from '../Statement/VariableDeclaration';
import type { RedexInfo } from '../..';

const test = baseTest.extend<{ redex: RedexInfo }>({
  redex: {
    preRedex: [],
    postRedex: [],
  },
});

describe(StepperBlockStatement, () => {
  test('properties', () => {
    const statement = new StepperBlockStatement([]);
    expect(statement.type).toEqual('BlockStatement');
    expectTypeOf(statement).toExtend<es.BlockStatement>();
  });

  describe('contract', () => {
    test('isContractible if body is empty', ({ redex }) => {
      const statement = new StepperBlockStatement([]);
      expect(statement.isContractible(redex)).toBeTruthy();
      expect(statement.contract(redex)).toBe(undefinedNode);
      expect(redex.preRedex.length).toEqual(1);
      expect(redex.preRedex[0]).toBe(statement);
    });

    test('isContractible if body has 1 statement that is not contractible', ({ redex }) => {
      const exprStmt = StepperExpressionStatement.create(
        ast.expressionStatement(ast.arrayExpression([])),
      );
      const statement = new StepperBlockStatement([exprStmt]);

      expect(statement.isContractible(redex)).toBeTruthy();
      expect(statement.contract(redex)).toBe(exprStmt);
      expect(redex.preRedex[0]).toBe(statement);
      expect(redex.postRedex[0]).toBe(exprStmt);
    });

    test('not contractible is body has more than 1 statement', ({ redex }) => {
      const statement = StepperBlockStatement.create(
        ast.blockStatement([
          ast.expressionStatement(ast.literal(1)),
          ast.expressionStatement(ast.literal(2)),
        ]),
      );

      expect(statement.isContractible(redex)).toBeFalsy();
      expect(statement.contract.bind(statement)).toThrow(
        'Cannot contract BlockStatement with body length > 1',
      );
    });
  });

  describe.todo('oneStep', () => {});
});

describe(StepperDebuggerStatement, () => {
  const statement = new StepperDebuggerStatement();

  test('properties', () => {
    expect(statement.type).toEqual('DebuggerStatement');
    expectTypeOf(statement).toExtend<es.DebuggerStatement>();
  });

  test('contract', () => {
    expect(statement.isContractible()).toBeTruthy();
    expect(statement.contract()).toBe(undefinedNode);
  });

  test('oneStep', ({ redex }) => {
    expect(statement.isOneStepPossible()).toBeTruthy();
    expect(statement.oneStep(redex)).toBe(undefinedNode);
  });
});

describe(StepperExpressionStatement, () => {
  test('properties', () => {
    const statement = StepperExpressionStatement.create(ast.expressionStatement(ast.literal(1)));
    expect(statement.type).toEqual('ExpressionStatement');
    expectTypeOf(statement).toExtend<es.ExpressionStatement>();
  });

  describe('contract', () => {
    test('is contractible when expression is contractible', ({ redex }) => {
      const statement = StepperExpressionStatement.create(
        ast.expressionStatement(ast.logicalExpression('&&', ast.literal(true), ast.literal(false))),
      );
      expect(statement.isContractible(redex)).toBeTruthy();
    });

    test('is not contractible when expression is not contractible', ({ redex }) => {
      const statement = StepperExpressionStatement.create(
        ast.expressionStatement(ast.literal(false)),
      );
      expect(statement.isContractible(redex)).toBeFalsy();
    });
  });

  describe('oneStep', () => {
    test('oneStep possible when expression has oneStep possible', ({ redex }) => {
      const statement = StepperExpressionStatement.create(
        ast.expressionStatement(ast.logicalExpression('&&', ast.literal(true), ast.literal(false))),
      );
      expect(statement.isOneStepPossible(redex)).toBeTruthy();
    });

    test('oneStep not possible when expression is not oneStep possible', ({ redex }) => {
      const statement = StepperExpressionStatement.create(
        ast.expressionStatement(ast.literal(true)),
      );

      expect(statement.isOneStepPossible(redex)).toBeFalsy();
      expect(statement.oneStep.bind(statement)).toThrow();
    });
  });
});

describe(StepperFunctionDeclaration, () => {
  const statement = StepperFunctionDeclaration.create(
    ast.functionDeclaration(ast.identifier('func'), [], ast.blockStatement([])),
  );

  test('properties', () => {
    expect(statement.type).toEqual('FunctionDeclaration');
    expectTypeOf(statement).toExtend<es.FunctionDeclaration>();
  });

  test('contract', ({ redex }) => {
    expect(statement.isContractible()).toBeFalsy();
    expect(statement.contract(redex)).toEqual(undefinedNode);
  });

  test('oneStep', ({ redex }) => {
    expect(statement.isOneStepPossible()).toBeFalsy();
    expect(statement.oneStep(redex)).toEqual(undefinedNode);
  });
});

describe(StepperIfStatement, () => {
  test('properties', () => {
    const statement = StepperIfStatement.create(
      ast.ifStatement(ast.literal(true), ast.blockStatement([]), ast.blockStatement([])),
    );
    expect(statement.type).toEqual('IfStatement');
    expectTypeOf(statement).toExtend<es.IfStatement>();
  });

  describe('contract', () => {
    test('is contractible when test is a literal', () => {
      const statement = StepperIfStatement.create(
        ast.ifStatement(ast.literal(true), ast.blockStatement([]), ast.blockStatement([])),
      );
      expect(statement.isContractible()).toBeTruthy();
    });

    test('is not contractible when test is not a literal', () => {
      const statement = StepperIfStatement.create(
        ast.ifStatement(
          ast.callExpression(ast.identifier('func'), []),
          ast.blockStatement([]),
          ast.blockStatement([]),
        ),
      );
      expect(statement.isContractible()).toBeFalsy();
      expect(statement.contract.bind(statement)).toThrow('Cannot contract non-literal test');
    });
  });

  describe('oneStep', () => {
    test('oneStep possible when test is oneStep possible', ({ redex }) => {
      const statement = StepperIfStatement.create(
        ast.ifStatement(
          ast.logicalExpression('||', ast.literal(true), ast.literal(false)),
          ast.blockStatement([]),
          ast.blockStatement([]),
        ),
      );
      expect(statement.isOneStepPossible(redex)).toBeTruthy();
    });

    test('oneStep not possible when test is not oneStep possible', ({ redex }) => {
      const test = ast.arrowFunctionExpression([], ast.blockStatement([]));
      expect(convert(test).isOneStepPossible(redex)).toBeFalsy();

      const statement = StepperIfStatement.create(
        ast.ifStatement(test, ast.blockStatement([]), ast.blockStatement([])),
      );

      expect(statement.isOneStepPossible(redex)).toBeFalsy();
      expect(statement.oneStep.bind(statement)).toThrow('Tried to oneStep ineligible IfStatement');
    });
  });
});

describe(StepperProgram, () => {
  const program = new StepperProgram([]);

  test('properties', () => {
    expect(program.type).toEqual('Program');
    expectTypeOf(program).toExtend<es.Program>();
  });

  test('not contractible', () => {
    expect(program.isContractible()).toBeFalsy();
    expect(program.contract.bind(program)).toThrow(InternalRuntimeError);
  });
});

describe(StepperReturnStatement, () => {
  test('properties', () => {
    const statement = StepperReturnStatement.create(ast.returnStatement(ast.literal(null)));

    expect(statement.type).toEqual('ReturnStatement');
    expectTypeOf(statement).toExtend<es.ReturnStatement>();
  });

  describe('contract', () => {
    test('is contractible when argument is present', () => {
      const statement = StepperReturnStatement.create(ast.returnStatement(ast.literal(0)));
      expect(statement.isContractible()).toBeTruthy();
    });
  });

  describe('one step', () => {
    test('is one step possible when argument is present', () => {
      const statement = StepperReturnStatement.create(ast.returnStatement(ast.literal(0)));
      expect(statement.isOneStepPossible()).toBeTruthy();
    });
  });
});

describe.todo(StepperVariableDeclaration, () => {});
