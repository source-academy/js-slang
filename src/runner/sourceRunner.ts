import type * as es from 'estree'
import * as _ from 'lodash'
import type { RawSourceMap } from 'source-map'

import { type IOptions, type Result } from '..'
import { JSSLANG_PROPERTIES, UNKNOWN_LOCATION } from '../constants'
import { CSEResultPromise, evaluate as CSEvaluate } from '../cse-machine/interpreter'
import { ExceptionError } from '../errors/errors'
import { CannotFindModuleError } from '../errors/localImportErrors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { TimeoutError } from '../errors/timeoutErrors'
import { transpileToGPU } from '../gpu/gpu'
import { isPotentialInfiniteLoop } from '../infiniteLoops/errors'
import { testForInfiniteLoop } from '../infiniteLoops/runtime'
import { evaluateProgram as evaluate } from '../interpreter/interpreter'
import { nonDetEvaluate } from '../interpreter/interpreter-non-det'
import { transpileToLazy } from '../lazy/lazy'
import preprocessFileImports from '../localImports/preprocessor'
import { getRequireProvider } from '../modules/requireProvider'
import { parse } from '../parser/parser'
import { AsyncScheduler, NonDetScheduler, PreemptiveScheduler } from '../schedulers'
import {
  callee,
  getEvaluationSteps,
  getRedex,
  IStepperPropContents,
  redexify
} from '../stepper/stepper'
import { sandboxedEval } from '../transpiler/evalContainer'
import { transpile } from '../transpiler/transpiler'
import { Context, Node, RecursivePartial, Scheduler, StatementSequence, Variant } from '../types'
import { forceIt } from '../utils/operators'
import { validateAndAnnotate } from '../validator/validator'
import { compileForConcurrent } from '../vm/svml-compiler'
import { runWithProgram } from '../vm/svml-machine'
import { determineExecutionMethod, hasVerboseErrors } from '.'
import { toSourceError } from './errors'
import { fullJSRunner } from './fullJSRunner'
import { determineVariant, resolvedErrorPromise } from './utils'
import * as ast from '../utils/astCreator'

const DEFAULT_SOURCE_OPTIONS: Readonly<IOptions> = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: -1,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true,
  envSteps: -1,
  importOptions: {
    wrapSourceModules: true,
    checkImports: true,
    loadTabs: true
  }
}

let previousCode: {
  files: Partial<Record<string, string>>
  entrypointFilePath: string
} | null = null
let isPreviousCodeTimeoutError = false

function runConcurrent(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  if (context.shouldIncreaseEvaluationTimeout) {
    context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
  } else {
    context.nativeStorage.maxExecTime = options.originalMaxExecTime
  }

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

async function runSubstitution(
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  const steps = await getEvaluationSteps(program, context, options)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }
  const redexedSteps: IStepperPropContents[] = []
  for (const step of steps) {
    const redex = getRedex(step[0], step[1])
    const redexed = redexify(step[0], step[1])
    redexedSteps.push({
      code: redexed[0],
      redex: redexed[1],
      explanation: step[2],
      function: callee(redex, context)
    })
  }
  return {
    status: 'finished',
    context,
    value: redexedSteps
  }
}

function runInterpreter(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  let it = evaluate(program, context, true, true)
  let scheduler: Scheduler
  if (context.variant === Variant.NON_DET) {
    it = nonDetEvaluate(program, context)
    scheduler = new NonDetScheduler()
  } else if (options.scheduler === 'async') {
    scheduler = new AsyncScheduler()
  } else {
    scheduler = new PreemptiveScheduler(options.steps)
  }
  return scheduler.run(it, context)
}

