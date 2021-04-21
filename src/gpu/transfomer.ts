import * as es from 'estree'
import { ancestor, simple, make } from '../utils/walkers'
import * as create from '../utils/astCreator'
import GPULoopVerifier from './verification/loopVerifier'
import GPUBodyVerifier from './verification/bodyVerifier'

let currentKernelId = 0
/*
 * GPU Transformer runs through the program and transpiles for loops to GPU code
 * Upon termination, the AST would be mutated accordingly
 * e.g.
 * let res = [];
 * for (let i = 0; i < 5; i = i + 1) {
 *    res[i] = 5;
 * }
 * would become:
 * let res = 0;
 * __createKernelSource(....)
 */
class GPUTransformer {
  // program to mutate
  program: es.Program

  // helps reference the main function
  globalIds: { __createKernelSource: es.Identifier }

  outputArray: es.Identifier
  innerBody: any

  // info about the for loops
  counters: string[]
  end: es.Expression[]
  steps: es.Expression[]
  initials: es.Expression[]
  operators: es.BinaryOperator[]

  state: number
  indices: (string | number)[]
  localVar: Set<string>
  outerVariables: any
  targetBody: any

  constructor(program: es.Program, createKernelSource: es.Identifier) {
    this.program = program
    this.globalIds = {
      __createKernelSource: createKernelSource
    }
  }

  // transforms away top-level for loops if possible
  transform = (): number[][] => {
    const gpuTranspile = this.gpuTranspile
    const res: number[][] = []

    // tslint:disable
    simple(
      this.program,
      {
        ForStatement(node: es.ForStatement) {
          const state = gpuTranspile(node)
          if (state > 0 && node.loc) {
            res.push([node.loc.start.line, state])
          }
        }
      },
      make({ ForStatement: () => {} })
    )
    // tslint:enable

    return res
  }

