import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_4, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_4, Variant.TYPED)
})

describe('parse tree types', () => {
  it('prelude has no errors', () => {
    parse('const x = 1;', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('types parse trees correctly (program)', () => {
    const code = `const x: Program = parse('const x = 1; x;');
      const type: "program" = head(x);
      const stmts: List<Statement> = tail(x); // error
      const stmts2: List<Statement> = head(tail(x)); // no error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type '\\"sequence\\"' is not assignable to type '\\"program\\"'.
      Line 3: Type 'Pair<List<Statement>, null>' is not assignable to type 'List<Statement>'."
    `)
  })

  it('types parse trees correctly (statement)', () => {
    const code = `const x: Statement = parse('1;');
      const type: "sequence" = head(x);
      const stmts: Pair<number, null> = tail(x); // no error
      const stmts2: Pair<number, null> = head(tail(x)); // error
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`
      "Line 2: Type '\\"constant_declaration\\" | \\"variable_declaration\\" | \\"function_declaration\\" | \\"return_statement\\" | \\"conditional_statement\\" | \\"while_loop\\" | \\"for_loop\\" | \\"break_statement\\" | \\"continue_statement\\" | \\"block\\" | \\"literal\\" | \\"name\\" | \\"logical_composition\\" | \\"binary_operator_combination\\" | \\"unary_operator_combination\\" | \\"application\\" | \\"lambda_expression\\" | \\"conditional_expression\\" | \\"assignment\\" | \\"object_assignment\\" | \\"object_access\\" | \\"array_expression\\"' is not assignable to type '\\"sequence\\"'.
      Line 4: Type 'Name | Expression | Expression | VariableDeclaration | null | Program | number | string | boolean | null | string | LogicalOperator | BinaryOperator | UnaryOperator | Expression | Parameters | Name | ObjectAccess | List<Expression>' is not assignable to type 'Pair<number, null>'."
    `)
  })
})

describe('parse', () => {
  it('takes in string', () => {
    const code = `const x1 = parse('1;');
      const x2 = parse(1);
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'number' is not assignable to type 'string'."`
    )
  })

  it('returns Program | Statement', () => {
    const code = "const x: number = parse('1;');"

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 1: Type 'Program | Statement' is not assignable to type 'number'."`
    )
  })
})
