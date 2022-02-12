import { SourceLocation } from 'estree'
import { SourceMapConsumer } from 'source-map'

import createContext from './createContext'
import { InterruptedError } from './errors/errors'
import { findDeclarationNode, findIdentifierNode } from './finder'
import { looseParse, parse, parseForNames, typedParse } from './parser/parser'
import { getAllOccurrencesInScopeHelper, getScopeHelper } from './scope-refactoring'
import { setBreakpointAtLine } from './stdlib/inspector'
import {
  Context,
  Error as ResultError,
  ExecutionMethod,
  Finished,
  Result,
  SourceError,
  SVMProgram,
  TypeAnnotatedFuncDecl,
  TypeAnnotatedNode,
  Variant
} from './types'
import { findNodeAt } from './utils/walkers'
import { assemble } from './vm/svml-assembler'
import { compileToIns } from './vm/svml-compiler'
export { SourceDocumentation } from './editors/ace/docTooltip'
import * as es from 'estree'

import { getKeywords, getProgramNames } from './name-extractor'
import { fullJSRunner, hasVerboseErrors, isFullJSChapter, sourceRunner } from './runner'
import { typeCheck } from './typeChecker/typeChecker'
import { typeToString } from './utils/stringify'

export interface IOptions {
  scheduler: 'preemptive' | 'async'
  steps: number
  stepLimit: number
  executionMethod: ExecutionMethod
  variant: Variant
  originalMaxExecTime: number
  useSubst: boolean
  isPrelude: boolean
  throwInfiniteLoops: boolean
}

// needed to work on browsers
if (typeof window !== 'undefined') {
  // @ts-ignore
  SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
  })
}

let verboseErrors: boolean = false

export function parseError(errors: SourceError[], verbose: boolean = verboseErrors): string {
  const errorMessagesArr = errors.map(error => {
    const line = error.location ? error.location.start.line : '<unknown>'
    const column = error.location ? error.location.start.column : '<unknown>'
    const explanation = error.explain()

    if (verbose) {
      // TODO currently elaboration is just tagged on to a new line after the error message itself. find a better
      // way to display it.
      const elaboration = error.elaborate()
      return line < 1
        ? explanation
        : `Line ${line}, Column ${column}: ${explanation}\n${elaboration}\n`
    } else {
      return line < 1 ? explanation : `Line ${line}: ${explanation}`
    }
  })
  return errorMessagesArr.join('\n')
}

