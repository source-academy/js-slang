import { parse } from 'acorn'
import { ArrowFunctionExpression, ExpressionStatement } from 'estree'
import { StepperExpression } from '../nodes'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'
import { StepperFunctionApplication } from '../nodes/Expression/FunctionApplication'

export const auxiliaryBuiltinFunctions = {
  __access_export__: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (exports, lookup_name) => {
                if (lookup_name === "default") {
                    return head(exports);
                } else {
                    const named_exports = tail(exports);
                    return __access_named_export__(named_exports, lookup_name);
                }
            }
        `,
        { ecmaVersion: 10 }
      )!
      const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement
      const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression
      return new StepperFunctionApplication(
        StepperArrowFunctionExpression.create(parsedExpression),
        args
      )
    },
    arity: 2
  },
  __access_named_export__: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (named_exports, lookup_name) => {
                if (is_null(named_exports)) {
                    return undefined;
                } else {
                    const name = head(head(named_exports));
                    const identifier = tail(head(named_exports));
                    if (name === lookup_name) {
                        return identifier;
                    } else {
                        return __access_named_export__(tail(named_exports), lookup_name);
                    }
                }
            }
        `,
        { ecmaVersion: 10 }
      )!
      const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement
      const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression
      return new StepperFunctionApplication(
        StepperArrowFunctionExpression.create(parsedExpression),
        args
      )
    },
    arity: 2
  }
}