  /*
   * Here we transpile away a for loop:
   * 1. Check if it meets our specifications
   * 2. Get external variables + target body (body to be run across gpu threads)
   * 3. Build a AST Node for (2) - this will be given to (8)
   * 4. Change assignment in body to a return statement
   * 5. Get all function expressions that are used in the body
   * 6. Get outer indices that are not going to be parallelised
   * 7. Get loops which are not going to be parallelised
   * 8. Call __createKernelSource
   * 9. Reassign results from GPU.js into the array
   */
  gpuTranspile = (node: es.ForStatement): number => {
    // initialize our class variables
    this.state = 0
    this.counters = []
    this.end = []
    this.initials = []
    this.steps = []
    this.operators = []

    // 1. verification of outer loops + body
    this.checkOuterLoops(node)
    // no gpu loops found
    if (this.counters.length === 0 || new Set(this.counters).size !== this.counters.length) {
      return 0
    }

    const verifier = new GPUBodyVerifier(this.program, this.innerBody, this.counters)
    if (!verifier.valid) {
      return 0
    }

    this.outputArray = verifier.outputArray
    this.indices = verifier.indices
    this.localVar = verifier.localVar

    // 2. get external variables + the main body
    this.getOuterVariables()
    this.getTargetBody(node)

    // 3. Build a AST Node of all outer variables
    const functionNames = new Set(verifier.customFunctions.keys())

    const externEntries: [es.Literal, es.Expression][] = []
    for (const key in this.outerVariables) {
      if (functionNames.has(key)) {
        // ignore functions as we handle them separately later
        continue
      }
      if (this.outerVariables.hasOwnProperty(key)) {
        const val = this.outerVariables[key]

        // push in a deep copy of the identifier
        // this is needed cos we modify it later
        externEntries.push([create.literal(key), JSON.parse(JSON.stringify(val))])
      }
    }

    // 4. Change assignment in body to a return statement
    const checker = verifier.getArrayName
    const locals = this.localVar
    ancestor(this.targetBody, {
      AssignmentExpression(nx: es.AssignmentExpression, ancstor: es.Node[]) {
        // assigning to local val, it's okay
        if (nx.left.type === 'Identifier') {
          return
        }

        if (nx.left.type !== 'MemberExpression') {
          return
        }

        const id = checker(nx.left)
        if (locals.has(id.name)) {
          return
        }

        const sz = ancstor.length
        create.mutateToReturnStatement(ancstor[sz - 2], nx.right)
      }
    })

    // 5. get all custom functions used
    const functionEntries: [es.Literal, es.Expression][] = []
    for (const [functionName, functionDeclaration] of verifier.customFunctions) {
      functionEntries.push([
        create.literal(functionName),
        JSON.parse(JSON.stringify(functionDeclaration.id))
      ])
    }

    // 6. We need to keep the outer indices that will not be parallelized
    const toParallelize: (string | number)[] = []
    let countersUsed = 0
    for (let i = this.indices.length - 1; i >= 0; i--) {
      const m = this.indices[i]
      if (typeof m === 'string' && this.counters.includes(m)) {
        countersUsed++
      }
      if (countersUsed > 3) {
        break
      }
      toParallelize.push(m)
    }
    toParallelize.reverse()
    const toKeepIndices = []
    for (let i = 0; i < this.indices.length - toParallelize.length; i++) {
      toKeepIndices.push(this.indices[i])
    }

    // 7. we need to keep the loops whose counters are not parallelized
    const toKeepForStatements = []
    const untranspiledCounters: string[] = []
    let currForLoop = node
    while (currForLoop.type === 'ForStatement') {
      const init = currForLoop.init as es.VariableDeclaration
      const ctr = init.declarations[0].id as es.Identifier

      if (toKeepIndices.includes(ctr.name)) {
        toKeepForStatements.push(currForLoop)
        untranspiledCounters.push(ctr.name)
      } else {
        // tranpile away for statement
        this.state++
      }

      if (currForLoop.body.type !== 'BlockStatement') {
        break
      }
      if (currForLoop.body.body.length > 1 || currForLoop.body.body.length === 0) {
        break
      }

      currForLoop = currForLoop.body.body[0] as any
    }

    // 8. we transpile the loop to a function call, __createKernelSource
    const makeCreateKernelSourceCall = (arr: es.Identifier): es.CallExpression => {
      const ctrToTranspile = []
      const endToTranspile = []
      const initialToTranspile = []
      const stepToTranspile = []
      const operatorToTranspile = []
      for (let i = 0; i < this.counters.length; i++) {
        if (!untranspiledCounters.includes(this.counters[i])) {
          ctrToTranspile.push(this.counters[i])
          endToTranspile.push(this.end[i])
          initialToTranspile.push(this.initials[i])
          stepToTranspile.push(this.steps[i])
          operatorToTranspile.push(this.operators[i])
        }
      }

      // we now treat the untranspiled counters as external variables
      // if same name is encountered, the loop counter will override the
      // external variable in the outer scope
      for (const c of untranspiledCounters) {
        for (let i = 0; i < externEntries.length; i++) {
          if (externEntries[i][0].value === c) {
            externEntries.splice(i, 1)
          }
        }
        const x: [es.Literal, es.Expression] = [
          create.literal(c, node.loc),
          create.identifier(c, node.loc)
        ]
        externEntries.push(x)
      }

      const kernelFunction = create.blockArrowFunction(
        ctrToTranspile.map(x => create.identifier(x)),
        this.targetBody
      )
      return create.callExpression(
        this.globalIds.__createKernelSource,
        [
          create.arrayExpression(ctrToTranspile.map(x => create.literal(x))),
          create.arrayExpression(endToTranspile),
          create.arrayExpression(initialToTranspile),
          create.arrayExpression(stepToTranspile),
          create.arrayExpression(operatorToTranspile.map(x => create.literal(x))),
          create.arrayExpression(toParallelize.map(x => create.literal(x))),
          create.arrayExpression(externEntries.map(create.arrayExpression)),
          create.arrayExpression(Array.from(locals.values()).map(v => create.literal(v))),
          arr,
          kernelFunction,
          create.literal(currentKernelId++),
          create.arrayExpression(functionEntries.map(create.arrayExpression))
        ],
        node.loc!
      )
    }

    // 9. we rebuild the node, keeping the necessary for statements
    if (toKeepIndices.length === 0) {
      create.mutateToExpressionStatement(node, makeCreateKernelSourceCall(this.outputArray))
      return this.state
    }

    // keep necessary outer indices
    let mem: es.MemberExpression | es.Identifier = this.outputArray
    for (const m of toKeepIndices) {
      mem = create.memberExpression(mem, m, true, node.loc)
    }
    // we need to assign GPU.js results to a subarray now
    const subarr = create.constantDeclaration('__arr', mem)
    const call = makeCreateKernelSourceCall(create.identifier('__arr'))

    // keep necessary for statements
    let body = create.blockStatement([subarr, create.expressionStatement(call)])
    for (let i = toKeepForStatements.length - 1; i > 0; i--) {
      const cur = toKeepForStatements[i]
      body = create.blockStatement([
        create.ForStatement(cur.init, cur.test, cur.update, body, cur.loc)
      ])
    }
    const last = toKeepForStatements[0]
    create.mutateToForStatement(node, last.init, last.test, last.update, body)

    return this.state
  }

