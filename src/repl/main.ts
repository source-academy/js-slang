#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'

import { getReplCommand } from './repl'
import { nonDetCommand } from './repl-non-det'
import { transpilerCommand } from './transpiler'

export const getMainCommand = () => new Command()
  .addCommand(transpilerCommand)
  .addCommand(getReplCommand(), { isDefault: true })
  .addCommand(nonDetCommand)
