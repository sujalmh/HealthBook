export function resolvePatientId(primary?: string, fallback?: string): string {
  const trim = (v?: string) => (typeof v === 'string' ? v.trim() : '');
  const p = trim(primary);
  if (p && p !== 'patient-s-devi') return p;
  const f = trim(fallback);
  if (f && f !== 'patient-s-devi') return f;
  try {
    const raw = localStorage.getItem('healthbook_active_user');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown as { userId?: unknown; id?: unknown; patientId?: unknown };
      const pid = (parsed as { userId?: unknown })?.userId ?? (parsed as { id?: unknown })?.id ?? (parsed as { patientId?: unknown })?.patientId;
      if (typeof pid === 'string' && pid.trim() && pid.trim() !== 'patient-s-devi') return pid.trim();
    }
  } catch {}
  return p || f || '';
}
