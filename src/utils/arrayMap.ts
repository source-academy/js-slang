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
}
