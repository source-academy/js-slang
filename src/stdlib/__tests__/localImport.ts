import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectResult } from '../../utils/testing'
import { defaultExportLookupName } from '../localImport.prelude'

describe('__access_named_export__', () => {
  it('returns identifier if name exists in list of exported names', () => {
    return expectResult(
      stripIndent`
      function importedFile() {
        const square = x => x * x;
        const cube = x => x * x * x;
        return list(pair("square", square), pair("cube", cube));
      }
      const square = __access_named_export__(importedFile(), "square");
      square(5);
    `,
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`25`)
  })

  it('returns first identifier if name exists multiple times in list of exported names', () => {
    return expectResult(
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
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`25`)
  })

  it('returns undefined if name does not exist in list of exported names', () => {
    return expectResult(
      stripIndent`
      function importedFile() {
        const square = x => x * x;
        const cube = x => x * x * x;
        return list(pair("square", square), pair("cube", cube));
      }
      __access_named_export__(importedFile(), "identity");
    `,
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`undefined`)
  })

  it('returns undefined if list of exported names is empty', () => {
    return expectResult(
      stripIndent`
      function importedFile() {
        const square = x => x * x;
        const cube = x => x * x * x;
        return list();
      }
      __access_named_export__(importedFile(), "identity");
    `,
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`undefined`)
  })
})

describe('__access_export__', () => {
  it('returns named export if it exists', () => {
    return expectResult(
      stripIndent`
      function importedFile() {
        const square = x => x * x;
        const cube = x => x * x * x;
        return pair(1 + 2, list(pair("square", square), pair("cube", cube)));
      }
      const square = __access_export__(importedFile(), "square");
      square(5);
    `,
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`25`)
  })

  it('returns default export if it exists', () => {
    return expectResult(
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
      { chapter: Chapter.SOURCE_2, native: true }
    ).toMatchInlineSnapshot(`125`)
  })
})
