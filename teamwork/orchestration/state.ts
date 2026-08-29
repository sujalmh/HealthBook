/**
 * Teamwork State Management — Distributed Coding Orchestration Engine
 * Handles .teamwork/state.json persistence and in-memory state.
 * Isolated from pattern specification; engine is generic, pattern defines transitions.
 */

import fs from 'fs';
import path from 'path';

export const STATE_VERSION = 1;
export const DEFAULT_ARTIFACTS_DIR = '.teamwork';

export type WorkstreamStatus = 'pending' | 'active' | 'completed' | 'failed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'verification' | 'passed' | 'failed';

export interface Workstream {
  id: string;
  title: string;
  description?: string;
  files: string[]; // glob patterns, e.g. "src/auth/*"
  owner?: string; // worker id
  status: WorkstreamStatus;
  dependsOn?: string[]; // other workstream ids
  milestoneId: string;
  scratchDir?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  workstreams: string[]; // workstream ids
  dependsOn?: string[]; // milestone ids
  status: MilestoneStatus;
  verification?: VerificationGate;
}

export interface OwnershipEntry {
  workstream: string;
  files: string[];
  owner: string;
  status: WorkstreamStatus;
}

export interface GateResult {
  milestoneId: string;
  criticVerdict: 'PASS' | 'FAIL' | 'pending';
  challengerVerdict: 'PASS' | 'FAIL' | 'pending';
  auditorVerdict: 'PASS' | 'FAIL' | 'pending';
  finalVerdict: 'PASS' | 'FAIL' | 'pending';
  evidence: string[];
  timestamp: string;
}

export interface VerificationGate {
  critic?: string; // path to critic report
  challenger?: string;
  auditor?: string;
  gateResult?: GateResult;
}

export type IntegrityMode = "development" | "demo" | "benchmark";
export type ExecutionPath = "distributed-coding" | "iterative-coding" | "document-review" | "math-proof" | "math-proof-large" | "self-verification";

export interface TeamworkState {
  version: number;
  projectId: string;
  request: {
    objective: string;
    constraints: string[];
    acceptanceCriteria: string[];
    nonGoals?: string[];
    createdAt: string;
    originalInput: string;
    // Antigravity parity fields (Phase 1)
    integrityMode?: IntegrityMode;
    executionPath?: ExecutionPath;
    workingDirectory?: string;
    promptArtifact?: string;
    verificationPlan?: string[]; // independent verification per requirement
  };
  plan: {
    createdAt: string;
    milestones: Milestone[];
    workstreams: Workstream[];
  };
  ownership: OwnershipEntry[];
  progress: {
    currentMilestone?: string;
    completedMilestones: string[];
    failedMilestones: string[];
    completedWorkstreams: string[];
    activeWorkstreams: string[];
  };
  verification: {
    gates: GateResult[];
    final?: GateResult;
  };
  context: {
    orchestratorSessionId?: string;
    lastHandoffAt?: string;
    handoffCount: number;
    summarisedContext?: string;
  };
  metadata: {
    artifactsDir: string;
    pattern: string;
  };
}

export function createInitialState(
  objective: string,
  opts: {
    projectId?: string;
    artifactsDir?: string;
    pattern?: string;
    constraints?: string[];
    acceptanceCriteria?: string[];
    nonGoals?: string[];
    integrityMode?: IntegrityMode;
    executionPath?: ExecutionPath;
    workingDirectory?: string;
    promptArtifact?: string;
    verificationPlan?: string[];
  } = {}
): TeamworkState {
  const now = new Date().toISOString();
  return {
    version: STATE_VERSION,
    projectId: opts.projectId || `teamwork-${Date.now()}`,
    request: {
      objective,
      constraints: opts.constraints || [],
      acceptanceCriteria: opts.acceptanceCriteria || [],
      nonGoals: opts.nonGoals || [],
      createdAt: now,
      originalInput: objective,
      integrityMode: opts.integrityMode || "development",
      executionPath: opts.executionPath || "distributed-coding",
      workingDirectory: opts.workingDirectory,
      promptArtifact: opts.promptArtifact,
      verificationPlan: opts.verificationPlan,
    },
    plan: {
      createdAt: now,
      milestones: [],
      workstreams: [],
    },
    ownership: [],
    progress: {
      completedMilestones: [],
      failedMilestones: [],
      completedWorkstreams: [],
      activeWorkstreams: [],
    },
    verification: {
      gates: [],
    },
    context: {
      handoffCount: 0,
    },
    metadata: {
      artifactsDir: opts.artifactsDir || DEFAULT_ARTIFACTS_DIR,
      pattern: opts.pattern || 'distributed-coding',
    },
  };
}

export function getStatePath(artifactsDir = DEFAULT_ARTIFACTS_DIR): string {
  return path.join(artifactsDir, 'state.json');
}

