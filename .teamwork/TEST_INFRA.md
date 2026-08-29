# TEST_INFRA.md — CareCanvas — Hard-Coded Hospital/Doctor/Proxy Cleanup (teamwork-1788021761432)

Synthesized: 2026-08-29T22:35Z from spec-miner-proxy-tools-verification + hospital-structure-seed + doctor-display-components

## Test Commands (baseline 1660 modules, 142+/231 PASS, lint 0)
- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone
- npm test -> vitest run (globals:true, jsdom, setup test/setup.ts clearAll) — expected 11 passed|1 skipped, 142+ passed (prior 142, may increase to 143 after updates) — after hospital/doctor/proxy generic fix, tests that asserted Raj Devi/Aarav/Patel must be updated to generic not fail
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness Tier1(7)+Tier2+Tier3+Tier4+E2E A-E — expected ALL 231 TESTS PASSED 15 suites — after generic fix runner must still 231 PASS
- npm run build -> tsc && vite build — expected EXIT 0, 1660 modules (was 1659→1660 after auth M2), dist CSS 67.69kB gz 11.57kB <50kB — build must stay 1660 after literal removal (only string replacement, no module count change)
- Tier splits: npm run test:tools --tier1, test:tier2 --tier2, test:tier3 --tier3, test:workloads --tier4, test:e2e:flows --e2e
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts 28, supabase.test.ts 8

## Coverage & Regression Guards
- vitest 142 covers LocalVault, vaultTools, pillMap, rxBridge, labStory, continuityDossier, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine — after generic fix vaultTools still 40 tools, localVault scoped counts, labStory no Patel fallback, homeLab no Metropolis, careCircle generic Family member
- test-runner 231 covers 40 tools (3 vault+2 labStory+8 pillMap+5 rxBridge+5 homeLab+9 safety+8 careCircle) + boundary T2 + cross-module INT + workloads + E2E A-E — workloads/profile tests must be updated to use generic patientId not patient-s-devi (already done in prior), now also generic doctor/proxy not Patel/Raj
- Cohesion invariants (grep -rn):
  - p_devi_78 -> 0 in src/ (test legacyMocks allowed, src 0)
  - mockShanti -> 0 in src/ (fixtures emptied, keep drug_knowledge mockBrandGeneric allowed with doc)
  - sampleDocuments -> 0 in src/
  - we pronoun 0 in src/components (direct voice)
  - slop 0 (no AI slop phrases)
  - 40 tools intact via src/tools/index.ts length 40 — grep -R "registerTool" src/tools 40
  - hidden wrappers 8 intact via App.tsx activeModule 8
  - drug_knowledge.ts St. John's Wort 233,241 keep — grep -R "St. John's Wort" src/fixtures/drug_knowledge.ts 2 hits allowed
  - New hard-code grep gates must be 0 in src/ display code after fix:
    - grep -R "ST\. JUDE\|ST JUDE\|Metropolis Healthcare\|Metropolis" src/components src/core/vault/seed.ts src/App.tsx -> 0 (BoundingBoxViewer 118, seed 116, UploadLabModal 205,236 removed)
    - grep -R "Dr\. Anita Patel\|Dr\. A\. Patel\|Dr\. Patel" src/components src/App.tsx src/core -> 0 in user-facing display (tools fallback || 'Your doctor' not Patel; allow only drug_knowledge comments if any)
    - grep -R "Raj Devi\|Aarav Sharma" src -> 0 (except test fixtures legacyMocks allowed)
    - grep -R "Shanti Devi\|Harold Jenkins" src/components src/App.tsx -> 0 (comments in tools that say no hardcoded Shanti allowed as docs, not display)
    - grep -R -i "john" src -> only St. John's Wort drug keep, 0 John proxy hard-code
    - vaultTools no longer fallback Dr. Patel, labStory no longer fallback Dr. Anita, homeLab no longer Metropolis, proxy no longer Raj/Aarav — all generic

