/**
 * Stack is implemented for agenda and stash registers.
 */
interface IStack<T> {
  push(item: T): void
  pop(): T | undefined
  peek(): T | undefined
  size(): number
}

export class Stack<T> implements IStack<T> {
  // Bottom of the array is at index 0
  protected storage: T[] = []

  constructor() {}

  push(item: T) {
    this.storage.push(item)
  }

  extend(items: T[]) {
    this.storage.push(...items)
  }

  pop() {
    return this.storage.pop()
  }

  peek() {
    if (this.size() === 0) {
      return undefined
    }
    return this.storage[this.size() - 1]
  }

  size() {
    return this.storage.length
  }
}
