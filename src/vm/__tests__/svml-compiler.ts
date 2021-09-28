import { compile, createContext } from '../..'

test('handles if without else', () => {
  const context = createContext(3)
  const compiled = compile(`if (true) { 1 + 1; }`, context)
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
              4,
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
              70,
            ],
          ],
        ],
      ],
    ]
  `)
})
