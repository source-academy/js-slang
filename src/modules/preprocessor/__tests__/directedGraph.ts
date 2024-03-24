import { DirectedGraph } from '../directedGraph'

describe('addEdge', () => {
  it('throws an error if the source and destination nodes are the same', () => {
    const graph = new DirectedGraph()
    expect(() => graph.addEdge('A', 'A')).toThrowError(
      'Edges that connect a node to itself are not allowed.'
    )
  })
})

describe('hasEdge', () => {
  it('returns false if the edge does not exist in the graph', () => {
    const graph = new DirectedGraph()
    expect(graph.hasEdge('A', 'B')).toBe(false)
  })

  it('returns false if the reversed edge exists in the graph, but not the edge itself', () => {
    const graph = new DirectedGraph()
    graph.addEdge('B', 'A')
    expect(graph.hasEdge('A', 'B')).toBe(false)
  })

  it('returns true if the edge exists in the graph', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    expect(graph.hasEdge('A', 'B')).toBe(true)
  })
})

describe('Topological ordering', () => {
  it('returns the first cycle found when the graph is not acyclic 1', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'D')
    graph.addEdge('D', 'E')
    graph.addEdge('E', 'B')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(false)
    expect([
      ['B', 'C', 'D', 'E', 'B'],
      ['C', 'D', 'E', 'B', 'C'],
      ['D', 'E', 'B', 'C', 'D'],
      ['E', 'B', 'C', 'D', 'E']
    ]).toContainEqual(topologicalOrderResult.firstCycleFound)
  })

  it('returns the first cycle found when the graph is not acyclic 2', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'A')
    graph.addEdge('C', 'D')
    graph.addEdge('D', 'E')
    graph.addEdge('E', 'C')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(false)
    expect([
      ['A', 'B', 'C', 'A'],
      ['B', 'C', 'A', 'B'],
      ['C', 'A', 'B', 'C'],
      ['C', 'D', 'E', 'C'],
      ['D', 'E', 'C', 'D'],
      ['E', 'C', 'D', 'E']
    ]).toContainEqual(topologicalOrderResult.firstCycleFound)
  })

  it('returns the first cycle found when the graph is not acyclic 3', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'A')
    graph.addEdge('A', 'D')
    graph.addEdge('D', 'C')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(false)
    expect([
      ['A', 'B', 'C', 'A'],
      ['B', 'C', 'A', 'B'],
      ['C', 'A', 'B', 'C'],
      ['A', 'D', 'C', 'A'],
      ['D', 'C', 'A', 'D'],
      ['C', 'A', 'D', 'C']
    ]).toContainEqual(topologicalOrderResult.firstCycleFound)
  })

  it('returns an empty array when the graph has no nodes', () => {
    const graph = new DirectedGraph()

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(true)
    expect(topologicalOrderResult.topologicalOrder).toEqual([])
  })

  it('returns a topological ordering if the graph is acyclic 1', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'D')
    graph.addEdge('D', 'E')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(true)
    expect(topologicalOrderResult.topologicalOrder).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('returns a topological ordering if the graph is acyclic 2', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('A', 'C')
    graph.addEdge('B', 'D')
    graph.addEdge('C', 'D')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(true)
    expect([
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'B', 'D']
    ]).toContainEqual(topologicalOrderResult.topologicalOrder)
  })

  it('returns a topological ordering if the graph is acyclic 3', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('C', 'D')

    const topologicalOrderResult = graph.getTopologicalOrder()
    expect(topologicalOrderResult.isValidTopologicalOrderFound).toBe(true)
    expect([
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'B', 'D'],
      ['A', 'C', 'D', 'B'],
      ['C', 'A', 'B', 'D'],
      ['C', 'A', 'D', 'B'],
      ['C', 'D', 'A', 'B']
    ]).toContainEqual(topologicalOrderResult.topologicalOrder)
  })
})
