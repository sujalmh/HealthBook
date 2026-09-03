/**
 * Healthbook RBAC: Central permission checks — R8 Global
 * Mirrors carecircle.ts:8 tiers view_only|manage|full + App.tsx:53 role patient|caregiver|doctor
 * Used by App nav gate + all tool preambles to enforce view_only => PERMISSION_DENIED
 * Do not change permissionLevel enum tiers — keep exactly view_only|manage|full
 */

import { getAIConfig, isAIEnabled } from '../ai/config.ts';

export type PermissionLevel = 'view_only' | 'manage' | 'full';
export type Role = 'patient' | 'caregiver' | 'doctor';

export interface RbacProfile {
  userId?: string;
  name?: string;
  role?: Role | string;
  isProxy?: boolean;
  permissionLevel?: PermissionLevel | string;
  onBehalfOf?: string;
}

export function isViewOnly(profile?: RbacProfile | null): boolean {
  return profile?.permissionLevel === 'view_only';
}

// Single AI gate — consolidates shouldUseAI 4x duplicate (pillMapTools, rxBridgeTools, interactionEngine, reconciliationEngine)
export function shouldUseAI(): boolean {
  try {
    if (typeof process !== 'undefined' && (process as unknown as { env?: Record<string, unknown> }).env?.['VITEST'] === 'true') return false;
    return isAIEnabled(getAIConfig());
  } catch { return false; }
}

export function canWrite(profile?: RbacProfile | null): boolean {
  // view_only read-only degraded not blank — cannot approve/upload/schedule
  return profile?.permissionLevel !== 'view_only';
}

export function isFullAdmin(profile?: RbacProfile | null): boolean {
  // full tier OR patient owner (non-proxy patient) is admin
  if (profile?.permissionLevel === 'full') return true;
  if (profile?.role === 'patient' && !profile?.isProxy) return true;
  if (profile?.role === 'doctor') return true;
  return false;
}

export function canDispatchDoctorOrder(profile?: RbacProfile | null): boolean {
  if (isViewOnly(profile)) return false;
  const role = profile?.role as string;
  const perm = profile?.permissionLevel as string;
  return role === 'doctor' || perm === 'full';
}

export function permissionDeniedResult(tool: string, actionSummary?: string) {
  const summary = actionSummary || 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.';
  return {
    success: false as const,
    tool,
    timestamp: new Date().toISOString(),
    data: null,
    plainLanguageSummary: summary,
    humanApprovalRequired: false as const,
    error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' },
  };
}

// Strict vault check — does caregiver have link with required tier? Used for defense against localStorage tamper
export function hasVaultCaregiverLink(vault: unknown, patientId: string, caregiverUserId: string, required?: PermissionLevel): boolean {
  try {
    if (!vault || !patientId || !caregiverUserId) return false;
    const v = vault as { getCaregiverLinks?: (pid: string) => unknown[] };
    const links = (v.getCaregiverLinks ? v.getCaregiverLinks(patientId) : []) as Array<Record<string, unknown>>;
    return links.some((l) => {
      const idMatch = l['caregiverId'] === caregiverUserId || l['caregiverUserId'] === caregiverUserId || l['caregiverName'] === caregiverUserId;
      if (!idMatch) return false;
      if (!required) return l['status'] === 'active';
      return l['status'] === 'active' && l['permissionLevel'] === required;
    });
  } catch { return false; }
}

// General gate helper for tools — returns PERMISSION_DENIED result if blocked else null
export function gateIfViewOnly(profile: RbacProfile | null | undefined, tool: string, extraSummary?: string) {
  if (profile?.permissionLevel === 'view_only') {
    return permissionDeniedResult(tool, extraSummary);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Doctor ↔ Patient RBAC — persistent link checks
// ─────────────────────────────────────────────────────────────────────────────

export function isDoctor(profile?: RbacProfile | null): boolean {
  return profile?.role === 'doctor';
}

export function isPatient(profile?: RbacProfile | null): boolean {
  return profile?.role === 'patient';
}

export function hasVaultDoctorLink(vault: unknown, patientId: string, doctorUserId: string, required?: PermissionLevel): boolean {
  try {
    if (!vault || !patientId || !doctorUserId) return false;
    const v = vault as { getDoctorLinksForPatient?: (pid: string) => unknown[]; doctorPatientLinks?: Map<string, unknown> };
    const links = (v.getDoctorLinksForPatient ? v.getDoctorLinksForPatient(patientId) : []) as Array<Record<string, unknown>>;
    const fallback = v.doctorPatientLinks ? Array.from(v.doctorPatientLinks.values()).filter((l) => (l as Record<string, unknown>)['patientId'] === patientId) as Array<Record<string, unknown>> : [];
    const combined = links.length ? links : fallback;
    return combined.some((l) => {
      const idMatch = l['doctorId'] === doctorUserId || l['doctorUserId'] === doctorUserId || l['doctorEmail'] === doctorUserId;
      if (!idMatch) return false;
      if (!required) return l['status'] === 'active';
      return l['status'] === 'active' && l['permissionLevel'] === required;
    });
  } catch { return false; }
}

export function canDoctorAccessPatient(vault: unknown, doctorUserId: string, patientId: string): boolean {
  try {
    if (!vault || !doctorUserId || !patientId) return false;
    if (hasVaultDoctorLink(vault, patientId, doctorUserId)) return true;
    const v = vault as { getDoctorGrants?: (pid: string) => unknown[]; getDoctorLinksForPatient?: (pid: string) => unknown[] };
    const grants = (v.getDoctorGrants ? v.getDoctorGrants(patientId) : []) as Array<Record<string, unknown>>;
    const doctorLinks = (v.getDoctorLinksForPatient ? v.getDoctorLinksForPatient(patientId) : []) as Array<Record<string, unknown>>;
    const doctorEmailFromLink = (doctorLinks.find((l) => l['doctorId'] === doctorUserId || l['doctorUserId'] === doctorUserId) as Record<string, unknown> | undefined)?.['doctorEmail'] as string | undefined;
    const emailToMatch = doctorEmailFromLink || doctorUserId;
    return grants.some((g) => g['status'] === 'active' && new Date(g['expiresAt'] as string).getTime() > Date.now() && (g['doctorEmail'] === emailToMatch || g['doctorEmail'] === doctorUserId));
  } catch { return false; }
}

export function getDoctorAccessiblePatients(vault: unknown, doctorUserId: string): string[] {
  try {
    if (!vault || !doctorUserId) return [];
    const v = vault as { getPatientsForDoctor?: (id: string) => unknown[]; doctorPatientLinks?: Map<string, unknown> };
    const links = (v.getPatientsForDoctor ? v.getPatientsForDoctor(doctorUserId) : []) as Array<Record<string, unknown>>;
    if (links.length) return links.map((l) => l['patientId'] as string);
    if (v.doctorPatientLinks) {
      return Array.from(v.doctorPatientLinks.values()).filter((l) => ((l as Record<string, unknown>)['doctorId'] === doctorUserId || (l as Record<string, unknown>)['doctorUserId'] === doctorUserId) && (l as Record<string, unknown>)['status'] === 'active').map((l) => (l as Record<string, unknown>)['patientId'] as string);
    }
    return [];
  } catch { return []; }
}

export function canLinkDoctor(profile?: RbacProfile | null): boolean {
  return isFullAdmin(profile);
}

export function doctorPermissionDeniedResult(tool: string) {
  return permissionDeniedResult(tool, 'Permission denied: Doctor access requires an active patient link. Ask patient to link your doctor account.');
}
