// tslint:disable-next-line:ban-types
export function makeWrapper(originalFunc: Function, wrappedFunc: Function) {
  for (const prop in originalFunc) {
    if (originalFunc.hasOwnProperty(prop)) {
      Object.defineProperty(wrappedFunc, prop, Object.getOwnPropertyDescriptor(originalFunc, prop)!)
    }
  }
  for (const prop of ['length', 'name']) {
    if (originalFunc.hasOwnProperty(prop)) {
      Object.defineProperty(wrappedFunc, prop, Object.getOwnPropertyDescriptor(originalFunc, prop)!)
    }
  }
}
