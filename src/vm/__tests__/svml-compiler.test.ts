import { expect, test } from 'vitest'
import { compile, createContext } from '../..'
import { Chapter } from '../../types'

test('handles if without else', async () => {
  const context = createContext(Chapter.SOURCE_3)
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
