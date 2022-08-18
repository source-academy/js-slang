/* eslint-disable @typescript-eslint/no-unused-vars */
import { IOptions, Result } from '..'
import { Context } from '../types'

export async function htmlRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  // Currently returns the HTML code without any changes,
  // more changes will be made in the future (e.g. adding modules support)
  return Promise.resolve({
    status: 'finished',
    context,
    value: code
  })
}
