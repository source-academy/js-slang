import { Context } from '../types'
import * as create from '../utils/astCreator'
import * as instr from './instrCreator'
import { ReservedParam, Sound } from './types'

export const play = (context: Context) => (sound: Sound) => {
  context.runtime.agenda_wgsl?.push(instr.playInstr(sound.duration, 44100))
  context.runtime.agenda_wgsl?.push(
    instr.appInstr(
      1,
      create.callExpression(create.identifier('manualCall'), [create.literal(null)])
    )
  )
  context.runtime.stash_wgsl?.push(sound.wave)
  return new ReservedParam('x')
}

export const make_sound = (fun: Function, length: number) => {
  return new Sound(fun, length)
}

export const get_duration = (sound: Sound) => {
  return sound.duration
}

export const get_wave = (sound: Sound) => {
  return sound.wave
}

// Generate a WGSL code calling the _random function.
// Refer to `computePipeline` in `./webgpu/play_gpu.ts`.
export const _random = () => {
  return new ReservedParam('_random(index)')
}

export const is_sound = (x: any) => {
  return x instanceof Sound
}
