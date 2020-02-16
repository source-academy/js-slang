import { Value } from '../types'
import { stripIndent } from '../utils/formatters'
import {
  createTestContext,
  expectParsedError,
  expectParsedErrorNoErrorSnapshot,
  expectParsedErrorNoSnapshot,
  expectResult,
  expectToLooselyMatchJS,
  expectToMatchJS
} from '../utils/testing'

const toString = (x: Value) => '' + x;

test('pair', () => {
    return expectResult(
        'pair(1, 2);'
    ).toBe( m => m(1,2))
  })

  test('list', () => {
    return expectResult(
        'list(1, 2);'
    ).toBe([1,()=>2])
  })

  test('is_list', () => {
    return expectResult(
        '!is_list(1)&&is_list(list(1,2));' // maybe pair(1,2)===list(1,2), so no test of is_list(pair(1,2))
    ).toBe(true)
  })

  test('is_pair', () => {
    return expectResult(
        '!is_pair(1)&&is_pair(pair(1,2))&&is_pair(list(1,2));'
    ).toBe(true)
  })

  test('head_pair', () => {
    return expectResult(
        'head(pair(1,2));'
    ).toBe(1)
  })

  test('tail_pair', () => {
    return expectResult(
        'tail(pair(1,2));'
    ).toBe(2)
  })

  test('head_list', () => {
    return expectResult(
        'head(list(1,2));'
    ).toBe(1)
  })

  test('tail_list', () => {
    return expectResult(
        'tail(list(1,2));'
    ).toBe(2)
  })

  test('tail_list_list', () => {
    return expectResult(
        'tail(list(1,list(2,3)));'
    ).toBe([2,()=>3])
  })

  test('head_null', () => {
    return expectResult(
        'head(null);'
    ).toBe(undefined)
  })

  test('tail_null', () => {
    return expectResult(
        'tail(null);'
    ).toBe(undefined)
  })

  test('head_number', () => {
    return expectResult(
        'head(1);'
    ).toBe(undefined)
  })

  test('tail_number', () => {
    return expectResult(
        'tail(1);'
    ).toBe(undefined)
  })

  test('length', () => {
    return expectResult(
        'length(list(1,2));'
    ).toBe(2)
  })

  /*
    length(list(1,2,3,4)) is 4 or 2 ?
    - If length is meaningful, it should be 4. Or we can give up length().
    Is list(1,2,3) the same as list(1,list(2,3)) ?
    - Originally it's different.
    - But would be the same (so far, according to our data structure)
  */
  // New Cases Below

  test('length', () => {
    return expectResult(
        'length(list(1,2,3,4));'
    ).toBe(4)
  })

  test('length', () => {
    return expectResult(
        'length(list(1,list(2,3)));'
    ).toBe(3)
  })

  test('Infinite stream', () => {
    return expectResult(
      stripIndent`
      function fibgen(a, b) {
        return pair(a, fibgen(b, a + b));
    }
    
    const fibs = fibgen(0, 1);
    list_ref(fibs,8);
    
    `,
      { chapter: 4, native: true }
    ).toBe(21)
  })

  test('Infinite stream and filter', () => {
    return expectResult(
      stripIndent`
      function integer(a) {
        return pair(a, a+1);
      }
      function isPrime(a){
        const limit = math_floor(sqrt(a));
        let i = 2;
        while (i<=limit){
          if (a % i ===0){
            return false;
          }
          else{ i= i+1;}
        }
        return true;
      }
      const ints = integer(2);
      list_ref(filter(isPrime,fibs), 7);
    `,
      { chapter: 4, native: true }
    ).toBe(17)
  })
