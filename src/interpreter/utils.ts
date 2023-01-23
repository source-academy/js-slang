import { AgendaItem} from './types'
import * as es from 'estree'

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

/**
 * Typeguard for esNode
 * @param command an AgendaItem
 * @returns true if the AgendaItem is an esNode and false otherwise.
 */
export const isNode = (command: AgendaItem): command is es.Node => {
  return (command as es.Node).type !== undefined
}
