import { initialise } from '@sourceacademy/conductor/runner';
// @ts-expect-error — __EVALUATOR__ is replaced at build time by @rollup/plugin-replace
import { __EVALUATOR__ } from './index';

initialise(__EVALUATOR__);
