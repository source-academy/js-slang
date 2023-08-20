#!/usr/bin/env node
import { generate } from 'astring'
import { Program } from 'estree'

import { sourceLanguages } from '../constants'
import { transpileToGPU } from '../gpu/gpu'
import { createContext, parseError } from '../index'
import { transpileToLazy } from '../lazy/lazy'
import { parse } from '../parser/parser'
import { transpile } from '../transpiler/transpiler'
import { Chapter, Variant } from '../types'
import { validateAndAnnotate } from '../validator/validator'

async function transpileCode(
  chapter: Chapter = Chapter.SOURCE_1,
  variant: Variant = Variant.DEFAULT,
  code = '',
  pretranspile = false
) {
  // use defaults for everything
  const context = createContext(chapter, variant, undefined, undefined)
  const program = parse(code, context)
  if (program === null) {
    throw Error(parseError(context.errors, true))
  }
  validateAndAnnotate(program as Program, context)
  switch (variant) {
    case Variant.GPU:
      transpileToGPU(program)
      break
    case Variant.LAZY:
      transpileToLazy(program)
      break
  }
  if (pretranspile) {
    return generate(program)
  } else {
    const { transpiled } = await transpile(program as Program, context)
    return transpiled
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
  if (
    !valid ||
    !(variant === Variant.DEFAULT || variant === Variant.LAZY || variant === Variant.GPU)
  ) {
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
    transpileCode(chapter, variant, code, pretranspile).then(transpiled =>
      process.stdout.write(transpiled)
    )
  })
}

main()
