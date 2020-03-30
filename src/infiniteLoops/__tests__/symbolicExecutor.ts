import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import * as es from 'estree'
import { symbolicExecute } from '../symbolicExecutor'

test('sym tree for fib function', () => {
  const code = `
        function fib(x) {
            if (x===0 || x===1) {
                return 1;
            } else {
                return fib(x-1) + fib(x-2);
            }
        }
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('sym tree with conditional expr', () => {
  const code = `
        function f(x){return x===1?1:f(x-1);}
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('test variable declaration and global consts', () => {
  const code = `
        function f(x) {let j=0;if(x===b){return 1;}else{return x*f(j);}}
    `
  const context = mockContext(4)
  const environment = context.runtime.environments[0]
  const name = 'b'
  const value = 9
  Object.defineProperty(environment.head, name, {
    value,
    writable: true,
    enumerable: true
  })
  const program = parse(code, context)!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    context.runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('test function with no return or other calls', () => {
  const code = `
        function h(x){2;}
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('test function with skip symbols', () => {
  const code = `
        function h(x){
            if(g(x)+2) {
                return 2*3;
            } else {
                2+4*5;
            }
        }
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('testing inequalities', () => {
  const code = `
        function h(x){
            x<1;1<x;
            x<=1;1<=x;
            x>1;1>x;
            x>=1;1>=x;
            x!==1 && 1!==x;
            x===1 || 1===x;
            !(x<2);
        }
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('testing arithmetic', () => {
  const code = `
        function h(x){
            -x; (-1);
            1+x;x+1;
            1-x;x-1;
            const y=-x;
            (-y)+1;
            f(x) + 1;1 + f(x);
        }
    `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})

test('nested conditional return', () => {
  const code = `
          function h(x){
              return x===0 ?
                        x>5 ? 1 : x<2? g(2) : 3 : f(4);
          }
      `
  const program = parse(code, mockContext())!
  const symTree = symbolicExecute(
    program.body[0] as es.FunctionDeclaration,
    mockContext().runtime.environments[0]
  )
  expect(symTree).toMatchSnapshot()
})
