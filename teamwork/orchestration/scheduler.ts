/**
 * Scheduler — Distributed Coding Workstream Dependency & Parallel Execution Planner
 * Builds dependency graph, determines parallelizable batches respecting:
 * - dependsOn ordering
 * - file ownership non-overlap
 */

import type { Workstream, Milestone } from './state.js';
import { detectConflicts } from './ownership.js';

export interface ScheduleBatch {
  batchId: number;
  workstreams: Workstream[];
  canRunInParallel: boolean;
  reason: string;
}

export interface MilestoneSchedule {
  milestoneId: string;
  batches: ScheduleBatch[];
  totalWorkstreams: number;
}

/**
 * Topological sort respecting dependsOn, then group into parallel batches
 * where workstreams in same batch have no inter-dependencies and no ownership conflict.
 */
export function scheduleWorkstreams(workstreams: Workstream[]): ScheduleBatch[] {
  if (workstreams.length === 0) return [];

  // map id -> ws
  const byId = new Map<string, Workstream>();
  for (const ws of workstreams) byId.set(ws.id, ws);

  // Kahn's algorithm for topological order
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const ws of workstreams) {
    inDegree.set(ws.id, ws.dependsOn?.length || 0);
    adj.set(ws.id, []);
  }
  for (const ws of workstreams) {
    for (const dep of ws.dependsOn || []) {
      if (!byId.has(dep)) throw new Error(`Workstream ${ws.id} dependsOn unknown ${dep}`);
      adj.get(dep)!.push(ws.id);
    }
  }

  // queue of nodes with 0 in-degree
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id);

  const sorted: Workstream[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const ws = byId.get(id)!;
    sorted.push(ws);
    for (const neighbor of adj.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== workstreams.length) {
    throw new Error('Cycle detected in workstream dependencies');
  }

  // Now group sorted into batches: greedy, fill batch while no conflict and no unsatisfied deps within batch
  const batches: ScheduleBatch[] = [];
  const scheduled = new Set<string>();

  let batchId = 0;
  let remaining = [...sorted];

  while (remaining.length > 0) {
    const batch: Workstream[] = [];
    const nextRemaining: Workstream[] = [];

    for (const ws of remaining) {
      // check if dependencies satisfied (all deps already scheduled in previous batches)
      const depsSatisfied = (ws.dependsOn || []).every(dep => scheduled.has(dep));
      if (!depsSatisfied) {
        nextRemaining.push(ws);
        continue;
      }
      // check if this ws can be added to current batch without ownership conflict
      const trialBatch = [...batch, ws];
      const conflicts = detectConflicts(trialBatch);
      if (conflicts.length === 0) {
        batch.push(ws);
      } else {
        nextRemaining.push(ws);
      }
    }

    if (batch.length === 0) {
      // No progress means remaining all conflict with each other or deps not met — single-serialize next
      // Take first remaining that has deps satisfied, force it alone
      const candidate = remaining.find(ws => (ws.dependsOn || []).every(dep => scheduled.has(dep)));
      if (!candidate) throw new Error('Scheduler deadlock — unsatisfied dependencies');
      batches.push({
        batchId: batchId++,
        workstreams: [candidate],
        canRunInParallel: false,
        reason: 'serialized due to ownership conflict or dependency',
      });
      scheduled.add(candidate.id);
      remaining = remaining.filter(ws => ws.id !== candidate.id);
    } else {
      const canParallel = batch.length > 1;
      batches.push({
        batchId: batchId++,
        workstreams: batch,
        canRunInParallel: canParallel,
        reason: canParallel ? 'independent workstreams with no file overlap and satisfied dependencies' : 'single workstream batch',
      });
      for (const ws of batch) scheduled.add(ws.id);
      remaining = nextRemaining;
    }
  }

  return batches;
}

export function scheduleMilestone(milestone: Milestone, allWorkstreams: Workstream[]): MilestoneSchedule {
  const wsForMilestone = allWorkstreams.filter(ws => milestone.workstreams.includes(ws.id));
  const batches = scheduleWorkstreams(wsForMilestone);
  return {
    milestoneId: milestone.id,
    batches,
    totalWorkstreams: wsForMilestone.length,
  };
}

export function getReadyWorkstreams(workstreams: Workstream[], completedIds: Set<string>): Workstream[] {
  return workstreams.filter(ws => {
    if (ws.status === 'completed' || ws.status === 'active') return false;
    const deps = ws.dependsOn || [];
    return deps.every(d => completedIds.has(d));
  });
}

export function canStartWorkstream(ws: Workstream, completedIds: Set<string>, activeWorkstreams: Workstream[]): boolean {
  const depsMet = (ws.dependsOn || []).every(d => completedIds.has(d));
  if (!depsMet) return false;
  // check ownership conflict with currently active
  const trial = [...activeWorkstreams, ws];
  return detectConflicts(trial).length === 0;
}
