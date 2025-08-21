import { expect } from 'vitest'
import { compile } from '../..'
import { Chapter } from '../../langs'
import { contextTest as test } from '../../utils/testing'

test.scoped({ chapter: Chapter.SOURCE_3 })

test('handles if without else', async ({ context }) => {
  const compiled = await compile(`if (true) { 1 + 1; }`, context)
  expect(compiled).toMatchInlineSnapshot(`
    Array [
      0,
      Array [
        Array [
          2,
          0,
          0,
          Array [
            Array [
              10,
            ],
            Array [
              61,
              5,
            ],
            Array [
              2,
              1,
            ],
            Array [
              2,
              1,
            ],
            Array [
              17,
            ],
            Array [
              62,
              2,
            ],
            Array [
              11,
            ],
            Array [
              70,
            ],
          ],
        ],
      ],
    ]
  `)
})
