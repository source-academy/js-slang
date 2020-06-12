import Buffer from '../buffer'

let buffer: Buffer

describe('reading', () => {
  beforeEach(() => {
    buffer = new Buffer()
    buffer.putA(new Uint8Array([0xf1, 0xf2, 3, 0xf4, 5, 6, 7, 8]))
    buffer.cursor = 0
  })

  test('array', () => {
    expect(buffer.asArray()).toEqual(new Uint8Array([0xf1, 0xf2, 3, 0xf4, 5, 6, 7, 8]))
  })

  test('u8', () => {
    expect(buffer.getU(8)).toEqual(0xf1)
    expect(buffer.cursor).toEqual(1)
  })
  test('u16', () => {
    expect(buffer.getU(16)).toEqual(0xf2f1)
    expect(buffer.cursor).toEqual(2)
  })
  test('u32', () => {
    expect(buffer.getU(32)).toEqual(0xf403f2f1)
    expect(buffer.cursor).toEqual(4)
  })

  test('i8', () => {
    expect(buffer.getI(8)).toEqual(-15)
    expect(buffer.cursor).toEqual(1)
  })
  test('i16', () => {
    expect(buffer.getI(16)).toEqual(-3343)
    expect(buffer.cursor).toEqual(2)
  })
  test('i32', () => {
    expect(buffer.getI(32)).toEqual(-201067791)
    expect(buffer.cursor).toEqual(4)
  })

  test('f32', () => {
    expect(buffer.getF(32)).toEqual(-41816304051471683428067034791936)
    expect(buffer.cursor).toEqual(4)
  })
  test('f64', () => {
    expect(buffer.getF(64)).toEqual(5.4476071068029086e-270)
    expect(buffer.cursor).toEqual(8)
  })
})

describe('writing', () => {
  beforeEach(() => {
    buffer = new Buffer()
  })

  test('array', () => {
    buffer.putA(new Uint8Array([5, 1, 5, 1, 117, 1, 117, 1]))
    expect(buffer.asArray()).toEqual(new Uint8Array([5, 1, 5, 1, 117, 1, 117, 1]))
    expect(buffer.cursor).toEqual(8)
  })

  test('u8', () => {
    buffer.putU(8, 0xf1)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xf1]))
    expect(buffer.cursor).toEqual(1)
  })
  test('u16', () => {
    buffer.putU(16, 0xf2f1)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xf1, 0xf2]))
    expect(buffer.cursor).toEqual(2)
  })
  test('u32', () => {
    buffer.putU(32, 0x5005acad)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xad, 0xac, 5, 0x50]))
    expect(buffer.cursor).toEqual(4)
  })

  test('i8', () => {
    buffer.putI(8, -123)
    expect(buffer.asArray()).toEqual(new Uint8Array([0x85]))
    expect(buffer.cursor).toEqual(1)
  })
  test('i16', () => {
    buffer.putI(16, -12345)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xc7, 0xcf]))
    expect(buffer.cursor).toEqual(2)
  })
  test('i32', () => {
    buffer.putI(32, -12345678)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xb2, 0x9e, 0x43, 0xff]))
    expect(buffer.cursor).toEqual(4)
  })

  test('f32', () => {
    buffer.putF(32, -117.117)
    expect(buffer.asArray()).toEqual(new Uint8Array([0xe7, 0x3b, 0xea, 0xc2]))
    expect(buffer.cursor).toEqual(4)
  })
  test('f64', () => {
    buffer.putF(64, -117.117)
    expect(buffer.asArray()).toEqual(
      new Uint8Array([0x73, 0x68, 0x91, 0xed, 0x7c, 0x47, 0x5d, 0xc0])
    )
    expect(buffer.cursor).toEqual(8)
  })

  test('align', () => {
    buffer.align(4)
    expect(buffer.cursor).toEqual(0)

    buffer.putU(8, 0)
    buffer.align(4)
    expect(buffer.cursor).toEqual(4)
  })

  test('large array', () => {
    buffer.putA(
      new Uint8Array(
        (function* () {
          for (let i = 0; i < 256; i++) {
            yield i
          }
        })()
      )
    )

    expect(buffer.cursor).toEqual(256)
    const out = buffer.asArray()
    for (let i = 0; i < 256; i++) {
      expect(out[i]).toEqual(i)
    }
    expect(out.byteLength).toEqual(256)
  })

  test('written', () => {
    buffer.putU(32, 123)
    buffer.cursor = 0
    expect(buffer.written).toEqual(4)
  })
})
