import { parse as acornParse, type Token, tokenizer } from 'acorn'
import type es from 'estree'

import { DEFAULT_ECMA_VERSION } from '../../constants'
import { Chapter, type Context, type Node, type SourceError, Variant } from '../../types'
import { ancestor, AncestorWalkerFn } from '../../utils/walkers'
import { DisallowedConstructError, FatalSyntaxError } from '../errors'
import type { AcornOptions, Rule, Parser } from '../types'
import { createAcornParserOptions, positionToSourceLocation } from '../utils'
import defaultRules from './rules'
import syntaxBlacklist from './syntax'

const combineAncestorWalkers =
  <TState>(w1: AncestorWalkerFn<TState>, w2: AncestorWalkerFn<TState>): AncestorWalkerFn<TState> =>
  (node: Node, state: TState, ancestors: Node[]) => {
    w1(node, state, ancestors)
    w2(node, state, ancestors)
  }

const mapToObj = <T>(map: Map<string, T>) =>
  Array.from(map).reduce((obj, [k, v]) => Object.assign(obj, { [k]: v }), {})

export class SourceParser implements Parser<AcornOptions> {
  private chapter: Chapter
  private variant: Variant

  constructor(chapter: Chapter, variant: Variant) {
    this.chapter = chapter
    this.variant = variant
  }

  static tokenize(programStr: string, context: Context): Token[] {
    return [
      ...tokenizer(programStr, createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors))
    ]
  }

  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): es.Program | null {
    try {
      return acornParse(
        programStr,
        createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors, options)
      ) as unknown as es.Program
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(
          positionToSourceLocation((error as any).loc, options?.sourceFile),
          error.toString()
        )
      }

      if (throwOnError) throw error
      context.errors.push(error)
    }

    return null
  }

  validate(ast: es.Program, context: Context, throwOnError?: boolean): boolean {
    const validationWalkers: Map<string, AncestorWalkerFn<any>> = new Map()
    this.getDisallowedSyntaxes().forEach((syntaxNodeName: string) => {
      validationWalkers.set(syntaxNodeName, (node: Node, _state: any, _ancestors: [Node]) => {
        if (node.type != syntaxNodeName) return

        const error: DisallowedConstructError = new DisallowedConstructError(node)
        if (throwOnError) throw error
        context.errors.push(error)
      })
    })

    this.getLangRules()
      .map(rule => Object.entries(rule.checkers))
      .flat()
      .forEach(([syntaxNodeName, checker]) => {
        const langWalker: AncestorWalkerFn<any> = (node: Node, _state: any, ancestors: Node[]) => {
          const errors: SourceError[] = checker(node, ancestors)

          if (throwOnError && errors.length > 0) throw errors[0]
          errors.forEach(e => context.errors.push(e))
        }
        if (validationWalkers.has(syntaxNodeName)) {
          validationWalkers.set(
            syntaxNodeName,
            combineAncestorWalkers(validationWalkers.get(syntaxNodeName)!, langWalker)
          )
        } else {
          validationWalkers.set(syntaxNodeName, langWalker)
        }
      })

    ancestor(ast as Node, mapToObj(validationWalkers), undefined, undefined)
    return context.errors.length == 0
  }

  toString(): string {
    return `SourceParser{chapter: ${this.chapter}, variant: ${this.variant}}`
  }

  private getDisallowedSyntaxes(): string[] {
    return Object.entries(syntaxBlacklist).reduce(
      (acc, [nodeName, chapterAllowed]) =>
        this.chapter < chapterAllowed ? [...acc, nodeName] : acc,
      []
    )
  }

  private getLangRules(): Rule<Node>[] {
    return defaultRules.filter(
      (rule: Rule<Node>) =>
        !(
          (rule.disableFromChapter && this.chapter >= rule.disableFromChapter) ||
          (rule.disableForVariants && rule.disableForVariants.includes(this.variant))
        )
    )
  }
}
