import { expectResult } from '../utils/testing'

test('Unused arguments are not evaluated', () => {
  return expectResult('function test(a, b) { return a === 1 ? a : b; } test(1, head(null));', {
    evaluationMethod: 'lazy',
    chapter: 2,
    native: true
  }).toBe(1)
})

test('Unary operations force argument', () => {
  return expectResult('function neg(b) { return !b; } neg(((x) => x)(false)); ', {
    evaluationMethod: 'lazy',
    native: true
  }).toBe(true)
})

test('Binary operations force arguments', () => {
  return expectResult(
    'function add(x, y) { return x + y; } add(((x) => x)(5), ((x) => x + 1)(9)); ',
    { evaluationMethod: 'lazy', native: true }
  ).toBe(15)
})

test('Conditionals force test', () => {
  return expectResult(
    `
function f(a, b) {
  return (a ? true : head(null)) && (!b ? true : head(null));
}

f(((b) => b)(true), ((b) => !b)(true));
`,
    { evaluationMethod: 'lazy', chapter: 2, native: true }
  ).toBe(true)
})

test('Thunks are memoized', () => {
  return expectResult(
    `
let x = 1;

function incX() {
  x = x + 1;
  return x;
}

function square(n) {
  return n * n;
}

square(incX());`,
    { evaluationMethod: 'lazy', chapter: 3, native: true }
  ).toBe(4)
})

test('Thunks capture local environment', () => {
  return expectResult(
    `
function addSome(x) {
  const y = x + 1;
  return z => y + z;
}

const addSome2 = addSome(2);

addSome2(3);
`,
    {evaluationMethod: 'lazy', native: true}
  ).toBe(6);
})
