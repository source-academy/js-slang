import type { Transformer } from './patterns';

/**
 * The T component is a dictionary of mappings from syntax names to
 * their corresponding syntax rule transformers (patterns).
 *
 * Similar to the E component, there is a matching
 * "T" environment tree that is used to store the transformers.
 * as such, we need to track the transformers and update them with the environment.
 */

export class Transformers {
  private parent: Transformers | null;
  private items: Map<string, Transformer[]>;
  public constructor(parent?: Transformers) {
    this.parent = parent || null;
    this.items = new Map<string, Transformer[]>();
  }

  // only call this if you are sure that the pattern exists.
  public getPattern(name: string): Transformer[] {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return this.items.get(name) as Transformer[];
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.getPattern(name);
    }
    // should not get here. use this properly.
    throw new Error(`Pattern ${name} not found in transformers`);
  }

  public hasPattern(name: string): boolean {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return true;
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.hasPattern(name);
    }
    return false;
  }

  public addPattern(name: string, item: Transformer[]): void {
    this.items.set(name, item);
  }
}
