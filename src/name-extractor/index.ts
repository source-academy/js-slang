import * as es from 'estree'

interface NameDeclaration {
  name: string
  meta: string
}

const KIND_FUNCTION = 'func'
const KIND_LET = 'let'

function isDeclaration(node: es.Node): boolean {
  return node.type === 'VariableDeclaration' || node.type === 'FunctionDeclaration'
}

function isFunction(node: es.Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  )
}

function isDummyName(name: string): boolean {
  return name === '✖'
}

export function getProgramNames(prog: es.Node, cursorLoc: es.Position) {
  function before(first: es.Position, second: es.Position) {
    return first.line < second.line || (first.line === second.line && first.column <= second.column)
  }

  function inNode(nodeLoc: es.SourceLocation | null | undefined) {
    if (nodeLoc === null || nodeLoc === undefined) {
      return false
    }
    return before(nodeLoc.start, cursorLoc) && before(cursorLoc, nodeLoc.end)
  }

  const queue: es.Node[] = [prog]
  const nameQueue: es.Node[] = []

  while (queue.length > 0) {
    const node = queue.pop()!
    if (isDeclaration(node)) {
      nameQueue.push(node)
    }

    if (inNode(node.loc)) {
      if (isFunction(node)) {
        // This is the only time we want to process raw identifiers
        nameQueue.push(...(node as any).params)
      }
      const body = getNodeChildren(node)
      if (body) {
        for (const child of body) {
          queue.push(child)
        }
      }
    }
  }

  const res: any = {}
  nameQueue
    .map(node => getNames(node, (n: es.Node) => !inNode(n.loc)))
    .reduce((prev, cur) => prev.concat(cur)) // no flatmap feelsbad
    .forEach(decl => {
      res[decl.name] = decl
    }) // Deduplicate, ensure deeper declarations overwrite
  return Object.values(res)
}

function getNodeChildren(node: es.Node): es.Node[] {
  switch (node.type) {
    case 'Program':
      return node.body
    case 'BlockStatement':
      return node.body
    case 'WhileStatement':
      return [node.test, node.body]
    case 'ForStatement':
      return [node.body]
    case 'ExpressionStatement':
      return [node.expression]
    case 'IfStatement':
      const children = [node.test, node.consequent]
      if (node.alternate !== undefined && node.alternate !== null) {
        children.push(node.alternate)
      }
      return children
    case 'ReturnStatement':
      return node.argument ? [node.argument] : []
    case 'FunctionDeclaration':
      return [node.body]
    case 'VariableDeclaration':
      return node.declarations
        .map(getNodeChildren)
        .reduce((prev: es.Node[], cur: es.Node[]) => prev.concat(cur))
    case 'VariableDeclarator':
      return node.init ? [node.init] : []
    case 'ArrowFunctionExpression':
      return [node.body]
    case 'FunctionExpression':
      return [node.body]
    case 'UnaryExpression':
      return [node.argument]
    case 'BinaryExpression':
      return [node.left, node.right]
    case 'LogicalExpression':
      return [node.left, node.right]
    case 'ConditionalExpression':
      return [node.test, node.alternate, node.consequent]
    case 'CallExpression':
      return [...node.arguments, node.callee]
    // case 'Identifier':
    // case 'DebuggerStatement':
    // case 'BreakStatement':
    // case 'ContinueStatement':
    // case 'MemberPattern':
    case 'ArrayExpression':
      return [...node.elements]
    case 'AssignmentExpression':
      return [node.left, node.right]
    case 'MemberExpression':
      return [node.object, node.property]
    case 'Property':
      return [node.key, node.value]
    case 'ObjectExpression':
      return [...node.properties]
    case 'NewExpression':
      return [...node.arguments, node.callee]
    default:
      return []
  }
}

function getNames(node: es.Node, test: (node: es.Node) => boolean): NameDeclaration[] {
  switch (node.type) {
    case 'VariableDeclaration':
      const delcarations: NameDeclaration[] = []
      for (const decl of node.declarations) {
        const id = decl.id
        const name = (id as es.Identifier).name
        if (!test(id) || !name || isDummyName(name)) {
          continue
        }
        delcarations.push({ name, meta: node.kind })
      }
      return delcarations
    case 'FunctionDeclaration':
      return node.id && test(node.id) && !isDummyName(node.id.name)
        ? [{ name: node.id.name, meta: KIND_FUNCTION }]
        : []
    case 'Identifier':
      return test(node) && !isDummyName(node.name) ? [{ name: node.name, meta: KIND_LET }] : []
    default:
      return []
  }
}
