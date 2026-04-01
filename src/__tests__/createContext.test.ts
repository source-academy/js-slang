import { beforeEach, describe, expect, test, vi } from 'vitest'
import { defaultBuiltIns } from '../createContext'
import { expectFinishedResult } from '../utils/testing'

const defaultRawDisplay = vi.spyOn(defaultBuiltIns, 'rawDisplay')
const defaultPrompt = vi.spyOn(defaultBuiltIns, 'prompt')
const defaultAlert = vi.spyOn(defaultBuiltIns, 'alert')

beforeEach(() => {
  defaultRawDisplay.mockClear()
  defaultPrompt.mockClear()
  defaultAlert.mockClear()
})

describe('importing builtins', () => {
  test('default builtins are used when no custom builtins are provided', async () => {
    await expectFinishedResult('display(1);', { testBuiltins: defaultBuiltIns }).resolves.toEqual(1)
    expect(defaultRawDisplay).toHaveBeenCalledOnce()
  })

  test('custom builtins are used when provided', async () => {
    const customDisplay = vi.fn(x => x)
    await expectFinishedResult('display(1);', {
      testBuiltins: {
        rawDisplay: customDisplay
      }
    }).resolves.toEqual(1)

    expect(customDisplay).toHaveBeenCalledOnce()
  })
})
