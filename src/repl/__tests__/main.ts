import type { Command } from "commander"
import { getMainCommand } from "../main"

jest.spyOn(process, 'exit').mockImplementation(code => {
  throw new Error(`process.exit called with ${code}`)
})

describe('Make sure each subcommand can be run', () => {
  const mainCommand = getMainCommand()
  test.each(
    mainCommand.commands.map(cmd => [cmd.name(), cmd] as [string, Command])
  )('Testing %s command', (_, cmd) => {
    return expect(cmd.parseAsync(['-h'], { from: 'user' })).rejects.toMatchInlineSnapshot(
      '[Error: process.exit called with 0]'
    )
  })
})