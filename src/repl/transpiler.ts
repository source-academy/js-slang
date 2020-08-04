#!/usr/bin/env node
import { createContext } from '../index'
import { Variant } from '../types'
import { sourceLanguages } from '../constants'
import { parse } from '../parser/parser'
import { transpile } from '../transpiler/transpiler'
import { validateAndAnnotate } from '../validator/validator'
import { Program } from 'estree'

function transpileCode(chapter = 1, variant: Variant = 'default', code = '') {
  // use defaults for everything
  const context = createContext(chapter, variant, undefined, undefined)
  const program = parse(code, context)
  validateAndAnnotate(program as Program, context)
  return transpile(program as Program, context, false, context.variant).transpiled
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
    const transpiled = transpileCode(chapter, variant, code)
    process.stdout.write(transpiled)
  })
}

main()
