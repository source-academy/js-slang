import { Command } from '@commander-js/extra-typings'

import { getReplCommand } from './repl'
import { nonDetCommand } from './repl-non-det'
import { transpilerCommand } from './transpiler'

new Command()
  .addCommand(transpilerCommand)
  .addCommand(getReplCommand(), { isDefault: true })
  .addCommand(nonDetCommand)
  .parseAsync()
