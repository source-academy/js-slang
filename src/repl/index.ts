import { Command } from '@commander-js/extra-typings'
import { transpilerCommand } from './transpiler'
import { replCommand } from './repl'
import { nonDetCommand } from './repl-non-det'

new Command()
  .addCommand(transpilerCommand)
  .addCommand(replCommand, { isDefault: true })
  .addCommand(nonDetCommand)
  .parseAsync()
