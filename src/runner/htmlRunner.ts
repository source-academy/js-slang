import { IOptions, Result } from '..'
import { Context } from '../types'

export const ERROR_HANDLING_SCRIPT = `<script>
  window.onerror = (msg, url, lineNum) => {
    window.parent.postMessage("Line " + Math.max(lineNum - 5, 0) + ": " + msg, "*");
  };
</script>\n`

export async function htmlRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  return Promise.resolve({
    status: 'finished',
    context,
    value: ERROR_HANDLING_SCRIPT + code
  })
}
