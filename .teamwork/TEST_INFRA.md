# TEST_INFRA.md — CareCanvas — Mock Removal → Real Data + Create Account + WebMCP (teamwork-1788014473534)

Synthesized: 2026-08-29T15:00Z from spec-miner-components-tests-verification + tools-fixtures-webmcp + structure-seed-app

## Test Commands (baseline 1663 modules, 141/231 PASS, lint 0)
- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone
- npm test -> vitest run (globals:true, jsdom, setup test/setup.ts clearAll) — expected 11 passed|1 skipped, 141 passed 1 skipped (cohesion 28 + supabase 8) — after fixture removal tests that used mock fixtures must be updated to real account not fail
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness Tier1(7)+Tier2+Tier3+Tier4+E2E A-E — expected ALL 231 TESTS PASSED 15 suites — after mock removal runner must still 231
- npm run build -> tsc && vite build — expected EXIT 0, 1663 modules, dist 0.73kB, CSS 66-67kB gz 11-12kB <50kB — build must stay 1663 after mock deletion
- Tier splits: npm run test:tools --tier1, test:tier2 --tier2, test:tier3 --tier3, test:workloads --tier4, test:e2e:flows --e2e
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts 28, supabase.test.ts 8

## Coverage & Regression Guards
- vitest 141 covers LocalVault, vaultTools, pillMap, rxBridge, labStory, continuityDossier, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine — after mock removal vaultTools no longer returns fixture facts by documentId, labStory no longer seeds mock longitudinal on empty, rxBridge no longer defaults mockShanti3ListDataset, homeLab no longer returns mockHomeLabPhotoSlip facts — all read from context.vault for context.patientId
- test-runner 231 covers 40 tools (3 vault+2 labStory+8 pillMap+5 rxBridge+5 homeLab+9 safety+8 careCircle) + boundary T2 + cross-module INT + workloads + E2E A-E — workloads/profile tests must be updated to use generic patientId not patient-s-devi
- Cohesion invariants (grep -rn):
  - p_devi_78 -> 0 in src/ (test/ ~100 hits in fixtures allowed -> after removal 0 in src/components/src tools/src fixtures (except drug_knowledge allowed) — audit)
  - seedBaselineRegimen -> 0 in src/
  - isSupabaseEnabled intact main.tsx + LocalVault.ts
  - wireLocalVaultToEventBus intact main.tsx + LocalVault.ts
  - App hidden wrappers activeModule 8 intact at App.tsx 260/278/282/286/291/296/301/310
  - 40 tools intact via src/tools/index.ts length 40
  - grep mockShantiDeviProfile etc 0 (except drug_knowledge mockBrandGeneric allowed with doc), sampleDocuments 0, patient-s-devi not hardcoded in App/components (only seed.ts fallback allowed if documented)
  - drug_knowledge.ts keep clinical knowledge base not user mock — allowed mockBrandGeneric etc if documented
- Mock grep gates must be 0 in src/ after fix:
  - grep -R "mockShantiDeviProfile" src -> 0
  - grep -R "mockShantiDeviLongitudinalLabs" src -> 0
  - grep -R "mockShantiDevi3ListDataset" src -> 0
  - grep -R "mockDischargeSummaryCardiacWard" src -> 0
  - grep -R "mockHomeLabPhotoSlip" src -> 0
  - grep -R "mockNephrologyConsultDocument" src -> 0
  - grep -R "mockHaroldJenkins" src -> 0
  - grep -R "sampleDocuments" src -> 0
  - grep -R "patient-s-devi" src/App.tsx src/components -> 0 (only seed.ts/supabase client may retain CANONICAL as constant)
  - vaultTools no longer imports/branches on mockDischarge, labStory no longer imports mockLongitudinalLabs, rxBridge no longer defaults mockShanti3ListDataset, homeLab no longer imports mockHomeLabPhotoSlip — all read from context.vault

## Snapshot Discipline (live browser mandatory)
- Every worker >=2 browser.capture (desktop 1280 + mobile 375) under .teamwork/snapshots/<milestone>/ + tablet 768 ; auditor re-captures independently
- Required viewports: 320/375/768/1024/1280/1440 — verify no empty-pill gaps, Create Account centered max-w-md mx-auto, DocumentDropzone real FileReader empty state clean
- Live dev server npm run dev port 5173, browser.open http://localhost:5173 viewport desktop|mobile|tablet + snapshot + capture ; fallback puppeteer-core justified if browser capture fails (UnknownVizError) — must still produce JPEG valid >5K
- Baselines: before screenshots 1280/375/768 of seeded demo (vault with 8 pending facts) captured pre-M1; after M1 mock removal empty vault 0 facts; after M2 Create Account centered card no seeded data; after M3 empty vault + after real upload verified via webMCPEngine.execute
- Auditor commands: lint+test+build+grep regrep + live re-capture 3 viewports (desktop 1280 mobile 375 tablet 768) must show Create Account gate when no user, empty vault after account

## Verification Plan Per Milestone
- M1 Mock Removal & Fixtures Cleanup: critic checks mockShanti etc 0, sampleDocuments 0, patient-s-devi not hardcoded, fixtures deleted/emptied, tools no longer branch on mock, build 1663, lint 0, no gaps; challenger edge viewports/long name/empty vault/grep; auditor rebuilds + regreps + re-captures + lint/test/build/runner
- M2 Create Account Gate: critic checks CreateAccountView exists centered 44px, App checks localStorage carecanvas_active_user, renders gate if no user, no Shanti hardcode, screenshots PASS desktop 1280 mobile 375 tablet 768; challenger cold start no user / sign-out clears / long name / restore session; auditor rebuilds + regreps + re-captures + 6 viewports
- M3 Real Data WebMCP + Chat + Polish: critic checks DocumentDropzone real FileReader handleRealExtract, vaultTools no fixture branch stores rawText for context.patientId, getRegisteredTools 40 after account, chat discoverable, empty vault 0 facts, after real upload/extract verified, no gaps at 6 viewports; challenger real drop / vaultTools rawText / long file / chat execute; auditor full lint/test/build/runner + grep + screenshot audit + no regression (p_devi_78 0, 40 tools, wrappers 8, direct voice we0 slop0)
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log
- Success Auditor final: independent lint/test/build/grep (mockShanti, sampleDocuments, patient-s-devi hardcode, p_devi_78, we pronoun, slop) + live dev-server screenshot audit at 3 viewports (must show Create Account gate when no user, empty vault after account) + chat 40 tools discoverable via modelContext.getRegisteredTools()===40 + webMCPEngine.execute real vault — must PASS before Sentinel Done

## Affected Files (test infra)
- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, tier3-integration cohesion 28 supabase 8, unit/integration, verification/milestone-*.md, snapshots, main.tsx, App.tsx, core/vault, core/supabase, tools/index.ts, components/auth, components/vault
- Mock target files: src/fixtures/*, src/core/vault/seed.ts, src/main.tsx, src/components/vault/DocumentDropzone.tsx, src/tools/vaultTools.ts, labStoryTools.ts, rxBridgeTools.ts, homeLabTools.ts, src/App.tsx

