import { describe, expect, test } from 'vitest';

import { InstrType } from '../../../cse-machine/types';
import { serializeControlItem } from '../serialize';

describe('serializeControlItem', () => {
  test('an instruction that restores a frame says so by instrType, and names the frame', () => {
    const item = { instrType: InstrType.ENVIRONMENT, env: { id: 'e42' } };

    const serialized = serializeControlItem(item, '');

    // The host takes it by `instrType: 'env'` (CseEnvironmentInstructionMetadata), not by
    // js-slang's own enum value.
    expect(serialized.metadata).toEqual({ instrType: 'env', envId: 'e42' });
    // Hosts that still match on the text keep working.
    expect(serialized.displayText).toBe('ENVIRONMENT');
  });
});
