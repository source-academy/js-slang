import * as es from 'estree'

/*
 * Loop Detector helps to verify if a for loop can be parallelized with a GPU
 * Updates ok, counter and end upon termination
 * @ok: false if not valid, true of valid
 * @end: if valid, stores the end of the loop
 * @counter: stores the string representation of the counter
 */
class GPULoopVerifier {
  // for loop that we are looking at
  node: es.ForStatement
  ok: boolean

  // info about the structure of the for loop
  // for (let |counter| = |initial|; |counter| < |end|; |counter| = |counter| + |step|)
  counter: string
  initial: es.Expression
  step: es.Expression
  end: es.Expression

  constructor(node: es.ForStatement) {
    this.node = node
    this.forLoopTransform(this.node)
  }

  forLoopTransform = (node: es.ForStatement) => {
    if (!node.init || !node.update || !node.test) {
      return
    }

    this.ok =
      this.hasCounter(node.init) && this.hasCondition(node.test) && this.hasUpdate(node.update)
  }

  /*
   * Checks if the loop counter is valid
   * it has to be "let <identifier> = 0;"
   */
  hasCounter = (node: es.VariableDeclaration | es.Expression | null): boolean => {
    if (!node || node.type !== 'VariableDeclaration') {
      return false
    }

    if (node.kind !== 'let') {
      return false
    }

    const declaration: es.VariableDeclarator[] = node.declarations
    if (declaration.length > 1) {
      return false
    }

    const initializer: es.VariableDeclarator = declaration[0]
    if (initializer.id.type !== 'Identifier' || !initializer.init) {
      return false
    }

    this.counter = initializer.id.name

    const set: es.Expression = initializer.init
    if (!set || !this.isValidLoopVar(set)) {
      return false
    }

    this.initial = set
    return true
  }

  /*
   * Checks if the loop condition is valid
   * it has to be "<identifier> < <number>;"
   * identifier is the same as the one initialized above
   */
  hasCondition = (node: es.Expression): boolean => {
    if (node.type !== 'BinaryExpression') {
      return false
    }

    if (!(node.operator === '<' || node.operator === '<=')) {
      return false
    }

    const lv: es.Expression = node.left
    if (!this.isCounter(lv)) {
      return false
    }

    const rv = node.right
    if (!this.isValidLoopVar(rv)) {
      return false
    }

    this.end = rv
    return true
  }

  /*
   * Checks if the loop update is valid
   * it has to be "<identifier> = <identifier> + 1;"
   * identifier is the same as the one initialized above
   */
  hasUpdate = (node: es.Expression): boolean => {
    if (node.type !== 'AssignmentExpression') {
      return false
    }

    if (node.operator !== '=') {
      return false
    }

    if (!this.isCounter(node.left)) {
      return false
    }

    if (node.right.type !== 'BinaryExpression') {
      return false
    }

    const rv = node.right
    if (rv.operator !== '+') {
      return false
    }

    // we allow both i = i + step and i = step + i
    if (this.isCounter(rv.left)) {
      // if left is the counter, right must be the step size
      this.step = rv.right
      return this.isValidLoopVar(rv.right)
    } else if (this.isCounter(rv.right)) {
      // if right is the counter, left must be the step size
      this.step = rv.left
      return this.isValidLoopVar(rv.left)
    } else {
      return false
    }
  }

  isValidLoopVar = (expr: es.Node): boolean => {
    return expr.type === 'Literal' || expr.type === 'Identifier'
  }

  isCounter = (expr: es.Node): boolean => {
    return expr.type === 'Identifier' && expr.name === this.counter
  }
}

export default GPULoopVerifier
