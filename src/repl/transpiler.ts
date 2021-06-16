#!/usr/bin/env node
import { createContext, parseError } from '../index'
import { Variant } from '../types'
import { sourceLanguages } from '../constants'
import { parse } from '../parser/parser'
import { transpile } from '../transpiler/transpiler'
import { transpileToGPU } from '../gpu/gpu'
import { transpileToLazy } from '../lazy/lazy'
import { validateAndAnnotate } from '../validator/validator'
import { Program } from 'estree'
import { generate } from 'astring'

function transpileCode(chapter = 1, variant: Variant = 'default', code = '', pretranspile = false) {
  // use defaults for everything
  const context = createContext(chapter, variant, undefined, undefined)
  const program = parse(code, context)
  if (program === undefined) {
    throw Error(parseError(context.errors, true))
  }
  validateAndAnnotate(program as Program, context)
  switch (variant) {
    case 'gpu':
      transpileToGPU(program)
      break
    case 'lazy':
      transpileToLazy(program)
      break
  }
  if (pretranspile) {
    return generate(program)
  } else {
    return transpile(program as Program, context).transpiled
  }
}

/**
 * Returns true iff the given chapter and variant combination is supported.
 */
function validChapterVariant(chapter: any, variant: any) {
  for (const lang of sourceLanguages) {
    if (lang.chapter === chapter && lang.variant === variant) return true
  }

  return false
}

function main() {
  const opt = require('node-getopt')
    .create([
      ['c', 'chapter=CHAPTER', 'set the Source chapter number (i.e., 1-4)', '1'],
      [
        'p',
        'pretranspile',
        "only pretranspile (e.g. GPU -> Source) and don't perform Source -> JS transpilation"
      ],
      [
        'v',
        'variant=VARIANT',
        'set the Source variant (i.e., default, interpreter, substituter, lazy, non-det, concurrent, wasm, gpu)',
        'default'
      ],
      ['h', 'help', 'display this help']
    ])
    .bindHelp()
    .setHelp('Usage: js-slang-transpiler [OPTION]\n\n[[OPTIONS]]')
    .parseSystem()

  const pretranspile = opt.options.pretranspile
  const variant = opt.options.variant
  const chapter = parseInt(opt.options.chapter, 10)
  const valid = validChapterVariant(chapter, variant)
  if (!valid || !(variant === 'default' || variant === 'lazy' || variant === 'gpu')) {
    throw new Error(
      'The chapter and variant combination provided is unsupported. Use the -h option to view valid chapters and variants.'
    )
  }

  const chunks: Buffer[] = []
  process.stdin.on('data', chunk => {
    chunks.push(chunk)
  })
  process.stdin.on('end', () => {
    const code = Buffer.concat(chunks).toString('utf-8')
    const transpiled = transpileCode(chapter, variant, code, pretranspile)
    process.stdout.write(transpiled)
  })
}

main()
