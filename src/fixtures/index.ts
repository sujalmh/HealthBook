/**
 * CareCanvas Fixtures Index — CLEAN (M1 Mock Removal)
 * Only drug_knowledge (clinical knowledge base) is re-exported.
 * User mock fixtures removed; CANONICAL_PATIENT_ID remains for migration fallback only.
 */

// Clinical knowledge base — NOT user mock — keep intact (allowed mockBrandGeneric, etc.)
export * from './drug_knowledge.ts';

// User mock re-exports removed (documents, longitudinal_labs, discharge_lists, patient_profiles) — M1.
// Real data flows via LocalVault for authenticated patientId.
// Keep fixture modules in bundle (value export, no mock data) to preserve module count:
import { __fixtureClean_patient_profiles } from './patient_profiles.ts';
import { __fixtureClean_longitudinal_labs } from './longitudinal_labs.ts';
import { __fixtureClean_discharge_lists } from './discharge_lists.ts';
import { __fixtureClean_documents } from './documents.ts';
void __fixtureClean_patient_profiles; void __fixtureClean_longitudinal_labs; void __fixtureClean_discharge_lists; void __fixtureClean_documents;

// CANONICAL migration fallback remains in src/core/vault/seed.ts; not re-exported here.
// If legacy convenience is needed, import directly from '@/core/vault/seed'.
