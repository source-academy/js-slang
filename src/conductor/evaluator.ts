// @ts-expect-error — __EVALUATOR__ is replaced at build time by @rollup/plugin-replace
import { __EVALUATOR__ } from './index';

export default __EVALUATOR__;
