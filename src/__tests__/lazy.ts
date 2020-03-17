import {
  expectResult,
} from '../utils/testing'

test('Unused arguments are not evaluated', () => {

  return expectResult('function test(a, b) { return a === 1 ? a : b; } test(1, head(null));',
    {executionMethod: 'interpreter_lazy', chapter: 2}).toBe(1);

});

test('Unary operations force argument', () => {

  return expectResult('function neg(b) { return !b; } neg(((x) => x)(false)); ',
    {executionMethod: 'interpreter_lazy'}).toBe(true);

});

test('Binary operations force arguments', () => {

  return expectResult('function add(x, y) { return x + y; } add(((x) => x)(5), ((x) => x + 1)(9)); ',
    {executionMethod: 'interpreter_lazy'}).toBe(15);

});

test('Conditionals force test', () => {

  return expectResult(`
function f(a, b) {
  return (a ? true : head(null)) && (!b ? true : head(null));
}

f(((b) => b)(true), ((b) => !b)(true));
`,    {executionMethod: 'interpreter_lazy', chapter: 2}).toBe(true);

});

test('Thunks are memoized', () => {

  return expectResult(`
let x = 1;

function incX() {
  x = x + 1;
  return x;
}

function square(n) {
  return n * n;
}

square(incX());`, {executionMethod: 'interpreter_lazy', chapter: 3}).toBe(4);

});