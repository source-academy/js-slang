import { describe, expect, test } from 'vitest'
import { parseError } from '../../index'
import { Chapter, type LanguageOptions, Variant } from '../../langs'
import { SourceTypedParser } from '../../parser/source/typed'
import { mockContext } from '../../utils/testing/mocks'

const parser = new SourceTypedParser(Chapter.SOURCE_4, Variant.TYPED)

describe('Any checker tests', () => {
  test('disallow any type in a variable declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInVariables'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const x = 4;', localContext)
    expect(parseError(localContext.errors)).toEqual(
      'Line 1: Usage of "any" in variable declaration is not allowed.'
    )
  })

  test('allow any type in a variable declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInVariables'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('let x: any = 4;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in a variable declaration, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInVariables'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('let x: number = 4;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in function parameter', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function f(x: any) { return x; }', localContext)
    expect(parseError(localContext.errors)).toEqual(
      'Line 1: Usage of "any" in function parameter is not allowed.'
    )
  })

  test('allow any type in function parameter', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function f(x: any) { return x; }', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in function parameter, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function f(x: number) { return x; }', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in function return type', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInReturnType'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function g(): any { return 4; }', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in function return type', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInReturnType'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function g(): any { return 4; }', localContext)
    expect(parseError(localContext.errors)).toEqual(
      'Line 1: Usage of "any" in function return type is not allowed.'
    )
  })

  test('allow any type in function return type, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInReturnType'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('function g(): number { return 4; }', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in lambda parameter', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const h = (x: any) => x + 1;', localContext)
    expect(parseError(localContext.errors)).toEqual(
      'Line 1: Usage of "any" in arrow function parameter is not allowed.'
    )
  })

  test('allow any type in lambda parameter', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const h = (x: any) => x + 1;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in lambda parameter, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const h = (x: number) => x + 1;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in nested lambda', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const f = (x: number) => (y: any) => x + y;', localContext)
    expect(parseError(localContext.errors)).toEqual(
      'Line 1: Usage of "any" in arrow function parameter is not allowed.'
    )
  })

  test('allow any type in nested lambda', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const f = (x: number) => (y: any) => x + y;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in nested lambda, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse('const f = (x: number) => (y: number) => x + y;', localContext)
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in nested function', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) {
        function g(y: any) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in nested function', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) {
        function g(y: any) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual(
      'Line 3: Usage of "any" in function parameter is not allowed.'
    )
  })

  test('allow any type in nested function, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: number) => number {
        function g(y: number) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in type annotation parameters', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationParameters'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: any) => number {
        function g(y: number) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in type annotation parameters', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: any) => number {
        function g(y: number) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual(
      'Line 2: Usage of "any" in type annotation\'s function parameter is not allowed.'
    )
  })

  test('disallow any type in type annotation parameters, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationParameters'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: number) => number {
        function g(y: number) {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('allow any type in type annotation return type', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationReturnType'] = 'true'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) {
        function g(y: number) : any {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })

  test('disallow any type in type annotation return type', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationReturnType'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: number) => any {
        function g(y: number) : number {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual(
      'Line 2: Usage of "any" in type annotation\'s function return type is not allowed.'
    )
  })

  test('disallow any type in type annotation return type, correct declaration', () => {
    const languageOptions: LanguageOptions = {}
    languageOptions['typedAllowAnyInTypeAnnotationReturnType'] = 'false'
    const localContext = mockContext(Chapter.SOURCE_4, Variant.TYPED, languageOptions)
    parser.parse(
      `
      function f(x: number) : (y: number) => number {
        function g(y: number) : number {
          return x + y;
        }
        return g;
      }
    `,
      localContext
    )
    expect(parseError(localContext.errors)).toEqual('')
  })
})
