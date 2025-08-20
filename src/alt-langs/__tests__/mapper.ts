import { mockContext } from "../../utils/testing/mocks";
import { Chapter } from "../../types";
import { Finished } from '../../runner/types';
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