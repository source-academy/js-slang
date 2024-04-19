export class HeapVal {
  val: string | number | boolean
  type: ValType

  constructor(val: string | number | boolean, type: ValType) {
    this.val = val
    this.type = type
  }
}

export enum ValType {
  Int32,
  String,
  Char,
  Boolean,
  Pointer,
  Undefined,
  Unassigned,
  Null
}

export const ValTypeToString = Object.keys(ValType)
