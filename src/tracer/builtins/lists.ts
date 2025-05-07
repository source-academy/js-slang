import { parse } from 'acorn'
import { ArrowFunctionExpression, ExpressionStatement } from 'estree'
import { StepperExpression } from '../nodes'
import { StepperArrayExpression } from '../nodes/Expression/ArrayExpression'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'
import { StepperFunctionApplication } from '../nodes/Expression/FunctionApplication'
import { StepperIdentifier } from '../nodes/Expression/Identifier'
import { StepperLiteral } from '../nodes/Expression/Literal'
import { StepperBinaryExpression } from '../nodes/Expression/BinaryExpression'

export const listBuiltinFunctions = {
  pair: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperArrayExpression([args[0], args[1]])
    },
    arity: 2
  },
  is_pair: {
    definition: (arg: StepperExpression[]): StepperExpression => {
      return new StepperLiteral(
        arg[0].type === 'ArrayExpression' && (arg[0] as StepperArrayExpression).elements.length == 2
      )
    },
    arity: 1
  },
  head: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return (args[0] as StepperArrayExpression).elements[0] as StepperExpression
    },
    arity: 1
  },
  tail: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return (args[0] as StepperArrayExpression).elements[1] as StepperArrayExpression
    },
    arity: 1
  },
  is_null: {
    definition: (arg: StepperExpression[]): StepperLiteral => {
      return new StepperLiteral(
        arg[0].type === 'Literal' && (arg[0] as StepperLiteral).value === null
      )
    },
    arity: 1
  },
  is_list: {
    definition: (arg: StepperExpression[]): StepperLiteral => {
      const $is_list: (args: StepperExpression) => boolean = (arg: StepperExpression) =>
        arg === null ||
        (arg.type === 'Literal' && arg.value === null) ||
        (arg.type === 'ArrayExpression' &&
          (arg as StepperArrayExpression).elements.length === 2 &&
          $is_list((arg as StepperArrayExpression).elements[1]!))
      return new StepperLiteral($is_list(arg[0]))
    },
    arity: 1
  },
  draw_data: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return args[0]
    },
    arity: 0
  },
  equal: {
    definition: (args: StepperExpression[]) => {
      const parsedProgram = parse(
        `
                (xs, ys) => is_pair(xs) 
                    ? is_pair(ys) && equal(head(xs), head(ys)) && equal(tail(xs), tail(ys)) 
                    : is_null(xs) ? is_null(ys) : is_number(xs) ? is_number(ys) && xs === ys 
                    : is_boolean(xs) ? is_boolean(ys) && (xs && ys || !xs && !ys) 
                    : is_string(xs) ? is_string(ys) && xs === ys 
                    : is_undefined(xs) ? is_undefined(ys) 
                    : is_function(xs) ? is_function(ys) && xs === ys : fals
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
  list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      if (args.length === 0) {
        return new StepperLiteral(null)
      }
      return listBuiltinFunctions.pair.definition([
        args[0],
        listBuiltinFunctions.list.definition(args.slice(1))
      ])
    },
    arity: 0
  },
  length: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$length'), [
        ...args,
        new StepperLiteral(0)
      ])
    },
    arity: 1
  },
  $length: {
    definition: (args: StepperExpression[]) => {
      const parsedProgram = parse(
        `
                (xs, acc) => is_null(xs) ? acc : $length(tail(xs), acc + 1);
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
  build_list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$build_list'), [
        new StepperBinaryExpression('-', args[1], new StepperLiteral(1)),
        args[0],
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $build_list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        ` 
                (i, fun, already_built) => i < 0 ? already_built : $build_list(i - 1, fun, pair(fun(i), already_built));`,
        { ecmaVersion: 10 }
      )!
      const parsedExpressionStatement = parsedProgram.body[0] as ExpressionStatement
      const parsedExpression = parsedExpressionStatement.expression as ArrowFunctionExpression
      return new StepperFunctionApplication(
        StepperArrowFunctionExpression.create(parsedExpression),
        args
      )
    },
    arity: 3
  },
  for_each: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        ` (fun, xs) =>
            {
                if (is_null(xs)) {
                    return true;
                } else {
                    fun(head(xs));
                    return for_each(fun, tail(xs));
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
  list_to_string: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$list_to_string'), [
        args[0],
        new StepperArrowFunctionExpression([new StepperIdentifier('x')], new StepperIdentifier('x'))
      ])
    },
    arity: 1
  },
  $list_to_string: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
        (xs, cont) => is_null(xs) ? cont("null") : is_pair(xs) ? $list_to_string(head(xs),
        x => $list_to_string(tail(xs), y => cont("[" + x + "," + y + "]"))) : cont(stringify(xs))  
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
  append: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$append'), [
        ...args,
        new StepperArrowFunctionExpression(
          [new StepperIdentifier('xs')],
          new StepperIdentifier('xs')
        )
      ])
    },
    arity: 2
  },
  $append: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (xs, ys, cont) => is_null(xs) ? cont(ys) : $append(tail(xs), ys, zs => cont(pair(head(xs), zs)));
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
    arity: 3
  },
  reverse: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$reverse'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 1
  },
  $reverse: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (original, reversed) => is_null(original) ? reversed : $reverse(tail(original), pair(head(original), reversed));
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
  member: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (v, xs) => is_null(xs)
                ? null
                : (v === head(xs))
                ? xs
                : member(v, tail(xs));
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
  remove: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$remove'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $remove: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (v, xs, acc) => is_null(xs)
                ? append(reverse(acc), xs)
                : v === head(xs)
                ? append(reverse(acc), tail(xs))
                : $remove(v, tail(xs), pair(head(xs), acc));
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
    arity: 3
  },
  remove_all: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$remove_all'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $remove_all: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (v, xs, acc) => is_null(xs)
                ? append(reverse(acc), xs)
                : v === head(xs)
                ? $remove_all(v, tail(xs), acc)
                : $remove_all(v, tail(xs), pair(head(xs), acc));
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
    arity: 3
  },
  enum_list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$enum_list'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $enum_list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (start, end, acc) => start > end
                ? reverse(acc)
                : $enum_list(start + 1, end, pair(start, acc));
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
    arity: 3
  },
  list_ref: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (xs, n) => n === 0
                ? head(xs)
                : list_ref(tail(xs), n - 1);
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
  map: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$map'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $map: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (f, xs, acc) => is_null(xs) ? reverse(acc) : $map(f, tail(xs), pair(f(head(xs)), acc));
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
    arity: 3
  },
  filter: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$filter'), [
        ...args,
        new StepperLiteral(null)
      ])
    },
    arity: 2
  },
  $filter: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (pred, xs, acc) =>  is_null(xs) ? reverse(acc) : pred(head(xs)) ? $filter(pred, tail(xs), pair(head(xs), acc)) : $filter(pred, tail(xs), acc);
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
    arity: 3
  },
  accumulate: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return new StepperFunctionApplication(new StepperIdentifier('$accumulate'), [
        ...args,
        new StepperArrowFunctionExpression([new StepperIdentifier('x')], new StepperIdentifier('x'))
      ])
    },
    arity: 3
  },
  $accumulate: {
    definition: (args: StepperExpression[]): StepperExpression => {
      const parsedProgram = parse(
        `
            (f, initial, xs, cont) => is_null(xs)
                ? cont(initial)
                : $accumulate(f, initial, tail(xs), x => cont(f(head(xs), x)));
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
    arity: 4
  },
  display_list: {
    definition: (args: StepperExpression[]): StepperExpression => {
      return args[0] // x => x
    },
    arity: 1
  }
}
