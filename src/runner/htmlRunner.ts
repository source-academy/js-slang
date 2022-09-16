import { IOptions, Result } from '..'
import { Context } from '../types'

const ERROR_HANDLING_SCRIPT_TEMPLATE = `<script>
  window.onerror = (msg, url, lineNum) => {
    window.parent.postMessage("Line " + Math.max(lineNum - %d, 0) + ": " + msg, "*");
  };
</script>\n`

const errorScriptLines = ERROR_HANDLING_SCRIPT_TEMPLATE.split('\n').length - 1
export const htmlErrorScript = ERROR_HANDLING_SCRIPT_TEMPLATE.replace(
  '%d',
  errorScriptLines.toString()
)

export async function htmlRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  return Promise.resolve({
    status: 'finished',
    context,
    value: htmlErrorScript + code
  })
}
