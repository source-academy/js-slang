import { Value } from "../types"

// We need to define our own typeof in order for null/array to display properly in error messages
export const typeOf = (v: Value) => {
  if (v === null) {
    return 'null'
  } else if (Array.isArray(v)) {
    return 'array'
  } else {
    return typeof v
  }
}
