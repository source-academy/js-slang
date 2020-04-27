declare global {
  interface ArrayBufferConstructor {
    transfer(source: ArrayBuffer, length: number): ArrayBuffer
  }
}

if (!ArrayBuffer.transfer) {
  ArrayBuffer.transfer = (source, length) => {
    if (!(source instanceof ArrayBuffer))
      throw new TypeError('Source must be an instance of ArrayBuffer')
    if (length <= source.byteLength) return source.slice(0, length)
    const sourceView = new Uint8Array(source)
    const destView = new Uint8Array(new ArrayBuffer(length))
    destView.set(sourceView)
    return destView.buffer
  }
}

/**
 * A little-endian byte buffer class.
 */
export default class Buffer {
  private _capacity: number
  public cursor: number
  private _written: number
  private _buffer: ArrayBuffer
  private _view: DataView

  constructor() {
    this._capacity = 32
    this.cursor = 0
    this._written = 0
    this._buffer = new ArrayBuffer(this._capacity)
    this._view = new DataView(this._buffer)
  }

  private maybeExpand(n: number) {
    if (this.cursor + n < this._capacity) {
      return
    }

    while (this.cursor + n >= this._capacity) {
      this._capacity *= 2
    }
    this._buffer = ArrayBuffer.transfer(this._buffer, this._capacity)
    this._view = new DataView(this._buffer)
  }

  private updateWritten() {
    this._written = Math.max(this._written, this.cursor)
  }

  get(signed: boolean, s: 8 | 16 | 32): number {
    const r = this._view[`get${signed ? 'I' : 'Ui'}nt${s}`](this.cursor, true)
    this.cursor += s / 8
    return r
  }

  getI(s: 8 | 16 | 32): number {
    return this.get(true, s)
  }

  getU(s: 8 | 16 | 32): number {
    return this.get(false, s)
  }

  getF(s: 32 | 64): number {
    const r = this._view[`getFloat${s}`](this.cursor, true)
    this.cursor += s / 8
    return r
  }

  put(n: number, signed: boolean, s: 8 | 16 | 32) {
    this.maybeExpand(s / 8)
    this._view[`set${signed ? 'I' : 'Ui'}nt${s}`](this.cursor, n, true)
    this.cursor += s / 8
    this.updateWritten()
  }

  putI(s: 8 | 16 | 32, n: number) {
    this.put(n, true, s)
  }

  putU(s: 8 | 16 | 32, n: number) {
    this.put(n, false, s)
  }

  putF(s: 32 | 64, n: number) {
    this.maybeExpand(s / 8)
    this._view[`setFloat${s}`](this.cursor, n, true)
    this.cursor += s / 8
    this.updateWritten()
  }

  putA(a: Uint8Array) {
    this.maybeExpand(a.byteLength)
    new Uint8Array(this._buffer, this.cursor, a.byteLength).set(a)
    this.cursor += a.byteLength
    this.updateWritten()
  }

  align(n: number) {
    const rem = this.cursor % n
    if (rem === 0) {
      return
    }
    this.cursor += n - rem
  }

  asArray(): Uint8Array {
    return new Uint8Array(this._buffer.slice(0, this._written))
  }

  get written(): number {
    return this._written
  }
}
