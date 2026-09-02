/**
 * CareCanvas RBAC: Central permission checks — R8 Global
 * Mirrors carecircle.ts:8 tiers view_only|manage|full + App.tsx:53 role patient|caregiver|doctor
 * Used by App nav gate + all tool preambles to enforce view_only => PERMISSION_DENIED
 * Do not change permissionLevel enum tiers — keep exactly view_only|manage|full
 */

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

export function canApprove(profile?: RbacProfile | null): boolean {
  return canWrite(profile);
}

export function canUploadLab(profile?: RbacProfile | null): boolean {
  return canWrite(profile);
}

export function canSchedule(profile?: RbacProfile | null): boolean {
  return canWrite(profile);
}

export function canDispatchDoctorOrder(profile?: RbacProfile | null): boolean {
  // doctor or full admin — but global still respects view_only as blocked
  if (isViewOnly(profile)) return false;
  const role = profile?.role as string;
  const perm = profile?.permissionLevel as string;
  return role === 'doctor' || perm === 'full';
}

export function canAccessDoctorTriage(profile?: RbacProfile | null): boolean {
  return canDispatchDoctorOrder(profile);
}

export function canGrantCaregiverAccess(profile?: RbacProfile | null): boolean {
  // full admin or patient owner
  return isFullAdmin(profile);
}

export function canGrantDoctorAccess(profile?: RbacProfile | null): boolean {
  return isFullAdmin(profile);
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
export function hasVaultCaregiverLink(vault: any, patientId: string, caregiverUserId: string, required?: PermissionLevel): boolean {
  try {
    if (!vault || !patientId || !caregiverUserId) return false;
    const links: any[] = (vault.getCaregiverLinks ? vault.getCaregiverLinks(patientId) : []) || [];
    return links.some((l: any) => {
      const idMatch = l.caregiverId === caregiverUserId || l.caregiverUserId === caregiverUserId || l.caregiverName === caregiverUserId;
      if (!idMatch) return false;
      if (!required) return l.status === 'active';
      return l.status === 'active' && l.permissionLevel === required;
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
