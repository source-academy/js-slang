import { IOptions, Result } from '..'
import { Context, RecursivePartial } from '../types'

const HTML_ERROR_HANDLING_SCRIPT_TEMPLATE = `<script>
  window.onerror = (msg, url, lineNum) => {
    window.parent.postMessage("Line " + Math.max(lineNum - %d, 0) + ": " + msg, "*");
  };
</script>\n`

const errorScriptLines = HTML_ERROR_HANDLING_SCRIPT_TEMPLATE.split('\n').length - 1
export const htmlErrorHandlingScript = HTML_ERROR_HANDLING_SCRIPT_TEMPLATE.replace(
  '%d',
  errorScriptLines.toString()
)

export async function htmlRunner(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  return Promise.resolve({
    status: 'finished',
    context,
    value: htmlErrorHandlingScript + code
  })
}
