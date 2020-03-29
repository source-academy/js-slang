declare module 'acorn-loose' {
  import { Options as AcornOptions } from 'acorn'
  import * as es from 'estree'

  export function parse(source: string, options: AcornOptions): es.Program
}
