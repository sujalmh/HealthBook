# TEST_INFRA.md — CareCanvas — Slop & Voice Verification Plan (teamwork-1788010057462)

Synthesized: 2026-08-29T19:06Z from spec-miner-tests-verification-infra + slop/voice miners

## Test Commands (baseline 1663 modules, 141/231 PASS, lint 0)
- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone
- npm test -> vitest run (globals:true, jsdom, setup test/setup.ts clearAll) — expected 11 passed|1 skipped, 141 passed 1 skipped (cohesion 28 + supabase 8)
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness Tier1(7)+Tier2+Tier3+Tier4+E2E A-E — expected ALL 231 TESTS PASSED 15 suites
- npm run build -> tsc && vite build — expected EXIT 0, 1663 modules, dist 0.73kB, CSS 66-67kB gz 11-12kB <50kB
- Tier splits: npm run test:tools --tier1, test:tier2 --tier2, test:tier3 --tier3, test:workloads --tier4, test:e2e:flows --e2e
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts 28, supabase.test.ts 8

## Coverage & Regression Guards
- vitest 141 covers LocalVault, vaultTools, pillMap, rxBridge, labStory, continuityDossier, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine
- test-runner 231 covers 40 tools (3 vault+2 labStory+8 pillMap+5 rxBridge+5 homeLab+9 safety+8 careCircle) + boundary T2 + cross-module INT + workloads + E2E A-E
- Cohesion invariants (grep -rn):
  - p_devi_78 -> 0 in src/ (test/ ~100 hits in fixtures allowed)
  - seedBaselineRegimen -> 0 in src/
  - isSupabaseEnabled intact main.tsx:29-30 + LocalVault.ts:21,69
  - wireLocalVaultToEventBus intact main.tsx:5,17 + LocalVault.ts:713
  - App hidden wrappers activeModule 8 intact at App.tsx:260,278,282,286,291,296,301,310
  - 40 tools intact via src/tools/index.ts length 40
- Slop grep gates must be 0 in src/ after fix:
  - grep -R "Private on your device" src -> 0 (was DocumentDropzone:84)
  - grep -R "Local Vault" src -> 0 (was PrivacyBadge:93 + LabStory:364)
  - grep -R "Zero-Cloud PHI Invariant|Zero Cloud" src -> 0 (was PrivacyBadge 102,114)
  - grep -R "100% Client-Side" src -> 0 (was PrivacyBadge:129)
  - grep -R "Weekly pill" src -> 0 (was PillMapView:460)
  - grep -R "Private & Secure" src -> keep App.tsx:157 functional chip documented
- Voice grep gates must be 0 in src/components + App.tsx after fix, tools excluded:
  - grep -R -E "\\bwe\\b" src/components src/App.tsx -i word-boundary must be 0 (was 6 hits 79,125,68,71,141,186)
  - Allow weekly/power substrings — use word-boundary not substring
  - grep we'll/We'll -> 0 (was 2) ; we're/we've already 0 stay 0
  - src/tools Should we 7 hits remain excluded

## Snapshot Discipline (live browser mandatory)
- Every worker >=2 browser.capture (desktop 1280 + mobile 375) under .teamwork/snapshots/<milestone>/ + tablet 768 ; auditor re-captures independently
- Required viewports: 320/375/768/1024/1280/1440 — verify no decorative pill gaps, no empty placeholders
- Live dev server npm run dev port 5173, browser.open http://localhost:5173 viewport desktop|mobile|tablet + snapshot + capture ; fallback puppeteer-core justified if needed
- Auditor commands: lint+test+build+grep regrep + live re-capture 3 viewports
- Success Auditor final independent lint/test/build/grep + live screenshot audit at 3 viewports — must PASS verification/final.md + snapshots/final/

## Verification Plan Per Milestone
- M1 Slop & Voice Combined: critic checks slop removed + voice direct (grep we 0, slop 0, citable files), challenger edge viewports/long text/empty + no gaps, auditor rebuilds + regreps + re-captures + lint/test/build
- M2 Polish/No-Gaps: critic responsive gaps, challenger 6 viewports + empty, auditor full lint/test/build/runner + grep + screenshot audit + no regression
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log

## Affected Files (test infra)
- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, tier3-integration cohesion 28 supabase 8, unit/integration, verification/milestone-04.md, snapshots, main.tsx, App.tsx, core/vault, core/supabase, tools/index.ts
- Slop/voice target files same as PROJECT.md ownership map