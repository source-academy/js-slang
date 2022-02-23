import { DebuggerStatement, Literal, Program, SourceLocation } from 'estree'
import { RawSourceMap, SourceMapConsumer } from 'source-map'

import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from './constants'
import createContext from './createContext'
import {
  ConstAssignment,
  ExceptionError,
  InterruptedError,
  UndefinedVariable
} from './errors/errors'
import { RuntimeSourceError } from './errors/runtimeSourceError'
import { findDeclarationNode, findIdentifierNode } from './finder'
import { transpileToGPU } from './gpu/gpu'
import { evaluate } from './interpreter/interpreter'
import { nonDetEvaluate } from './interpreter/interpreter-non-det'
import { transpileToLazy } from './lazy/lazy'
import { looseParse, parse, parseAt, parseForNames, typedParse } from './parser/parser'
import { AsyncScheduler, NonDetScheduler, PreemptiveScheduler } from './schedulers'
import { getAllOccurrencesInScopeHelper, getScopeHelper } from './scope-refactoring'
import { areBreakpointsSet, setBreakpointAtLine } from './stdlib/inspector'
import {
  callee,
  getEvaluationSteps,
  getRedex,
  IStepperPropContents,
  redexify
} from './stepper/stepper'
import { sandboxedEval } from './transpiler/evalContainer'
import { reduceImportDeclarations, transpile } from './transpiler/transpiler'
import {
  Context,
  Error as ResultError,
  ExecutionMethod,
  Finished,
  ModuleContext,
  ModuleState,
  Result,
  Scheduler,
  SourceError,
  SVMProgram,
  TypeAnnotatedFuncDecl,
  TypeAnnotatedNode,
  Variant
} from './types'
import { locationDummyNode } from './utils/astCreator'
import { findNodeAt, simple } from './utils/walkers'
import { validateAndAnnotate } from './validator/validator'
import { assemble } from './vm/svml-assembler'
import { compileForConcurrent, compileToIns } from './vm/svml-compiler'
import { runWithProgram } from './vm/svml-machine'
export { SourceDocumentation } from './editors/ace/docTooltip'
import * as es from 'estree'

import { TimeoutError } from './errors/timeoutErrors'
import { isPotentialInfiniteLoop } from './infiniteLoops/errors'
import { testForInfiniteLoop } from './infiniteLoops/runtime'
// import { loadModuleTabs } from './modules/moduleLoader'
import { getKeywords, getProgramNames } from './name-extractor'
import { typeCheck } from './typeChecker/typeChecker'
import { forceIt } from './utils/operators'
import { typeToString } from './utils/stringify'
import { appendModuleTabsToContext } from './modules/moduleLoader'

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

const DEFAULT_OPTIONS: IOptions = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: 1000,
  executionMethod: 'auto',
  variant: 'default',
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true
}

// needed to work on browsers
if (typeof window !== 'undefined') {
  // @ts-ignore
  SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
  })
}

// deals with parsing error objects and converting them to strings (for repl at least)

let verboseErrors = false
const resolvedErrorPromise = Promise.resolve({ status: 'error' } as Result)

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

function convertNativeErrorToSourceError(
  error: Error,
  line: number | null,
  column: number | null,
  name: string | null
) {
  // brute-forced from MDN website for phrasing of errors from different browsers
  // FWIW node and chrome uses V8 so they'll have the same error messages
  // unable to test on other engines
  const assignmentToConst = [
    'invalid assignment to const',
    'Assignment to constant variable',
    'Assignment to const',
    'Redeclaration of const'
  ]
  const undefinedVariable = ['is not defined']

  const message = error.message
  if (name === null) {
    name = 'UNKNOWN'
  }

  function messageContains(possibleErrorMessages: string[]) {
    return possibleErrorMessages.some(errorMessage => message.includes(errorMessage))
  }

  if (messageContains(assignmentToConst)) {
    return new ConstAssignment(locationDummyNode(line!, column!), name)
  } else if (messageContains(undefinedVariable)) {
    return new UndefinedVariable(name, locationDummyNode(line!, column!))
  } else {
    const location =
      line === null || column === null
        ? UNKNOWN_LOCATION
        : {
            start: { line, column },
            end: { line: -1, column: -1 }
          }
    return new ExceptionError(error, location)
  }
}

