// @ts-ignore
import { Context, createContext, IOptions, runInContext } from './index'

const options: Partial<IOptions> = { scheduler: 'nondet', executionMethod: 'interpreter' }
const res = runInContext(
  // "const a=1;a+1;",
  // 'const a=1; const b=2; const c=true; c?a:b;',
  // 'function add(a,b){return a()+b();} function aV(){return 1+bV();} function bV(){return 2;} if(1!==null){add(aV,bV);} else{ 999; }',
  // 'function add(a,b){return a+b;} function aV(){return 1;} function bV(){return 2;} add(aV(),bV());',

  'function require(predicate) {return predicate ? "require success" : amb();} const a=amb(2,1,3,4); require(a>2); a;',
  createContext(2),
  options
)
res.then(v => {
  console.log(v)
})

// function* gen() {
//   console.log("1")
//   yield "haha"
//   console.log("2")
// }
//
// function* gengen(){
//   yield* gen()
// }

// const generator = gengen()
// let n = generator.next()
// console.log(n.value)
// n = generator.next()
// console.log(n.value)

// function* ry(){
//   console.log("3")
//   return yield* gen()
//   console.log("4")
// }
//
// const ryGen = ry()
//
// let n = ryGen.next()
// console.log(n.value)
// n = ryGen.next()
// console.log(n.value)
