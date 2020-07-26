import * as es from 'estree'
import { ancestor, simple, make } from 'acorn-walk/dist/walk'
import * as create from '../utils/astCreator'
import GPULoopVerifier from './verification/loopVerifier'
import GPUBodyVerifier from './verification/bodyVerifier'

/*
 * GPU Transformer runs through the program and transpiles for loops to GPU code
 * Upon termination, the AST would be mutated accordingly
 * e.g.
 * let res = 0;
 * for (let i = 0; i < 5; i = i + 1) {
 *    res[i] = 5;
 * }
 * would become:
 * let res = 0;
 * __createKernel(....)
 */
class GPUTransformer {
  // program to mutate
  program: es.Program

  // helps reference the main function
  globalIds: { __createKernel: es.Identifier }

  outputArray: es.Identifier
  innerBody: any
  counters: string[]
  end: es.Expression[]
  state: number
  localVar: Set<string>
  outerVariables: any
  targetBody: any

  constructor(program: es.Program, createKernel: es.Identifier) {
    this.program = program
    this.globalIds = {
      __createKernel: createKernel
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
          let state = gpuTranspile(node)
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
   * 5. In body, update all math_* calls to become Math.* calls
   * 6. In body, update all external variable references
   * 7. In body, update reference to counters
   * 8. Call __createKernel and assign it to our external variable
   */
  gpuTranspile = (node: es.ForStatement): number => {
    // initialize our class variables
    this.state = 0
    this.counters = []
    this.end = []

    // 1. verification of outer loops + body
    this.checkOuterLoops(node)
    // no gpu loops found
    if (this.counters.length === 0 || new Set(this.counters).size !== this.counters.length) {
      return 0
    }

    const verifier = new GPUBodyVerifier(this.program, this.innerBody, this.counters)
    if (verifier.state === 0) {
      return 0
    }

    this.state = verifier.state
    this.outputArray = verifier.outputArray
    this.localVar = verifier.localVar

    // 2. get external variables + the main body
    this.getOuterVariables()
    this.getTargetBody(node)

    // 3. Build a AST Node of all outer variables
    const externObject: es.Property[] = []
    for (const key in this.outerVariables) {
      if (this.outerVariables.hasOwnProperty(key)) {
        const val = this.outerVariables[key]

        // push in a deep copy of the identifier
        // this is needed cos we modify it later
        externObject.push(create.property(key, JSON.parse(JSON.stringify(val))))
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

    // deep copy here (for runtime checks)
    const params: es.Identifier[] = []
    for (let i = 0; i < this.state; i++) {
      params.push(create.identifier(this.counters[i]))
    }
    const tempNode = create.functionExpression(params, JSON.parse(JSON.stringify(this.targetBody)))

    // 5. Update all math_* calls to become Math.*
    simple(this.targetBody, {
      CallExpression(nx: es.CallExpression) {
        if (nx.callee.type !== 'Identifier') {
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

    // 6. Update all external variable references in body
    // e.g. let res = 1 + y; where y is an external variable
    // becomes let res = 1 + this.constants.y;

    const names = [this.outputArray.name, ...this.counters, 'Math']
    simple(this.targetBody, {
      Identifier(nx: es.Identifier) {
        // ignore these names
        if (names.includes(nx.name) || locals.has(nx.name)) {
          return
        }

        create.mutateToMemberExpression(
          nx,
          create.memberExpression(create.identifier('this'), 'constants'),
          create.identifier(nx.name)
        )
      }
    })

    // 7. Update reference to counters
    // e.g. let res = 1 + i; where i is a counter
    // becomes let res = 1 + this.thread.x;

    // depending on state the mappings will change
    let threads = ['x']
    if (this.state === 2) threads = ['y', 'x']
    if (this.state === 3) threads = ['z', 'y', 'x']

    const counters: string[] = []
    for (let i = 0; i < this.state; i = i + 1) {
      counters.push(this.counters[i])
    }

    simple(this.targetBody, {
      Identifier(nx: es.Identifier) {
        let x = -1
        for (let i = 0; i < counters.length; i = i + 1) {
          if (nx.name === counters[i]) {
            x = i
            break
          }
        }

        if (x === -1) {
          return
        }

        const id = threads[x]
        create.mutateToMemberExpression(
          nx,
          create.memberExpression(create.identifier('this'), 'thread'),
          create.identifier(id)
        )
      }
    })

    // 8. we transpile the loop to a function call, __createKernel
    const kernelFunction = create.functionExpression([], this.targetBody)
    create.mutateToExpressionStatement(
      node,
      create.callExpression(
        this.globalIds.__createKernel,
        [
          create.arrayExpression(this.end),
          create.objectExpression(externObject),
          kernelFunction,
          this.outputArray,
          tempNode
        ],
        node.loc!
      )
    )

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
    let mv = this.state
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

export default GPUTransformer
