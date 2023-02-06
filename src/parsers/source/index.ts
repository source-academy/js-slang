import { Options, parse as acornParse, Position, SourceLocation } from 'acorn'
import { Node as ESNode, Program } from 'estree'

import { Chapter, Context, Rule, SourceError, Variant } from '../../types'
import { ancestor, AncestorWalkerFn } from '../../utils/walkers'
import { Parser } from '../types'
import {
  DisallowedConstructError,
  FatalSyntaxError,
  MissingSemicolonError,
  TrailingCommaError
} from './errors'
import defaultRules from './rules'
import syntaxBlacklist from './syntax'

const toSourceLocation = (position: Position): SourceLocation => ({
  start: position,
  end: { ...position, column: position.column + 1 }
})

const combineAncestorWalkers =
  <TState>(w1: AncestorWalkerFn<TState>, w2: AncestorWalkerFn<TState>): AncestorWalkerFn<TState> =>
  (node: ESNode, state: TState, ancestors: ESNode[]) => {
    w1(node, state, ancestors)
    w2(node, state, ancestors)
  }

const mapToObj = <T>(map: Map<string, T>) =>
  Array.from(map).reduce((obj, [k, v]) => Object.assign(obj, { [k]: v }), {})

export class SourceParser implements Parser {
  static defaultAcornOptions: Options = {
    sourceType: 'module',
    ecmaVersion: 6,
    locations: true,
    onInsertedSemicolon(_tokenEndPos: number, tokenPos: Position) {
      throw new MissingSemicolonError(toSourceLocation(tokenPos))
    },
    onTrailingComma(_tokenEndPos: number, tokenPos: Position) {
      throw new TrailingCommaError(toSourceLocation(tokenPos))
    }
  }

  private chapter: Chapter
  private variant: Variant

  constructor(chapter: Chapter, variant: Variant) {
    this.chapter = chapter
    this.variant = variant
  }

  parse(programStr: string, context: Context, throwOnError?: boolean): Program | null {
    try {
      return acornParse(programStr, SourceParser.defaultAcornOptions) as unknown as Program
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(toSourceLocation((error as any).loc), error.toString())
      }

      if (throwOnError) throw error
      context.errors.push(error)
    }

    return null
  }

  validate(ast: Program, context: Context, throwOnError?: boolean): boolean {
    const validationWalkers: Map<string, AncestorWalkerFn<any>> = new Map()
    this.getDisallowedSyntaxes().forEach((syntaxNodeName: string) => {
      validationWalkers.set(syntaxNodeName, (node: ESNode, _state: any, _ancestors: [ESNode]) => {
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
        const langWalker: AncestorWalkerFn<any> = (
          node: ESNode,
          _state: any,
          ancestors: ESNode[]
        ) => {
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

    ancestor(ast as ESNode, mapToObj(validationWalkers), undefined, undefined)
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

  private getLangRules(): Rule<ESNode>[] {
    return defaultRules.filter(
      (rule: Rule<ESNode>) =>
        !(
          (rule.disableFromChapter && this.chapter >= rule.disableFromChapter) ||
          (rule.disableForVariants && rule.disableForVariants.includes(this.variant))
        )
    )
  }
}
