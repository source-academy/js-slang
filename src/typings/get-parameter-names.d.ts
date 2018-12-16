declare module 'get-parameter-names' {
  // tslint:disable-next-line:ban-types
  function getParameterNames(fn: Function): string[]
  export = getParameterNames
}
