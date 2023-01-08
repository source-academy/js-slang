export class DirectedGraph {
  private readonly adjacencyList: Map<string, Set<string>>
  private readonly differentKeysError = new Error(
    'The keys of the adjacency list & the in-degree maps are not the same. This should never occur.'
  )

  constructor() {
    this.adjacencyList = new Map()
  }

  public addEdge(sourceNode: string, destinationNode: string): void {
    if (sourceNode === destinationNode) {
      throw new Error('Edges that connect a node to itself are not allowed.')
    }

    const neighbours = this.adjacencyList.get(sourceNode) ?? new Set()
    neighbours.add(destinationNode)
    this.adjacencyList.set(sourceNode, neighbours)

    // Create an entry for the destination node if it does not exist
    // in the adjacency list. This is so that the set of keys of the
    // adjacency list is the same as the set of nodes in the graph.
    if (!this.adjacencyList.has(destinationNode)) {
      this.adjacencyList.set(destinationNode, new Set())
    }
  }

  private calculateInDegrees(): Map<string, number> {
    const inDegrees = new Map()
    for (const neighbours of this.adjacencyList.values()) {
      for (const neighbour of neighbours) {
        const inDegree = inDegrees.get(neighbour) ?? 0
        inDegrees.set(neighbour, inDegree + 1)
      }
    }
    // Handle nodes which have an in-degree of 0.
    for (const node of this.adjacencyList.keys()) {
      if (!inDegrees.has(node)) {
        inDegrees.set(node, 0)
      }
    }
    return inDegrees
  }

  public getTopologicalOrder(): string[] | null {
    let numOfVisitedNodes = 0
    const inDegrees = this.calculateInDegrees()
    const topologicalOrder: string[] = []

    const queue: string[] = []
    for (const [node, inDegree] of inDegrees) {
      if (inDegree === 0) {
        queue.push(node)
      }
    }

    while (true) {
      const node = queue.shift()
      // 'node' is 'undefined' when the queue is empty.
      if (node === undefined) {
        break
      }

      numOfVisitedNodes++
      topologicalOrder.push(node)

      const neighbours = this.adjacencyList.get(node)
      if (neighbours === undefined) {
        throw this.differentKeysError
      }
      for (const neighbour of neighbours) {
        const inDegree = inDegrees.get(neighbour)
        if (inDegree === undefined) {
          throw this.differentKeysError
        }
        inDegrees.set(neighbour, inDegree - 1)

        if (inDegrees.get(neighbour) === 0) {
          queue.push(neighbour)
        }
      }
    }

    if (numOfVisitedNodes !== this.adjacencyList.size) {
      return null
    }

    return topologicalOrder
  }
}