export function findDeclaration(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation | null | undefined {
  const program = looseParse(code, context)
  if (!program) {
    return null
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return null
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (!declarationNode || identifierNode === declarationNode) {
    return null
  }
  return declarationNode.loc
}

export function getScope(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation[] {
  const program = looseParse(code, context)
  if (!program) {
    return []
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return []
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (!declarationNode || declarationNode.loc == null || identifierNode !== declarationNode) {
    return []
  }

  return getScopeHelper(declarationNode.loc, program, identifierNode.name)
}

export function getAllOccurrencesInScope(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): SourceLocation[] {
  const program = looseParse(code, context)
  if (!program) {
    return []
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return []
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (declarationNode == null || declarationNode.loc == null) {
    return []
  }
  return getAllOccurrencesInScopeHelper(declarationNode.loc, program, identifierNode.name)
}

export function hasDeclaration(
  code: string,
  context: Context,
  loc: { line: number; column: number }
): boolean {
  const program = looseParse(code, context)
  if (!program) {
    return false
  }
  const identifierNode = findIdentifierNode(program, context, loc)
  if (!identifierNode) {
    return false
  }
  const declarationNode = findDeclarationNode(program, identifierNode)
  if (declarationNode == null || declarationNode.loc == null) {
    return false
  }

  return true
}

export async function getNames(
  code: string,
  line: number,
  col: number,
  context: Context
): Promise<any> {
  const [program, comments] = parseForNames(code)

  if (!program) {
    return []
  }
  const cursorLoc: es.Position = { line, column: col }

  const [progNames, displaySuggestions] = getProgramNames(program, comments, cursorLoc)
  const keywords = getKeywords(program, cursorLoc, context)
  return [progNames.concat(keywords), displaySuggestions]
}

export function getTypeInformation(
  code: string,
  context: Context,
  loc: { line: number; column: number },
  name: string
): string {
  try {
    // parse the program into typed nodes and parse error
    const program = typedParse(code, context)
    if (program === null) {
      return ''
    }
    if (context.prelude !== null) {
      typeCheck(typedParse(context.prelude, context)!, context)
    }
    const [typedProgram, error] = typeCheck(program, context)
    const parsedError = parseError(error)
    if (context.prelude !== null) {
      // the env of the prelude was added, we now need to remove it
      context.typeEnvironment.pop()
    }

    // initialize the ans string
    let ans = ''
    if (parsedError) {
      ans += parsedError + '\n'
    }
    if (!typedProgram) {
      return ans
    }

    // get name of the node
    const getName = (typedNode: TypeAnnotatedNode<es.Node>) => {
      let nodeId = ''
      if (typedNode.type) {
        if (typedNode.type === 'FunctionDeclaration') {
          nodeId = typedNode.id?.name!
        } else if (typedNode.type === 'VariableDeclaration') {
          nodeId = (typedNode.declarations[0].id as es.Identifier).name
        } else if (typedNode.type === 'Identifier') {
          nodeId = typedNode.name
        }
      }
      return nodeId
    }

    // callback function for findNodeAt function
    function findByLocationPredicate(t: string, nd: TypeAnnotatedNode<es.Node>) {
      if (!nd.inferredType) {
        return false
      }

      const isInLoc = (nodeLoc: SourceLocation): boolean => {
        return !(
          nodeLoc.start.line > loc.line ||
          nodeLoc.end.line < loc.line ||
          (nodeLoc.start.line === loc.line && nodeLoc.start.column > loc.column) ||
          (nodeLoc.end.line === loc.line && nodeLoc.end.column < loc.column)
        )
      }

      const location = nd.loc
      if (nd.type && location) {
        return getName(nd) === name && isInLoc(location)
      }
      return false
    }

    // report both as the type inference

    const res = findNodeAt(typedProgram, undefined, undefined, findByLocationPredicate)

    if (res === undefined) {
      return ans
    }

    const node: TypeAnnotatedNode<es.Node> = res.node

    if (node === undefined) {
      return ans
    }

    const actualNode =
      node.type === 'VariableDeclaration'
        ? (node.declarations[0].init! as TypeAnnotatedNode<es.Node>)
        : node
    const type = typeToString(
      actualNode.type === 'FunctionDeclaration'
        ? (actualNode as TypeAnnotatedFuncDecl).functionInferredType!
        : actualNode.inferredType!
    )
    return ans + `At Line ${loc.line} => ${getName(node)}: ${type}`
  } catch (error) {
    return ''
  }
}

export async function runInContext(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  if (isFullJSChapter(context.chapter)) {
    return fullJSRunner(code, context, options)
  }

  verboseErrors = hasVerboseErrors(code)
  return sourceRunner(code, context, verboseErrors, options)
}

export function resume(result: Result): Finished | ResultError | Promise<Result> {
  if (result.status === 'finished' || result.status === 'error') {
    return result
  } else {
    return result.scheduler.run(result.it, result.context)
  }
}

export function interrupt(context: Context) {
  const globalEnvironment = context.runtime.environments[context.runtime.environments.length - 1]
  context.runtime.environments = [globalEnvironment]
  context.runtime.isRunning = false
  context.errors.push(new InterruptedError(context.runtime.nodes[0]))
}

export function compile(
  code: string,
  context: Context,
  vmInternalFunctions?: string[]
): SVMProgram | undefined {
  const astProgram = parse(code, context)
  if (!astProgram) {
    return undefined
  }

  try {
    return compileToIns(astProgram, undefined, vmInternalFunctions)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }
}

export { assemble, Context, createContext, Result, setBreakpointAtLine }
