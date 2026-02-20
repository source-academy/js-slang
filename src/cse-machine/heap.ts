import type { HeapObject } from './types'

/**
 * The heap stores all objects in each environment.
 */
export default class Heap {
  private storage: Set<HeapObject> | null = null

  add(...items: HeapObject[]): void {
    this.storage ??= new Set<HeapObject>()
    for (const item of items) {
      this.storage.add(item)
    }
  }

  /** Checks the existence of `item` in the heap. */
  contains(item: any): boolean {
    return this.storage?.has(item) ?? false
  }

  /** Gets the number of items in the heap. */
  size(): number {
    return this.storage?.size ?? 0
  }

  /**
   * Removes `item` from current heap and adds it to `otherHeap`.
   * If the current heap does not contain `item`, nothing happens.
   * @returns whether the item transfer is successful
   */
  move(item: HeapObject, otherHeap: Heap): boolean {
    if (!this.contains(item)) return false
    this.storage!.delete(item)
    otherHeap.add(item)
    return true
  }

  /** Returns a copy of the heap's contents. */
  getHeap(): Set<HeapObject> {
    return new Set(this.storage)
  }
}
