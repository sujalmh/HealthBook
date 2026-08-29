/**
 * Verification Gates — Distributed Coding Milestone Gate Logic
 * Implements: WORKERS → CRITIC → CHALLENGER → AUDITOR → PASS/FAIL
 * and repair/retry loop.
 */

import type { GateResult } from './state.js';

export interface ReviewResult {
  verdict: 'PASS' | 'FAIL';
  findings: string[];
  filePath?: string;
}

export interface MilestoneVerificationInput {
  milestoneId: string;
  critic: ReviewResult;
  challenger: ReviewResult;
  auditor: ReviewResult;
  evidence: string[]; // paths to logs, test outputs
}

export function evaluateGate(input: MilestoneVerificationInput): GateResult {
  const { milestoneId, critic, challenger, auditor } = input;
  // All three must PASS for final PASS
  // However, Challenger FAIL is also blocking (demonstrated break)
  const finalVerdict = (critic.verdict === 'PASS' && challenger.verdict === 'PASS' && auditor.verdict === 'PASS')
    ? 'PASS' as const
    : 'FAIL' as const;

  return {
    milestoneId,
    criticVerdict: critic.verdict,
    challengerVerdict: challenger.verdict,
    auditorVerdict: auditor.verdict,
    finalVerdict,
    evidence: input.evidence,
    timestamp: new Date().toISOString(),
  };
}

export function isGatePassed(gate: GateResult): boolean {
  return gate.finalVerdict === 'PASS';
}

export function requiresRepair(gate: GateResult): boolean {
  return gate.finalVerdict === 'FAIL';
}

/**
 * Auditor independence check: ensure auditor didn't just trust worker summary
 * Auditor must have inspected real files and command outputs.
 */
export function checkAuditorIndependence(auditorReport: string, evidence: string[]): { independent: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const reportLower = auditorReport.toLowerCase();

  // check for evidence of independent inspection
  const hasFileInspection = reportLower.includes('inspected') || reportLower.includes('read ') || reportLower.includes('file:');
  const hasCommandEvidence = evidence.length > 0 && (reportLower.includes('log') || reportLower.includes('test') || reportLower.includes('command') || reportLower.includes('run'));
  const hasRepro = reportLower.includes('re-ran') || reportLower.includes('reproduced') || reportLower.includes('verified');

  if (!hasFileInspection) reasons.push('Auditor report does not show file inspection');
  if (!hasCommandEvidence) reasons.push('Auditor lacks command output evidence');
  if (!hasRepro) reasons.push('Auditor did not re-verify tests independently (no re-run)');

  // trust phrase detection: if auditor says "trust worker" without verification, flag
  if (reportLower.includes('trust worker') && !hasRepro) {
    reasons.push('Auditor appears to trust worker summary without independent verification');
  }

  return { independent: reasons.length === 0, reasons };
}

export function checkReviewGatePresent(gate: GateResult): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (gate.criticVerdict === 'pending') missing.push('critic');
  if (gate.challengerVerdict === 'pending') missing.push('challenger');
  if (gate.auditorVerdict === 'pending') missing.push('auditor');
  return { complete: missing.length === 0, missing };
}

/**
 * Milestone cannot be marked complete without verification.
 * This enforces that state transition to 'passed' requires a gate.
 */
export function assertMilestoneCanComplete(gate: GateResult | undefined): void {
  if (!gate) throw new Error('Milestone cannot be marked complete without verification gate');
  if (gate.finalVerdict !== 'PASS') throw new Error(`Milestone cannot be marked complete: gate is ${gate.finalVerdict}`);
  const { complete, missing } = checkReviewGatePresent(gate);
  if (!complete) throw new Error(`Milestone missing review gates: ${missing.join(', ')}`);
}

/**
 * Failure recovery: generate repair task description from gate failure.
 */
export interface RepairTask {
  id: string;
  milestoneId: string;
  reason: string;
  findings: string[];
  priority: 'high' | 'medium';
}

export function createRepairTask(gate: GateResult, criticFindings: string[], challengerFindings: string[], auditorFindings: string[]): RepairTask {
  const findings = [...criticFindings, ...challengerFindings, ...auditorFindings];
  const reasonParts: string[] = [];
  if (gate.criticVerdict === 'FAIL') reasonParts.push('Critic FAIL');
  if (gate.challengerVerdict === 'FAIL') reasonParts.push('Challenger FAIL (break demonstrated)');
  if (gate.auditorVerdict === 'FAIL') reasonParts.push('Auditor FAIL');
  return {
    id: `repair-${gate.milestoneId}-${Date.now()}`,
    milestoneId: gate.milestoneId,
    reason: reasonParts.join(', '),
    findings,
    priority: 'high',
  };
}
