/**
 * Convenience class for maps that store an array of values
 */
export default class ArrayMap<K, V> {
  constructor(private readonly map: Map<K, V[]> = new Map()) {}

  public get(key: K) {
    return this.map.get(key)
  }

  public add(key: K, item: V) {
    if (!this.map.has(key)) {
      this.map.set(key, [])
    }
    this.map.get(key)!.push(item)
  }

  public entries() {
    return Array.from(this.map.entries())
  }

  public keys() {
    return new Set(this.map.keys())
  }

  /**
   * Similar to `mapAsync`, but for an async mapping function that does not return any value
   */
  public async forEachAsync<F extends (k: K, v: V[]) => Promise<void>>(forEach: F): Promise<void> {
    await Promise.all(this.entries().map(([key, value]) => forEach(key, value)))
  }

  /**
   * Using a mapping function that returns a promise, transform an array map
   * to another array map with different keys and values. All calls to the mapping function
   * execute asynchronously
   */
  public async mapAsync<F extends (k: K, v: V[]) => Promise<[any, any[]]>>(mapper: F) {
    const pairs = await Promise.all(this.entries().map(([key, value]) => mapper(key, value)))

    type U = Awaited<ReturnType<F>>
    const tempMap = new Map<U[0], U[1]>(pairs)
    return new ArrayMap<U[0], U[1][number]>(tempMap)
  }

  public [Symbol.toStringTag]() {
    return this.entries().map(([key, value]) => `${key}: ${value}`)
  }
}

/**
 * Create an ArrayMap from an iterable of key value pairs
 */
export function arrayMapFrom<K, V extends Array<any>>(
  pairs: Iterable<[K, V]>
): ArrayMap<K, V[number]>
export function arrayMapFrom<K, V>(pairs: Iterable<[K, V]>): ArrayMap<K, V>
export function arrayMapFrom<K, V>(pairs: Iterable<[K, V | V[]]>) {
  const res = new ArrayMap<K, V>()
  for (const [k, v] of pairs) {
    if (Array.isArray(v)) {
      for (const each of v) {
        res.add(k, each)
      }
    } else {
      res.add(k, v)
    }
  }

  return res
}
