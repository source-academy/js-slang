import { describe, expect, it } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testForValue } from '../../utils/testing'
import { defaultExportLookupName } from '../localImport.prelude'

describe('__access_named_export__', () => {
  it('returns identifier if name exists in list of exported names', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            return list(pair("square", square), pair("cube", cube));
          }
          const square = __access_named_export__(importedFile(), "square");
          square(5);
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toEqual(25)
  })

  it('returns first identifier if name exists multiple times in list of exported names', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            // The second instance of the name 'square' actually refers to the function 'cube'.
            return list(pair("square", square), pair("square", cube), pair("cube", cube));
          }
          const square = __access_named_export__(importedFile(), "square");
          square(5);
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toEqual(25)
  })

  it('returns undefined if name does not exist in list of exported names', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            return list(pair("square", square), pair("cube", cube));
          }
          __access_named_export__(importedFile(), "identity");
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toBeUndefined()
  })

  it('returns undefined if list of exported names is empty', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            return list();
          }
          __access_named_export__(importedFile(), "identity");
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toBeUndefined()
  })
})

describe('__access_export__', () => {
  it('returns named export if it exists', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            return pair(1 + 2, list(pair("square", square), pair("cube", cube)));
          }
          const square = __access_export__(importedFile(), "square");
          square(5);
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toEqual(25)
  })

  it('returns default export if it exists', () => {
    return expect(
      testForValue(
        stripIndent`
          function importedFile() {
            const square = x => x * x;
            const cube = x => x * x * x;
            return pair(cube, list(pair("square", square)));
          }
          // When 'null' is passed in as the name of the export,
          // '__access_export__' returns the default export.
          const square = __access_export__(importedFile(), "${defaultExportLookupName}");
          square(5);
        `,
        Chapter.SOURCE_2
      )
    ).resolves.toEqual(125)
  })
})
