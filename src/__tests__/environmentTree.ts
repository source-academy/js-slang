import { createGlobalEnvironment, EnvTree, EnvTreeNode } from '../createContext'
import { pushEnvironment } from '../interpreter/interpreter'
import { mockContext, mockEnvironment } from '../mocks/context'
import { Chapter } from '../types'

test('EnvTree root should be null upon instantiation', () => {
  const envTree = new EnvTree()
  expect(envTree.root).toBeNull()
})

test('EnvTree::insert should insert the globalEnvironment as the root', () => {
  const envTree = new EnvTree()
  envTree.insert(createGlobalEnvironment())
  expect(envTree.root).toMatchSnapshot({
    environment: {
      id: expect.any(String)
    }
  })
})

test('EnvTree::getTreeNode should return the tree node that contains a pointer to the given environment', () => {
  const envTree = new EnvTree()
  const globalEnvironment = createGlobalEnvironment()
  envTree.insert(globalEnvironment)
  expect(envTree.getTreeNode(globalEnvironment)?.environment).toMatchSnapshot({
    id: expect.any(String)
  })
})

test('EnvTreeNode::resetChildren should reset the children of the node to the given children', () => {
  const context = mockContext(Chapter.SOURCE_4)
  const parent = mockEnvironment(context, 'programEnvironment')
  pushEnvironment(context, parent)
  // children under parent
  const child1 = mockEnvironment(context)
  const child2 = mockEnvironment(context)
  const child3 = mockEnvironment(context)
  pushEnvironment(context, child1)
  pushEnvironment(context, child2)
  pushEnvironment(context, child3)
  // children under child3
  const grandChild1 = mockEnvironment(context)
  const grandChild2 = mockEnvironment(context)
  const grandChild3 = mockEnvironment(context)
  pushEnvironment(context, grandChild1)
  pushEnvironment(context, grandChild2)
  pushEnvironment(context, grandChild3)
  const envTree = context.runtime.environmentTree
  const parentNode = envTree.getTreeNode(parent)
  const grandChildNode1 = envTree.getTreeNode(grandChild1)
  const grandChildNode2 = envTree.getTreeNode(grandChild2)
  const grandChildNode3 = envTree.getTreeNode(grandChild3)
  expect(parentNode).not.toBeNull()
  expect(grandChildNode1).not.toBeNull()
  expect(grandChildNode2).not.toBeNull()
  expect(grandChildNode3).not.toBeNull()
  parentNode?.children.forEach(child => {
    expect(child).toMatchSnapshot({
      environment: {
        id: expect.any(String)
      }
    })
  })
  parentNode?.resetChildren([
    grandChildNode1 as EnvTreeNode,
    grandChildNode2 as EnvTreeNode,
    grandChildNode3 as EnvTreeNode
  ])
  parentNode?.children.forEach(child => {
    expect(child).toMatchSnapshot({
      environment: {
        id: expect.any(String)
      }
    })
  })
})

test('EnvTreeNode::addChild should add the given child node to the tree node', () => {
  const context = mockContext(Chapter.SOURCE_4)
  const programEnv = mockEnvironment(context, 'programEnvironment')
  const envTreeRoot = context.runtime.environmentTree.root
  expect(envTreeRoot).not.toBeNull()
  envTreeRoot?.addChild(new EnvTreeNode(programEnv, envTreeRoot))
  envTreeRoot?.children.forEach(child => {
    expect(child).toMatchSnapshot({
      environment: {
        id: expect.any(String)
      }
    })
  })
})
