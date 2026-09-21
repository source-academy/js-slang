// @ts-morph/bootstrap pulls in the entire TypeScript compiler (~24MB on disk). It is reached only
// through FullTSParser (Chapter.FULL_TS), which these Source §1-4 evaluators never select, so it is
// stubbed out rather than bundled. Anything that does reach it fails loudly instead of silently
// misbehaving.
const unavailable = () => {
  throw new Error('Chapter.FULL_TS is not supported by this evaluator.');
};

export const createProjectSync = unavailable;
export const ts = new Proxy({}, { get: unavailable });
export default { createProjectSync, ts };
