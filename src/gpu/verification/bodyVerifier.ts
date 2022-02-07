import * as es from 'estree'

import { make, simple } from '../../utils/walkers'

/*
 * GPU Body verifier helps to ensure the body is parallelizable
 * It does a series of checks to make sure the loop can be parallelized easily
 * Upon termination will update:
 *   @state: number that indicates the dimensions you can parallize till (max 3)
 *   @localVar: local variables in the body
 *   @outputArray: array that is being written to
 */
class GPUBodyVerifier {
  program: es.Program
  node: es.Statement

  state: number
  localVar: Set<string>
  counters: string[]
  outputArray: es.Identifier

  /**
   *
   * @param node body to be verified
   * @param counters list of for loop counters (to check array assignment)
   */
  constructor(program: es.Program, node: es.Statement, counters: string[]) {
    this.program = program
    this.node = node
    this.counters = counters
    this.state = 0
    this.checkBody(node)
  }

  /*
   * Checks if the GPU body is valid
   * 1. No return/function declarations/break/continue
   * 2. No functions except math_*
   * 3. Only ONE assignment to a global result variable
   * 4. Assigning to an array at specific indices (i, j, k from for loop counters)
   */
  checkBody = (node: es.Statement) => {
    let ok: boolean = true

    // 1. check illegal statements
    simple(node, {
      FunctionDeclaration() {
        ok = false
      },
      ArrowFunctionExpression() {
        ok = false
      },
      ReturnStatement() {
        ok = false
      },
      BreakStatement() {
        ok = false
      },
      ContinueStatement() {
        ok = false
      }
    })

    if (!ok) {
      return
    }

    // 2. check function calls are only to math_*
    const mathFuncCheck = new RegExp(/^math_[a-z]+$/)
    simple(node, {
      CallExpression(nx: es.CallExpression) {
        if (nx.callee.type !== 'Identifier') {
          ok = false
          return
        }

        const functionName = nx.callee.name
        if (!mathFuncCheck.test(functionName)) {
          ok = false
          return
        }
      }
    })

    if (!ok) {
      return
    }

    // 3. check there is only ONE assignment to a global result variable

    // get all local variables
    const localVar = new Set<string>()
    simple(node, {
      VariableDeclaration(nx: es.VariableDeclaration) {
        if (nx.declarations[0].id.type === 'Identifier') {
          localVar.add(nx.declarations[0].id.name)
        }
      }
    })
    this.localVar = localVar

    // make sure only one assignment
    const resultExpr: es.AssignmentExpression[] = []
    const checker = this.getArrayName
    simple(node, {
      AssignmentExpression(nx: es.AssignmentExpression) {
        // assigning to local val, it's okay
        if (nx.left.type === 'Identifier' && localVar.has(nx.left.name)) {
          return
        }

        if (nx.left.type === 'MemberExpression') {
          const chk = checker(nx.left)
          if (localVar.has(chk.name)) {
            return
          }
        }

        resultExpr.push(nx)
      }
    })

    // too many assignments!
    if (resultExpr.length !== 1) {
      return
    }

    // 4. check assigning to array at specific indices

    // not assigning to array
    if (resultExpr[0].left.type !== 'MemberExpression') {
      return
    }

    // check res assignment and its counters
    const res = this.getPropertyAccess(resultExpr[0].left)
    if (res.length === 0 || res.length > this.counters.length) {
      return
    }

    // check result variable is not used anywhere with wrong indices
    const getProp = this.getPropertyAccess
    const resArr = this.outputArray
    simple(
      node,
      {
        MemberExpression(nx: es.MemberExpression) {
          const chk = checker(nx)
          if (chk.name !== resArr.name) {
            return
          }

          // get indices
          const indices = getProp(nx)
          if (JSON.stringify(indices) === JSON.stringify(res)) {
            return
          }

          ok = false
        }
      },
      // tslint:disable-next-line
      make({ MemberExpression: () => {} })
    )

    if (!ok) {
      return
    }

    for (let i = 0; i < this.counters.length; i++) {
      if (res[i] !== this.counters[i]) break
      this.state++
    }

    // we only can have upto 3 states
    if (this.state > 3) this.state = 3
  }

  getArrayName = (node: es.MemberExpression): es.Identifier => {
    let curr: any = node
    while (curr.type === 'MemberExpression') {
      curr = curr.object
    }
    return curr
  }

  // helper function that helps to get indices accessed from array
  // e.g. returns i, j for res[i][j]
  getPropertyAccess = (node: es.MemberExpression): string[] => {
    const res: string[] = []
    let ok: boolean = true
    let curr: any = node
    while (curr.type === 'MemberExpression') {
      if (curr.property.type !== 'Identifier') {
        ok = false
        break
      }

      res.push(curr.property.name)
      curr = curr.object
    }

    if (!ok) {
      return []
    }

    this.outputArray = curr
    return res.reverse()
  }
}

export default GPUBodyVerifier
