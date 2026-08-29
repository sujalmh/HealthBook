/**
 * Teamwork Orchestration Engine — Distributed Coding
 * Core engine handling milestones, workstreams, ownership, verification, and persistence.
 * Pattern-agnostic where possible; pattern specifics in teamwork/patterns/distributed-coding/
 */

import fs from 'fs';
import path from 'path';
import {
  createInitialState,
  loadState,
  saveState,
  updateState,
  addMilestone,
  addWorkstream,
  setWorkstreamStatus,
  setMilestoneStatus,
  type TeamworkState,
  type Workstream,
  type Milestone,
  ensureArtifactsDir,
  isCancelled,
  assertNotCancelled,
  clearCancelled,
  setCancelled,
  getCancelledPath,
} from './state.js';
import { detectConflicts, validateNoOverlapOrThrow } from './ownership.js';
import { scheduleWorkstreams, type ScheduleBatch } from './scheduler.js';
import { writeRequestArtifact, writePlanArtifact } from './artifacts.js';
import { evaluateGate, type ReviewResult } from './verification.js';
import { prepareSuccession, restoreFromArtifacts } from './handoff.js';
import type { GateResult } from './state.js';

export * from './state.js';
export * from './ownership.js';
export * from './scheduler.js';
export * from './verification.js';
export * from './handoff.js';
export * from './isolation.js';

export type IntegrityMode = "development" | "demo" | "benchmark";
export type ExecutionPath = "distributed-coding" | "iterative-coding" | "document-review" | "math-proof" | "math-proof-large" | "self-verification";

export function inferExecutionPath(objective: string): ExecutionPath {
  const t = objective.toLowerCase();
  if (t.match(/keep it small|keep it focused|small fix|single file|trivial/)) return "iterative-coding";
  if (t.match(/review this|critique|paper|rfc|design doc/)) return "document-review";
  if (t.match(/prove|theorem|lemma|conjecture|mathematical bounds|lean/)) {
    if (t.match(/very large team|large team|tournament/)) return "math-proof-large";
    return "math-proof";
  }
  if (t.match(/self.verif|rigorous self-check/)) return "self-verification";
  return "distributed-coding";
}

export function inferIntegrityMode(objective: string, explicit?: IntegrityMode): IntegrityMode {
  if (explicit) return explicit;
  const t = objective.toLowerCase();
  if (t.includes("benchmark") || t.includes("from scratch") || t.includes("strict")) return "benchmark";
  if (t.includes("demo") || t.includes("reproducible")) return "demo";
  return "development";
}

export interface DecomposeInput {
  objective: string;
  constraints?: string[];
  acceptanceCriteria?: string[];
  nonGoals?: string[];
  integrityMode?: IntegrityMode;
  executionPath?: ExecutionPath;
  workingDirectory?: string;
  verificationPlan?: string[];
  promptArtifact?: string;
  // optional hints for decomposition
  suggestedMilestones?: Array<{ title: string; description: string; workstreams: Array<{ title: string; files: string[]; dependsOn?: string[] }>; dependsOn?: string[] }>;
}

export class TeamworkEngine {
  artifactsDir: string;
  patternDir: string;

  constructor(opts: { artifactsDir?: string; patternDir?: string } = {}) {
    this.artifactsDir = opts.artifactsDir || '.teamwork';
    this.patternDir = opts.patternDir || 'teamwork/patterns/distributed-coding';
    ensureArtifactsDir(this.artifactsDir);
  }

  /** Step 1-2: receive request + create request artifact */
  initProject(input: DecomposeInput): TeamworkState {
    // Clear any previous cancellation on new project start
    clearCancelled(this.artifactsDir);
    const executionPath = input.executionPath || inferExecutionPath(input.objective);
    const integrityMode = input.integrityMode || inferIntegrityMode(input.objective);
    const state = createInitialState(input.objective, {
      artifactsDir: this.artifactsDir,
      constraints: input.constraints,
      acceptanceCriteria: input.acceptanceCriteria,
      nonGoals: input.nonGoals,
      integrityMode,
      executionPath,
      workingDirectory: input.workingDirectory || this.artifactsDir,
      verificationPlan: input.verificationPlan,
      promptArtifact: input.promptArtifact,
    });
    // write request.md (with extended fields)
    writeRequestArtifact(this.artifactsDir, {
      objective: input.objective,
      constraints: input.constraints || [],
      acceptanceCriteria: input.acceptanceCriteria || [],
      nonGoals: input.nonGoals || [],
      createdAt: state.request.createdAt,
      integrityMode,
      executionPath,
      workingDirectory: input.workingDirectory,
      verificationPlan: input.verificationPlan,
    } as any);
    saveState(state, this.artifactsDir);
    // mark active (lazy activation)
    try {
      const activePath = path.join(this.artifactsDir, "active");
      if (!fs.existsSync(activePath)) {
        fs.writeFileSync(activePath, JSON.stringify({ at: new Date().toISOString(), projectId: state.projectId, integrityMode, executionPath }, null, 2));
      }
    } catch {}
    return state;
  }

