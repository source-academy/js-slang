import { describe, expect, test, vi } from 'vitest'
import { pyLanguages, scmLanguages, sourceLanguages, type Language } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { getChapterName, getVariantName } from '../../utils/misc'
import { testForValue } from '../../utils/testing'

vi.mock(import('../../modules/loader/loaders'))

type DescribeCase = [string, Language[], string]
const describeCases: DescribeCase[] = [
  ['javascript', sourceLanguages, 'import { foo } from "one_module"; foo();'],
  [
    'python',
    pyLanguages,
    stripIndent`
    from one_module import foo
    foo()
    `
  ],
  ['scheme', scmLanguages, '(import "one_module" (foo)) (foo)']
]

describe.each(describeCases)(
  'Ensuring that %s languages are able to load modules',
  (_, langs, code) => {
    const cases = langs.map(lang => {
      const chapterName = getChapterName(lang.chapter)
      const variantName = getVariantName(lang.variant)
      return [`Testing ${chapterName}, ${variantName}`, lang] as [string, Language]
    })

    test.for(cases)('%s', ([_, lang], { signal }) => {
      return expect(testForValue(code, { signal, ...lang })).resolves.toEqual('foo')
    })
  }
)
