/**
 * CareCanvas Fixtures Index — CLEAN (M1 Mock Removal)
 * Only drug_knowledge (clinical knowledge base) is re-exported.
 * User mock fixtures removed; CANONICAL_PATIENT_ID remains for migration fallback only.
 */

// Clinical knowledge base — NOT user mock — keep intact (allowed mockBrandGeneric, etc.)
export * from './drug_knowledge.ts';

// User mock re-exports removed (documents, longitudinal_labs, discharge_lists, patient_profiles) — M1.
// Real data flows via LocalVault for authenticated patientId.
// Fixture modules remain as separate files with minimal exports; no mock data.

// CANONICAL migration fallback remains in src/core/vault/seed.ts; not re-exported here.
