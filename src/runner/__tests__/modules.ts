import { Variant } from '../../langs'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { getChapterName } from '../../utils/misc'
import { expectFinishedResult } from '../../utils/testing'

jest.mock('../../modules/loader/loaders')

type DescribeCase = [string, Chapter[], Variant[], string]
const describeCases: DescribeCase[] = [
  [
    'javascript',
    [
      Chapter.SOURCE_1,
      Chapter.SOURCE_2,
      Chapter.SOURCE_3,
      Chapter.SOURCE_4,
      Chapter.FULL_JS,
      Chapter.FULL_TS,
      Chapter.LIBRARY_PARSER
    ],
    [
      Variant.DEFAULT,
      Variant.DEFAULT,
      Variant.DEFAULT,
      Variant.DEFAULT,
      Variant.DEFAULT,
      Variant.DEFAULT,
      Variant.DEFAULT
    ],
    'import { foo } from "one_module"; foo();'
  ],
  [
    'python',
    [Chapter.PYTHON_1],
    [Variant.DEFAULT],
    stripIndent`
    from one_module import foo
    foo()
    `
  ],
  [
    'scheme',
    [Chapter.SCHEME_1, Chapter.SCHEME_2, Chapter.SCHEME_3, Chapter.SCHEME_4, Chapter.FULL_SCHEME],
    [
      Variant.EXPLICIT_CONTROL,
      Variant.EXPLICIT_CONTROL,
      Variant.EXPLICIT_CONTROL,
      Variant.EXPLICIT_CONTROL,
      Variant.EXPLICIT_CONTROL
    ],
    '(import "one_module" (foo)) (foo)'
  ]
]

describe.each(describeCases)(
  'Ensuring that %s chapters are able to load modules',
  (_, chapters, variants, code) => {
    const chapterCases = chapters.map((chapterVal, index) => {
      const chapterName = getChapterName(chapterVal)
      const variant = variants[index]
      return [`Testing ${chapterName}`, chapterVal, variant] as [string, Chapter, Variant]
    })

    test.each(chapterCases)('%s', async (_, chapter, variant) => {
      return expectFinishedResult(code, { chapter, variant }).toEqual('foo')
    })
  }
)
