import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectResult } from '../../utils/testing'

test('infinite functions with pair', () => {
  return expectResult(
    stripIndent`
      function f(x) { return pair(x,f(x+1)); }
      head(f(0))+head(tail(tail(f(0))));
    `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`2`)
})

test('infinite functions with list', () => {
  return expectResult(
    stripIndent`
        function f(x) { return list(x,f(x+1)); }
        head(f(0))+head(head(tail(f(0))));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`1`)
})

test('is_null with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return list(x,f(x+1)); }
        is_null(f(0));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`false`)
})

test('is_pair && is_list with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return list(x,f(x+1)); }
        is_pair(f(0)) && is_list(f(0));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`true`)
})

test('list_ref with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return pair(x,f(x+1)); }
        list_ref(f(0),3);
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`3`)
})

test('map with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return pair(x,f(x+1)); }
        head(tail(map((a)=>{return a*a;}, f(1))));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`4`)
})

test('member with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return pair(x*x,f(x+1)); }
        head(member(4,f(0)));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`4`)
})

test('remove_all with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return pair(x,f(x+1)); }
        head(tail(remove_all(1,f(0))));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`2`)
})

test('filter with infinite function', () => {
  return expectResult(
    stripIndent`
        function f(x) { return pair(x,f(x+1)); }
        function h(x){return x%2===0;}
        head(filter(h,f(1)));
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`2`)
})

test('self-loop lazy list', () => {
  return expectResult(
    stripIndent`
        const ones = pair(1,ones);
        display(head(ones)+head(tail(ones)));
        `,
    { chapter: 3, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`2`)
})

test('set_head in lazy evaluation', () => {
  return expectResult(
    stripIndent`
        const a = pair(1,2);
        set_head(a,10);
        display(head(a));
        `,
    { chapter: 3, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`10`)
})

test('set_tail in lazy evaluation', () => {
  return expectResult(
    stripIndent`
        const a = pair(1,2);
        set_tail(a,10);
        display(tail(a));
        `,
    { chapter: 3, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`10`)
})

test('non-pair error for head', () => {
  return expectParsedError(
    stripIndent`
        head("head");
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered \\"head\\""`
  )
})

test('non-pair error for tail', () => {
  return expectParsedError(
    stripIndent`
        tail("tail");
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: tail(xs) expects a pair as argument xs, but encountered \\"tail\\""`
  )
})

test('non-pair error for set_head', () => {
  return expectParsedError(
    stripIndent`
        set_head("pair",10);
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`"Line 1: Name set_head not declared."`)
})

test('non-pair error for set_tail', () => {
  return expectParsedError(
    stripIndent`
        set_tail("pair",10);
        `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`"Line 1: Name set_tail not declared."`)
})
