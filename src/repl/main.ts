import { Command } from '@commander-js/extra-typings'

import { getSVMCCommand } from './svmc'
import { getReplCommand } from './repl'
import { transpilerCommand } from './transpiler'

export const getMainCommand = () =>
  new Command()
    .addCommand(getSVMCCommand())
    .addCommand(transpilerCommand)
    .addCommand(getReplCommand(), { isDefault: true })
