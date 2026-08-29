/**
 * CareCanvas Fixtures Index — Single Barrel for M1 Canonical Patient
 * Canonical patient-s-devi fixtures unified; secondary p_jenkins_72 preserved via CareCircle only.
 * Re-exports centralized seed helpers for bootstrap convenience (main.tsx imports from core directly).
 */

export * from './documents.ts';
export * from './longitudinal_labs.ts';
export * from './drug_knowledge.ts';
export * from './discharge_lists.ts';
export * from './patient_profiles.ts';

// Canonical seed re-export — allows `import { CANONICAL_PATIENT_ID, seedIfEmpty } from '@/fixtures'`
// Primary import remains `src/core/vault/seed.ts`; this is a convenience forwarding.
export { CANONICAL_PATIENT_ID, seedIfEmpty, seedVault, isSeeded } from '../core/vault/seed.ts';
