// import { stripIndent } from '../utils/formatters'
import { expectResult } from '../utils/testing'

test('Dummy test', () => {
  return expectResult('').toBe(undefined)
})

// test('Lazy evaluation for function calls should run without errors', () => {
//   return expectResult(
//     stripIndent`
//     function unless(cond, conseq, alter) {
//       return cond ? alter : conseq;
//     }
//     const xs = list();
//     unless(xs === null, head(xs), 42);
//   `,
//     { chapter: 4, native: false }
//   ).toBe(42)
// })
