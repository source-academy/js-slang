import { expect } from 'vitest'
import { contextTest as test } from '../../utils/testing';
import { mockContext } from "../../utils/testing/mocks";
import { Chapter } from '../../langs';
import { Finished } from '../../runner/types';
import { mapResult } from "../mapper";

test("given source, mapper should do nothing (no mapping needed)", ({ context }) => {
  const result: Finished = {
    status: "finished",
    context: context,
    value: 5,
  }
  const mapper = mapResult(context);
  expect(mapper(result)).toEqual(result);
})

test("given scheme, mapper should map result to scheme representation", () => {
  const context = mockContext(Chapter.SCHEME_1);
  const result: Finished = {
    status: "finished",
    context,
    value: [1, 2, 3, 4, 5],
  }
  const mapper = mapResult(context);
  expect(mapper(result)).toEqual({
    status: "finished",
    context: context,
    value: [1, 2, 3, 4, 5],
    representation: {
      representation: "#(1 2 3 4 5)",
    },
  });
})