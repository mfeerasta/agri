/**
 * Critical-path computation over a task DAG. Each task has a duration in
 * days and a list of dependencies (predecessor task ids). The result
 * identifies the longest-path task ids and the earliest/latest start day
 * for every task. Used by the Gantt view.
 *
 * Algorithm:
 *   1. Topological sort (Kahn's).
 *   2. Forward pass to compute earliestStart and earliestFinish.
 *   3. Backward pass to compute latestFinish, latestStart.
 *   4. Critical = tasks where earliestStart === latestStart.
 *
 * Returns `{ criticalIds: [], ... }` if the graph contains a cycle.
 */

export interface TaskNode {
  id: string;
  durationDays: number;
  dependencies: string[];
}

export interface CriticalPathResult {
  criticalIds: string[];
  earliestStart: Record<string, number>;
  latestStart: Record<string, number>;
}

export function computeCriticalPath(tasks: TaskNode[]): CriticalPathResult {
  const earliestStart: Record<string, number> = {};
  const earliestFinish: Record<string, number> = {};
  const latestStart: Record<string, number> = {};
  const latestFinish: Record<string, number> = {};
  const criticalIds: string[] = [];

  if (tasks.length === 0) return { criticalIds, earliestStart, latestStart };

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const t of tasks) {
    indegree.set(t.id, 0);
    successors.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (!byId.has(dep)) continue;
      successors.get(dep)!.push(t.id);
      indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1);
    }
  }

  // Kahn's topo sort.
  const order: string[] = [];
  const ready: string[] = [];
  for (const [id, d] of indegree) if (d === 0) ready.push(id);
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const nd = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, nd);
      if (nd === 0) ready.push(s);
    }
  }
  if (order.length !== tasks.length) {
    // Cycle: return empty critical path.
    return { criticalIds: [], earliestStart, latestStart };
  }

  // Forward pass.
  for (const id of order) {
    const t = byId.get(id)!;
    const start = t.dependencies.reduce((acc, dep) => {
      const f = earliestFinish[dep];
      return f != null && f > acc ? f : acc;
    }, 0);
    earliestStart[id] = start;
    earliestFinish[id] = start + t.durationDays;
  }

  const projectFinish = Math.max(...Object.values(earliestFinish));

  // Backward pass.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const t = byId.get(id)!;
    const succs = successors.get(id) ?? [];
    const finish = succs.length === 0
      ? projectFinish
      : succs.reduce((acc, s) => {
          const ls = latestStart[s];
          return ls != null && ls < acc ? ls : acc;
        }, Number.POSITIVE_INFINITY);
    latestFinish[id] = finish;
    latestStart[id] = finish - t.durationDays;
  }

  for (const id of order) {
    if (earliestStart[id] === latestStart[id]) criticalIds.push(id);
  }

  return { criticalIds, earliestStart, latestStart };
}
