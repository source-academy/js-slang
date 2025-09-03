import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DeclarationKind } from '..'
import { getNames } from '../..'
import { mockContext } from '../../utils/testing/mocks'
import { Chapter } from '../../langs'

import {
  memoizedGetModuleDocsAsync,
  memoizedGetModuleManifestAsync
} from '../../modules/loader/loaders'
import { ModuleConnectionError } from '../../modules/errors'

vi.mock(import('../../modules/loader/loaders'))

type TestCase = [
  description: string,
  actualCode: string,
  expectedName: [name: string, html: string][],
  manifestCount: number,
  docsCount: number
]

beforeEach(() => {
  vi.clearAllMocks()
})

async function testGetNames(code: string, expectedNames: [string, string][]) {
  const context = mockContext(Chapter.LIBRARY_PARSER)
  const [extractedNames] = await getNames(code, 2, 0, context)
  const expectedDocs = expectedNames.map(([name, html], i) => ({
    name,
    meta: DeclarationKind.KIND_IMPORT,
    score: i,
    docHTML: html
  }))

  for (const name of expectedDocs) {
    expect(extractedNames).toContainEqual(name)
  }
}

describe('test name extractor functionality on imports', () => {
  const testCases: TestCase[] = [
    [
      'Single import from known local module',
      "import { a } from './a.js';",
      [['a', "Import 'a' from './a.js'"]],
      0,
      0
    ],
    [
      'Multiple imports from known local module',
      "import { a, b } from './a.js';",
      [
        ['a', "Import 'a' from './a.js'"],
        ['b', "Import 'b' from './a.js'"]
      ],
      0,
      0
    ],
    [
      'Single known function import from known Source module',
      "import { bar } from 'one_module';",
      [['bar', '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>']],
      1,
      1
    ],
    [
      'Single known variable import from known Source module',
      "import { foo } from 'one_module'; foo",
      [['foo', '<div><h4>foo: string</h4><div class="description">foo</div></div>']],
      1,
      1
    ],
    [
      'Different imports from different known Source modules',
      "import { bar } from 'one_module';\nimport{ foo } from 'another_module'",
      [
        ['bar', '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>'],
        ['foo', '<div><h4>foo: string</h4><div class="description">foo</div></div>']
      ],
      2,
      2
    ],
    [
      'Aliased known imports from known Source modules',
      "import { bar as b } from 'one_module';\nimport{ foo as f } from 'another_module'",
      [
        [
          'b',
          '<div><h4>bar(a: number) → {void}</h4><div class="description">Imported as b\nbar</div></div>'
        ],
        ['f', '<div><h4>foo: string</h4><div class="description">Imported as f\nfoo</div></div>']
      ],
      2,
      2
    ],
    [
      'Namespace import of known Source module',
      "import * as all from 'one_module';",
      [['all', "Namespace import of 'one_module'"]],
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
        ['all', "Namespace import of 'one_module'"],
        [
          'foo',
          '<div><h4>default: unknown</h4><div class="description">Imported as foo\nNo description available</div></div>'
        ],
        ['bar', '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>']
      ],
      2,
      1
    ],

    // Error cases
    [
      'Unknown import from known Source module',
      "import { unknown } from 'one_module'; unknown;",
      [['unknown', "No documentation available for <code>unknown</code> from 'one_module'"]],
      1,
      1
    ],
    [
      'Import from unknown Source module',
      "import { something } from 'unknown_module'; ",
      [['something', "Import from unknown module 'unknown_module'"]],
      1,
      0
    ],
    [
      'Default import from Source module without default export',
      "import a from 'another_module';",
      [['a', "No documentation available for <code>default</code> from 'another_module'"]],
      1,
      1
    ],
    [
      'Known import and unknown import from known Source Module',
      "import { foo, unknown } from 'one_module';",
      [
        ['foo', '<div><h4>foo: string</h4><div class="description">foo</div></div>'],
        ['unknown', "No documentation available for <code>unknown</code> from 'one_module'"]
      ],
      1,
      1
    ],
    [
      'Namespace import of unknown Source Module',
      "import * as all from 'unknown_module';",
      [['all', "Namespace import of unknown module 'unknown_module'"]],
      1,
      0
    ]
  ]

  test.each(testCases)('%s', async (_, code, expectedNames, manifestCount, docsCount) => {
    await testGetNames(code, expectedNames)
    expect(memoizedGetModuleDocsAsync).toHaveBeenCalledTimes(docsCount)
    expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(manifestCount)
  })

  test('Handles errors from memoizedGetModuleManifest gracefully', async () => {
    const mockedManifest = vi.mocked(memoizedGetModuleManifestAsync)
    mockedManifest.mockRejectedValueOnce(new ModuleConnectionError())
    await testGetNames("import { foo } from 'one_module';", [
      ['foo', "Unable to retrieve documentation for 'one_module'"]
    ])

    expect(memoizedGetModuleDocsAsync).toHaveBeenCalledTimes(0)
  })

  test('Handles errors from memoizedGetModuleDocs gracefully', async () => {
    const mockedDocs = vi.mocked(memoizedGetModuleDocsAsync)
    mockedDocs.mockRejectedValueOnce(new ModuleConnectionError())

    await testGetNames(`import { foo } from 'one_module'; import { bar } from 'another_module';`, [
      ['foo', "Unable to retrieve documentation for 'one_module'"],
      ['bar', '<div><h4>bar(a: number) → {void}</h4><div class="description">bar</div></div>']
    ])

    expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(2)
  })
})
