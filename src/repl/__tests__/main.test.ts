import { describe, test, expect, vi } from 'vitest'
import type { Command } from 'commander'
import { getMainCommand } from '../main'

vi.spyOn(process, 'exit').mockImplementation(code => {
  throw new Error(`process.exit called with ${code}`)
})

vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

describe('Make sure each subcommand can be run', () => {
  const mainCommand = getMainCommand()
  test.each(mainCommand.commands.map(cmd => [cmd.name(), cmd] as [string, Command]))(
    'Testing %s command',
    (_, cmd) => {
      return expect(cmd.parseAsync(['-h'], { from: 'user' })).rejects.toMatchInlineSnapshot(
        '[Error: process.exit called with 0]'
      )
    }
  )
})
