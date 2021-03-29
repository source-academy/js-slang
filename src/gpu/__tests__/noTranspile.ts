// import { generate } from 'astring'
// import { mockContext } from '../../mocks/context'
// import { parse } from '../../parser/parser'
// import { stripIndent } from '../../utils/formatters'
// import { transpileToGPU } from '../../gpu/gpu'

// test('empty for loop does not get transpiled', () => {
//   const code = stripIndent`
//     for (let i = 0; i < 10; i = i + 1) {}
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with different update does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     for (let i = 0; i < 5; i = i + 2) {
//         res[i] = i;
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with different loop variables does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     let j = 0;
//     for (let i = 0; j < 5; j = j + 1) {
//         res[i] = i;
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with const initialization does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     let j = 0;
//     for (const i = 0; i < 5; i = i + 1) {
//         res[i] = i;
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with non-zero initialization does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     for (let i = 1; i < 5; i = i + 1) {
//         res[i] = i;
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with a function end counter does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     let f = () => 5;
//     for (let i = 1; i < f(); i = i + 1) {
//         res[i] = i;
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with different initialization does not get transpiled', () => {
//   const code = stripIndent`
//       let res = [];
//       let i = 0;
//       for (i = 0; i < 5; i = i + 2) {
//           res[i] = i;
//       }
//       `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with assignment to array does not get transpiled', () => {
//   const code = stripIndent`
//       let res = [];
//       let i = [1, 2, 3];
//       for (i = 0; i < 5; i = i + 1) {
//           res[i] = i;
//       }
//       `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with global variable update does not get transpiled', () => {
//   const code = stripIndent`
//       let res = [];
//       let y = 5;
//       for (let i = 0; i < 5; i = i + 1) {
//           y = y + 1;
//           res[i] = i;
//       }
//       `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with function call does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         let y = () => 1;
//         for (let i = 0; i < 5; i = i + 1) {
//             y();
//             res[i] = i;
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('simple for loop with double update does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         for (let i = 0; i < 5; i = i + 1) {
//             res[i] = i;
//             res[i] = i + 1;
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('2 for loops with wrong indice order does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         for (let i = 0; i < 5; i = i + 1) {
//             for (let j = 0; j < 5; j = j + 1) {
//                 res[j][i] = i + 1;
//             }
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('2 for loops with wrong indices order does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         for (let i = 0; i < 5; i = i + 1) {
//             for (let j = 0; j < 5; j = j + 1) {
//                 res[j] = i + 1;
//             }
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('2 for loop case with 2 indices being written + use of result variable[i-1][j] does not get transpiled', () => {
//   const code = stripIndent`
//     let res = [];
//     for (let i = 0; i < 5; i = i + 1) {
//       res[i] = [];
//       for (let j = 0; j < 5; j = j + 1) {
//         res[i][j] = j;
//       }
//     }

//     for (let i = 0; i < 5; i = i + 1) {
//         for (let j = 0; j < 5; j = j + 1) {
//             let x = res[i-1][j];
//             let y = math_abs(x * -5);
//             res[i][j] = x + y;
//         }
//     }
//     `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)
//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('3 for loops with wrong indice order does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         for (let i = 0; i < 5; i = i + 1) {
//             for (let j = 0; j < 5; j = j + 1) {
//                 for (let k = 0; k < 5; k = k + 1) {
//                     res[k][j][i] = i + 1;
//                 }
//             }
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })

// test('3 for loops with wrong indice order does not get transpiled', () => {
//   const code = stripIndent`
//         let res = [];
//         for (let i = 0; i < 5; i = i + 1) {
//             for (let j = 0; j < 5; j = j + 1) {
//                 for (let k = 0; k < 5; k = k + 1) {
//                     res[j][k] = i + 1;
//                 }
//             }
//         }
//         `
//   const context = mockContext(4, 'gpu')
//   const program = parse(code, context)!
//   transpileToGPU(program)
//   const transpiled = generate(program)

//   const cnt = transpiled.match(/__createKernelSource/g)
//   expect(cnt).toEqual(null)
// })
