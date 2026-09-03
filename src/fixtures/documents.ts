/**
 * Healthbook Fixtures: Document Types — CLEAN (M1 Mock Removal)
 * Mock documents removed; real extraction uses rawText/documentId for context.patientId.
 */

import type { DocumentRecord, Fact } from '../types/vault.ts';

export interface ExtractedDocumentFixture {
  document: DocumentRecord;
  facts: Fact[];
}

// Mock documents removed — M1.
// Real documents are uploaded via DocumentDropzone FileReader and processed by vaultTools.extract_fact
// which writes vault-derived facts for context.patientId (no fixture branching).
// Test-only legacy bridge:
export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_documents = true;
