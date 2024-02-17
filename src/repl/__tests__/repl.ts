import { Chapter } from "../../types";
import { chapterParser } from "../utils";

describe('Test chapter parser', () => test.each([
  ['1', Chapter.SOURCE_1],
  ['SOURCE_1', Chapter.SOURCE_1],
  ['2', Chapter.SOURCE_2],
  ['SOURCE_2', Chapter.SOURCE_2],
  ['3', Chapter.SOURCE_3],
  ['SOURCE_3', Chapter.SOURCE_3],
  ['4', Chapter.SOURCE_4],
  ['SOURCE_4', Chapter.SOURCE_4],
  ['random string', undefined],
  ['525600', undefined],
])('%#', (value, expected) => {
  if (!expected) {
    expect(() => chapterParser(value)).toThrow()
    return
  }

  expect(chapterParser(value)).toEqual(expected)
}))