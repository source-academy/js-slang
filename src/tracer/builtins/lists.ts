import { parse } from "acorn";
import { StepperExpression } from "../nodes";
import { StepperArrayExpression } from "../nodes/Expression/ArrayExpression";
import { StepperArrowFunctionExpression } from "../nodes/Expression/ArrowFunctionExpression";
import { StepperFunctionApplication } from "../nodes/Expression/FunctionApplication";
import { StepperIdentifier } from "../nodes/Expression/Identifier";
import { StepperLiteral } from "../nodes/Expression/Literal";
import { ArrowFunctionExpression, ExpressionStatement } from "estree";

export const listBuiltinFunctions = {
    pair: (args: StepperExpression[]): StepperExpression => {
        return new StepperArrayExpression([args[0], args[1]]);
    },
    list: (args: StepperExpression[]): StepperExpression => {
        if (args.length === 0) {
            return new StepperLiteral(null);
        }
        return listBuiltinFunctions.pair([args[0], listBuiltinFunctions.list(args.slice(1))]);
    },
    head: (args: StepperExpression[]): StepperExpression => {
        console.log(args)
        return (args[0] as StepperArrayExpression).elements[0] as StepperExpression;
    },
    tail: (args: StepperExpression[]): StepperExpression => {
        return (args[0] as StepperArrayExpression).elements[1] as StepperArrayExpression;
    },
    append: (args: StepperExpression[]): StepperExpression => {
        return new StepperFunctionApplication(new StepperIdentifier('$append'), 
        [...args, new StepperArrowFunctionExpression([new StepperIdentifier("xs")], new StepperIdentifier("xs"))]);
    },
    $append: (args: StepperExpression[]): StepperExpression => {
        const parsedProgram = parse(`
            (xs, ys, cont) => {
                return is_null(xs) ? cont(ys) : $append(tail(xs), ys, zs => cont(pair(head(xs), zs)));
            };
        `, { ecmaVersion: 10 })!;
        const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement;
        const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression;
        return new StepperFunctionApplication(StepperArrowFunctionExpression.create(parsedExpression), args);
    },
    reverse: (args: StepperExpression[]): StepperExpression => {
        return new StepperFunctionApplication(new StepperIdentifier('$reverse'), 
        [...args, new StepperLiteral(null)]);
    },
    $reverse: (args: StepperExpression[]): StepperExpression => {
        const parsedProgram = parse(`
            (original, reversed) => {
                return is_null(original) ? reversed : $reverse(tail(original), pair(head(original), reversed));
            }
        `, { ecmaVersion: 10 })!;
        const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement;
        const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression;
        return new StepperFunctionApplication(StepperArrowFunctionExpression.create(parsedExpression), args);
    },
    map: (args: StepperExpression[]): StepperExpression => {
        return new StepperFunctionApplication(new StepperIdentifier('$map'), 
        [...args, new StepperLiteral(null)]);
    },
    $map: (args: StepperExpression[]): StepperExpression => {
        const parsedProgram = parse(`
            (f, xs, acc) => {
                return is_null(xs) ? reverse(acc) : $map(f, tail(xs), pair(f(head(xs)), acc));
            }
        `, { ecmaVersion: 10 })!;
        const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement;
        const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression;
        return new StepperFunctionApplication(StepperArrowFunctionExpression.create(parsedExpression), args);
    },
    filter: (args: StepperExpression[]): StepperExpression => {
        return new StepperFunctionApplication(new StepperIdentifier('$filter'), 
        [...args, new StepperLiteral(null)]);
    },
    $filter: (args: StepperExpression[]): StepperExpression => {
        const parsedProgram = parse(`
            (pred, xs, acc) => {
                return is_null(xs) ? reverse(acc) : pred(head(xs)) ? $filter(pred, tail(xs), pair(head(xs), acc)) : $filter(pred, tail(xs), acc);
            }
        `, { ecmaVersion: 10 })!;
        const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement;
        const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression;
        return new StepperFunctionApplication(StepperArrowFunctionExpression.create(parsedExpression), args);
    },
    is_null: (args: StepperExpression[]): StepperExpression => {
        return new StepperLiteral((args[0] as StepperLiteral).value === null);
    }
}