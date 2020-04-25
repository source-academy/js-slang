import { createContext, IOptions, runInContext } from '../index'
import { SourceError, SuspendedNonDete, Type } from '../types'
import { UndefinedVariable } from '../errors/errors'
import { Class } from 'estree'
const defaultOptions: Partial<IOptions> = { scheduler: 'nondet', executionMethod: 'interpreter' }
const defaultContext = ()=>{return createContext(2, 'nondet');}

async function testNonDet(code: string, expectedResult: any, outputFormatter?:(output:any)=>string) {
  const context = defaultContext();
  const res = await runInContext(code, context, defaultOptions)
  let resCasted = res as SuspendedNonDete
  if (!(expectedResult instanceof Array)) {
    let actual = resCasted.value;
    if(outputFormatter){
      actual = outputFormatter(actual);
    }
    expect(actual).toEqual(expectedResult)
  } else {
    for (const v of expectedResult) {
      let actual = resCasted.value;
      if(outputFormatter){
        actual = outputFormatter(actual);
      }
      expect(resCasted.value).toEqual(v)
      resCasted = (await resCasted.scheduler.run(
        resCasted.it,
        resCasted.context
      )) as SuspendedNonDete
    }
  }
}

async function testNonDatNegative<T extends SourceError>(code:string, expectedErrorType:T){
  const context = defaultContext();
  const res = await runInContext(code, context, defaultOptions)
  expect(res.status).toEqual('error')
  expect(context.errors[0].constructor.name === expectedErrorType.constructor.name).toEqual(true)
}

test('simple function',async ()=>{
  await testNonDet('function foo(){return 5;} foo();',5)
})
test('amb emit', async () => {
  await testNonDet('amb(1,2);', [1, 2])
})
test('amb require one result',async()=>{
  await testNonDet('function require(predicate) {return predicate ? "require success" : amb();}' +
    'const a = amb(2,1,3,4);' +
    'require(a>3);' +
    'a;',4);
})
test('amb require multiple result',async()=>{
  await testNonDet('function require(predicate) {return predicate ? "require success" : amb();}' +
    'const a = amb(2,1,3,4);' +
    'require(a>=2);' +
    'a;',[2,3,4]);

})
test('multiple dwelling',async()=>{
  await testNonDet('function require(predicate) {return predicate ? "require success" : amb();}\n' +
    'function distinct(xs) {\n' +
    '    return is_null(xs) || is_null(tail(xs))\n' +
    '        ? true\n' +
    '        : is_null(member(head(xs), tail(xs))) && \n' +
    '          distinct(tail(xs));\n' +
    '}\n' +
    '\n' +
    'function multiple_dwelling() {\n' +
    '    const baker = amb(1, 2, 3, 4, 5);\n' +
    '    const cooper = amb(1, 2, 3, 4, 5);\n' +
    '    const fletcher = amb(1, 2, 3, 4, 5);\n' +
    '    const miller = amb(1, 2, 3, 4, 5);\n' +
    '    const smith = amb(1, 2, 3, 4, 5);\n' +
    '    require(distinct(list(baker, cooper, fletcher, miller, smith)));\n' +
    '    require(! (baker === 5));\n' +
    '    require(! (cooper === 1));\n' +
    '    require(! (fletcher === 5));\n' +
    '    require(! (fletcher === 1));\n' +
    '    require(miller > cooper);\n' +
    '    require(! (math_abs(smith - fletcher) === 1));\n' +
    '    require(! (math_abs(fletcher - cooper) === 1));\n' +
    '    return list(list("baker", baker),\n' +
    '                list("cooper", cooper),\n' +
    '                list("fletcher", fletcher),\n' +
    '                list("miller", miller),\n' +
    '                list("smith", smith));\n' +
    '}\n' +
    'multiple_dwelling();',
    'baker,3,,cooper,2,,fletcher,4,,miller,5,,smith,1,,',(outputAry:any)=>{
      return outputAry.toString();
    })
})

test('error var not declared',async ()=>{
  testNonDatNegative('const a=0; b;',UndefinedVariable.prototype);
})
