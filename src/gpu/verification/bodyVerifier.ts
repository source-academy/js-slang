import * as es from 'estree'
import { simple, make, ancestor } from '../../utils/walkers'
import GPUFunctionVerifier from './functionVerifier'

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

  valid: boolean
  localVar: Set<string>
  counters: string[]
  indices: (string | number)[]
  outputArray: es.Identifier
  customFunctions: Map<string, es.FunctionDeclaration>

  /**
   *
   * @param node body to be verified
   * @param counters list of for loop counters (to check array assignment)
   */
  constructor(program: es.Program, node: es.Statement, counters: string[]) {
    this.program = program
    this.node = node
    this.counters = counters
    this.valid = false
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

    // 2. verify functions in body
    const calledFunctions = new Set<string>()
    const mathFuncCheck = new RegExp(/^math_[a-z]+$/)
    simple(node, {
      CallExpression(nx: es.CallExpression) {
        if (nx.callee.type !== 'Identifier') {
          ok = false
          return
        }

        const functionName = nx.callee.name
        // Check if it is a math_* function
        if (!mathFuncCheck.test(functionName)) {
          // If not, must do extensive verification on it later
          calledFunctions.add(functionName)
        }
      }
    })

    if (!ok) {
      return
    }

    // first create a map of all custom function names to their declarations (to help with later verification)
    const customFunctions = new Map<string, es.FunctionDeclaration>()
    // for now we only consider custom functions that are in the global scope
    ancestor(this.program, {
      FunctionDeclaration(nx: es.FunctionDeclaration, ancestors: Array<es.Node>) {
        if (nx.id === null) {
          return
        }
        if (ancestors.length == 2) {
          // only add a custom function if it is in the global scope (ancestors are the Program and itself)
          customFunctions.set(nx.id.name, nx)
        }
      }
    })

    // check if the non math_* functions are valid GPUFunctions
    const verifiedFunctions = new Set<string>()
    const unverifiedFunctions = new Set<string>()
    for (const functionName of calledFunctions) {
      const fun = customFunctions.get(functionName)
      if (fun === undefined) {
        // automatically invalid if function is not defined anywhere in program
        ok = false
        return
      }
      const functionVerifier = new GPUFunctionVerifier(
        fun,
        functionName,
        verifiedFunctions,
        unverifiedFunctions,
        customFunctions
      )
      if (!functionVerifier.ok) {
        ok = false
        return
      }
    }

    // keep track of what custom functions were actually called by the program, for use in transpilation later
    for (const functionName of customFunctions.keys()) {
      if (!verifiedFunctions.has(functionName)) {
        customFunctions.delete(functionName)
      }
    }
    this.customFunctions = customFunctions

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

    // retrieve indices
    this.indices = this.getPropertyAccess(resultExpr[0].left)

    // check result variable is not used anywhere with wrong indices
    // this prevents scenarios such as accessing the value of another cell in
    // the array, which can lead to undefined behavior if parallelized
    const getProp = this.getPropertyAccess
    const resArr = this.outputArray
    const members = this.indices
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
          if (JSON.stringify(indices) === JSON.stringify(members)) {
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

    this.valid = true
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
  getPropertyAccess = (node: es.MemberExpression) => {
    const res: (string | number)[] = []
    let ok: boolean = true
    let curr: any = node
    while (curr.type === 'MemberExpression') {
      if (curr.property.type === 'Literal' && typeof curr.property.value === 'number') {
        res.push(curr.property.value)
      } else if (curr.property.type === 'Identifier' && !(curr.property.name in this.localVar)) {
        res.push(curr.property.name)
      } else {
        ok = false
        break
      }
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
