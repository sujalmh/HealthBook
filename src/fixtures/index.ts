/**
 * Healthbook Fixtures Index — CLEAN (M1 Mock Removal + AI-native knowledge)
 * drug_knowledge exports clinical *shapes* only (no bundled drug tables).
 * User mock fixtures removed; CANONICAL_PATIENT_ID remains for migration fallback only.
 */

// Clinical knowledge shapes (types only — content comes from the AI pipeline)
export * from './drug_knowledge.ts';

// User mock re-exports removed (documents, longitudinal_labs, discharge_lists, patient_profiles) — M1.
// Real data flows via LocalVault for authenticated patientId.
// Fixture modules remain as separate files with minimal exports; no mock data.

// CANONICAL migration fallback remains in src/core/vault/seed.ts; not re-exported here.
