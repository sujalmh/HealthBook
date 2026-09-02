/**
 * Production Demo Seed Map — deterministic patientId for seeded demo users
 * Allows any *@carecanvas.health seeded email to login on prod even when Supabase rate-limits (429) or returns 400,
 * by falling back to local deterministic ID that matches vault patientId (patient-asthma-0x / doctor-*)
 * This effectively disallows rate-limit UX block for demo — local fallback is instant, no email send.
 * Real users still try Supabase first; demo users bypass rate limit via local.
 */

export const SEEDED_DEMO_USERS: Record<string, { userId: string; name: string; role: 'patient' | 'doctor'; password: string }> = {
  'amara.okafor@carecanvas.health': { userId: 'patient-asthma-01', name: 'Amara Okafor', role: 'patient', password: 'Asthma2026!' },
  'liam.chen@carecanvas.health': { userId: 'patient-asthma-02', name: 'Liam Chen', role: 'patient', password: 'Asthma2026!' },
  'sofia.ramirez@carecanvas.health': { userId: 'patient-asthma-03', name: 'Sofia Ramirez', role: 'patient', password: 'Asthma2026!' },
  'marcus.johnson@carecanvas.health': { userId: 'patient-asthma-04', name: 'Marcus Johnson', role: 'patient', password: 'Asthma2026!' },
  'elena.petrova@carecanvas.health': { userId: 'patient-asthma-05', name: 'Elena Petrova', role: 'patient', password: 'Asthma2026!' },
  'james.okonkwo@carecanvas.health': { userId: 'patient-asthma-06', name: 'James Okonkwo', role: 'patient', password: 'Asthma2026!' },
  'priya.desai@carecanvas.health': { userId: 'patient-asthma-07', name: 'Priya Desai', role: 'patient', password: 'Asthma2026!' },
  'diego.fernandez@carecanvas.health': { userId: 'patient-asthma-08', name: 'Diego Fernández', role: 'patient', password: 'Asthma2026!' },
  'chloe.williams@carecanvas.health': { userId: 'patient-asthma-09', name: 'Chloe Williams', role: 'patient', password: 'Asthma2026!' },
  'barbara.klein@carecanvas.health': { userId: 'patient-asthma-10', name: 'Barbara Klein', role: 'patient', password: 'Asthma2026!' },
  'arjun.patel@carecanvas.health': { userId: 'doctor-arjun-patel', name: 'Dr. Arjun Patel', role: 'doctor', password: 'CareCanvas2026!' },
  'sarah.whitmore@carecanvas.health': { userId: 'doctor-sarah-whitmore', name: 'Dr. Sarah Whitmore', role: 'doctor', password: 'CareCanvas2026!' },
};

export function getSeededForEmail(email: string): { userId: string; name: string; role: 'patient' | 'doctor'; password: string } | null {
  const key = email.trim().toLowerCase();
  return SEEDED_DEMO_USERS[key] || null;
}

export function isRateLimitError(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes('rate limit') || m.includes('429') || m.includes('too many') || m.includes('over_email');
}

export function isEmailInvalidError(msg: string | undefined): boolean {
  if (!msg) return false;
  return msg.toLowerCase().includes('email_address_invalid') || msg.toLowerCase().includes('email address') && msg.toLowerCase().includes('invalid');
}
