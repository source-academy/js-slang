import { Chapter, Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectResult } from '../../utils/testing'

test('pair creates pair', () => {
  return expectResult(
    stripIndent`
    is_pair (pair(1, 'a string ""'));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('head works', () => {
  return expectResult(
    stripIndent`
    head(pair(1, 'a string ""'));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('tail works', () => {
  return expectResult(
    stripIndent`
    tail(pair(1, 'a string ""'));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`"a string \\"\\""`)
})

test('tail of a 1 element list is null', () => {
  return expectResult(
    stripIndent`
    tail(list(1));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`null`)
})

test('empty list is null', () => {
  return expectResult(
    stripIndent`
    list();
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot('null')
})

test('for_each', () => {
  return expectResult(
    stripIndent`
    let sum = 0;
    for_each(x => {
      sum = sum + x;
    }, list(1, 2, 3));
    sum;
    `,
    { chapter: Chapter.SOURCE_3, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expectResult(
    stripIndent`
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expectResult(
    stripIndent`
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expectResult(
    stripIndent`
    equal(build_list(x => x * x, 5), list(0, 1, 4, 9, 16));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expectResult(
    stripIndent`
    equal(reverse(list("string", "null", "undefined", "null", 123)), list(123, "null", "undefined", "null", "string"));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expectResult(
    stripIndent`
    equal(append(list(123, 123), list(456, 456, 456)), list(123, 123, 456, 456, 456));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expectResult(
    stripIndent`
    equal(
      member(4, list(1, 2, 3, 4, 123, 456, 789)),
      list(4, 123, 456, 789));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expectResult(
    stripIndent`
    remove(1, list(1));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expectResult(
    stripIndent`
    equal (remove(2, list(1)),list(1));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('remove_all', () => {
  return expectResult(
    stripIndent`
    equal(remove_all(1, list(1, 2, 3, 4, 1, 1, 1, 5, 1, 1, 6)), list(2, 3, 4, 5, 6));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expectResult(
    stripIndent`
    equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expectResult(
    stripIndent`
    list_ref(list(1, 2, 3, "4", 4), 4);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`4`)
})

test('accumulate', () => {
  return expectResult(
    stripIndent`
    accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`10`)
})

test('list_to_string', () => {
  return expectResult(
    stripIndent`
    list_to_string(list(1, 2, 3));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`"[1,[2,[3,null]]]"`)
})
test('bad number error build_list', () => {
  return expectParsedError(
    stripIndent`
    build_list(x => x, '1');
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`"Line 45: Expected number on left hand side of operation, got string."`)
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list('1', '5');
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 139: Expected string on right hand side of operation, got number."`
  )
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list('1', 5);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 139: Expected string on right hand side of operation, got number."`
  )
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list(1, '5');
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 140: Expected number on right hand side of operation, got string."`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), 3);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 148: Error: tail(xs) expects a pair as argument xs, but encountered null"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), -1);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 148: Error: tail(xs) expects a pair as argument xs, but encountered null"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), 1.5);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 148: Error: tail(xs) expects a pair as argument xs, but encountered null"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), '1');
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(
    `"Line 149: Expected string on right hand side of operation, got number."`
  )
})

test('arguments are not evaluated for pair', () => {
  return expectResult(
    stripIndent`
    head(pair(1,head(null)));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})
test('arguments are not evaluated for list', () => {
  return expectResult(
    stripIndent`
    head(list(1,head(null)));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('recursive pair definitions are possible (tail)', () => {
  return expectResult(
    stripIndent`
    const a = pair (1,a);
    head(a) + head(tail(a));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('recursive pair definitions are possible (head)', () => {
  return expectResult(
    stripIndent`
    const a = pair (a,1);
    tail(a) + tail(head(a));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('recursive list definitions are possible (head)', () => {
  return expectResult(
    stripIndent`
    const a = list (1,a);
    head(a) + head(head(tail(a)));
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('is_list on infinite lists works', () => {
  return expectResult(
    stripIndent`
    const a = list(1,a);
    is_list(a);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`true`)
})
test('list_ref on infinite lists', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    list_ref(a,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('map on infinite lists works', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    const b = map(x => 2 * x, a);
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('map on infinite lists works', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    const b = map(x => 2 * x, a);
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('append left list is infinite', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    const b = append(a, list(3,4));
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('append right list is infinite', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    const b = append(list(3,4),a);
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('remove on infinite list', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,a);
    const b = remove(1,a);
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`1`)
})

test('remove all ones on infinite list of ones and twos', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,pair(2,a));
    const b = remove_all(1,a);
    list_ref(b,200);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})

test('filter on infinite lists', () => {
  return expectResult(
    stripIndent`
    const a = pair(1,pair(2,a));
    const b = filter(x => x % 2 === 0,a);
    list_ref(b,1);
    `,
    { chapter: Chapter.SOURCE_2, native: true, variant: Variant.LAZY }
  ).toMatchInlineSnapshot(`2`)
})
