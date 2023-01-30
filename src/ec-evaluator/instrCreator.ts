/**
 * Utility functions for creating the various agenda instructions.
 */

import { Environment } from '../types'
import { IInstr, InstrTypes } from './types'

export const assignmentInstr = (
  symbol: string,
  constant: boolean,
  declaration: boolean
): IInstr => ({
  instrType: InstrTypes.ASSIGNMENT,
  symbol,
  constant,
  declaration
})

export const popInstr = (): IInstr => ({ instrType: InstrTypes.POP })

export const envInstr = (env: Environment): IInstr => ({ instrType: InstrTypes.ENVIRONMENT, env })

export const pushUndefInstr = (): IInstr => ({ instrType: InstrTypes.PUSH_UNDEFINED_IF_NEEDED })
