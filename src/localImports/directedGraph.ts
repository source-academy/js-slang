/**
 * The result of attempting to find a topological ordering
 * of nodes on a DirectedGraph.
 */
export type TopologicalOrderResult =
  | {
      isValidTopologicalOrderFound: true
      topologicalOrder: string[]
      firstCycleFound: null
    }
  | {
      isValidTopologicalOrderFound: false
      topologicalOrder: null
      firstCycleFound: string[]
    }

/**
 * Represents a directed graph which disallows self-loops.
 */
export class DirectedGraph {
  private readonly adjacencyList: Map<string, Set<string>>
  private readonly differentKeysError = new Error(
    'The keys of the adjacency list & the in-degree maps are not the same. This should never occur.'
  )

  constructor() {
    this.adjacencyList = new Map()
  }

  /**
   * Adds a directed edge to the graph from the source node to
   * the destination node. Self-loops are not allowed.
   *
   * @param sourceNode      The name of the source node.
   * @param destinationNode The name of the destination node.
   */
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

  /**
   * Returns whether the directed edge from the source node to the
   * destination node exists in the graph.
   *
   * @param sourceNode      The name of the source node.
   * @param destinationNode The name of the destination node.
   */
  public hasEdge(sourceNode: string, destinationNode: string): boolean {
    if (sourceNode === destinationNode) {
      throw new Error('Edges that connect a node to itself are not allowed.')
    }

    const neighbours = this.adjacencyList.get(sourceNode) ?? new Set()
    return neighbours.has(destinationNode)
  }

  /**
   * Calculates the in-degree of every node in the directed graph.
   *
   * The in-degree of a node is the number of edges coming into
   * the node.
   */
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

  /**
   * Finds a cycle of nodes in the directed graph. This operates on the
   * invariant that any nodes left over with a non-zero in-degree after
   * Kahn's algorithm has been run is part of a cycle.
   *
   * @param inDegrees The number of edges coming into each node after
   *                  running Kahn's algorithm.
   */
  private findCycle(inDegrees: Map<string, number>): string[] {
    // First, we pick any arbitrary node that is part of a cycle as our
    // starting node.
    let startingNodeInCycle: string | null = null
    for (const [node, inDegree] of inDegrees) {
      if (inDegree !== 0) {
        startingNodeInCycle = node
        break
      }
    }
    // By the invariant stated above, it is impossible that the starting
    // node cannot be found. The lack of a starting node implies that
    // all nodes have an in-degree of 0 after running Kahn's algorithm.
    // This in turn implies that Kahn's algorithm was able to find a
    // valid topological ordering & that the graph contains no cycles.
    if (startingNodeInCycle === null) {
      throw new Error('There are no cycles in this graph. This should never happen.')
    }

    const cycle = [startingNodeInCycle]
    // Then, we keep picking arbitrary nodes with non-zero in-degrees until
    // we pick a node that has already been picked.
    while (true) {
      const currentNode = cycle[cycle.length - 1]

      const neighbours = this.adjacencyList.get(currentNode)
      if (neighbours === undefined) {
        throw this.differentKeysError
      }
      // By the invariant stated above, it is impossible that any node
      // on the cycle has an in-degree of 0 after running Kahn's algorithm.
      // An in-degree of 0 implies that the node is not part of a cycle,
      // which is a contradiction since the current node was picked because
      // it is part of a cycle.
      if (neighbours.size === 0) {
        throw new Error(`Node '${currentNode}' has no incoming edges. This should never happen.`)
      }

      let nextNodeInCycle: string | null = null
      for (const neighbour of neighbours) {
        if (inDegrees.get(neighbour) !== 0) {
          nextNodeInCycle = neighbour
          break
        }
      }
      // By the invariant stated above, if the current node is part of a cycle,
      // then one of its neighbours must also be part of the same cycle. This
      // is because a cycle contains at least 2 nodes.
      if (nextNodeInCycle === null) {
        throw new Error(
          `None of the neighbours of node '${currentNode}' are part of the same cycle. This should never happen.`
        )
      }

      // If the next node we pick is already part of the cycle,
      // we drop all elements before the first instance of the
      // next node and return the cycle.
      const nextNodeIndex = cycle.indexOf(nextNodeInCycle)
      const isNodeAlreadyInCycle = nextNodeIndex !== -1
      cycle.push(nextNodeInCycle)
      if (isNodeAlreadyInCycle) {
        return cycle.slice(nextNodeIndex)
      }
    }
  }

  /**
   * Returns a topological ordering of the nodes in the directed
   * graph if the graph is acyclic. Otherwise, returns null.
   *
   * To get the topological ordering, Kahn's algorithm is used.
   */
  public getTopologicalOrder(): TopologicalOrderResult {
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

    // If not all nodes are visited, then at least one
    // cycle exists in the graph and a topological ordering
    // cannot be found.
    if (numOfVisitedNodes !== this.adjacencyList.size) {
      const firstCycleFound = this.findCycle(inDegrees)
      return {
        isValidTopologicalOrderFound: false,
        topologicalOrder: null,
        firstCycleFound
      }
    }

    return {
      isValidTopologicalOrderFound: true,
      topologicalOrder,
      firstCycleFound: null
    }
  }
}