  // verification of outer loops using our verifier
  checkOuterLoops = (node: es.ForStatement) => {
    let currForLoop = node
    while (currForLoop.type === 'ForStatement') {
      const detector = new GPULoopVerifier(currForLoop)
      if (!detector.ok) {
        break
      }

      this.innerBody = currForLoop.body
      this.counters.push(detector.counter)
      this.end.push(detector.end)
      this.initials.push(detector.initial)
      this.steps.push(detector.step)
      this.operators.push(detector.operator)

      if (this.innerBody.type !== 'BlockStatement') {
        break
      }

      if (this.innerBody.body.length > 1 || this.innerBody.body.length === 0) {
        break
      }

      currForLoop = this.innerBody.body[0]
    }
  }

  /*
   * Based on state, gets the correct body to be run across threads
   * e.g. state = 2 (2 top level loops skipped)
   * for (...) {
   *    for (...) {
   *      let x = 1;
   *      res[i] = x + 1
   *    }
   * }
   *
   * returns:
   *
   * {
   *  let x = 1;
   *  res[i] = x + 1
   * }
   */
  getTargetBody(node: es.ForStatement) {
    // get rid of all outer loops
    let mv = this.counters.length
    this.targetBody = node
    while (mv > 1) {
      this.targetBody = this.targetBody.body.body[0]
      mv--
    }
    this.targetBody = this.targetBody.body
  }

  // get all variables defined outside the block (on right hand side)
  // TODO: method can be more optimized
  getOuterVariables() {
    // set some local variables for walking
    const curr = this.innerBody
    const localVar = this.localVar
    const counters = this.counters
    const output = this.outputArray.name

    const varDefinitions = {}
    simple(curr, {
      Identifier(node: es.Identifier) {
        if (
          localVar.has(node.name) ||
          counters.includes(node.name) ||
          node.name === output ||
          node.name.startsWith('math_')
        ) {
          return
        }

        varDefinitions[node.name] = node
      }
    })
    this.outerVariables = varDefinitions
  }
}

/*
 * Here we transpile a source-syntax custom function to a function that gpu.js is able to accept
 * We just need to update all math_* calls to become Math.* calls
 * No external variables are allowed, so no updating is required
 */
export function gpuFunctionTranspile(node: es.FunctionDeclaration): es.FunctionDeclaration {
  // 1. Update all math_* calls to become Math.*
  transpileMathFunction(node.body)

  return node
}

/*
 * Here we transpile a source-syntax kernel function to a gpu.js kernel function
 * 0. No need for validity checks, as that is done at compile time in gpuTranspile
 * 1. In body, update all math_* calls to become Math.* calls
 * 2. In body, update all external variable references
 * 3. In body, update reference to counters
 */