export function ensureArtifactsDir(artifactsDir = DEFAULT_ARTIFACTS_DIR): void {
  const dirs = [
    artifactsDir,
    path.join(artifactsDir, 'milestones'),
    path.join(artifactsDir, 'workstreams'),
    path.join(artifactsDir, 'research'),
    path.join(artifactsDir, 'reviews'),
    path.join(artifactsDir, 'verification'),
    path.join(artifactsDir, 'worktrees'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function saveState(state: TeamworkState, artifactsDir = state.metadata.artifactsDir): void {
  ensureArtifactsDir(artifactsDir);
  const statePath = getStatePath(artifactsDir);
  // validate before save
  if (!state.request.objective) throw new Error('State must have objective');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  // also update progress.md as human-readable mirror
  const progressPath = path.join(artifactsDir, 'progress.md');
  const progress = `# Progress — ${state.projectId}\n\n` +
    `Last updated: ${new Date().toISOString()}\n\n` +
    `## Current Milestone\n${state.progress.currentMilestone || 'none'}\n\n` +
    `## Completed Milestones\n${state.progress.completedMilestones.length ? state.progress.completedMilestones.map(m => `- [x] ${m}`).join('\n') : '- none'}\n\n` +
    `## Active Workstreams\n${state.progress.activeWorkstreams.length ? state.progress.activeWorkstreams.map(w => `- ${w}`).join('\n') : '- none'}\n\n` +
    `## Failed Milestones\n${state.progress.failedMilestones.length ? state.progress.failedMilestones.map(m => `- ${m}`).join('\n') : '- none'}\n\n` +
    `## Gates\n${state.verification.gates.map(g => `- ${g.milestoneId}: ${g.finalVerdict}`).join('\n') || '- none'}\n`;
  fs.writeFileSync(progressPath, progress, 'utf-8');
}

export function loadState(artifactsDir = DEFAULT_ARTIFACTS_DIR): TeamworkState | null {
  const statePath = getStatePath(artifactsDir);
  if (!fs.existsSync(statePath)) return null;
  const raw = fs.readFileSync(statePath, 'utf-8');
  const parsed = JSON.parse(raw) as TeamworkState;
  // migrate if needed
  if (!parsed.version) parsed.version = STATE_VERSION;
  return parsed;
}

export function updateState(
  artifactsDir: string,
  updater: (draft: TeamworkState) => void
): TeamworkState {
  const state = loadState(artifactsDir);
  if (!state) throw new Error(`No state found at ${artifactsDir}/state.json — cannot resume`);
  updater(state);
  saveState(state, artifactsDir);
  return state;
}

// Milestone / Workstream helpers
export function addMilestone(state: TeamworkState, milestone: Omit<Milestone, 'status'> & { status?: MilestoneStatus }): void {
  const m: Milestone = { status: 'pending', ...milestone } as Milestone;
  state.plan.milestones.push(m);
}

export function addWorkstream(state: TeamworkState, ws: Omit<Workstream, 'status'> & { status?: WorkstreamStatus }): void {
  const w: Workstream = { status: 'pending', ...ws } as Workstream;
  state.plan.workstreams.push(w);
  // also push ownership entry
  state.ownership.push({
    workstream: w.id,
    files: w.files,
    owner: w.owner || 'unassigned',
    status: w.status,
  });
}

export function setWorkstreamOwner(state: TeamworkState, workstreamId: string, owner: string): void {
  const ws = state.plan.workstreams.find(w => w.id === workstreamId);
  if (!ws) throw new Error(`Workstream ${workstreamId} not found`);
  ws.owner = owner;
  const entry = state.ownership.find(o => o.workstream === workstreamId);
  if (entry) entry.owner = owner;
}

export function setWorkstreamStatus(state: TeamworkState, workstreamId: string, status: WorkstreamStatus): void {
  const ws = state.plan.workstreams.find(w => w.id === workstreamId);
  if (ws) ws.status = status;
  const entry = state.ownership.find(o => o.workstream === workstreamId);
  if (entry) entry.status = status;
  // sync progress
  if (status === 'active' && !state.progress.activeWorkstreams.includes(workstreamId)) {
    state.progress.activeWorkstreams.push(workstreamId);
  }
  if (status === 'completed' && !state.progress.completedWorkstreams.includes(workstreamId)) {
    state.progress.completedWorkstreams.push(workstreamId);
    state.progress.activeWorkstreams = state.progress.activeWorkstreams.filter(id => id !== workstreamId);
  }
}

export function setMilestoneStatus(state: TeamworkState, milestoneId: string, status: MilestoneStatus): void {
  const m = state.plan.milestones.find(mm => mm.id === milestoneId);
  if (!m) throw new Error(`Milestone ${milestoneId} not found`);
  m.status = status;
  if (status === 'passed' && !state.progress.completedMilestones.includes(milestoneId)) {
    state.progress.completedMilestones.push(milestoneId);
    state.progress.failedMilestones = state.progress.failedMilestones.filter(id => id !== milestoneId);
  }
  if (status === 'failed' && !state.progress.failedMilestones.includes(milestoneId)) {
    state.progress.failedMilestones.push(milestoneId);
  }
  if (status === 'in_progress') {
    state.progress.currentMilestone = milestoneId;
  }
}

// Cancellation handling — file-based signal for subagent propagation
// When main session is stopped/reverted, Sentinel or user writes .teamwork/cancelled
// Workers/Orchestrator should poll this and abort gracefully.

export function getCancelledPath(artifactsDir = DEFAULT_ARTIFACTS_DIR): string {
  return path.join(artifactsDir, 'cancelled');
}

export function isCancelled(artifactsDir = DEFAULT_ARTIFACTS_DIR): boolean {
  return fs.existsSync(getCancelledPath(artifactsDir));
}

export function setCancelled(artifactsDir: string, reason: string): void {
  ensureArtifactsDir(artifactsDir);
  fs.writeFileSync(getCancelledPath(artifactsDir), JSON.stringify({ reason, at: new Date().toISOString() }, null, 2));
}

export function clearCancelled(artifactsDir = DEFAULT_ARTIFACTS_DIR): void {
  const p = getCancelledPath(artifactsDir);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function assertNotCancelled(artifactsDir = DEFAULT_ARTIFACTS_DIR): void {
  if (isCancelled(artifactsDir)) {
    const raw = fs.readFileSync(getCancelledPath(artifactsDir), 'utf-8');
    let reason = raw;
    try { reason = JSON.parse(raw).reason; } catch {}
    throw new Error(`Teamwork cancelled: ${reason} — clear .teamwork/cancelled to resume`);
  }
}
