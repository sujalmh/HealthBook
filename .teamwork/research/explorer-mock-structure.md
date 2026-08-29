# Explorer Baseline — Structure + Seed + App (scope: structure-seed-app)

Synthesized: 2026-08-29 from spec miner structure-seed-app (read-only)

## Findings — File:Line Citations

### App.tsx Hardcoded patient-s-devi
- src/App.tsx:39 activeProfile userId:'patient-s-devi' name:'Shanti Devi'
- src/App.tsx:81 handleSwitchProfile caregiver isProxy true userId:'patient-s-devi' onBehalfOf:'Shanti Devi'
- src/App.tsx:111 handleSwitchProfile patient branch userId:'patient-s-devi'
- Total patient-s-devi hardcodes in App.tsx: 3
- src/App.tsx:52-58 refreshCounts localVault.getPendingFacts(activeProfile.userId)
- src/App.tsx:260 hidden wrapper vault block/hidden
- src/App.tsx:278 labstory, 282 pillmap, 286 rxbridge, 291 homelab, 296 safety, 301 carecircle, 310 dossier — 8 wrappers

### main.tsx Bootstrap Seeding
- src/main.tsx:8 import { seedIfEmpty, CANONICAL_PATIENT_ID } from './core/vault/seed.ts'
- src/main.tsx:33 hydrateFromSupabase(CANONICAL_PATIENT_ID, localVault) #1
- src/main.tsx:38 seedIfEmpty(CANONICAL) #1, 53 #2, 66 #3, 79 #4 — total 4 seedIfEmpty occurrences
- src/main.tsx:91 registerAllWebMCPTools()

### seed.ts CANONICAL & Mock Consumption
- src/core/vault/seed.ts:19 export const CANONICAL_PATIENT_ID = 'patient-s-devi'
- src/core/vault/seed.ts:14 import mockShantiDeviProfile
- src/core/vault/seed.ts:15 import mockShantiDeviLongitudinalLabs
- src/core/vault/seed.ts:213 const profile = mockShantiDeviProfile
- src/core/vault/seed.ts:254 convertToLabRecords(effectivePatientId, mockShantiDeviLongitudinalLabs)
- src/core/vault/seed.ts:53 getBaselineDueCard due_card_kidney_001
- src/core/vault/seed.ts:67 getBaselineProposal prop_metformin_titration_001
- src/core/vault/seed.ts:85 getBaselineDangerReport danger_edema_001
- src/core/vault/seed.ts:99 getBaselineCalendarEvents cal_followup_001, cal_lab_002

### LocalVault Pre-populated
- src/core/vault/LocalVault.ts:23-37 13 Maps facts/documents/meds/labs/allergies/conditions/proposals etc
- src/core/vault/LocalVault.ts:643 isSeeded hasMeds&&hasLabs
- src/core/vault/LocalVault.ts:671 getSeedCounts 8 stores
- src/core/vault/LocalVault.ts:710 singleton localVault

### WebMCPEngine mockContext
- src/core/webmcp/WebMCPEngine.ts:45 const mockContext = { registerTool, getRegisteredTools, executeTool }
- src/core/webmcp/WebMCPEngine.ts:61 globalThis.modelContext = mockContext
- src/core/webmcp/WebMCPEngine.ts:187 defaultContext patientId: CANONICAL_PATIENT_ID
- src/core/webmcp/WebMCPEngine.ts:188 activeProfile user_shanti_devi

### Fixtures
- src/fixtures/patient_profiles.ts:29 mockShantiDeviProfile id:'patient-s-devi' MRN-984210 age78
- src/fixtures/patient_profiles.ts:170 mockHaroldJenkinsProfile id:p_jenkins_72
- src/fixtures/longitudinal_labs.ts:21 mockShantiDeviLongitudinalLabs 7 points
- src/fixtures/longitudinal_labs.ts:115 mockHaroldJenkinsLongitudinalLabs
- src/fixtures/discharge_lists.ts:19 mockShantiDevi3ListDataset 7/6/6 meds
- src/fixtures/documents.ts:12 mockDischargeSummaryCardiacWard doc_discharge_cardiac_001
- src/fixtures/documents.ts:172 mockHomeLabPhotoSlip doc_homelab_slip_002
- src/fixtures/documents.ts:241 mockNephrologyConsultDocument doc_consult_note_nephrology_006
- src/fixtures/drug_knowledge.ts:13 mockBrandGenericCatalog KEEP knowledge base

## Mock Grep Inventory (file:line) — Required AC
- mockShantiDeviProfile: src/fixtures/patient_profiles.ts:29, src/core/vault/seed.ts:14, src/core/vault/seed.ts:213
- mockShantiDeviLongitudinalLabs: src/fixtures/longitudinal_labs.ts:21, src/core/vault/seed.ts:15, src/core/vault/seed.ts:254
- mockShantiDevi3ListDataset: src/fixtures/discharge_lists.ts:19 (strict), plus src/tools/rxBridgeTools.ts:10,354 out-of-scope
- mockDischargeSummaryCardiacWard: src/fixtures/documents.ts:12, src/tools/vaultTools.ts:8,42
- mockHomeLabPhotoSlip: src/fixtures/documents.ts:172, src/tools/vaultTools.ts:8,44, src/tools/homeLabTools.ts:7,35
- mockNephrologyConsultDocument: src/fixtures/documents.ts:241, src/tools/vaultTools.ts:8,46
- sampleDocuments: src/components/vault/DocumentDropzone.tsx:14 const sampleDocuments, :31 handleExtractSample, :93 map, :126 find
- CANONICAL_PATIENT_ID: src/core/vault/seed.ts:19, src/main.tsx:8,33,38,53,66,79 (46 hits repo-wide, 31 strict)
- patient-s-devi hardcode: src/App.tsx:39,81,111 (3), plus fixtures ~22, components ~10, tests ~25 total ~100 repo-wide
- mockContext: src/core/webmcp/WebMCPEngine.ts:45,61,62

## Dependencies
main.tsx bootstrap -> LocalVault init -> wire EventBus -> hydrateOrSeed(CANONICAL) via seed.ts mock profile+labs -> registerAllWebMCPTools polyfill mockContext -> App reads localVault via patient-s-devi -> 8 hidden wrappers

## Affected Files
- src/App.tsx, src/main.tsx, src/core/vault/seed.ts, src/core/vault/LocalVault.ts, src/core/vault/supabaseSync.ts, src/core/webmcp/WebMCPEngine.ts, src/fixtures/patient_profiles.ts, longitudinal_labs.ts, discharge_lists.ts, documents.ts, index.ts, drug_knowledge.ts (keep), tailwind.config.js, vite.config.ts

## Unknowns
- tools branching not readable per isolation, inferred via grep only
- LocalVault persistence in-memory vs IndexedDB
- isNative flag may never be true

## Recommendations
- See PROJECT.md risks — keep CANONICAL only as migration fallback, replace App hardcodes with CreateAccount, update seed to accept real patientId
