/**
 * Artifacts — .teamwork file helpers
 * Manages request.md, plan.md, progress.md, milestone/workstream/research/reviews/verification artifacts
 */

import fs from 'fs';
import path from 'path';

export const DEFAULT_DIR = '.teamwork';

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Request artifact — extended for Antigravity Phase 1 parity */
export interface RequestArtifact {
  objective: string;
  constraints: string[];
  acceptanceCriteria: string[];
  nonGoals: string[];
  createdAt: string;
  integrityMode?: string;
  executionPath?: string;
  workingDirectory?: string;
  verificationPlan?: string[];
  promptArtifact?: string;
}

export function writeRequestArtifact(dir: string, data: RequestArtifact): string {
  ensureDir(dir);
  const filePath = path.join(dir, 'request.md');
  let content = `# Request — Teamwork Distributed Coding\n\n` +
    `Created: ${data.createdAt}\n\n` +
    `## Objective\n${data.objective}\n\n` +
    `## Constraints\n${data.constraints.length ? data.constraints.map(c => `- ${c}`).join('\n') : '- none stated'}\n\n` +
    `## Acceptance Criteria\n${data.acceptanceCriteria.length ? data.acceptanceCriteria.map(a => `- [ ] ${a}`).join('\n') : '- none stated'}\n\n` +
    `## Non-Goals\n${data.nonGoals.length ? data.nonGoals.map(n => `- ${n}`).join('\n') : '- none'}\n\n`;
  if (data.integrityMode) content += `## Integrity Mode\n${data.integrityMode}\n\n`;
  if (data.executionPath) content += `## Execution Path\n${data.executionPath}\n\n`;
  if (data.workingDirectory) content += `## Working Directory\n${data.workingDirectory}\n\n`;
  if (data.verificationPlan?.length) content += `## Independent Verification Plan\n${data.verificationPlan.map(v => `- ${v}`).join('\n')}\n\n`;
  if (data.promptArtifact) content += `## Prompt Artifact\n${data.promptArtifact}\n\n`;
  content += `## Artifact\n- Path: ${filePath}\n- Pattern: distributed-coding\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function writePromptArtifact(dir: string, data: { objective: string; requirements: string[]; verificationPlan: string[]; acceptanceCriteria: string[]; workingDirectory: string; integrityMode: string; executionPath: string; createdAt: string }): string {
  ensureDir(dir);
  const fp = path.join(dir, 'prompt.md');
  const content = `# Prompt — Teamwork Distributed Coding (Phase 1 Reviewable Artifact)\n\nCreated: ${data.createdAt}\n\n` +
    `## Objective\n${data.objective}\n\n` +
    `## Requirements (What, Not How)\n${data.requirements.map(r => `- ${r}`).join('\n') || '- none'}\n\n` +
    `## Independent Verification (per requirement)\n${data.verificationPlan.map(v => `- ${v}`).join('\n') || '- none'}\n\n` +
    `## Acceptance Criteria\n${data.acceptanceCriteria.map(a => `- [ ] ${a}`).join('\n') || '- none'}\n\n` +
    `## Working Directory\n${data.workingDirectory}\n\n` +
    `## Integrity Mode\n${data.integrityMode}\n\n` +
    `## Execution Path\n${data.executionPath}\n\n` +
    `> Approve this prompt to proceed to Phase 2 autonomous execution. Reply with modifications or \"approve\".\n`;
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

export function readRequestArtifact(dir: string): string | null {
  const fp = path.join(dir, 'request.md');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf-8');
}

/** Plan artifact */
export interface PlanArtifact {
  milestones: Array<{ id: string; title: string; description: string; workstreams: string[]; dependsOn?: string[] }>;
  workstreams: Array<{ id: string; title: string; files: string[]; owner?: string; milestoneId: string; dependsOn?: string[] }>;
  createdAt: string;
}

export function writePlanArtifact(dir: string, plan: PlanArtifact): string {
  ensureDir(dir);
  const fp = path.join(dir, 'plan.md');
  let content = `# Plan — Distributed Coding\n\nCreated: ${plan.createdAt}\n\n`;
  content += `## Milestones\n`;
  for (const m of plan.milestones) {
    content += `### ${m.id}: ${m.title}\n${m.description}\n`;
    content += `- Workstreams: ${m.workstreams.join(', ')}\n`;
    if (m.dependsOn?.length) content += `- Depends on: ${m.dependsOn.join(', ')}\n`;
    content += `\n`;
  }
  content += `## Workstreams & Ownership\n`;
  for (const w of plan.workstreams) {
    content += `- **${w.id}** (${w.milestoneId}) — ${w.title} — files: ${w.files.join(', ')} — owner: ${w.owner || 'unassigned'}${w.dependsOn?.length ? ` — dependsOn: ${w.dependsOn.join(',')}` : ''}\n`;
  }
  content += `\n## Dependency Graph\n\`\`\`mermaid\ngraph TD\n`;
  for (const m of plan.milestones) {
    for (const dep of m.dependsOn || []) {
      content += `  ${dep} --> ${m.id}\n`;
    }
  }
  content += `\`\`\`\n`;
  fs.writeFileSync(fp, content, 'utf-8');
  // also write milestones individual files
  for (const m of plan.milestones) {
    const mp = path.join(dir, 'milestones', `${m.id}.md`);
    ensureDir(path.dirname(mp));
    fs.writeFileSync(mp, `# Milestone ${m.id}: ${m.title}\n\n${m.description}\n\n- Workstreams: ${m.workstreams.join(', ')}\n- DependsOn: ${m.dependsOn?.join(', ') || 'none'}\n- Status: pending\n`, 'utf-8');
  }
  for (const w of plan.workstreams) {
    const wp = path.join(dir, 'workstreams', `${w.id}.md`);
    ensureDir(path.dirname(wp));
    fs.writeFileSync(wp, `# Workstream ${w.id}: ${w.title}\n\n- Milestone: ${w.milestoneId}\n- Files: ${w.files.join(', ')}\n- Owner: ${w.owner || 'unassigned'}\n- DependsOn: ${w.dependsOn?.join(', ') || 'none'}\n- Status: pending\n`, 'utf-8');
  }
  return fp;
}

/** Research artifact */
export function writeResearchArtifact(dir: string, id: string, content: string): string {
  const fp = path.join(dir, 'research', `explorer-${id}.md`);
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

/** Review artifacts */
export function writeReviewArtifact(dir: string, type: 'critic' | 'challenger' | 'auditor', milestoneId: string, content: string): string {
  const fp = path.join(dir, 'reviews', `${type}-${milestoneId}.md`);
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

/** Verification */
export function writeVerificationArtifact(dir: string, milestoneId: string, content: string): string {
  const fp = path.join(dir, 'verification', `${milestoneId}.md`);
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

export function writeFinalVerification(dir: string, content: string): string {
  const fp = path.join(dir, 'verification', 'final.md');
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

export function writeProgress(dir: string, content: string): void {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'progress.md'), content, 'utf-8');
}

export function listArtifacts(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else results.push(full);
    }
  }
  walk(dir);
  return results;
}
