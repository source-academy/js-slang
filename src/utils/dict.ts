/**
 * Python style dictionary
 */
export default class Dict<K, V> {
  constructor(private readonly internalMap = new Map<K, V>()) {}

  public get size() {
    return this.internalMap.size
  }

  public [Symbol.iterator]() {
    return this.internalMap[Symbol.iterator]()
  }

  public get(key: K) {
    return this.internalMap.get(key)
  }

  public set(key: K, value: V) {
    return this.internalMap.set(key, value)
  }

  public has(key: K) {
    return this.internalMap.has(key)
  }

  /**
   * Similar to how the python dictionary's setdefault function works:
   * If the key is not present, it is set to the given value, then that value is returned
   * Otherwise, `setdefault` returns the value stored in the dictionary without
   * modifying it
   */
  public setdefault(key: K, value: V) {
    if (!this.has(key)) {
      this.set(key, value)
    }

    return this.get(key)!
  }

  /**
   * Updates the value of the given key with the given function. If
   * the key does not exist in the dict, then `defaultVal` is used.
   */
  public update(key: K, defaultVal: V, updater: (oldV: V) => V) {
    const value = this.setdefault(key, defaultVal)
    const newValue = updater(value)
    this.set(key, newValue)
    return newValue
  }

  public entries() {
    return [...this.internalMap.entries()]
  }

  public forEach(func: (key: K, value: V) => void) {
    this.internalMap.forEach((v, k) => func(k, v))
  }

  /**
   * Similar to `mapAsync`, but for an async mapping function that does not return any value
   */
  public async forEachAsync(func: (k: K, v: V, index: number) => Promise<void>): Promise<void> {
    await Promise.all(this.map((key, value, i) => func(key, value, i)))
  }

  public map<T>(func: (key: K, value: V, index: number) => T) {
    return this.entries().map(([k, v], i) => func(k, v, i))
  }

  /**
   * Using a mapping function that returns a promise, transform a map
   * to another map with different keys and values. All calls to the mapping function
   * execute asynchronously
   */
  public mapAsync<U>(func: (key: K, value: V, index: number) => Promise<U>) {
    return Promise.all(this.map((key, value, i) => func(key, value, i)))
  }

  public flatMap<U>(func: (key: K, value: V, index: number) => U[]) {
    return this.entries().flatMap(([k, v], i) => func(k, v, i))
  }
}

/**
 * Convenience class for maps that store an array of values
 */
export class ArrayMap<K, V> extends Dict<K, V[]> {
  public add(key: K, item: V) {
    this.setdefault(key, []).push(item)
  }
}

/**
 * Create a Dict from an iterable of key value pairs
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
