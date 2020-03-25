// tslint:disable:max-classes-per-file
import * as es from 'estree'
/**
 * Defines types in Source 1.
 * @version 0.0.1
 * @packageDocumentation
 */

/**
 * The interface for types. All types are able to be compared and displayed.
 */
export interface Type {
  /**
   * Displays the type information in a human-readable form.
   */
  toString(): string
}

/**
 * The internal error type
 */
export class InternalError extends Error implements Type {
  toString() {
    return 'ERROR'
  }
}

export class Scope extends Map<string, Type> {
  private _stopGeneralisingAfter: es.FunctionDeclaration | null = null

  public shouldGeneralise() {
    return this._shouldGeneralise
  }

  public stopGeneralisation(functionDeclaration: es.FunctionDeclaration) {
    if (this._stopGeneralisingAfter === functionDeclaration) {
      this._shouldGeneralise = false
    }
  }

  constructor(public _shouldGeneralise = true) {
    super()
  }

  public stopGeneralisingAfter(functionDeclaration: es.FunctionDeclaration) {
    this._stopGeneralisingAfter = functionDeclaration
  }
}

/**
 * The environment of the program is a mapping between identifiers and their corresponding types.
 */
export type Environment = null | [Scope, Environment]

export class Float implements Type {
  toString() {
    return 'Float'
  }
}

export class Integer implements Type {
  toString() {
    return 'Integer'
  }
}

export class Bool implements Type {
  toString() {
    return 'Bool'
  }
}

export class String implements Type {
  toString() {
    return 'String'
  }
}

export class Undefined implements Type {
  toString() {
    return 'Undefined'
  }
}

/**
 * The type of a general n-ary function, which captures a n-tuple of types of its parameter, and its return type.
 */
export class Function implements Type {
  /**
   * @param argTypes The types of the arguments of this function.
   * @param retType  The return type of this function.
   */
  constructor(public argTypes: Type[], public retType: Type) {}
  toString() {
    const argStr = this.argTypes.map(t => t.toString()).join(', ')
    const separator = ' -> '
    return this.argTypes.length === 1
      ? `(${argStr}${separator}${this.retType.toString()})`
      : `((${argStr})${separator}${this.retType.toString()})`
  }

  fresh() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this)
  }
}

/**
 * Represents a type variable in a polymorphic type, or a type to be inferred.
 */
export class Var implements Type {
  /**
   * The instance of the type variable. `null` if uninitialised.
   */
  public instance: Type | null = null

  /**
   *  The symbolic typename of this type variable.
   */
  public name = genVar()

  toString() {
    return this.instance === null ? this.name : this.instance.toString()
  }

  /**
   * An unconstrained type variable can contain any type as its instance
   * @param candidate
   */
  canContain(candidate: Type): boolean {
    return true
  }

  /**
   * Returns a fresh copy of this type variable
   */
  fresh() {
    return new Var()
  }
}

/**
 * Represents a *constrained* type variable. Its instance can only contain the specified types
 */
export class Constrained extends Var {
  private _instance: Type | null = null

  public get instance(): Type | null {
    return this._instance
  }

  /**
   * Only set the instance if allowed
   * @param instance
   */
  public set instance(instance: Type | null) {
    if (instance !== null && this.canContain(instance)) {
      this._instance = instance
    }
  }

  /**
   *  The symbolic typename of this constrained type variable.
   */
  public name = this.description + genVar()

  /**
   *
   * @param description the description of this constrained type variable
   * @param possibleTypes the types that this type variable can contain
   */
  constructor(
    private description: string,
    public readonly possibleTypes: (new (...args: any[]) => Type)[]
  ) {
    super()
  }

  /**
   * Checks to see if candidate is of the correct type.
   * @param candidate
   */
  canContain(candidate: Type): boolean {
    return this.possibleTypes.some(possibleType => candidate instanceof possibleType)
  }

  /**
   * Returns a fresh copy of this constrained type variable.
   */
  fresh() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this)
  }
}

/**
 * The Integer type, uses `Number.isInteger` to check if integer.
 *
 * Implemented using a self-referential constrained type of either Float or Integer.
 *
 * If uninitialised, we know that it's an integer. *
 * If initialised, it was initialised to either another integer or a float, so we call the toString of the instance.
 */
export class Number extends Constrained {
  constructor() {
    super('number', [Float, Integer, Number])
  }

  toString(): string {
    if (this.instance === null) {
      return this.name
    } else {
      return this.instance.toString()
    }
  }
}

/**
 * The "Comparable" type, used for primitive operations that work on numbers/strings
 * such as + < > <= >=.
 */
export class Comparable extends Constrained {
  constructor() {
    super('comparable', [String, Float, Integer, Number, Comparable])
  }
}

/**
 * The polymorphic type
 */
export class Polymorphic implements Type {
  constructor(public name: string, public types: Type[]) {}

  toString() {
    return `${this.name}<${this.types.join(', ')}>`
  }

  fresh() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this)
  }
}

/**
 * The polymorphic List type
 */
export class List extends Polymorphic {
  constructor(v: Type) {
    super('List', [v])
  }
}

export class Pair extends Polymorphic {
  constructor(head: Type, tail: Type) {
    super('Pair', [head, tail])
  }
}

let i = 0

/**
 * An auxiliary generator for generating unique names for type variables.
 * // i replaced this for now, easier to use.
 * // can change back later on
 */
function genVar() {
  return 'T' + i++
}