let previousCode = ''
let isPreviousCodeTimeoutError = false

function determineExecutionMethod(theOptions: IOptions, context: Context, program: Program) {
  let isNativeRunnable
  if (theOptions.executionMethod === 'auto') {
    if (context.executionMethod === 'auto') {
      if (verboseErrors) {
        isNativeRunnable = false
      } else if (areBreakpointsSet()) {
        isNativeRunnable = false
      } else {
        let hasDeuggerStatement = false
        simple(program, {
          DebuggerStatement(node: DebuggerStatement) {
            hasDeuggerStatement = true
          }
        })
        isNativeRunnable = !hasDeuggerStatement
      }
      context.executionMethod = isNativeRunnable ? 'native' : 'interpreter'
    } else {
      isNativeRunnable = context.executionMethod === 'native'
    }
  } else {
    isNativeRunnable = theOptions.executionMethod === 'native'
    context.executionMethod = theOptions.executionMethod
  }
  return isNativeRunnable
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

/*
function appendModulesToContext(program: Program, context: Context): void {
  if (context.modules == null) context.modules = new Map<string, ModuleContext>();

  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') break
    const moduleName = (node.source.value as string).trim()
    
    // Load the module's tabs
    if (!context.modules.has(moduleName)) {
      let moduleContext = {
        state: null,
        tabs: loadModuleTabs(moduleName)
      }
      context.modules.set(moduleName, moduleContext)
    }
  }
} */

export async function runInContext(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  function getFirstLine(theCode: string) {
    const theProgramFirstExpression = parseAt(theCode, 0)

    if (theProgramFirstExpression && theProgramFirstExpression.type === 'Literal') {
      return (theProgramFirstExpression as unknown as Literal).value
    }

    return undefined
  }
  const theOptions: IOptions = { ...DEFAULT_OPTIONS, ...options }
  context.variant = determineVariant(context, options)
  context.errors = []

  verboseErrors = getFirstLine(code) === 'enable verbose'
  const program = parse(code, context)
  if (!program) {
    return resolvedErrorPromise
  }
  validateAndAnnotate(program as Program, context)
  context.unTypecheckedCode.push(code)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }

  if (context.variant === 'concurrent') {
    if (previousCode === code) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      context.nativeStorage.maxExecTime = theOptions.originalMaxExecTime
    }
    context.previousCode.unshift(code)
    previousCode = code
    try {
      return Promise.resolve({
        status: 'finished',
        context,
        value: runWithProgram(compileForConcurrent(program, context), context)
      })
    } catch (error) {
      if (error instanceof RuntimeSourceError || error instanceof ExceptionError) {
        context.errors.push(error) // use ExceptionErrors for non Source Errors
        return resolvedErrorPromise
      }
      context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
      return resolvedErrorPromise
    }
  }
  if (options.useSubst) {
    const steps = getEvaluationSteps(program, context, options.stepLimit)
    const redexedSteps: IStepperPropContents[] = []
    for (const step of steps) {
      const redex = getRedex(step[0], step[1])
      const redexed = redexify(step[0], step[1])
      redexedSteps.push({
        code: redexed[0],
        redex: redexed[1],
        explanation: step[2],
        function: callee(redex)
      })
    }
    return Promise.resolve({
      status: 'finished',
      context,
      value: redexedSteps
    })
  }

  const isNativeRunnable = determineExecutionMethod(theOptions, context, program)
  if (context.prelude !== null) {
    const prelude = context.prelude
    context.prelude = null
    await runInContext(prelude, context, { ...options, isPrelude: true })
    return runInContext(code, context, options)
  }
  if (isNativeRunnable) {
    if (previousCode === code && isPreviousCodeTimeoutError) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else if (!options.isPrelude) {
      context.nativeStorage.maxExecTime = theOptions.originalMaxExecTime
    }
    if (!options.isPrelude) {
      context.previousCode.unshift(code)
      previousCode = code
    }
    let transpiled
    let sourceMapJson: RawSourceMap | undefined
    try {
      reduceImportDeclarations(program);
      appendModuleTabsToContext(program, context)
      
      // Mutates program
      switch (context.variant) {
        case 'gpu':
          transpileToGPU(program)
          break
        case 'lazy':
          transpileToLazy(program)
          break
      }

      ({ transpiled, codeMap: sourceMapJson } = transpile(program, context))
      let value = await sandboxedEval(transpiled, context.nativeStorage, context.moduleParams, context.moduleContexts)

      if (context.variant === 'lazy') {
        value = forceIt(value)
      }

      if (!options.isPrelude) {
        isPreviousCodeTimeoutError = false
      }
      return Promise.resolve({
        status: 'finished',
        context,
        value
      })
    } catch (error) {
      const isDefaultVariant = options.variant === undefined || options.variant === 'default'
      if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
        const detectedInfiniteLoop = testForInfiniteLoop(code, context.previousCode.slice(1))
        if (detectedInfiniteLoop !== undefined) {
          if (theOptions.throwInfiniteLoops) {
            context.errors.push(detectedInfiniteLoop)
            return resolvedErrorPromise
          } else {
            error.infiniteLoopError = detectedInfiniteLoop
            if (error instanceof ExceptionError) {
              ;(error.error as any).infiniteLoopError = detectedInfiniteLoop
            }
          }
        }
      }
      if (error instanceof RuntimeSourceError) {
        context.errors.push(error)
        if (error instanceof TimeoutError) {
          isPreviousCodeTimeoutError = true
        }
        return resolvedErrorPromise
      }
      if (error instanceof ExceptionError) {
        // if we know the location of the error, just throw it
        if (error.location.start.line !== -1) {
          context.errors.push(error)
          return resolvedErrorPromise
        } else {
          error = error.error // else we try to get the location from source map
        }
      }
      const errorStack = error.stack
      const match = /<anonymous>:(\d+):(\d+)/.exec(errorStack)
      if (match === null) {
        context.errors.push(new ExceptionError(error, UNKNOWN_LOCATION))
        return resolvedErrorPromise
      }
      const line = Number(match![1])
      const column = Number(match![2])
      return SourceMapConsumer.with(sourceMapJson!, null, consumer => {
        const {
          line: originalLine,
          column: originalColumn,
          name
        } = consumer.originalPositionFor({
          line,
          column
        })
        context.errors.push(
          convertNativeErrorToSourceError(error, originalLine, originalColumn, name)
        )
        return resolvedErrorPromise
      })
    }
  } else {
    let it = evaluate(program, context)
    let scheduler: Scheduler
    if (context.variant === 'non-det') {
      it = nonDetEvaluate(program, context)
      scheduler = new NonDetScheduler()
    } else if (theOptions.scheduler === 'async') {
      scheduler = new AsyncScheduler()
    } else {
      scheduler = new PreemptiveScheduler(theOptions.steps)
    }
    return scheduler.run(it, context)
  }
}

/**
 * Small function to determine the variant to be used
 * by a program, as both context and options can have
 * a variant. The variant provided in options will
 * have precedence over the variant provided in context.
 *
 * @param context The context of the program.
 * @param options Options to be used when
 *                running the program.
 *
 * @returns The variant that the program is to be run in
 */
function determineVariant(context: Context, options: Partial<IOptions>): Variant {
  if (options.variant) {
    return options.variant
  } else {
    return context.variant
  }
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

export { createContext, Context, ModuleContext, ModuleState, Result, setBreakpointAtLine, assemble }
