import { Comment, Literal, SourceLocation, UnaryExpression, UnaryOperator } from 'estree'
import { StepperBaseNode } from '../../interface'
import { redex } from '../..'
import { StepperLiteral } from './Literal'
import { convert } from '../../generator'
import { StepperExpression, StepperPattern } from '..'

export class StepperUnaryExpression implements UnaryExpression, StepperBaseNode {
  type: 'UnaryExpression'
  operator: UnaryOperator
  prefix: true
  argument: StepperExpression
  leadingComments?: Comment[]
  trailingComments?: Comment[]
  loc?: SourceLocation | null
  range?: [number, number]

  constructor(
    operator: UnaryOperator,
    argument: StepperExpression,
    leadingComments?: Comment[],
    trailingComments?: Comment[],
    loc?: SourceLocation | null,
    range?: [number, number]
  ) {
    this.type = 'UnaryExpression'
    this.operator = operator
    this.prefix = true
    this.argument = argument
    this.leadingComments = leadingComments
    this.trailingComments = trailingComments
    this.loc = loc
    this.range = range
  }

  static createLiteral(node: StepperUnaryExpression | UnaryExpression): StepperLiteral | undefined {
    // if node argument is positive literal(x) and node operator is "-", we replace them with literal(-x) instead.
    if (node.operator === '-' 
      && node.argument.type === "Literal"
      && typeof (node.argument as Literal).value === "number"
      && (node.argument as Literal).value as number > 0
    ) {
      return new StepperLiteral(
        -((node.argument as Literal).value as number),
        (-((node.argument as Literal).value as number)).toString(),
        node.leadingComments,
        node.trailingComments,
        node.loc,
        node.range
      );
    }
    return undefined;
  }

  static create(node: UnaryExpression) {
    const literal = StepperUnaryExpression.createLiteral(node);
    if (literal) {
      return literal;
    }
    return new StepperUnaryExpression(
      node.operator,
      convert(node.argument) as StepperExpression,
      node.leadingComments,
      node.trailingComments,
      node.loc,
      node.range
    )
  }

  isContractible(): boolean {
    if (this.argument.type !== 'Literal') return false

    const valueType = typeof this.argument.value;
    const markContractible = () => {
      redex.preRedex = [this];
      return true;
    };

    switch (this.operator) {
      case '!':
        if (valueType === 'boolean') {
          return markContractible();
        } else {
          throw new Error(`Line ${this.loc?.start.line || 0}: Expected boolean, got ${valueType}.`);
        }
      case '-':
        if (valueType === 'number') {
          return markContractible();
        } else {
          throw new Error(`Line ${this.loc?.start.line || 0}: Expected number, got ${valueType}.`);
        }
      default:
        return false;
    }
  }

  isOneStepPossible(): boolean {
    return this.isContractible() || this.argument.isOneStepPossible()
  }

  contract(): StepperLiteral {
    redex.preRedex = [this]
    if (this.argument.type !== 'Literal') throw new Error()

    const operand = this.argument.value
    if (this.operator === '!') {
      const ret = new StepperLiteral(
        !operand,
        undefined,
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    } else if (this.operator === '-') {
      const ret = new StepperLiteral(
        -(operand as number),
        (-(operand as number)).toString(),
        this.leadingComments,
        this.trailingComments,
        this.loc,
        this.range
      )
      redex.postRedex = [ret]
      return ret
    }

    throw new Error()
  }

  oneStep(): StepperExpression {
    if (this.isContractible()) {
      return this.contract()
    }
    const res = new StepperUnaryExpression(
      this.operator,
      this.argument.oneStep(),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    );
    const literal = StepperUnaryExpression.createLiteral(res);
    return literal ? literal : res;
  }

  substitute(id: StepperPattern, value: StepperExpression): StepperExpression {
    const res = new StepperUnaryExpression(
      this.operator,
      this.argument.substitute(id, value),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
    const literal = StepperUnaryExpression.createLiteral(res);
    return literal ? literal : res;
  }

  freeNames(): string[] {
    return this.argument.freeNames()
  }

  allNames(): string[] {
    return this.argument.allNames()
  }

  rename(before: string, after: string): StepperExpression {
    return new StepperUnaryExpression(
      this.operator,
      this.argument.rename(before, after),
      this.leadingComments,
      this.trailingComments,
      this.loc,
      this.range
    )
  }
}
