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
    if (!set || set.type !== 'Literal' || !this.isInteger(set.value)) {
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
    if (lv.type !== 'Identifier' || lv.name !== this.counter) {
      return false
    }

    const rv = node.right
    if (!(rv.type === 'Identifier' || rv.type === 'Literal')) {
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

    if (node.left.type !== 'Identifier' || node.left.name !== this.counter) {
      return false
    }

    if (node.right.type !== 'BinaryExpression') {
      return false
    }

    const rv = node.right
    if (rv.operator !== '+') {
      return false
    }

    const identifierLeft = rv.left.type === 'Identifier' && rv.left.name === this.counter
    const identifierRight = rv.right.type === 'Identifier' && rv.right.name === this.counter

    const literalLeft = rv.left.type === 'Literal' && this.isInteger(rv.left.value)
    const literalRight = rv.right.type === 'Literal' && this.isInteger(rv.right.value)
    if (literalLeft) {
      this.step = rv.left
    } else if (literalRight) {
      this.step = rv.right
    }

    // we allow both i = i + int and i = int + i
    return (identifierLeft && literalRight) || (identifierRight && literalLeft)
  }

  isInteger = (val: any): boolean => {
    return typeof val === 'number' && Number.isInteger(val)
  }
}

export default GPULoopVerifier
