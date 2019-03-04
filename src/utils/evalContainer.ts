/* tslint:disable */
export const sandboxedEval = (code: string) => {
  const evalInGlobalScope = eval
  console.log(code)
  return evalInGlobalScope(code)
}
