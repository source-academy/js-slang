import { HeapObject } from './types'

/**
 * The heap stores all objects in each environment.
 */
export default class Heap {
  private storage: Set<HeapObject> | null = null

  public constructor() {}

  add(...items: HeapObject[]): void {
    if (!this.storage) {
      this.storage = new Set<HeapObject>(items)
    } else {
      for (const item of items) {
        this.storage.add(item)
      }
    }
  }

  contains(item: HeapObject): boolean {
    return this.storage?.has(item) ?? false
  }

  size(): number {
    return this.storage?.size ?? 0
  }

  getHeap(): Set<HeapObject> {
    // return a copy of the heap's contents
    return new Set(this.storage)
  }
}
