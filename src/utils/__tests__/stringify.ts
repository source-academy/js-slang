import { stringify } from '../stringify'

describe('stringify', () => {
  test('works with arrays with holes', () => {
    {
      const a = []
      a[1] = []
      expect(stringify(a)).toMatchInlineSnapshot(`"[undefined, []]"`)
    }

    {
      const a = []
      a[2] = []
      expect(stringify(a)).toMatchInlineSnapshot(`"[undefined, undefined, []]"`)
    }

    {
      const a = []
      a[3] = []
      expect(stringify(a)).toMatchInlineSnapshot(`"[undefined, undefined, undefined, []]"`)
    }
  })
})
