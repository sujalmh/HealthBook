# Explorer Baseline — Components + Tests + Verification (scope: components-tests-verification)

Synthesized: 2026-08-29 from spec miner components-tests-verification (read-only)

## Findings — Components file:line

### src/components/vault/DocumentDropzone.tsx — Mock Selector
- src/components/vault/DocumentDropzone.tsx:12 selectedSample useState 'discharge'
- src/components/vault/DocumentDropzone.tsx:14 sampleDocuments array 2 demo docs discharge+lab with rawText 20/27
- src/components/vault/DocumentDropzone.tsx:31 handleExtractSample fake extraction addDocument + webMCPEngine.execute('extract_fact',{rawText}) canned
- src/components/vault/DocumentDropzone.tsx:93 grid map(sampleDocuments) role=button CheckCircle2 111 selected
- src/components/vault/DocumentDropzone.tsx:126 find selectedSample
- Must become onDrop + input file + FileReader -> handleRealExtract real rawText — grep sampleDocuments must become 0
- No drop zone exists despite header 78 Drop a PDF

### Empty States (real-data ready, already functional)
- src/components/vault/FactStreamView.tsx:8 default patient-s-devi, :134 empty No records here yet + Drop a PDF to get started 145 — ok
- src/components/pillmap/PillMapView.tsx:74 default patient-s-devi, :108 loadMedicationsFromVault if 0 -> createEmptyGrid, :607 empty No medicines yet min-h 44 615, :621 elder bypass WARNING
- src/components/labstory/LabStoryView.tsx:307 No lab results yet 315 Add Past Results 44px
- src/components/homelab/HomeLabView.tsx:188 You're all caught up! No dose changes
- src/components/safety/SafetyView.tsx:235 No danger reports yet
- src/components/carecircle/CareCircleView.tsx:169 No helpers yet, 226 No recent activity
- src/components/dossier/DossierView.tsx:160 metric 0 medicines when empty
- src/components/common/QuestionBank.tsx:180 No questions yet

### App & Auth Gate Missing
- src/App.tsx:39 hardcoded activeProfile patient-s-devi Shanti Devi
- src/App.tsx:78 handleSwitchProfile toggles patient-s-devi vs patient-child-003 — proxy not real account
- src/App.tsx:260-310 8 hidden wrappers block/hidden verified
- src/App.tsx:146 header sticky, 228 desktop tabs hidden md:block, 316 mobile bottom nav fixed, 156 Private & Secure chip, 165 PrivacyBadge hidden lg:flex
- src/components/auth/*: 0 files — glob 0, no CreateAccountView, violates Create Account first gate
- src/components/common/PrivacyBadge.tsx:6 patient-s-devi default, 82 Local data, 98 double overflow WARNING
- src/components/common/BoundingBoxViewer.tsx:13 default doc-discharge-001 St Jude — hardcoded Shanti fixture, must become dynamic
- src/components/rxbridge/RxBridgeView.tsx:38 import mockShantiDevi3ListDataset, 67 useState(mockShantiDevi3ListDataset), 89 selector shanti?mockShanti:mockHarold — mock-driven

### Test Infra
- vite.config.ts:34 include test/unit|integration|tier3-integration (vitest 141-149)
- package.json:6 scripts dev/build/test/lint, build 1663 baseline, lint tsc --noEmit
- verification/milestone-01.md PASS 1660, milestone-04.md PASS 1663 141 231
- test/test-runner.ts:30 15 suites Tier1 7 + Tier2 + Tier3 + Tier4 + E2E 231
- test/setup.ts:1 beforeEach localVault.clearAll()
- test/harness/webmcp-test-shim.ts:18 createTestHarness patientId='patient-s-devi' default — must change to real account

### Tests Importing Mock Fixtures (must be updated)
- test/unit/rxBridge.test.ts:13 import mockShantiDevi3ListDataset
- test/e2e-flows/flow-a-discharge-night.spec.ts:7 mockShantiDevi3ListDataset
- test/tier4-workloads/real-world-workloads.spec.ts:7 mockShantiDeviProfile/mockHaroldJenkinsProfile
- test/unit/vaultTools.test.ts:8 doc ids doc_discharge_cardiac_001 etc expect ≥4 facts — will break when vaultTools stops branching
- test/integration/M1_CoreFlow.test.ts:8 same doc ids
- test/tier1-feature/vault-tools.spec.ts:24 TC-V01-01..04 Creatinine/Apixaban etc assertions
- test/unit/LocalVault.test.ts:7 p_devi_78 legacy id
- test/tier1-feature/carecircle-dossier-tools.spec.ts:27 p_devi_78, homelab-tools p_devi_78

## Mock Grep Inventory
- sampleDocuments: DocumentDropzone 14,31,93,126 — must 0
- mockShantiDevi3ListDataset: rxBridgeView 38,67,89 + tests 13
- mockShantiDeviProfile: workloads 7 etc
- patient-s-devi defaults: FactStream 8, PillMap 74, LabStory 74, PrivacyBadge 6, BoundingBoxViewer 13, RxBridgeView 62, App 39

## Dependencies
App composes 8 hidden wrappers -> DocumentDropzone handleExtractSample -> localVault + webMCPEngine -> FactStream etc via EventBus; tests mirror via harness shim isolated vault/engine per test; verification gates assert lint/test/build/grep 40 tools

## Affected Files
src/components/vault/DocumentDropzone.tsx, FactStreamView.tsx, BoundingBoxViewer.tsx, src/components/pillmap/PillMapView.tsx, labstory, homelab, safety, carecircle, dossier, common, src/App.tsx, src/components/auth/* (new), test/unit/rxBridge, e2e flow-a, workloads, vaultTools, LocalVault, harness, vite.config, package.json, verification/*

## Unknowns
- Create Account persistence localStorage vs Supabase
- FileReader PDF OCR needs pdfjs defer
- Elder empty bypass gap
