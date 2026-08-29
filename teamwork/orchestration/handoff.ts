/**
 * Context Management & Handoff — Orchestrator Succession
 * Implements Antigravity-like prevention of context degradation.
 * Workers communicate via structured artifacts/summaries, not raw histories.
 * Orchestrator carries summarized context, can restart fresh and restore from artifacts.
 */

import fs from 'fs';
import path from 'path';
import { loadState, saveState, type TeamworkState } from './state.js';

export interface HandoffPayload {
  fromSessionId: string;
  toSessionId?: string;
  projectId: string;
  currentGoal: string;
  currentMilestone?: string;
  dependencyState: string;
  summarizedWorkerResults: Array<{ workstream: string; summary: string }>;
  reviewFindings: string[];
  unresolvedIssues: string[];
  nextSteps: string[];
  artifactsDir: string;
  timestamp: string;
}

export function createHandoffPayload(state: TeamworkState, fromSessionId: string, opts: {
  summarizedWorkerResults?: Array<{ workstream: string; summary: string }>;
  reviewFindings?: string[];
  unresolvedIssues?: string[];
  nextSteps?: string[];
} = {}): HandoffPayload {
  return {
    fromSessionId,
    projectId: state.projectId,
    currentGoal: state.request.objective,
    currentMilestone: state.progress.currentMilestone,
    dependencyState: JSON.stringify({
      milestones: state.plan.milestones.map(m => ({ id: m.id, status: m.status, dependsOn: m.dependsOn })),
      workstreams: state.plan.workstreams.map(w => ({ id: w.id, status: w.status, dependsOn: w.dependsOn })),
    }, null, 2),
    summarizedWorkerResults: opts.summarizedWorkerResults || [],
    reviewFindings: opts.reviewFindings || [],
    unresolvedIssues: opts.unresolvedIssues || [],
    nextSteps: opts.nextSteps || [],
    artifactsDir: state.metadata.artifactsDir,
    timestamp: new Date().toISOString(),
  };
}

export function writeHandoffArtifact(artifactsDir: string, payload: HandoffPayload): string {
  const handoffDir = path.join(artifactsDir, 'handoff');
  if (!fs.existsSync(handoffDir)) fs.mkdirSync(handoffDir, { recursive: true });
  const fp = path.join(handoffDir, `handoff-${Date.now()}.json`);
  fs.writeFileSync(fp, JSON.stringify(payload, null, 2), 'utf-8');
  return fp;
}

export function readLatestHandoff(artifactsDir: string): HandoffPayload | null {
  const handoffDir = path.join(artifactsDir, 'handoff');
  if (!fs.existsSync(handoffDir)) return null;
  const files = fs.readdirSync(handoffDir).filter(f => f.startsWith('handoff-')).sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(handoffDir, latest), 'utf-8'));
}

/**
 * Context succession: start fresh orchestrator session and restore from artifacts.
 * This simulates what would happen when orchestrator's context window is too large.
 */
export function prepareSuccession(state: TeamworkState, currentSessionId: string, reason = 'context window succession'): { newSessionId: string; payload: HandoffPayload } {
  const newSessionId = `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const payload = createHandoffPayload(state, currentSessionId, {
    nextSteps: [`Succession reason: ${reason}`, 'Restore from .teamwork/state.json and progress.md'],
  });
  // update state context
  state.context.lastHandoffAt = new Date().toISOString();
  state.context.handoffCount += 1;
  state.context.orchestratorSessionId = newSessionId;
  state.context.summarisedContext = JSON.stringify({
    goal: state.request.objective,
    currentMilestone: state.progress.currentMilestone,
    completed: state.progress.completedMilestones,
  });
  saveState(state);
  writeHandoffArtifact(state.metadata.artifactsDir, payload);
  return { newSessionId, payload };
}

export function restoreFromArtifacts(artifactsDir: string): TeamworkState {
  const state = loadState(artifactsDir);
  if (!state) throw new Error(`Cannot restore: no state found at ${artifactsDir}/state.json`);
  // Validate artifacts exist
  const required = ['request.md', 'plan.md', 'progress.md', 'state.json'];
  for (const r of required) {
    const fp = path.join(artifactsDir, r);
    if (!fs.existsSync(fp)) throw new Error(`Missing required artifact: ${fp}`);
  }
  return state;
}

/**
 * Helper: get compact context for orchestrator to carry (instead of full histories)
 */
export function getCompactContext(state: TeamworkState): string {
  return [
    `# Compact Orchestrator Context — ${state.projectId}`,
    `Goal: ${state.request.objective}`,
    `Current milestone: ${state.progress.currentMilestone || 'none'}`,
    `Completed milestones: ${state.progress.completedMilestones.join(', ') || 'none'}`,
    `Active workstreams: ${state.progress.activeWorkstreams.join(', ') || 'none'}`,
    `Gates: ${state.verification.gates.map(g => `${g.milestoneId}:${g.finalVerdict}`).join(', ') || 'none'}`,
    `Handoffs: ${state.context.handoffCount}`,
    `Last handoff: ${state.context.lastHandoffAt || 'none'}`,
  ].join('\n');
}
