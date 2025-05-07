import type { Command } from '@commander-js/extra-typings'
import { asMockedFunc } from '../../utils/testing/misc'

/**
 * Set up the environment for testing the given command. Returns
 * `expectSuccess` and `expectError` for use with making assertions
 * about the behaviour of the command
 */
export function getCommandRunner<T extends Command<any, any>>(getter: () => T) {
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  jest.spyOn(process, 'exit').mockImplementation(code => {
    throw new Error(`process.exit called with ${code}`)
  })

  async function runner(...args: string[]) {
    await getter().parseAsync(args, { from: 'user' })
  }

  return {
    expectError(...args: string[]) {
      // Error conditions should always cause commands to call
      // process.exit(1)
      return expect(runner(...args)).rejects.toMatchInlineSnapshot(
        `[Error: process.exit called with 1]`
      )
    },
    expectSuccess(...args: string[]) {
      return expect(runner(...args)).resolves.toBeUndefined()
    }
  }
}

export function expectWritten(f: (contents: string) => any) {
  expect(f).toHaveBeenCalledTimes(1)
  const [[contents]] = asMockedFunc(f).mock.calls
  return expect(contents)
}
