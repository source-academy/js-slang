/* This file uses programs from SICP JS 4.3 as tests for the non deterministic interpreter */
import { testNonDeterministicCode } from './non-det-interpreter'

test('An element of', async () => {
  await testNonDeterministicCode(`an_element_of(list(1, 2, list(3, 4)));`, [1, 2, [3, [4, null]]])
})

test('An integer between', async () => {
  await testNonDeterministicCode('an_integer_between(5, 10);', [5, 6, 7, 8, 9, 10])
})

test('Pythagorean triple', async () => {
  await testNonDeterministicCode(
    `function a_pythagorean_triple_between(low, high) {
         const i = an_integer_between(low, high);
         const j = an_integer_between(i, high);
         const k = an_integer_between(j, high);
         require(i * i + j * j === k * k);
         return list(i, j, k);
       }
       a_pythagorean_triple_between(3, 5);`,
    [[3, [4, [5, null]]]]
  )
})

test('Multiple dwelling problem', async () => {
  await testNonDeterministicCode(
    `function multiple_dwelling() {
            const baker = amb(1, 2, 3, 4, 5);
            const cooper = amb(1, 2, 3, 4, 5);
            const fletcher = amb(1, 2, 3, 4, 5);
            const miller = amb(1, 2, 3, 4, 5);
            const smith = amb(1, 2, 3, 4, 5);
            require(distinct(list(baker, cooper, fletcher, miller, smith)));
            require(!(baker === 5));
            require(!(cooper === 1));
            require(!(fletcher === 5));
            require(!(fletcher === 1));
            require((miller > cooper));
            require(!(math_abs(smith - fletcher) === 1));
            require(!(math_abs(fletcher - cooper) === 1));
            return list(list("baker", baker),
                        list("cooper", cooper),
                        list("fletcher", fletcher),
                        list("miller", miller),
                        list("smith", smith));
        }
        multiple_dwelling();`,
    [
      [
        ['baker', [3, null]],
        [
          ['cooper', [2, null]],
          [
            ['fletcher', [4, null]],
            [
              ['miller', [5, null]],
              [['smith', [1, null]], null]
            ]
          ]
        ]
      ]
    ]
  )
})
