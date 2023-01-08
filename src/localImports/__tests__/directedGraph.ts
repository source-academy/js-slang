import { DirectedGraph } from '../directedGraph'

describe('addEdge', () => {
  it('throws an error if the source and destination nodes are the same', () => {
    const graph = new DirectedGraph()
    expect(() => graph.addEdge('A', 'A')).toThrowError(
      'Edges that connect a node to itself are not allowed.'
    )
  })
})

describe('Topological ordering', () => {
  it('returns null when the graph is not acyclic', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'D')
    graph.addEdge('D', 'E')
    graph.addEdge('E', 'B')

    expect(graph.getTopologicalOrder()).toBeNull()
  })

  it('returns an empty array when the graph has no nodes', () => {
    const graph = new DirectedGraph()

    expect(graph.getTopologicalOrder()).toEqual([])
  })

  it('returns a topological ordering if the graph is acyclic 1', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('B', 'C')
    graph.addEdge('C', 'D')
    graph.addEdge('D', 'E')

    expect(graph.getTopologicalOrder()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('returns a topological ordering if the graph is acyclic 2', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('A', 'C')
    graph.addEdge('B', 'D')
    graph.addEdge('C', 'D')

    expect([
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'B', 'D']
    ]).toContainEqual(graph.getTopologicalOrder())
  })

  it('returns a topological ordering if the graph is acyclic 3', () => {
    const graph = new DirectedGraph()
    graph.addEdge('A', 'B')
    graph.addEdge('C', 'D')

    expect([
      ['A', 'B', 'C', 'D'],
      ['A', 'C', 'B', 'D'],
      ['A', 'C', 'D', 'B'],
      ['C', 'A', 'B', 'D'],
      ['C', 'A', 'D', 'B'],
      ['C', 'D', 'A', 'B']
    ]).toContainEqual(graph.getTopologicalOrder())
  })
})
