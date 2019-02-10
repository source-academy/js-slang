/* tslint:disable */
export const sandboxedEval = (code: string) => {
  const evalInGlobalScope = eval
  return evalInGlobalScope(code)
}