## Snapshot Discipline (live browser mandatory)
- Every worker >=2 browser.capture (desktop 1280 + mobile 375) under .teamwork/snapshots/<milestone>/ + tablet 768 ; auditor re-captures independently
- Required viewports: 320/375/768/1024/1280/1440 — verify no empty-pill gaps, BoundingBoxViewer header generic Medical Document, empty vault No records here yet, Create Account gate centered max-w-md, proxy switcher generic Proxy/Family not Raj
- Live dev server npm run dev port 5173, browser.open http://localhost:5173 viewport desktop|mobile|tablet + snapshot + capture ; fallback puppeteer-core justified if browser capture fails — must still produce JPEG valid >5K
- Baselines: before screenshots 1280/375/768 of ST. JUDE header + Raj proxy + Dr. Patel fallbacks captured pre-M1 (cold start empty vault + Create Account gate + after account vault empty); after M1 hospital/doctor generic, after M2 proxy/tools generic, after M3 polish 6 viewports verification, auditor 3 viewports re-capture
- Auditor commands: lint+test+build+grep regrep + live re-capture 3 viewports (desktop 1280 mobile 375 tablet 768) must show BoundingBoxViewer header generic, no hospital/doctor/proxy literals, empty vault + gate still functional

## Verification Plan Per Milestone
- M1 Hospital/Doctor Audit & Removal: critic checks ST. JUDE/Metropolis grep 0, BoundingBoxViewer header generic Medical Document, seed Metropolis removed generic Healthcare provider, doctor fallbacks in labstory/safety/dossier 30 hits removed → Your doctor, build 1660, lint 0, no gaps; challenger edge cold start empty, long hospital name overflow, proxy switch not needed, doctor fallback empty vs generic; auditor rebuilds + regreps + re-captures 1280/375/768 + 6 viewports
- M2 Proxy Names Generic + Tools Fallback: critic checks Raj Devi/Aarav Sharma grep 0, John proxy 0, App.tsx generic activeProfile.name / Family member / Proxy label, ScopedPermissions generic, EmergencySnapshotCard generic, tools homeLab 5 + safety 18 Patel → Your doctor / Your care team, grep 0 in src except test legacyMocks, lint 0 test 142+ build 1660; challenger proxy switch mother/child/self generic, empty vault + after account, ScopedPermissions fallback empty, long name truncation; auditor rebuilds + regreps + re-captures + 6 viewports + vault empty generic headers
- M3 Polish + 6-viewport verification + tests/build: critic checks all remaining UI (pillmap, carecircle, rxbridge) no Patel/Raj/Metropolis/Shanti/Harold, no gaps at 320/375/768/1024/1280/1440, Create Account still required, auto sign-in still works, 40 tools, hidden wrappers 8, p_devi_78 0, we0 slop0, snapshots ≥2 per milestone valid JFIF >5K; challenger real drop FileReader still intact, vaultTools rawText synthetic not Patel, long names no overflow, auth gate still centered max-w-md 44px; auditor full lint/test/build/runner + grep + screenshot audit + no regression
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log
- Success Auditor final: independent lint/test/build/grep (ST. JUDE, Metropolis, Dr. Anita/Dr. A. Patel/Dr. Patel, Raj Devi/Aarav Sharma, Shanti/Harold, John proxy, p_devi_78, mockShanti, we, slop) + live dev-server screenshot audit at 3 viewports (must show no hard-coded literals, generic placeholders, vault empty generic header, Create Account gate still required, 6 viewports no gaps) + build 1660 + 40 tools wrappers 8 — must PASS before Sentinel Done

## Affected Files (test infra)
- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, tier3-integration cohesion 28 supabase 8, unit/integration, verification/milestone-*.md, snapshots, main.tsx, App.tsx, core/vault, core/supabase, tools/index.ts, components/auth, components/vault, components/labstory, homelab, safety, dossier, carecircle, rxbridge, fixtures/drug_knowledge.ts
- Hard-code target files: src/components/common/BoundingBoxViewer.tsx, src/core/vault/seed.ts, src/components/homelab/UploadLabModal.tsx, src/components/labstory/LabStoryView.tsx, MedOverlayBands.tsx, ProposalCard.tsx, DoctorInbox.tsx, DueCardList.tsx, src/components/safety/FollowupScheduler.tsx, TriagePanel.tsx, DangerSignModal.tsx, SafetyView.tsx, src/components/dossier/SourceLinkViewer.tsx, EmergencySnapshotCard.tsx, src/components/common/WebMCPInspector.tsx, src/components/rxbridge/ReconciliationWalk.tsx, src/components/carecircle/MultiPatientDashboard.tsx, ScopedPermissionsModal.tsx, src/App.tsx, src/tools/homeLabTools.ts, src/tools/safetyTools.ts
