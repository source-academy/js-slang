import type { SerializedStepperStep, StepperMessage } from '@sourceacademy/common-stepper';
import { describe, expect, test } from 'vitest';

import createContext from '../../../createContext';
import { Chapter, Variant } from '../../../langs';
import { parse } from '../../../parser/parser';
import { generateSteps, getSteps } from '../../../stepper/steppers';
import { SourceStepperRunnerPlugin, STEPS_PER_BATCH } from '../SourceStepperRunnerPlugin';

class FakeChannel {
  name = '__stepper';
  sent: StepperMessage[] = [];
  private subscribers: ((message: StepperMessage) => void)[] = [];
  send(message: StepperMessage) {
    this.sent.push(message);
  }
  /** What the host sends to the runner. */
  emit(message: StepperMessage) {
    this.subscribers.forEach(fn => fn(message));
  }
  subscribe(fn: (message: StepperMessage) => void) {
    this.subscribers.push(fn);
  }
  unsubscribe() {}
  close() {}
}

function setUp(code: string, stepLimit: number, chapter = Chapter.SOURCE_2) {
  const context = createContext(chapter, Variant.DEFAULT);
  const program = parse(code, context)!;
  expect(program).not.toBeNull();
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new SourceStepperRunnerPlugin({} as any, [channel as any], context, stepLimit);
  return { context, program, channel, plugin };
}

/** What a host that applies the batches in order ends up with. */
function received(messages: StepperMessage[]): SerializedStepperStep[] {
  let steps: SerializedStepperStep[] = [];
  for (const message of messages) {
    if (message.type !== 'batch') throw new Error(`unexpected ${message.type}`);
    steps = steps.slice(0, message.index).concat(message.steps);
  }
  return steps;
}

/** The last element (the project's target library has no `Array.prototype.at`). */
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

const FACTORIAL = 'function f(n) { return n === 0 ? 1 : n * f(n - 1); }\nf(6);';

describe('generateSteps', () => {
  test('gives the steps that getSteps collects, and says the run was not cut off', () => {
    const { context, program } = setUp(FACTORIAL, 1000);
    const generator = generateSteps(program, context, { stepLimit: 1000 });
    const streamed = [];
    let next = generator.next();
    for (; !next.done; next = generator.next()) streamed.push(next.value);
    expect(streamed.length).toBeGreaterThan(10);
    expect(streamed.map(s => s.markers?.map(m => m.explanation))).toEqual(
      getSteps(program, context, { stepLimit: 1000 }).map(s => s.markers?.map(m => m.explanation)),
    );
    expect(next.value).toEqual({ limitReached: false });
  });

  test('has its first step before the program has been stepped', () => {
    const { context, program } = setUp(FACTORIAL, 1000);
    const first = generateSteps(program, context, { stepLimit: 1000 }).next();
    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({ markers: [{ explanation: 'Start of evaluation' }] });
  });

  test('says that the run was cut off by the step limit', () => {
    const { context, program } = setUp(FACTORIAL, 20);
    const generator = generateSteps(program, context, { stepLimit: 20 });
    let next = generator.next();
    let last = next.value;
    for (; !next.done; next = generator.next()) last = next.value;
    expect(next.value).toEqual({ limitReached: true });
    expect(last).toMatchObject({ markers: [{ explanation: 'Maximum number of steps exceeded' }] });
  });

  test('a run of thousands of steps does not overflow the call stack', () => {
    // The steps used to be found by a recursion that was a call deeper at every step.
    const code = 'function f(n) { return n === 0 ? 0 : f(n - 1); }\nf(100000);';
    const { context, program } = setUp(code, 30000);
    const generator = generateSteps(program, context, { stepLimit: 30000 });
    let count = 0;
    let next = generator.next();
    for (; !next.done; next = generator.next()) count += 1;
    expect(count).toBeGreaterThan(15000);
    expect(next.value).toEqual({ limitReached: true });
  }, 60000);
});

describe('SourceStepperRunnerPlugin', () => {
  test('sends the steps in batches, then the end of the trace', async () => {
    const { program, channel, plugin } = setUp(FACTORIAL, 1000);
    await plugin.sendSteps(program);
    const batches = channel.sent;
    expect(batches.length).toBeGreaterThan(2);
    expect(batches.every(m => m.type === 'batch')).toBe(true);
    // Each batch continues where the one before ended, and only the last one has an end.
    let total = 0;
    for (const message of batches.slice(0, -1)) {
      if (message.type !== 'batch') throw new Error('not a batch');
      expect(message.index).toBe(total);
      expect(message.end).toBeUndefined();
      expect(message.steps.length).toBeLessThanOrEqual(STEPS_PER_BATCH);
      total += message.steps.length;
    }
    expect(last(batches)).toMatchObject({
      type: 'batch',
      index: total,
      steps: [],
      end: { status: 'complete' },
    });
  });

  test('the batches add up to the steps that sendSteps gave when it sent them whole', async () => {
    const { program, channel, plugin, context } = setUp(FACTORIAL, 1000);
    await plugin.sendSteps(program);
    expect(received(channel.sent)).toEqual(plugin.getSteps(program));
    expect(plugin.getSteps(program).length).toBe(
      getSteps(program, context, { stepLimit: 1000 }).length,
    );
  });

  test('a run cut off by the step limit ends cut off, with the reason, and keeps its last step', async () => {
    const { program, channel, plugin } = setUp(FACTORIAL, 20);
    await plugin.sendSteps(program);
    const lastMessage = last(channel.sent);
    expect(lastMessage).toMatchObject({
      type: 'batch',
      steps: [],
      end: { status: 'cut-off', reason: 'the limit of 20 steps was reached' },
    });
    const steps = received(channel.sent);
    expect(last(steps)?.markers?.[0]?.explanation).toBe('Maximum number of steps exceeded');
  });

  test('a program with an error in it ends complete, with the stuck step', async () => {
    const { program, channel, plugin } = setUp('1 + "a";', 1000);
    await plugin.sendSteps(program);
    expect(last(channel.sent)).toMatchObject({ end: { status: 'complete' } });
    expect(last(received(channel.sent))?.markers?.[0]?.explanation).toBe('Evaluation stuck');
  });

  test('a request replays the run as one batch that carries its end', async () => {
    const { program, channel, plugin } = setUp(FACTORIAL, 20);
    await plugin.sendSteps(program);
    const steps = received(channel.sent);
    channel.sent.length = 0;
    // The host asks again, as when its tab is opened after the run.
    channel.emit({ type: 'request' });
    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]).toMatchObject({
      type: 'batch',
      index: 0,
      steps,
      end: { status: 'cut-off', reason: 'the limit of 20 steps was reached' },
    });
  });
});
