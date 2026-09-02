export interface VaultStats {
  docs: number;
  meds: number;
  labs: number;
  factsConfirmed: number;
  caregiverLinks: number;
}

export function calculateCompleteness(
  profile: { name?: string; email?: string; userId?: string },
  vaultStats: VaultStats
): number {
  let score = 0;
  const max = 100;
  if (profile.name && profile.name.trim().length > 1 && profile.name !== 'Anonymous') score += 12;
  if (profile.email && profile.email.includes('@')) score += 8;
  else if (profile.userId) score += 5;
  if (vaultStats.docs > 0) score += 15;
  if (vaultStats.meds > 0) score += 20;
  if (vaultStats.labs > 0) score += 20;
  if (vaultStats.factsConfirmed > 0) score += 15;
  if (vaultStats.caregiverLinks > 0) score += 5;
  if (score > max) score = max;
  if (score < 5 && profile.userId) score = 5;
  return Math.round(score);
}
