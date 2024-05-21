import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectFinishedResult } from '../../utils/testing/testers'
import { runCodeInSource } from '../sourceRunner'

jest.mock('../../modules/loader/loaders')

type DescribeCase = [string, Chapter[], string]
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
    'import { foo } from "one_module"; foo();'
  ],
  [
    'python',
    [Chapter.PYTHON_1],
    stripIndent`
    from one_module import foo
    foo()
    `
  ],
  [
    'scheme',
    [Chapter.SCHEME_1, Chapter.SCHEME_2, Chapter.SCHEME_3, Chapter.SCHEME_4, Chapter.FULL_SCHEME],
    '(import "one_module" (foo)) (foo)'
  ]
]

describe.each(describeCases)(
  'Ensuring that %s chapters are able to load modules',
  (_, chapters, code) => {
    const chapterCases = chapters.map(chapterVal => {
      const [chapterName] = Object.entries(Chapter).find(([, value]) => value === chapterVal)!
      return [`Testing ${chapterName}`, chapterVal] as [string, Chapter]
    })

    test.each(chapterCases)('%s', async (_, chapter) => {
      const context = mockContext(chapter)
      const { result } = await runCodeInSource(code, context)

      expectFinishedResult(result)
      expect(result.value).toEqual('foo')
    })
  }
)
