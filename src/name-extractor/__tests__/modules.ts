import { DeclarationKind, type NameDeclaration } from '..'
import { getNames } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'

import { memoizedGetModuleDocsAsync, memoizedGetModuleManifestAsync } from '../../modules/loader'
import { asMockedFunc } from '../../utils/testing'
import { ModuleConnectionError } from '../../modules/errors'

jest.mock('../../modules/loader')

type NameDeclarationWithHTML = NameDeclaration & { docHTML: string }

type TestCase = [
  description: string,
  actualCode: string,
  expectedNames: NameDeclarationWithHTML[],
  manifestCount: number,
  docsCount: number
]

beforeEach(() => {
  jest.clearAllMocks()
})

async function runGetNames(code: string, expectedNames: NameDeclarationWithHTML[]) {
  const context = mockContext(Chapter.LIBRARY_PARSER)
  const [extractedNames] = await getNames(code, 2, 0, context)
  for (const name of expectedNames) {
    expect(extractedNames).toContainEqual(name)
  }
}

describe('test name extractor functionality on imports', () => {
  const testCases: TestCase[] = [
    [
      'Single import from known local module',
      "import { a } from './a.js';",
      [
        {
          name: 'a',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Import 'a' from './a.js'"
        }
      ],
      0,
      0
    ],
    [
      'Multiple imports from known local module',
      "import { a, b } from './a.js';",
      [
        {
          name: 'a',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Import 'a' from './a.js'"
        },
        {
          name: 'b',
          meta: DeclarationKind.KIND_IMPORT,
          score: 1,
          docHTML: "Import 'b' from './a.js'"
        }
      ],
      0,
      0
    ],
    [
      'Single known function import from known Source module',
      "import { bar } from 'one_module';",
      [
        {
          name: 'bar',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>'
        }
      ],
      1,
      1
    ],
    [
      'Single known variable import from known Source module',
      "import { foo } from 'one_module'; foo",
      [
        {
          name: 'foo',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: '<div><h4>foo: string</h4><div class="description">foo</div></div>'
        }
      ],
      1,
      1
    ],
    [
      'Different imports from different known Source modules',
      "import { bar } from 'one_module';\nimport{ foo } from 'another_module'",
      [
        {
          name: 'bar',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>'
        },
        {
          name: 'foo',
          meta: DeclarationKind.KIND_IMPORT,
          score: 1,
          docHTML: '<div><h4>foo: string</h4><div class="description">foo</div></div>'
        }
      ],
      2,
      2
    ],
    [
      'Aliased known imports from known Source modules',
      "import { bar as b } from 'one_module';\nimport{ foo as f } from 'another_module'",
      [
        {
          name: 'b',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML:
            '<div><h4>bar(a: number) → {void}</h4><div class="description">Imported as b\nbar</div></div>'
        },
        {
          name: 'f',
          meta: DeclarationKind.KIND_IMPORT,
          score: 1,
          docHTML:
            '<div><h4>foo: string</h4><div class="description">Imported as f\nfoo</div></div>'
        }
      ],
      2,
      2
    ],
    [
      'Namespace import of known Source module',
      "import * as all from 'one_module';",
      [
        {
          name: 'all',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Namespace import of 'one_module'"
        }
      ],
      1,
      0
    ],
    [
      'Different known imports of known Source module',
      `
        import * as all from 'one_module';
        import foo, { bar } from 'one_module';
      `,
      [
        {
          name: 'all',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Namespace import of 'one_module'"
        },
        {
          name: 'foo',
          meta: DeclarationKind.KIND_IMPORT,
          score: 1,
          docHTML:
            '<div><h4>default: unknown</h4><div class="description">Imported as foo\nNo description available</div></div>'
        },
        {
          name: 'bar',
          meta: DeclarationKind.KIND_IMPORT,
          score: 2,
          docHTML: '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>'
        }
      ],
      2,
      1
    ],

    // Error cases
    [
      'Unknown import from known Source module',
      "import { unknown } from 'one_module'; unknown;",
      [
        {
          name: 'unknown',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "No documentation available for <code>unknown</code> from 'one_module'"
        }
      ],
      1,
      1
    ],
    [
      'Import from unknown Source module',
      "import { something } from 'unknown_module'; ",
      [
        {
          name: 'something',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Import from unknown module 'unknown_module'"
        }
      ],
      1,
      0
    ],
    [
      'Default import from Source module without default export',
      "import a from 'another_module';",
      [
        {
          name: 'a',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "No documentation available for <code>default</code> from 'another_module'"
        }
      ],
      1,
      1
    ],
    [
      'Known import and unknown import from known Source Module',
      "import { foo, unknown } from 'one_module';",
      [
        {
          name: 'unknown',
          meta: DeclarationKind.KIND_IMPORT,
          score: 1,
          docHTML: "No documentation available for <code>unknown</code> from 'one_module'"
        },
        {
          name: 'foo',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: '<div><h4>foo: string</h4><div class="description">foo</div></div>'
        }
      ],
      1,
      1
    ],
    [
      'Namespace import of unknown Source Module',
      "import * as all from 'unknown_module';",
      [
        {
          name: 'all',
          meta: DeclarationKind.KIND_IMPORT,
          score: 0,
          docHTML: "Namespace import of unknown module 'unknown_module'"
        }
      ],
      1,
      0
    ]
  ]

  test.each(testCases)('%s', async (_, code, expectedNames, manifestCount, docsCount) => {
    await runGetNames(code, expectedNames)
    expect(memoizedGetModuleDocsAsync).toHaveBeenCalledTimes(docsCount)
    expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(manifestCount)
  })

  test('Handles errors from memoizedGetModuleManifest gracefully', async () => {
    const mockedManifest = asMockedFunc(memoizedGetModuleManifestAsync)
    mockedManifest.mockRejectedValueOnce(new ModuleConnectionError())
    await runGetNames("import { foo } from 'one_module';", [
      {
        name: 'foo',
        meta: DeclarationKind.KIND_IMPORT,
        docHTML: "Unable to retrieve documentation for 'one_module'",
        score: 0
      }
    ])

    expect(memoizedGetModuleDocsAsync).toHaveBeenCalledTimes(0)
  })

  test('Handles errors from memoizedGetModuleDocs gracefully', async () => {
    const mockedDocs = asMockedFunc(memoizedGetModuleDocsAsync)
    mockedDocs.mockRejectedValueOnce(new ModuleConnectionError())

    await runGetNames(`import { foo } from 'one_module'; import { bar } from 'another_module';`, [
      {
        name: 'foo',
        meta: DeclarationKind.KIND_IMPORT,
        docHTML: "Unable to retrieve documentation for 'one_module'",
        score: 0
      },
      {
        name: 'bar',
        meta: DeclarationKind.KIND_IMPORT,
        docHTML: '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>',
        score: 1
      }
    ])

    expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(2)
  })
})
