/**
 * A script for running jest that automatically handles converting Windows
 * style paths to Posix style paths because Jest is fussy about those
 */
import { fork } from 'child_process'
import pathlib from 'path'
import { Command } from '@commander-js/extra-typings'

await new Command()
  .argument('[patterns...]', 'Patterns to test')
  .allowUnknownOption()
  .action(async (patterns, args) => {
    const newPatterns = patterns.map(pattern => pattern.split(pathlib.sep).join(pathlib.posix.sep))

    const proc = fork('node_modules/jest/bin/jest.js', [
      ...Object.entries(args),
      ...newPatterns
    ])

    const code = await new Promise((resolve, reject) => {
      proc.on('exit', resolve)
      proc.on('error', reject)
    })

    process.exit(code)
  })
  .parseAsync()