  isCancelled(): boolean {
    return isCancelled(this.artifactsDir);
  }

  cancel(reason = "Cancelled via teamwork_cancel"): void {
    setCancelled(this.artifactsDir, reason);
  }

  clearCancel(): void {
    clearCancelled(this.artifactsDir);
  }

  getCancelledReason(): string | null {
    if (!isCancelled(this.artifactsDir)) return null;
    try {
      return JSON.parse(fs.readFileSync(getCancelledPath(this.artifactsDir), 'utf-8')).reason;
    } catch { return "cancelled"; }
  }

  /** Step 4-5: create milestones + workstreams + ownership */
  createPlan(milestones: Milestone[], workstreams: Workstream[]): TeamworkState {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir);
    if (!state) throw new Error('No project initialized — call initProject first');
    // validate no ownership conflicts among parallel workstreams
    // Do not throw here for plan creation — scheduler will handle serialization, but detect for warning
    const conflicts = detectConflicts(workstreams.filter(w => !w.dependsOn?.length));
    if (conflicts.length) {
      console.warn(`Ownership conflicts detected during plan creation: ${JSON.stringify(conflicts)}`);
    }
    state.plan.milestones = milestones;
    state.plan.workstreams = workstreams;
    state.ownership = workstreams.map(ws => ({
      workstream: ws.id,
      files: ws.files,
      owner: ws.owner || 'unassigned',
      status: ws.status,
    }));
    // write plan.md + individual milestones/workstreams
    writePlanArtifact(this.artifactsDir, {
      milestones: milestones.map(m => ({ id: m.id, title: m.title, description: m.description, workstreams: m.workstreams, dependsOn: m.dependsOn })),
      workstreams: workstreams.map(w => ({ id: w.id, title: w.title, files: w.files, owner: w.owner, milestoneId: w.milestoneId, dependsOn: w.dependsOn })),
      createdAt: new Date().toISOString(),
    });
    saveState(state, this.artifactsDir);
    return state;
  }

  /** Convenience: decompose via simple heuristic or provided suggestion */
  decompose(objective: string, suggested?: DecomposeInput['suggestedMilestones']): { milestones: Milestone[]; workstreams: Workstream[] } {
    if (suggested && suggested.length) {
      const milestones: Milestone[] = [];
      const workstreams: Workstream[] = [];
      for (let mi = 0; mi < suggested.length; mi++) {
        const s = suggested[mi];
        const mid = `milestone-${String(mi + 1).padStart(2, '0')}`;
        const wsIds: string[] = [];
        for (let wi = 0; wi < s.workstreams.length; wi++) {
          const w = s.workstreams[wi];
          const wid = `ws-${String(mi + 1).padStart(2, '0')}-${String(wi + 1).padStart(2, '0')}`;
          wsIds.push(wid);
          workstreams.push({
            id: wid,
            title: w.title,
            files: w.files,
            owner: `worker-${wi + 1}`,
            status: 'pending',
            milestoneId: mid,
            dependsOn: w.dependsOn,
          });
        }
        milestones.push({
          id: mid,
          title: s.title,
          description: s.description,
          workstreams: wsIds,
          dependsOn: s.dependsOn,
          status: 'pending',
        });
      }
      return { milestones, workstreams };
    }
    // Fallback: single milestone, single workstream (trivial task)
    const mid = 'milestone-01';
    const wid = 'ws-01-01';
    return {
      milestones: [{
        id: mid,
        title: 'Implement objective',
        description: objective,
        workstreams: [wid],
        status: 'pending',
      }],
      workstreams: [{
        id: wid,
        title: 'Implement',
        files: ['src/**/*'],
        owner: 'worker-1',
        status: 'pending',
        milestoneId: mid,
      }],
    };
  }

  /** Scheduler: get parallel batches for a milestone */
  getScheduleForMilestone(milestoneId: string): ScheduleBatch[] {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir);
    if (!state) throw new Error('No state');
    const milestone = state.plan.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);
    const ws = state.plan.workstreams.filter(w => milestone.workstreams.includes(w.id));
    return scheduleWorkstreams(ws);
  }

  /** Simulate parallel execution: mark workstreams active, then completed if no conflict */
  async executeBatches(batches: ScheduleBatch[], executor?: (ws: Workstream) => Promise<void>): Promise<void> {
    assertNotCancelled(this.artifactsDir);
    for (const batch of batches) {
      assertNotCancelled(this.artifactsDir);
      // Detect ownership conflict before launching parallel batch — should be zero by scheduler design
      const conflicts = detectConflicts(batch.workstreams.filter(w => w.status !== 'completed'));
      if (conflicts.length) throw new Error(`Cannot execute batch ${batch.batchId}: ownership conflict ${JSON.stringify(conflicts)}`);
      // Mark active
      for (const ws of batch.workstreams) {
        updateState(this.artifactsDir, s => setWorkstreamStatus(s, ws.id, 'active'));
      }
      // Execute (parallel)
      if (executor) {
        await Promise.all(batch.workstreams.map(ws => executor(ws)));
      } else {
        // default: immediately mark completed (for tests)
        for (const ws of batch.workstreams) {
          updateState(this.artifactsDir, s => setWorkstreamStatus(s, ws.id, 'completed'));
        }
      }
    }
  }

  /** Verification gate */
  verifyMilestone(milestoneId: string, critic: ReviewResult, challenger: ReviewResult, auditor: ReviewResult, evidence: string[] = []): GateResult {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir)!;
    const gate = evaluateGate({ milestoneId, critic, challenger, auditor, evidence });
    // persist gate
    state.verification.gates = state.verification.gates.filter(g => g.milestoneId !== milestoneId);
    state.verification.gates.push(gate);
    // update milestone status
    const milestone = state.plan.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      milestone.verification = milestone.verification || {};
      milestone.status = gate.finalVerdict === 'PASS' ? 'passed' : 'failed';
      if (gate.finalVerdict === 'PASS') {
        if (!state.progress.completedMilestones.includes(milestoneId)) state.progress.completedMilestones.push(milestoneId);
        state.progress.failedMilestones = state.progress.failedMilestones.filter(id => id !== milestoneId);
      } else {
        if (!state.progress.failedMilestones.includes(milestoneId)) state.progress.failedMilestones.push(milestoneId);
      }
      if (milestone.status === 'passed') state.progress.currentMilestone = undefined;
      else state.progress.currentMilestone = milestoneId;
    }
    saveState(state, this.artifactsDir);
    return gate;
  }

  /** Repair loop: on FAIL, create repair workstream */
  createRepairWorkstream(milestoneId: string, findings: string[]): Workstream {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir)!;
    const milestone = state.plan.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);
    const repairId = `ws-repair-${milestoneId}-${Date.now()}`;
    const ws: Workstream = {
      id: repairId,
      title: `Repair ${milestoneId}`,
      files: ['src/**/*'], // will be narrowed by orchestrator based on findings
      owner: 'worker-repair',
      status: 'pending',
      milestoneId,
    };
    state.plan.workstreams.push(ws);
    milestone.workstreams.push(repairId);
    milestone.status = 'in_progress';
    state.ownership.push({ workstream: repairId, files: ws.files, owner: ws.owner!, status: ws.status });
    // remove failed from failed list? Keep until next gate passes
    saveState(state, this.artifactsDir);
    return ws;
  }

  /** Handoff / succession */
  handoff(currentSessionId: string, reason?: string) {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir)!;
    return prepareSuccession(state, currentSessionId, reason);
  }

  /** Resume from artifacts */
  resume(): TeamworkState {
    assertNotCancelled(this.artifactsDir);
    return restoreFromArtifacts(this.artifactsDir);
  }

  /** Final verification */
  finalVerification(successAuditorResult: ReviewResult, evidence: string[] = []): GateResult {
    assertNotCancelled(this.artifactsDir);
    const state = loadState(this.artifactsDir)!;
    // Final gate requires all milestones passed
    const allPassed = state.plan.milestones.every(m => m.status === 'passed');
    const critic: ReviewResult = { verdict: allPassed ? 'PASS' : 'FAIL', findings: allPassed ? [] : ['Not all milestones passed'] };
    const challenger: ReviewResult = { verdict: 'PASS', findings: [] }; // simplified
    // successAuditorResult is the auditor gate for final
    const gate: GateResult = {
      milestoneId: 'final',
      criticVerdict: critic.verdict,
      challengerVerdict: challenger.verdict,
      auditorVerdict: successAuditorResult.verdict,
      finalVerdict: (critic.verdict === 'PASS' && challenger.verdict === 'PASS' && successAuditorResult.verdict === 'PASS') ? 'PASS' : 'FAIL',
      evidence,
      timestamp: new Date().toISOString(),
    };
    state.verification.final = gate;
    saveState(state, this.artifactsDir);
    return gate;
  }

  canMarkDone(): boolean {
    const state = loadState(this.artifactsDir);
    if (!state) return false;
    if (!state.verification.final) return false;
    return state.verification.final.finalVerdict === 'PASS';
  }
}
