#!/usr/bin/env node
/* istanbul ignore file */

import { getMainCommand } from './main'

getMainCommand().parseAsync()