export function gpuRuntimeTranspile(
  node: es.ArrowFunctionExpression,
  localNames: Set<string>,
  end: number[],
  initials: number[],
  steps: number[],
  idx: (string | number)[],
  functionNames: Set<string>
): es.BlockStatement {
  // Contains counters
  const params = (node.params as es.Identifier[]).map(v => v.name)

  // body here is the loop body transformed into a function of the indices.
  // We need to finish the transformation to a gpu.js kernel function by renaming stuff.
  const body = node.body as es.BlockStatement

  // 1. Update all math_* calls to become Math.*
  transpileMathFunction(body)

  // 2. Update all external variable references in body
  // e.g. let res = 1 + y; where y is an external variable
  // becomes let res = 1 + this.constants.y;

  const ignoredNames: Set<string> = new Set([...params, 'Math'])
  simple(body, {
    Identifier(nx: es.Identifier) {
      // ignore these names
      if (ignoredNames.has(nx.name) || localNames.has(nx.name) || functionNames.has(nx.name)) {
        return
      }

      create.mutateToMemberExpression(
        nx,
        create.memberExpression(create.identifier('this'), 'constants'),
        create.identifier(nx.name)
      )
    }
  })

  // 3. Update reference to counters
  // e.g. let res = 1 + i; where i is a counter
  // becomes let res = 1 + this.thread.x;

  // unused counters will simply be substitued with their end bounds
  const endMap = {}
  for (let i = 0; i < params.length; i++) {
    endMap[params[i]] = end[i] - 1
  }
  simple(body, {
    Identifier(nx: es.Identifier) {
      if (params.includes(nx.name) && !idx.includes(nx.name)) {
        create.mutateToLiteral(nx, endMap[nx.name])
      }
    }
  })

  // depending on ordering of indices, mapping will change
  // there is at most 3 counters as indices, guranteed by static transpile
  const counterIdx = []
  for (const i of idx) {
    if (typeof i === 'string' && params.includes(i)) {
      counterIdx.push(i)
    }
  }
  counterIdx.reverse()

  const threads = ['x', 'y', 'z']
  const counterMap = {}
  const initialMap = {}
  const stepMap = {}
  for (let i = 0; i < counterIdx.length; i++) {
    counterMap[counterIdx[i]] = threads[i]
    // initial and step are obtained in the reverse order
    initialMap[counterIdx[i]] = initials[counterIdx.length - i - 1]
    stepMap[counterIdx[i]] = steps[counterIdx.length - i - 1]
  }

  simple(body, {
    Identifier(nx: es.Identifier) {
      if (nx.name in counterMap) {
        const id = counterMap[nx.name]
        const initial = initialMap[nx.name]
        const step = stepMap[nx.name]

        if (initial === 0 && step === 1) {
          // if initial and step are standard, no need to mutate with arithmetic
          create.mutateToMemberExpression(
            nx,
            create.memberExpression(create.identifier('this'), 'thread'),
            create.identifier(id)
          )
          return
        }
        // map this.thread.x/y/z to the 'correct' value by accounting for initial and step
        // initial + this.thread.x/y/z * step
        const thisThreadExpr = create.memberExpression(
          create.memberExpression(create.identifier('this'), 'thread'),
          id
        )
        const multiplyExpr = create.binaryExpression('*', thisThreadExpr, create.literal(step))

        create.mutateToBinaryExpression(nx, '+', create.literal(initial), multiplyExpr)
      }
    }
  })

  return body
}

// Helper method to mutate all math_* calls to become Math.*
function transpileMathFunction(node: es.Node) {
  simple(node, {
    CallExpression(nx: es.CallExpression) {
      if (nx.callee.type !== 'Identifier') {
        return
      }
      if (!nx.callee.name.startsWith('math_')) {
        return
      }

      const functionName = nx.callee.name
      const term = functionName.split('_')[1]
      const args: es.Expression[] = nx.arguments as any

      create.mutateToCallExpression(
        nx,
        create.memberExpression(create.identifier('Math'), term),
        args
      )
    }
  })
}

export default GPUTransformer
