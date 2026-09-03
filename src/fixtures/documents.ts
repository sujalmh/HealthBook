
import type { DocumentRecord, Fact } from '../types/vault.ts';

export interface ExtractedDocumentFixture {
  document: DocumentRecord;
  facts: Fact[];
}

export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_documents = true;