async function runNative(
  program: es.Program,
  context: Context,
  options: IOptions
): Promise<Result> {
  if (!options.isPrelude) {
    if (context.shouldIncreaseEvaluationTimeout && isPreviousCodeTimeoutError) {
      context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy
    } else {
      context.nativeStorage.maxExecTime = options.originalMaxExecTime
    }
  }

  // For whatever reason, the transpiler mutates the state of the AST as it is transpiling and inserts
  // a bunch of global identifiers to it. Once that happens, the infinite loop detection instrumentation
  // ends up generating code that has syntax errors. As such, we need to make a deep copy here to preserve
  // the original AST for future use, such as with the infinite loop detector.
  const transpiledProgram = _.cloneDeep(program)
  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    switch (context.variant) {
      case Variant.GPU:
        transpileToGPU(transpiledProgram)
        break
      case Variant.LAZY:
        transpileToLazy(transpiledProgram)
        break
    }

    ;({ transpiled, sourceMapJson } = await transpile(
      transpiledProgram,
      context,
      options.importOptions
    ))
    let value = await sandboxedEval(transpiled, getRequireProvider(context), context.nativeStorage)

    if (context.variant === Variant.LAZY) {
      value = forceIt(value)
    }

    if (!options.isPrelude) {
      isPreviousCodeTimeoutError = false
    }

    return {
      status: 'finished',
      context,
      value
    }
  } catch (error) {
    const isDefaultVariant = options.variant === undefined || options.variant === Variant.DEFAULT
    if (isDefaultVariant && isPotentialInfiniteLoop(error)) {
      const detectedInfiniteLoop = await testForInfiniteLoop(
        program,
        context.previousPrograms.slice(1)
      )
      if (detectedInfiniteLoop !== undefined) {
        if (options.throwInfiniteLoops) {
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

    const sourceError = await toSourceError(error, sourceMapJson)
    context.errors.push(sourceError)
    return resolvedErrorPromise
  }
}

function runCSEMachine(program: es.Program, context: Context, options: IOptions): Promise<Result> {
  const value = CSEvaluate(program, context, options)
  return CSEResultPromise(context, value)
}

function hasDeclarations(node: es.BlockStatement): boolean {
  for (const statement of node.body) {
    if (statement.type === 'VariableDeclaration' || statement.type === 'FunctionDeclaration') {
      return true
    }
  }
  return false
}

type NodeTransformer = (node : Node) => Node

type ASTTransformers = Map<string,  NodeTransformer>

const transformers: ASTTransformers = new Map<string, NodeTransformer>([
  [
    'Program',
    (node: es.Program) => {
      node.body.map((x) => transform(x))
      return node
    }
  ],

  [
    'BlockStatement',
    (node: es.BlockStatement) => {
      node.body.map((x : Node) => transform(x))
      if (hasDeclarations(node)) {
        return ast.statementSequence(node.body, node.loc)
      } 
      else { 
        return node
      }
    }
  ],

  [
    'StatementSequence',
    (node: StatementSequence) => {
      node.body.map((x : Node) => transform(x))
      return node
    }
  ],

  [
    'ExpressionStatement',
    (node: es.ExpressionStatement) => {
      node.expression = transform(node.expression)
      return node
    }
  ],

  [
    'IfStatement',
    (node: es.IfStatement) => {
      node.test = transform(node.test)
      node.consequent = transform(node.consequent)
      if (node.alternate) {
        node.alternate = transform(node.alternate)
      }
      return node
    }
  ],

  [
    'FunctionDeclaration',
    (node: es.FunctionDeclaration) => {
      node.params.map((x : Node) => transform(node))
      node.body = transform(node.body)
      if (node.id) {
        node.id = transform(node.id)
      }
      return node
    }
  ],
  
  [
    'VariableDeclarator',
    (node: es.VariableDeclarator) => {
      node.id = transform(node.id)
      if (node.init) {
        node.init = transform(node.init)
      }
      return node
    }
  ],

  [
    'VariableDeclaration',
    (node: es.VariableDeclaration) => {
      node.declarations.map((x : Node) => transform(node))
      return node
    }
  ],

  [
    'ReturnStatement',
    (node: es.ReturnStatement) => {
      if (node.argument) {
        node.argument = transform(node.argument)
      }
      return node
    }
  ],

  [
    'CallExpression',
    (node: es.SimpleCallExpression) => {
      node.callee = transform(node.callee)
      node.arguments.map((x : Node) => transform(x))
      return node
    }
  ],

  [
    'UnaryExpression',
    (node: es.UnaryExpression) => {
      node.argument = transform(node.argument)
      return node
    }
  ],

  [
    'BinaryExpression',
    (node: es.BinaryExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'LogicalExpression',
    (node: es.LogicalExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'ConditionalExpression',
    (node: es.ConditionalExpression) => {
      node.test = transform(node.test)
      node.consequent = transform(node.consequent)
      node.alternate = transform(node.alternate)
      return node
    }
  ],

  [
    'ArrowFunctionExpression',
    (node: es.ArrowFunctionExpression) => {
      node.params.map((x : Node) => transform(x))
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'Identifier',
    (node: es.Identifier) => {
      return node
    }
  ],

  [
    'Literal',
    (node: es.Literal) => {
      return node
    }
  ],

  [
    'ArrayExpression',
    (node: es.ArrayExpression) => {
      node.elements.map((x : Node | null) => (x) ? transform(x) : null)
      return node
    }
  ],

  [
    'AssignmentExpression',
    (node: es.AssignmentExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'ForStatement',
    (node: es.ForStatement) => {
      if (node.init) {
        node.init = transform(node.init)
      }
      if (node.test) {
        node.test = transform(node.test)
      }
      if (node.update) {
        node.update = transform(node.update)
      }
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'WhileStatement',
    (node: es.WhileStatement) => {
      node.test = transform(node.test)
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'BreakStatement',
    (node: es.BreakStatement) => {
      if (node.label) {
        node.label = transform(node.label)
      }
      return node
    }
  ],

  [
    'ContinueStatement',
    (node: es.ContinueStatement) => {
      if (node.label) {
        node.label = transform(node.label)
      }
      return node
    }
  ],

  [
    'ObjectExpression',
    (node: es.ObjectExpression) => {
      node.properties.map((x : Node) => transform(x))
      return node
    }
  ],

  [
    'MemberExpression',
    (node: es.MemberExpression) => {
      node.object = transform(node.object)
      node.property = transform(node.property)
      return node
    }
  ],

  [
    'Property',
    (node: es.Property) => {
      node.key = transform(node.key)
      node.value = transform(node.value)
      return node
    }
  ],

  [
    'ImportDeclaration',
    (node: es.ImportDeclaration) => {
      node.specifiers.map((x : Node) => transform(x))
      node.source = transform(node.source)
      return node
    }
  ],

  [
    'ImportSpecifier',
    (node: es.ImportSpecifier) => {
      node.local = transform(node.local)
      node.imported = transform(node.imported)
      return node
    }
  ],

  [
    'ImportDefaultSpecifier',
    (node: es.ImportDefaultSpecifier) => {
      node.local = transform(node.local)
      return node
    }
  ],

  [
    'ExportNamedDeclaration',
    (node: es.ExportNamedDeclaration) => {
      if (node.declaration) {
        node.declaration = transform(node.declaration)
      }
      node.specifiers.map((x : Node) => transform(x))
      if (node.source) {
        transform(node.source)
      }
      return node
    }
  ],

  [
    'ExportDefaultDeclaration',
    (node: es.ExportDefaultDeclaration) => {
      node.declaration = transform(node.declaration)
      return node
    }
  ],

  [
    'ExportSpecifier',
    (node: es.ExportSpecifier) => {
      node.local = transform(node.local)
      node.exported = transform(node.exported)
      return node
    }
  ],

  [
    'ClassDeclaration',
    (node: es.ClassDeclaration) => {
      if (node.id) {
        node.id = transform(node.id)
      }
      if (node.superClass) {
        node.superClass = transform(node.superClass)
      }
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'NewExpression',
    (node: es.NewExpression) => {
      node.arguments.map((x : Node) => transform(x))
      return node
    }
  ],

  [
    'MethodDefinition',
    (node: es.MethodDefinition) => {
      node.key = transform(node.key)
      node.value = transform(node.value)
      return node
    }
  ],

  [
    'FunctionExpression',
    (node: es.FunctionExpression) => {
      if (node.id) {
        node.id = transform(node.id)
      }
      node.params.map((x : Node) => transform(x))
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'ThisExpression',
    (_node: es.ThisExpression) => {
      return _node
    }
  ],

  [
    'Super',
    (_node: es.Super) => {
      return _node
    }
  ],

  [
    'TryStatement',
    (node: es.TryStatement) => {
      node.block = transform(node.block)
      if (node.handler) {
        node.handler = transform(node.handler)
      }
      if (node.finalizer) {
        node.finalizer = transform(node.finalizer)
      }
      return node
    }
  ],
  [
    'ThrowStatement',
    (node: es.ThrowStatement) => {
      node.argument = transform(node.argument)
      return node
    }
  ],
  [
    'SpreadElement',
    (node: es.SpreadElement) => {
      node.argument = transform(node.argument)
      return node
    }
  ],
  [
    'RestElement',
    (node: es.RestElement) => {
      node.argument = transform(node.argument)
      return node
    }
  ]
])

function transform<NodeType extends Node>(node: NodeType) : NodeType {
  if (transformers.has(node.type)) {
    const transformer = transformers.get(node.type) as (n: NodeType) => NodeType
    const transformed = transformer(node)
    return transformed
  } else {
    return node
  }
}

export async function sourceRunner(
  program: es.Program,
  context: Context,
  isVerboseErrorsEnabled: boolean,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  // It is necessary to make a copy of the DEFAULT_SOURCE_OPTIONS object because merge()
  // will modify it rather than create a new object
  const theOptions = _.merge({ ...DEFAULT_SOURCE_OPTIONS }, options)
  context.variant = determineVariant(context, options)

  validateAndAnnotate(program, context)
  if (context.errors.length > 0) {
    return resolvedErrorPromise
  }
  const transformedProgram = transform(program)

  if (context.variant === Variant.CONCURRENT) {
    return runConcurrent(program, context, theOptions)
  }

  if (theOptions.useSubst) {
    return runSubstitution(program, context, theOptions)
  }

  determineExecutionMethod(theOptions, context, program, isVerboseErrorsEnabled)

  // native, don't evaluate prelude
  if (context.executionMethod === 'native' && context.variant === Variant.NATIVE) {
    return await fullJSRunner(program, context, theOptions.importOptions)
  }

  // All runners after this point evaluate the prelude.
  if (context.prelude !== null) {
    context.unTypecheckedCode.push(context.prelude)
    const prelude = parse(context.prelude, context)
    if (prelude === null) {
      return resolvedErrorPromise
    }
    context.prelude = null
    await sourceRunner(prelude, context, isVerboseErrorsEnabled, { ...options, isPrelude: true })
    return sourceRunner(program, context, isVerboseErrorsEnabled, options)
  }

  // testing AST transform with CSE machine first
  if (context.variant === Variant.EXPLICIT_CONTROL) {
    return runCSEMachine(transformedProgram, context, theOptions)
  }

  if (context.executionMethod === 'cse-machine') {
    if (options.isPrelude) {
      return runCSEMachine(
        transformedProgram,
        { ...context, runtime: { ...context.runtime, debuggerOn: false } },
        theOptions
      )
    }
    return runCSEMachine(transformedProgram, context, theOptions)
  }

  if (context.executionMethod === 'native') {
    return runNative(program, context, theOptions)
  }

  return runInterpreter(program!, context, theOptions)
}

export async function sourceFilesRunner(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
  const entrypointCode = files[entrypointFilePath]
  if (entrypointCode === undefined) {
    context.errors.push(new CannotFindModuleError(entrypointFilePath))
    return resolvedErrorPromise
  }

  const isVerboseErrorsEnabled = hasVerboseErrors(entrypointCode)

  context.variant = determineVariant(context, options)
  // FIXME: The type checker does not support the typing of multiple files, so
  //        we only push the code in the entrypoint file. Ideally, all files
  //        involved in the program evaluation should be type-checked. Either way,
  //        the type checker is currently not used at all so this is not very
  //        urgent.
  context.unTypecheckedCode.push(entrypointCode)

  const currentCode = {
    files,
    entrypointFilePath
  }
  context.shouldIncreaseEvaluationTimeout = _.isEqual(previousCode, currentCode)
  previousCode = currentCode

  const preprocessedProgram = preprocessFileImports(files, entrypointFilePath, context)
  if (!preprocessedProgram) {
    return resolvedErrorPromise
  }
  context.previousPrograms.unshift(preprocessedProgram)

  return sourceRunner(preprocessedProgram, context, isVerboseErrorsEnabled, options)
}
