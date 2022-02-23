/* tslint:disable:max-classes-per-file */
import {
  Options as AcornOptions,
  parse as acornParse,
  parseExpressionAt as acornParseAt,
  Position,
  tokenizer as acornTokenizer
} from 'acorn'
import { parse as acornLooseParse } from 'acorn-loose'
import * as es from 'estree'

import { ACORN_PARSE_OPTIONS } from '../constants'
import { Context, ErrorSeverity, ErrorType, Rule, SourceError } from '../types'
import { stripIndent } from '../utils/formatters'
import { ancestor, AncestorWalkerFn } from '../utils/walkers'
import { validateAndAnnotate } from '../validator/validator'
import rules from './rules'
import syntaxBlacklist from './syntaxBlacklist'

export class DisallowedConstructError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public nodeType: string

  constructor(public node: es.Node) {
    this.nodeType = this.formatNodeType(this.node.type)
  }

  get location() {
    return this.node.loc!
  }

  public explain() {
    return `${this.nodeType} are not allowed`
  }

  public elaborate() {
    return stripIndent`
      You are trying to use ${this.nodeType}, which is not allowed (yet).
    `
  }

  /**
   * Converts estree node.type into english
   * e.g. ThisExpression -> 'this' expressions
   *      Property -> Properties
   *      EmptyStatement -> Empty Statements
   */
  private formatNodeType(nodeType: string) {
    switch (nodeType) {
      case 'ThisExpression':
        return "'this' expressions"
      case 'Property':
        return 'Properties'
      default: {
        const words = nodeType.split(/(?=[A-Z])/)
        return words.map((word, i) => (i === 0 ? word : word.toLowerCase())).join(' ') + 's'
      }
    }
  }
}

export class FatalSyntaxError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public constructor(public location: es.SourceLocation, public message: string) {}

  public explain() {
    return this.message
  }

  public elaborate() {
    return 'There is a syntax error in your program'
  }
}

export class MissingSemicolonError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR
  public constructor(public location: es.SourceLocation) {}

  public explain() {
    return 'Missing semicolon at the end of statement'
  }

  public elaborate() {
    return 'Every statement must be terminated by a semicolon.'
  }
}

export class TrailingCommaError implements SourceError {
  public type: ErrorType.SYNTAX
  public severity: ErrorSeverity.WARNING
  public constructor(public location: es.SourceLocation) {}

  public explain() {
    return 'Trailing comma'
  }

  public elaborate() {
    return 'Please remove the trailing comma'
  }
}

export function parseAt(source: string, num: number) {
  let theNode: acorn.Node | undefined
  try {
    theNode = acornParseAt(source, num, ACORN_PARSE_OPTIONS)
  } catch (error) {
    return undefined
  }
  return theNode
}

export function parse(source: string, context: Context) {
  let program: es.Program | undefined
  try {
    program = acornParse(source, createAcornParserOptions(context)) as unknown as es.Program
    ancestor(program as es.Node, walkers, undefined, context)
  } catch (error) {
    if (error instanceof SyntaxError) {
      // tslint:disable-next-line:no-any
      const loc = (error as any).loc
      const location = {
        start: { line: loc.line, column: loc.column },
        end: { line: loc.line, column: loc.column + 1 }
      }
      context.errors.push(new FatalSyntaxError(location, error.toString()))
    } else {
      throw error
    }
  }
  const hasErrors = context.errors.find(m => m.severity === ErrorSeverity.ERROR)
  if (program && !hasErrors) {
    return program
  } else {
    return undefined
  }
}

export function tokenize(source: string, context: Context) {
  return [...acornTokenizer(source, createAcornParserOptions(context))]
}

export const createAcornParserOptions = (context: Context): AcornOptions => ({
  sourceType: 'module',
  ecmaVersion: 6,
  locations: true,
  // tslint:disable-next-line:no-any
  onInsertedSemicolon(end: any, loc: any) {
    context.errors.push(
      new MissingSemicolonError({
        end: { line: loc.line, column: loc.column + 1 },
        start: loc
      })
    )
  },
  // tslint:disable-next-line:no-any
  onTrailingComma(end: any, loc: Position) {
    context.errors.push(
      new TrailingCommaError({
        end: { line: loc.line, column: loc.column + 1 },
        start: loc
      })
    )
  }
})

// Names-extractor needs comments
export function parseForNames(source: string): [es.Program, acorn.Comment[]] {
  let comments: acorn.Comment[] = []
  const options: AcornOptions = {
    sourceType: 'module',
    ecmaVersion: 6,
    locations: true,
    onComment: comments
  }
  let program: es.Program | undefined
  try {
    program = acornParse(source, options) as unknown as es.Program
  } catch {
    comments = []
    program = acornLooseParse(source, options)
  }

  return [program, comments]
}

export function looseParse(source: string, context: Context) {
  const program = acornLooseParse(
    source,
    createAcornParserOptions(context)
  ) as unknown as es.Program
  return program
}

export function typedParse(code: any, context: Context) {
  const program: es.Program | undefined = looseParse(code, context)
  if (program === undefined) {
    return null
  }
  return validateAndAnnotate(program, context)
}

function createWalkers(
  allowedSyntaxes: { [nodeName: string]: number },
  parserRules: Rule<es.Node>[]
) {
  const newWalkers = new Map<string, AncestorWalkerFn<Context>>()
  const visitedNodes = new Set<es.Node>()

  // Provide callbacks checking for disallowed syntaxes, such as case, switch...
  const syntaxPairs = Object.entries(allowedSyntaxes)
  syntaxPairs.map(pair => {
    const syntax = pair[0]
    newWalkers.set(syntax, (node: es.Node, context: Context, ancestors: [es.Node]) => {
      if (!visitedNodes.has(node)) {
        visitedNodes.add(node)

        if (context.chapter < allowedSyntaxes[node.type]) {
          context.errors.push(new DisallowedConstructError(node))
        }
      }
    })
  })

  // Provide callbacks checking for rule violations, e.g. no block arrow funcs, nonempty lists...
  parserRules.forEach(rule => {
    const checkers = rule.checkers
    const syntaxCheckerPair = Object.entries(checkers)
    syntaxCheckerPair.forEach(pair => {
      const syntax = pair[0]
      const checker = pair[1]
      const oldCheck = newWalkers.get(syntax)!
      const newCheck = (node: es.Node, context: Context, ancestors: es.Node[]) => {
        if (typeof rule.disableOn !== 'undefined' && context.chapter >= rule.disableOn) {
          return
        }
        const errors = checker(node, ancestors)
        errors.forEach(e => context.errors.push(e))
      }
      newWalkers.set(syntax, (node: es.Node, context: Context<any>, ancestors: es.Node[]) => {
        oldCheck(node, context, ancestors)
        newCheck(node, context, ancestors)
      })
    })
  })

  return mapToObj(newWalkers)
}

const mapToObj = (map: Map<string, any>) =>
  Array.from(map).reduce((obj, [k, v]) => Object.assign(obj, { [k]: v }), {})

const walkers: { [name: string]: AncestorWalkerFn<Context> } = createWalkers(syntaxBlacklist, rules)
