import * as es from 'estree'

const isNumber = (v: any) => typeOf(v) === 'number'
const typeOf = (v: any) => {
  if (v === null) {
    return 'null'
  } else if (Array.isArray(v)) {
    return 'array'
  } else {
    return typeof v
  }
}

/*
takes in a for loop and verifies if it meets the specifications of a GPU for loop
*/
class GPULoopDetecter {
  node: es.ForStatement

  // functions needed
  counter: any
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

  hasCondition = (node: es.Expression): boolean => {
    if (node.type !== 'BinaryExpression') {
      return false
    }

    if (node.operator !== '<') {
      return false
    }

    const lv: es.Expression = node.left
    if (lv.type !== 'Identifier' || lv.name !== this.counter) {
      return false
    }

    const rv: es.Expression = node.right
    if (rv.type !== 'Literal' || !rv.value || !isNumber(rv.value) || rv.value <= 0) {
      return false
    }

    this.end = rv
    return true
  }

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

    return (identifierLeft && literalRight) || (identifierRight && literalLeft)
  }
}

export default GPULoopDetecter
