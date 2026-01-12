import { expect, test } from 'vitest';
import { Chapter } from "../../langs";
import { type Finished } from "../../types";
import { mockContext } from "../../utils/testing/mocks";
import { mapResult } from "../mapper";

test("given source, mapper should do nothing (no mapping needed)", () => {
  const context = mockContext();
  const result = {
    status: "finished",
    context: context,
    value: 5,
  } as Finished;
  const mapper = mapResult(context);
  expect(mapper(result)).toEqual(result);
})

test("given scheme, mapper should map result to scheme representation", () => {
  const context = mockContext(Chapter.SCHEME_1);
  const result = {
    status: "finished",
    context: context,
    value: [1, 2, 3, 4, 5],
  } as Finished;
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
