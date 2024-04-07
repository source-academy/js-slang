import { Command } from '@commander-js/extra-typings'

import { replCommand } from './repl'
import { nonDetCommand } from './repl-non-det'
import { transpilerCommand } from './transpiler'

new Command()
  .addCommand(transpilerCommand)
  .addCommand(replCommand, { isDefault: true })
  .addCommand(nonDetCommand)
  .parseAsync()