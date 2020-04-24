import { createContext, IOptions, runInContext } from '../index'
import { SuspendedNonDete } from '../types'
const defaultOptions: Partial<IOptions> = { scheduler: 'nondet', executionMethod: 'interpreter' }
const defaultContext = createContext(2,'nondet')


async function testNonDet(code: string, expectedResult: any) {
  const res = await runInContext(code, defaultContext, defaultOptions);
  let resCasted = res as SuspendedNonDete
  if(!(expectedResult instanceof Array)){
    expect(expectedResult).toEqual(resCasted.value)
  }else{
    for (const v of expectedResult) {
      expect(v).toEqual(resCasted.value);
      resCasted = await resCasted.scheduler.run(resCasted.it, resCasted.context) as SuspendedNonDete
    }
  }
}
test('amb emit',async () => {
  testNonDet('amb(1,2);',[1,2])
})
