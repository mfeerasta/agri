/**
 * Cycle detection for task dependency edges.
 * Edges are [blockerId, blockedId]. detectCycle returns true if adding
 * newEdge would create a cycle in the existing graph. O(V + E).
 */

export type Edge = [string, string];

export function detectCycle(edges: Edge[], newEdge: Edge): boolean {
  const [from, to] = newEdge;
  if (from === to) return true;

  // Build adjacency over the union of existing + new edge.
  const adj = new Map<string, string[]>();
  const push = (a: string, b: string): void => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const [a, b] of edges) push(a, b);
  push(from, to);

  // DFS from `to`. If we can reach `from`, the new edge closes a cycle.
  const visited = new Set<string>();
  const stack: string[] = [to];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = adj.get(node);
    if (next) for (const n of next) stack.push(n);
  }
  return false;
}
