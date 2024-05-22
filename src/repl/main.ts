import { Command } from '@commander-js/extra-typings'

import { getSVMCCommand } from './svmc'
import { getReplCommand } from './repl'
import { getTranspilerCommand } from './transpiler'

export const getMainCommand = () =>
  new Command()
    .addCommand(getSVMCCommand())
    .addCommand(getTranspilerCommand())
    .addCommand(getReplCommand(), { isDefault: true })
