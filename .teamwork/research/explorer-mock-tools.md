# Explorer Baseline — Tools + Fixtures + WebMCP (scope: tools-fixtures-webmcp)

Synthesized: 2026-08-29 from spec miner tools-fixtures-webmcp (read-only)

## Findings — Mock Import Inventory file:line

### src/tools/vaultTools.ts
- src/tools/vaultTools.ts:8 import { mockDischargeSummaryCardiacWard, mockHomeLabPhotoSlip, mockNephrologyConsultDocument } from '../fixtures/documents.ts'
- src/tools/vaultTools.ts:42 extractedFacts = mockDischargeSummaryCardiacWard.facts when documentId === 'doc_discharge_cardiac_001' || includes('discharge')
- src/tools/vaultTools.ts:44 mockHomeLabPhotoSlip.facts when includes('homelab')
- src/tools/vaultTools.ts:46 mockNephrologyConsultDocument.facts when includes('nephrology')
- src/tools/vaultTools.ts:68 loop context.vault.addFact({...fact, patientId:context.patientId})
- src/tools/vaultTools.ts:264 isShanti = patientId === CANONICAL_PATIENT_ID
- src/tools/vaultTools.ts:391 verifiedAllergies fallback Penicillin if isShanti
- src/tools/vaultTools.ts:514 chronicConditions fallback CKD if isShanti
- src/tools/vaultTools.ts:335-341 mostRecentCriticalLabs defaults eGFR 32 Creat 1.8 etc

### src/tools/homeLabTools.ts
- src/tools/homeLabTools.ts:7 import { mockHomeLabPhotoSlip } from '../fixtures/documents.ts'
- src/tools/homeLabTools.ts:35 const fixture = mockHomeLabPhotoSlip unconditional
- src/tools/homeLabTools.ts:47 context.vault.addFact({...fact, patientId:params.patientId||context.patientId})
- src/tools/homeLabTools.ts:60 extractedValues Creat 1.90 eGFR 28 hardcoded narration L54

### src/tools/labStoryTools.ts
- src/tools/labStoryTools.ts:10 import { mockShantiDeviLongitudinalLabs, mockHaroldJenkinsLongitudinalLabs, convertToLabRecords }
- src/tools/labStoryTools.ts:313 labPoints = isJenkins ? mockHarold ... : mockShanti in extract_labs else branch
- src/tools/labStoryTools.ts:407 same in correlate_meds fallback seeding on empty
- src/tools/labStoryTools.ts:440 hardcoded narrative bLower.includes('egfr') declines etc

### src/tools/rxBridgeTools.ts
- src/tools/rxBridgeTools.ts:10 import { mockShantiDevi3ListDataset }
- src/tools/rxBridgeTools.ts:354 const dataset = params.dataset || mockShantiDevi3ListDataset default

### src/tools/pillMapTools.ts, safetyTools, careCircleTools
- 0 mock imports verified — already vault-backed
- src/tools/careCircleTools.ts:46 includes('devi') heuristic must be replaced with vault lookup

### Fixtures
- src/fixtures/documents.ts:12 mockDischargeSummaryCardiacWard id doc_discharge_cardiac_001 9 facts
- src/fixtures/documents.ts:172 mockHomeLabPhotoSlip doc_homelab_slip_002 3 facts
- src/fixtures/documents.ts:241 mockNephrologyConsultDocument doc_consult_note_nephrology_006 1 fact
- src/fixtures/longitudinal_labs.ts:21 mockShantiDeviLongitudinalLabs 7 points 2022-2026
- src/fixtures/discharge_lists.ts:19 mockShantiDevi3ListDataset 7/6/6 meds NEW/DOSE_CHANGED/STOPPED
- src/fixtures/patient_profiles.ts:29 mockShantiDeviProfile MRN-984210
- src/fixtures/drug_knowledge.ts KEEP knowledge base 20 entries

### WebMCP & Vault
- src/core/webmcp/WebMCPEngine.ts:13 CANONICAL import, :45 mockContext polyfill, :61 globalThis.modelContext, :187 default patientId CANONICAL, :188 activeProfile Shanti
- src/core/vault/LocalVault.ts:23 13 Maps, :643 isSeeded, :671 getSeedCounts
- src/tools/index.ts:69 40 tools catalog 3+2+8+5+5+9+8

## Branching Logic
- vaultTools extract_fact if discharge/homelab/nephrology then fixture else generic fallback 47-65 — overly broad includes()
- labStory extract_labs else mockShantiLabs even for new patients — must read rawLabData only
- correlate_meds seeds mock labs when existingLabs 0
- rxBridge export_patient_summary defaults mock dataset
- homeLab upload_lab_image unconditional fixture

## Mock Grep Inventory
- mockShantiDeviProfile: 3 in tools? 0 but fixtures 29 etc — toolsFi 9 repo-wide 3 strict handled
- mockShantiDeviLongitudinalLabs: labStoryTools 11,313,407 + fixtures 21
- mockShantiDevi3ListDataset: rxBridge 10,354 + fixtures 19
- mockDischargeSummaryCardiacWard: vaultTools 8,42 + fixtures 12
- mockHomeLabPhotoSlip: vaultTools 8,44 + homeLab 7,35 + fixtures 172
- mockNephrologyConsultDocument: vaultTools 8,46 + fixtures 241
- CANONICAL: WebMCP 13,187 + seed 19 etc 46 repo-wide
- patient-s-devi: compile_health_record 264 etc

## Dependencies
tools/index catalog -> WebMCPEngine registry -> context.vault LocalVault -> fixtures mock data currently, should become rawText/rawLabData/imageBlob parsing

## Affected Files
src/tools/vaultTools.ts, labStoryTools.ts, rxBridgeTools.ts, homeLabTools.ts, index.ts, src/fixtures/*, src/core/webmcp/WebMCPEngine.ts, src/core/vault/LocalVault.ts

## Unknowns
- drug_knowledge keep vs delete — keep as knowledge
- fixtures delete vs decouple — seed still imports Shanti
- Create Account flow unknown per scope
