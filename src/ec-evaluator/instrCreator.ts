/**
 * Utility functions for creating the various agenda instructions.
 */
import * as es from 'estree'

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

export const branchInstr = (
  consequent: es.Expression | es.Statement,
  alternate: es.Expression | es.Statement | null = null,
  srcNode: es.Node
): IInstr => ({
  instrType: InstrTypes.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const envInstr = (env: Environment): IInstr => ({ instrType: InstrTypes.ENVIRONMENT, env })

export const pushUndefInstr = (): IInstr => ({ instrType: InstrTypes.PUSH_UNDEFINED_IF_NEEDED })
