import { BasicEvaluator } from '@sourceacademy/conductor/runner';
import { createContext, parseError, runFilesInContext } from '../index';
import { Chapter } from '../langs';

export class SourceEvaluator1 extends BasicEvaluator {
  private context = createContext(Chapter.SOURCE_1);

  async evaluateChunk(chunk: string): Promise<any> {
    try {
      const result = await runFilesInContext({ '/code.js': chunk }, '/code.js', this.context);

      if (result.status === 'finished') {
        return result.value;
      }

      this.conductor.sendOutput(`Error: ${parseError(this.context.errors)}`);
      this.context.errors = [];
    } catch (e) {
      const msg =
        this.context.errors.length > 0
          ? parseError(this.context.errors)
          : e instanceof Error
            ? e.message
            : String(e);
      this.conductor.sendOutput(`Error: ${msg}`);
      this.context.errors = [];
    }
  }
}
