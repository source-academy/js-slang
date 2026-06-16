import { BasicEvaluator, IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { createContext, runFilesInContext } from '../index';
import { Chapter } from '../langs';

export class SourceEvaluator1 extends BasicEvaluator {
  private context = createContext(Chapter.SOURCE_1);

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  async evaluateChunk(chunk: string): Promise<any> {
    const result = await runFilesInContext({ '/code.js': chunk }, '/code.js', this.context);

    if (result.status === 'finished') {
      return result.value;
    }

    // On error, ship each error message to the host error channel and reset
    for (const error of this.context.errors) {
      this.conductor.sendOutput(`Error: ${error.explain()}`);
    }
    this.context.errors = [];
  }
}
