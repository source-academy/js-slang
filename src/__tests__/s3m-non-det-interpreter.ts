import { createContext, IOptions, runInContext } from '../index'
import { SourceError, SuspendedNonDete } from '../types'
import {
  CallingNonFunctionValue,
  ConstAssignment,
  ExceptionError,
  InvalidNumberOfArguments,
  UnassignedVariable,
  UndefinedVariable
} from '../errors/errors'
import { TypeError } from '../utils/rttc'
const defaultOptions: Partial<IOptions> = { scheduler: 'nondet', executionMethod: 'interpreter' }
const defaultContext = () => {
  return createContext(3, 'nondet')
}

async function testNonDetPositive(
  code: string,
  expectedResult: any,
  outputFormatter?: (output: any) => string
) {
  const context = defaultContext()
  const res = await runInContext(code, context, defaultOptions)
  let resCasted = res as SuspendedNonDete
  if (!(expectedResult instanceof Array)) {
    let actual = resCasted.value
    if (outputFormatter) {
      actual = outputFormatter(actual)
    }
    expect(actual).toEqual(expectedResult)
  } else {
    for (const v of expectedResult) {
      let actual = resCasted.value
      if (outputFormatter) {
        actual = outputFormatter(actual)
      }
      expect(resCasted.value).toEqual(v)
      resCasted = (await resCasted.scheduler.run(
        resCasted.it,
        resCasted.context
      )) as SuspendedNonDete
    }
  }
}

async function testNonDetNegative<T extends SourceError>(code: string, expectedErrorType: T) {
  const context = defaultContext()
  const res = await runInContext(code, context, defaultOptions)
  expect(res.status).toEqual('error')
  const actualErrorClass = context.errors[0].constructor.name
  const expectedErrorClass = expectedErrorType.constructor.name
  expect(actualErrorClass).toEqual(expectedErrorClass)
}

test('simple function', async () => {
  await testNonDetPositive('function foo(){return 5;} foo();', 5)
})
test('amb emit', async () => {
  await testNonDetPositive('amb(1,2);', [1, 2])
})
test('amb require one result', async () => {
  await testNonDetPositive(
    'function require(predicate) {return predicate ? "require success" : amb();}' +
      'const a = amb(2,1,3,4);' +
      'require(a>3);' +
      'a;',
    4
  )
})
test('amb require multiple result', async () => {
  await testNonDetPositive(
    'function require(predicate) {return predicate ? "require success" : amb();}' +
      'const a = amb(2,1,3,4);' +
      'require(a>=2);' +
      'a;',
    [2, 3, 4]
  )
})
test('multiple dwelling', async () => {
  await testNonDetPositive(
    'function require(predicate) {return predicate ? "require success" : amb();}\n' +
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
    'baker,3,,cooper,2,,fletcher,4,,miller,5,,smith,1,,',
    (outputAry: any) => {
      return outputAry.toString()
    }
  )
})

test('error var not declared', async () => {
  await testNonDetNegative('const a=0; b;', UndefinedVariable.prototype)
})

test('error define non-exist var', async () => {
  await testNonDetNegative('const a=0; b; const b=1;', UnassignedVariable.prototype)
})

test('error assign to const ', async () => {
  await testNonDetNegative('const a=0;a=1;', ConstAssignment.prototype)
})

test('arrow function', async () => {
  await testNonDetPositive('const f = ()=>{return 1;};f();', 1)
})

test('assignment', async () => {
  await testNonDetPositive('let a=1;a=2;a;', 2)
})
test('block', async () => {
  await testNonDetPositive('{let a=1;a=2;a;}', 2)
})

test('error func apply', async () => {
  await testNonDetNegative(`function add(a,b){return a+b;} add(1,'str');`, TypeError.prototype)
})

test('error func apply native', async () => {
  await testNonDetNegative(`parse_int('e');`, ExceptionError.prototype)
})

test('error invalid num of args', async () => {
  await testNonDetNegative('function f(a,b){return a+b;} f(1);', InvalidNumberOfArguments.prototype)
})

test('error invalid if condition', async () => {
  await testNonDetNegative(`if('a'){ 1; }else{ 2; }`, TypeError.prototype)
})

test('error invalid unary', async () => {
  await testNonDetNegative(`!'a';`, TypeError.prototype)
})

test('error call non function value', async () => {
  testNonDetNegative('const a=0; a();', CallingNonFunctionValue.prototype)
})

test('yield undefined if function has no return statement', async () => {
  await testNonDetPositive('const a=()=>{const b=1;}; a();', undefined)
})

test('yield undefined no statement', async () => {
  await testNonDetPositive('', undefined)
})
