import * as astring from 'astring'
import { parse } from 'acorn'
import { describe, expect, test } from 'vitest'
import createContext from '../../createContext'
import { redex } from '..'
import { convert, explain } from '../generator'
import type { StepperBaseNode } from '../interface'
import { undefinedNode } from '../nodes'
import { StepperIdentifier } from '../nodes/Expression/Identifier'
import { StepperLiteral } from '../nodes/Expression/Literal'
import { StepperDebuggerStatement } from '../nodes/Statement/DebuggerStatement'
import { getSteps } from '../steppers'

const stringify = (ast: StepperBaseNode) =>
  astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')

describe('DebuggerStatement', () => {
  test('covers DebuggerStatement node methods', () => {
    const program = parse('debugger;', { ecmaVersion: 10, locations: true }) as any
    const node = convert(program.body[0]) as StepperDebuggerStatement

    expect(node.type).toBe('DebuggerStatement')
    expect(node.isContractible()).toBe(true)
    expect(node.isOneStepPossible()).toBe(true)
    expect(explain(node)).toBe('Debugger statement reached')

    expect(node.contract()).toBe(undefinedNode)

    redex.preRedex = []
    redex.postRedex = []
    expect(node.oneStep()).toBe(undefinedNode)
    expect(redex.preRedex[0]).toBe(node)
    expect(redex.postRedex).toEqual([])

    const id = new StepperIdentifier('x')
    const value = new StepperLiteral(1, '1')
    expect(node.substitute(id, value)).toBe(node)
    expect(node.freeNames()).toEqual([])
    expect(node.allNames()).toEqual([])
    expect(node.rename('x', 'y')).toBe(node)
  })

  test('steps through debugger statements in the tracer', () => {
    const program = parse('debugger; 1;', { ecmaVersion: 10, locations: true }) as any
    const steps = getSteps(program, createContext(2), { stepLimit: 1000 })

    expect(
      steps.map(step => [
        stringify(step.ast),
        step.markers?.[0]?.redexType ?? 'noMarker',
        step.markers?.[0]?.explanation
      ])
    ).toEqual([
      ['debugger; 1;', 'noMarker', 'Start of evaluation'],
      ['debugger; 1;', 'beforeMarker', 'Debugger statement reached'],
      ['1;', 'afterMarker', 'Debugger statement reached'],
      ['1;', 'noMarker', 'Evaluation complete']
    ])
  })
})
