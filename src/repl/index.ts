#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'

import { getReplCommand } from './repl'
import { transpilerCommand } from './transpiler'

new Command()
  .addCommand(transpilerCommand)
  .addCommand(getReplCommand(), { isDefault: true })
  .parseAsync()
