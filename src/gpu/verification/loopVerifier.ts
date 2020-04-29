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

  counter: string
  end: es.Expression
  ok: boolean

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
    if (!set || set.type !== 'Literal' || set.value !== 0) {
      return false
    }

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

    const literalLeft = rv.left.type === 'Literal' && rv.left.value === 1
    const literalRight = rv.right.type === 'Literal' && rv.right.value === 1

    // we allow both i = i + 1 and i = 1 + i
    return (identifierLeft && literalRight) || (identifierRight && literalLeft)
  }
}

export default GPULoopVerifier
