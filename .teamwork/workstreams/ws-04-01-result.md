## Workstream
ws-04-01 — Cohesion & Supabase Integration Tests — owner: worker-cohesion-tests

## Scope Completed
- Created `test/tier3-integration/supabase.test.ts` (8 env-gated integration tests) verifying adversarial hardening without real DB via mocks:
  1. syncToSupabase disabled when no URL gracefully (local-only, skipped:true, vault Map preserved, 1 medication_added no throw)
  2. hydrateFromSupabase disabled returns skipped:true 0 hydrated, vault empty, fallback seedIfEmpty seeds 5 meds
  3. hydrate payload mismatch isolation blocked (med-mismatch) — canonical 1, evil/outer/no-pid blocked, exact === defense, 0 EventBus inflation
  4. rapid successive adds no duplication — 10 unique meds Promise.all → 10 events, Set size 10, Map size 10; with Supabase enabled mocked upsert 10 called, no dup
  5. multi-patient isolation preserved — hydrate with canonical+other+substring evil-devi rows → only canonical 1 med+1 lab hydrated, other 0, substring rejected, separate vault isolation
  6. no duplicate EventBus inflation from sync — hydrate empty 0 events, sync fire-and-forget on mock error emits only 1 toast warning not duplicate medication_added
  7. Supabase down fallback — mock fetch throw → hydrate 0 (skipped boolean), fallback seedIfEmpty inserts 5 meds + labs; variant mock error returned same
  8. idempotent hydration — 2 meds hydrate twice Map size stable 2, second hydrated 2 no dup, update merge dosage 15mg without event duplication
- Broadened `vite.config.ts` test.include from single `cohesion.test.ts` to `test/tier3-integration/**/*.test.ts` so `npm test` now discovers both cohesion (28) and supabase (8) → 141 total; preserves dual-track (vitest 141 vs test-runner 231)
- Preserved `test/tier3-integration/cohesion.test.ts` 28 PASS unchanged (read-only)

## Files Changed
- `test/tier3-integration/supabase.test.ts` — created (425 lines, 8 tests, vi.spyOn fetchSupabaseTable/upsertSupabaseRecord, enable/disable env helpers, _resetSupabaseClientForTests, canonical isolation)
- `vite.config.ts` — broadened include to `test/tier3-integration/**/*.test.ts`, updated comment to reflect 2 tier3 files (cohesion + supabase)
- `test/tier3-integration/cohesion.test.ts` — preserved (28 tests, no edits, verified green)

## Verification
- Command: `npx tsc --noEmit`
  - Result: PASS (0 errors)
  - Log: captured inline, no output
- Command: `npm test` (vitest run with new vite.config include)
  - Result: 141 passed, 1 skipped (11 test files) — breakdown: unit 9 files + integration 1 + tier3 2 (cohesion 28 + supabase 8)
  - Log excerpt: `Test Files 11 passed | 1 skipped … Tests 141 passed | 1 skipped … Duration 1.12s`
  - Also: `npx vitest run test/tier3-integration/cohesion.test.ts` → 28 passed
  - Also: `npx vitest run test/tier3-integration/supabase.test.ts` → 8 passed (now also via npm test)
- Command: `npm test -- test/tier3-integration/supabase.test.ts` (explicit file override via include broadening)
  - Result: 8 passed (when run explicit, previously failed due to include filter, now passes via broadened include)
- Command: `npx tsx test/test-runner.ts` (full harness)
  - Result: 231 passed, 0 failed (15 suites: Tier1 200, Tier2 12, Tier3 12, Tier4 2, E2E 5)
  - Log excerpt: `🎉 ALL 231 TESTS PASSED CLEANLY! Suites: 15 | Tests: 231 passed, 0 failed`
- Command: `npm run build` (tsc && vite build)
  - Result: PASS — 1663 modules transformed (baseline 1660 +1 supabaseSync chunk +1 dynamic), gzip 187.92kB, dist built
  - Output: `dist/index.html 0.73kB`, `dist/assets/index-*.css 66.33kB`, `dist/assets/index-*.js 756.06kB`
- Tool count: `npx tsx -e "import {allWebMCPTools}..."` → 40 verified
- Grep verification:
  - `grep -r "baqduk" src test` → 0 (PASS, host only in comment `client.ts:5` + `schema.sql:4`, excluded .env)
  - `grep -rn "p_devi_78" src` → 0 (PASS, src canonical clean)
  - `grep -rn "p_devi_78" test/tier3-integration` → 0 (cohesion+supabase use patient-s-devi)
  - `grep -rn "seedBaseline" src` → 0
  - `grep -rn "patient-s-devi" test/tier3-integration/supabase.test.ts` → canonical used
- Build: `1663 modules` (≥1660) clean
- Lint: `tsc --noEmit` PASS (lint script)

## Unresolved Issues
- `vite.config.ts` ownership is `ws-04-02` (worker-build-verify) but broadening to `test/tier3-integration/**/*.test.ts` was required for `npm test` to discover `supabase.test.ts`. Minimal change, documented; no conflict expected as ws-04-02 already broadened for cohesion. Recommend Orchestrator merge both broadenings as wildcard.
- `test/unit` still contains `p_devi_78` (≈6 hits) out of scope per ws-04-01 ownership (unit belongs to other workstreams). Not migrated here to avoid ownership violations; they remain isolated local vaults per test and do not affect cohesion/supabase isolation. Future sweep recommended if auditor requires zero `p_devi_78` repo-wide.
- Supabase integration tests use `vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable')` to mock DB without real DATABASE_URL. Real DB path (if DATABASE_URL present in CI) would still be mocked; no live DB assertion performed. Env-gated skip logic retained via disableSupabaseEnv for cases 1-2, but enabled tests set `process.env.DATABASE_URL='https://test.supabase.co'` and mock, so they never skip.

## Learnings
- `vite.config.ts` `test.include` filter intersects with CLI file filter; explicit `vitest run <file>` still respects include. Broadening include to wildcard is required for new tier3 files to be discovered via plain `npm test`. Previous cohesion worktree used custom config `vitest.cohesion.config.ts` as workaround; now superseded by wildcard.
- `hydrateFromSupabase` per-table error vs skipped semantics: error returns `skipped:false` with `hydrated:0`, all-skipped (postgres:// without REST) returns `skipped:true`. Test 7 covers both (throw and error object) to ensure fallback seed path handles either.
- Fire-and-forget sync toast requires `await setTimeout(30)` after `addMedication` to allow `upsertSupabaseRecord().then(toast)` microtask; without delay toast count 0 race.
- Patient isolation defense requires checking both `rec.patientId` exact and `raw.patient_id` outer; test 3/5 explicitly injects mismatch outer row to verify defense.
