import type { SerializedDataVisualizerNode } from '@sourceacademy/common-data-visualizer';
import {
  BaseDataVisualizerRunnerPlugin,
  type RefIdAllocator,
} from '@sourceacademy/runner-data-visualizer';

import type { Value } from '../../types';
import { toDataVisualizerNode } from './toDataVisualizerNode';

/**
 * The js-slang (Source) binding of the language-agnostic data visualizer runner.
 *
 * All Source-specific knowledge lives in {@link toDataVisualizerNode}; this class is the thin
 * adapter `BaseDataVisualizerRunnerPlugin` expects — no cycle-detection or classification here, that
 * stays host-side. Mirrors py-slang's `PythonDataVisualizerRunnerPlugin`.
 */
export class SourceDataVisualizerRunnerPlugin extends BaseDataVisualizerRunnerPlugin<Value> {
  protected toNode(value: Value, refs: RefIdAllocator): SerializedDataVisualizerNode {
    return toDataVisualizerNode(value, refs);
  }
}
