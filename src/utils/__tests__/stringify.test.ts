import { describe, expect, test } from 'vitest'
import { stringify } from '../stringify'

describe(stringify, () => {
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

  test('toReplString takes precedence over toString for objects', () => {
    const obj = {
      toReplString: () => 'str1'
    }
    expect(stringify(obj)).toEqual('str1')
  })

  test('toReplString takes precedence for arrays', () => {
    const a = [1, 2, 3]
    ;(a as any).toReplString = () => 'str1'

    expect(stringify(a)).toEqual('str1')
  })
})
