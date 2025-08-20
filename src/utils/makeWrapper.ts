// tslint:disable-next-line:ban-types
export function makeWrapper(originalFunc: Function, wrappedFunc: Function) {
  for (const prop in originalFunc) {
    if (Object.hasOwnProperty.call(originalFunc, prop)) {
      Object.defineProperty(wrappedFunc, prop, Object.getOwnPropertyDescriptor(originalFunc, prop)!)
    }
  }
  for (const prop of ['length', 'name']) {
    if (Object.hasOwnProperty.call(originalFunc, prop)) {
      Object.defineProperty(wrappedFunc, prop, Object.getOwnPropertyDescriptor(originalFunc, prop)!)
    }
  }
}
