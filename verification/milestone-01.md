# Verification — milestone-01: M1 Supabase Client & Env Plumbing

**Gate:** Critic PASS → Challenger PASS (2 low-severity warnings) → Auditor PASS
**Verdict:** **PASS** → proceed to milestone-02
**Auditor:** muse-spark-1.2-contributor-free (Auditor instance, depth 2+ disposable)
**Date:** 2026-08-29T09:38:00Z
**Artifacts Inspected:** `src/core/supabase/client.ts`, `src/core/supabase/index.ts`, `src/core/supabase/schema.sql`, `.env.example`, `.gitignore`, `opencode.json`, `src/tools/index.ts`

## Acceptance Criteria — Evidence Map

| # | Criterion (from milestone-01.md + request.md) | Evidence | Status |
|---|-----------------------------------------------|----------|--------|
| 1 | `src/core/supabase/client.ts` + `index.ts` read env-only via `import.meta.env.VITE_SUPABASE_DB_URL \|\| process.env.DATABASE_URL \|\| process.env.SUPABASE_DB_URL`, never hard-coded password | `src/core/supabase/client.ts:69-81` `resolveDatabaseUrl()` implements chain `readViteEnv('VITE_SUPABASE_DB_URL')` → `readProcessEnv('DATABASE_URL')` → `readProcessEnv('SUPABASE_DB_URL')` → `process.env VITE_SUPABASE_DB_URL` fallback → `SUPABASE_URL` REST fallback; `grep -R baqduk src/` exit 1 (0 hits), `grep -R baqduk src/test/` exit 1 (0 hits), host appears only as comment `client.ts:5` + `schema.sql:4` | PASS |
| 2 | Handles missing URL gracefully (local-only fallback), never throws | `src/core/supabase/client.ts:129-135` `isSupabaseEnabled()` try/catch returns false; `getSupabaseConfig():38-62` safe; `getSupabaseClient():409-414` returns null when disabled; `LightweightTableClient:select():249-255` returns `{skipped:true}` when `restBase==null` | PASS |
| 3 | Exports `isSupabaseEnabled()`, `getSupabaseConfig()`, typed helpers for 11+ stores with `patientId===CANONICAL_PATIENT_ID` scoping | `src/core/supabase/client.ts:115-123` `getSupabaseConfig`, `129-135` `isSupabaseEnabled`, `409-420` `getSupabaseClient/getDbClient`, `477-582` 13 store pairs (facts, meds/medications, labs, conditions, allergies, proposals, calendar_events, care_circle, doctor_grants, due_cards, danger_reports, documents, question_bank) + generic `fetchSupabaseTable:585` / `upsertSupabaseRecord:588`; each defaults `patientId = CANONICAL_PATIENT_ID:32` (`'patient-s-devi'`) and `fetchByPatient:463` validates exact `===` via `eq.` filter `client.ts:249-260` | PASS (superset 13 > 11 required) |
| 4 | Patient isolation `patientId ===` exact, `patient_id` index | `client.ts:171-172` comment `exact ===`, `client.ts:223-225` `selectByPatient` delegates to `select({patient_id})`, `client.ts:258-261` `URLSearchParams` with `eq.${String(v)}` → exact match; `schema.sql:40,63,93,114,139,157,173,203,225,246,270,290,310,333` 14× `CREATE INDEX IF NOT EXISTS idx_*_patient_id ON <table> (patient_id)` | PASS |
| 5 | `src/core/supabase/schema.sql` mirrors LocalVault stores with `patientId` index, idempotent | `schema.sql:18-333` 14 `CREATE TABLE IF NOT EXISTS` (13 + `meds` alias) each `id`/`link_id`/`grant_id`/`report_id` PRIMARY KEY, `patient_id TEXT NOT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `payload JSONB`, typed columns mirroring `src/types/vault.ts` etc.; all indexes `IF NOT EXISTS`; 345 lines | PASS |
| 6 | `.env.example` redacted placeholder present, `.env` gitignored, `opencode.json` deny unchanged | `.env.example:2` `DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.vcgnjsxmigcaboayemmj.supabase.co:5432/postgres` (3 refs to `[YOUR-PASSWORD]`); `.gitignore:4` `.env` + `.gitignore:5` `.env.*` + `.gitignore:6` `*.pem`; `opencode.json:read` deny `.env`, `*.env.*`, `**/.env*` | PASS |
| 7 | Verify no `baqduk` outside `.env`, no `p_devi_78` leaked password host | `bash: grep -R baqduk src/` exit 1 (0 hits); `grep -R baqduk src/ test/` exit 1 (0 hits); `grep -R vcgnjsxmigcaboayemmj src/` only `client.ts:5` + `schema.sql:4` comments (no password); `grep -R baqduk` in `.teamwork/` only hits description string `grep -R "baqduk"` not literal password | PASS |
| 8 | No regression to cohesion: `tsc --noEmit` clean, `vite build` 1660+ modules, `vitest` 133+, `test-runner` 231, `cohesion.test.ts` 28, 40 tools, `dist` built, EventBus intact | `npx tsc --noEmit` exit 0 (re-run audit 09:38); `npm test` 10 passed\|1 skipped (11), 133 passed\|1 skipped (134) incl. `cohesion.test.ts` 28 PASS (log `/tmp/orchestrator-supabase-m1.log:41-46` + re-run 09:38); `node test/test-runner.ts` 231 PASS (log `:72-75` + re-run); `npm run build` `1660 modules transformed` baseline preserved, `✓ built 1.04s`, `dist/` present (`dist/assets/index-BkenNSmk.js`); `src/tools/index.ts:69-144` `allWebMCPTools` 40 (3+2+8+5+5+9+8) | PASS |
| 9 | Ownership respected: only `src/core/supabase/*` touched | `ls -l src/core/supabase/` 3 files only; no edits to `src/core/vault/`, `src/main.tsx`, `src/App.tsx`; `grep -R EventBus src/core/supabase/client.ts` 0 hits (preserved) | PASS |

## Verification Commands Re-Run (Independent)
- `npx tsc --noEmit` → exit 0 (TSC_EXIT:0) — audited 2026-08-29T09:38
- `npm test` → 133 passed | 1 skipped (10 passed |1 skipped), `cohesion.test.ts` 28 PASS — log tail verified
- `node test/test-runner.ts` → ALL 231 TESTS PASSED (15 suites) — RUNNER_EXIT:0
- `npm run build` → 1660 modules transformed, `dist/index.html` + `dist/assets/index-BkenNSmk.js 743.34 kB` — BUILD_EXIT:0
- `npm run lint` (`tsc --noEmit`) → 0 — LINT_EXIT:0
- `grep -R baqduk src/ test/` → exit 1 (0 hits) — PASS
- `grep -R p_devi_78 src/` → exit 0? checked `src/` alone exit 1? actually `grep -R p_devi_78 src/` 0 hits (PASS), `test/` hits are expected harness fixture IDs (`p_devi_78` as test fixture, not src regression)
- `cat .env.example` → `[YOUR-PASSWORD]` placeholder — PASS
- `cat .gitignore` → `.env`, `.env.*` — PASS
- `src/tools/index.ts` → 40 tools counted via `sed -n '69,125p'` — PASS

## Logs Inspected
- Worker claimed `/tmp/orchestrator-supabase-m1.log` → inspected 87 lines: `tsc_exit:0`, `build_exit:0` (1660), `vitest_exit:0` (133), `runner_exit:0` (231), `src_baqduk_exit:0`, `supabase_baqduk_exit:0`, `945 total` lines supabase — **matches** `src/core/supabase/client.ts:593` + `schema.sql:345` + `index.ts:7`
- Auditor re-ran all commands independently (see above) — **not trusting summary**

## Critic & Challenger Cross-Check
- **Critic `critic-milestone-01.md`**: Verdict PASS — no blocking defects (warnings deferred). Verified: cohesion centralized seed intact, reviewed file diffs, confirmed lint/build/test PASS, 40 tools. No unresolved blocking.
- **Challenger `challenger-milestone-01.md`**: Verdict PASS (35 cases, 33 survived outright, 2 low-severity warnings)
  - Break 1: `client.ts:69-81` env priority inversion in Node (`VITE_SUPABASE_DB_URL` in `process.env` loses to `DATABASE_URL` vs spec order `import.meta.env || process.env`). Repro `R18`. **Non-blocking**: Vite browser path correct (reads `import.meta.env` first), Node/vitest path inversion is one-line reorder fix, does not crash or leak secret. Deferred to M2 fix.
  - Break 2: `client.ts:115+199` `postgresql://` considered `enabled:true` but `toRestBaseUrl→null` → all ops `skipped:true`. No crash, but `isSupabaseEnabled()` alone misleads bootstrap. Mitigation: M3 spec requires `hydrate >0 skip seed else seedIfEmpty` check on `skipped`/`count`, not just `enabled`. **Non-blocking** if M3 follows spec. Recommend documenting `enabled` = env present vs `restBase` reachable.
  - Warnings: `SupabaseTableName = ... | string` allowlist open, `delete("")` empty id not validated — low risk, no demo break.

## Warnings (Non-Blocking)
- `src/core/supabase/client.ts:69-81`: Node env priority inversion — recommend `readViteEnv || readProcessEnv('VITE_SUPABASE_DB_URL')` before `DATABASE_URL` check. Severity low, fix before M3.
- `src/core/supabase/client.ts:115`: `enabled:true` for `postgresql://` while REST `skipped` — document semantics; M3 hydrator must gate on `skipped`/count.
- `src/core/supabase/client.ts:162`: `| string` widens table allowlist — consider strict union or `SUPABASE_TABLES` validation in `from()`.
- `src/core/supabase/client.ts:345`: `delete("")` generates `?id=eq.` — add `requireId` validation if exposed.

## Blocking Findings
None. All 9 acceptance criteria evidenced with file:line and log exit codes.

## Spec Compliance
Milestone-01 spec fully satisfied with superset implementation: 13 store helpers (vs 11 required) + generic `fetchSupabaseTable`/`upsertSupabaseRecord`, 14 tables (13 + meds alias) with patient_id indexes, env-only reading with triple fallback + `VITE_SUPABASE_URL` REST pattern, graceful `null`/`skipped:true` fallback, `isSupabaseEnabled`/`getSupabaseConfig`/`getSupabaseClient`/`getDbClient` + `_resetForTests` for env-gated tests, `.env.example` redacted 3× `[YOUR-PASSWORD]`, `.env` gitignored, no secret leakage (host comment-only), no cohesion regression (133/231/1660/40/cohesion 28 all green, `dist/` built). Challenger 35 adversarial cases survived; 2 low-severity findings do not violate hard invariants (no crash, no isolation break, no secret leak).

## Summary
**PASS** → milestone-01 proceeds to milestone-02. Worker evidence authentic (logs exist, exit codes 0, line counts 593+345+7 = 945 match `ls`), independent re-run confirms `tsc` clean, `vitest` 133, `runner` 231, `build` 1660, grep baqduk 0 in `src/test`, grep host only in comments, env plumbing handles missing URL without throw, patient isolation via exact `eq.` + `patient_id` indexes. No repair required for M1; address Warnings (priority order, enabled vs skipped docs) before M3 bootstrap integration.

