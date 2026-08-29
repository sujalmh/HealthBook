## Workstream
ws-01-01 — Supabase Client & Schema Layer — owner: worker-supabase-client

## Scope Completed
- Implemented env-only Supabase Postgres persistence layer in `src/core/supabase/client.ts:1-593` — reads `DATABASE_URL` ONLY via `import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL` (also supports `VITE_SUPABASE_URL` + `ANON_KEY` fallback), never hard-codes password, handles missing URL gracefully (local-only fallback, no throw). Exports `isSupabaseEnabled(): boolean`, `getSupabaseConfig(): {url, anonKey, enabled}`, `getSupabaseClient()` and alias `getDbClient()` returning null when disabled and lightweight fetch/pg stub client when enabled (no @supabase/supabase-js dependency, mockable `from(table)` with `selectByPatient`, `select`, `insert`, `upsert`, `delete`). Patient isolation via exact `patientId === CANONICAL_PATIENT_ID` scoping with validation; generic `patientId -> patient_id` column mapping for PostgREST.
- Added typed helpers for 13 LocalVault stores (superset of required 11): `syncFactToSupabase`/`fetchFactsFromSupabase`, `syncMedicationToSupabase`/`syncMedToSupabase`/`fetchMedicationsFromSupabase`, `syncLabToSupabase`/`fetchLabsFromSupabase`, `syncConditionToSupabase`/`fetchConditionsFromSupabase`, `syncAllergyToSupabase`/`fetchAllergiesFromSupabase`, `syncProposalToSupabase`/`fetchProposalsFromSupabase`, `syncCalendarEventToSupabase`/`fetchCalendarEventsFromSupabase`, `syncCareCircleMemberToSupabase`/`syncCareCircleToSupabase`/`fetchCareCircleFromSupabase`, `syncDoctorGrantToSupabase`/`fetchDoctorGrantsFromSupabase`, `syncDueCardToSupabase`/`fetchDueCardsFromSupabase`, `syncDangerReportToSupabase`/`fetchDangerReportsFromSupabase`, `syncDocumentToSupabase`/`fetchDocumentsFromSupabase`, `syncQuestionBankItemToSupabase`/`syncQuestionToSupabase`/`fetchQuestionBankFromSupabase`, plus generic `fetchSupabaseTable`/`upsertSupabaseRecord`. All helpers no-op with `{ok:true, skipped:true}` when disabled, validate `patientId` required, return `{ok:false, error}` on validation/network failure, enable non-blocking sync for M2.
- Created `src/core/supabase/schema.sql:1-345` — idempotent DDL mirroring LocalVault stores: 13 tables (`facts`, `documents`, `medications` + `meds` alias, `labs`, `conditions`, `allergies`, `proposals`, `calendar_events`, `care_circle`, `doctor_grants`, `due_cards`, `danger_reports`, `question_bank`) each with `id`/`grant_id`/`link_id`/`report_id` PRIMARY KEY, `patient_id TEXT NOT NULL` + index, `created_at TIMESTAMPTZ DEFAULT NOW()`, typed columns mirroring `src/types/vault.ts`, `carecircle.ts`, `safety.ts` (e.g., medications has brand_name/generic_name/dosage/frequency/status, labs has marker/value/draw_date/flag, etc.) plus `payload JSONB` for flexible forward-compat; all indexes use `CREATE INDEX IF NOT EXISTS`.
- Created `src/core/supabase/index.ts:1-7` barrel re-exporting `client.ts`.
- Verified `.env.example` already contains `[YOUR-PASSWORD]` placeholder (3 lines) not real password, and `.gitignore` covers `.env` + `.env.*` + `*.pem` (lines 4-6). No `.env` read in code.
- Verified no password leakage: `grep -R "baqduk" src/` returns 0 hits; host `db.vcgnjsxmigcaboayemmj.supabase.co` appears only in comments/docs (`client.ts` header comment, `schema.sql` header, `.env.example`, `.teamwork/plan` sanitized), never with password. No `grep p_devi_78` regression (0 hits in src owned files).
- Preserved cohesion: `CANONICAL_PATIENT_ID='patient-s-devi'` re-exported, no divergent seeds.

## Files Changed
- `src/core/supabase/client.ts` — **created** (593 lines). Env resolution helpers `readViteEnv`/`readProcessEnv`/`resolveDatabaseUrl`/`resolveAnonKey`, `getSupabaseConfig`/`isSupabaseEnabled`, `SUPABASE_TABLES` constant (13 tables), `SupabaseTableClient`/`SupabaseClient` interfaces, `LightweightTableClient` (patient_id mapping, REST fetch with anonKey auth, stub no-op for `postgresql://` URLs), `LightweightSupabaseClientImpl`, singleton `getSupabaseClient`/`getDbClient`/`_resetSupabaseClientForTests`, 26 typed sync/fetch helpers with patientId scoping.
- `src/core/supabase/schema.sql` — **created** (345 lines). 13 `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` for patient_id isolation, typed columns, payload JSONB. Postgres connection via `DATABASE_URL`; host comment only.
- `src/core/supabase/index.ts` — **created** (7 lines). `export * from './client.ts'` barrel.

## Verification
- Command: `npx tsc --noEmit`
  - Result: PASS (exit 0, no errors) — clean with new supabase types
  - Log: `/tmp/orchestrator-supabase-m1.log` (excerpt: `tsc_exit:0`)
- Command: `npm run build` (`tsc && vite build`)
  - Result: PASS — 1660 modules transformed (baseline 1660), `✓ built in 1.04s`, dist built
  - Assets: `index-BkenNSmk.js 743.34 kB | gzip 184.65 kB`, CSS 66.33 kB
  - Log: `/tmp/orchestrator-supabase-m1.log` (`build_exit:0`)
- Command: `npm test` (`vitest run`)
  - Result: 10 passed | 1 skipped (11 files), 133 passed | 1 skipped (134 tests) — includes `cohesion.test.ts` 28 PASS
  - Log: `/tmp/orchestrator-supabase-m1.log` (`vitest_exit:0`)
- Command: `node test/test-runner.ts`
  - Result: ALL 231 TESTS PASSED CLEANLY (15 suites) — Tier1 200 + Tier2 12 + Tier3 12 + Tier4 2 + E2E 5
  - Log: `/tmp/orchestrator-supabase-m1.log` (`runner_exit:0`)
- Command: `grep -R "baqduk" src/` → 0 hits (exit 1 = no matches, PASS) — verified password not in src
- Command: `grep -R "baqduk" src/core/supabase` → 0 hits — supabase layer clean
- Command: `grep -R "vcgnjsxmigcaboayemmj" src/` → only `client.ts` comment line (host comment-only, no password)
- Env checks: `.env.example` contains `[YOUR-PASSWORD]` (3 occurrences), `.gitignore` has `.env` + `.env.*` + `*.pem`
- Tools intact: `allWebMCPTools.length === 40` verified via dynamic import
- Build: `1660` modules == baseline (no regression), dist built
- Log: `/tmp/orchestrator-supabase-m1.log` (full verbose output redirected, excerpt above)

## Unresolved Issues
- None for M1 scope. Note: `resolveDatabaseUrl` stub returns `null` REST base for `postgresql://` URLs (intentional local-only fallback until `VITE_SUPABASE_URL` REST endpoint is configured). M2 sync will be no-op in that mode (skipped:true) — expected graceful degradation. When REST env (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` or `https://...supabase.co`) is present, fetch path activates. This avoids hard-coding password and keeps offline fallback.
- `.teamwork/state.json` and `plan.md` contain the string `baqduk` only as part of acceptance-criteria description (“grep -R baqduk ...”), not as password literal — src itself has 0 hits. No secret leakage.
- Future M4 `supabase.test.ts` will need `DATABASE_URL` env to exercise live sync; currently env-gated `skipped:true` path is tested via unit-level disabled checks.

## Learnings
- Vite `import.meta.env` access must be try/catch guarded for Node/vitest runtimes; direct access without optional chaining throws in non-Vite contexts.
- Postgres connection strings (`postgresql://`) cannot be used as PostgREST `fetch` base — stub must return `skipped:true` to preserve local-only fallback without network error. Translating host `db.vcgnjsxmigcaboayemmj.supabase.co` to `https://<project>.supabase.co` requires explicit REST env, not derived from DB URL, to avoid password exposure.
- Supabase schema uses `patient_id` snake_case for SQL indexing while TypeScript uses `patientId` camelCase — client must map `patientId -> patient_id` in both query filters and inserted records (plus `payload JSONB` preserves original shape). This keeps query isolation exact (`patient_id === 'patient-s-devi'`) and avoids quoted identifiers.
- Typed helpers deliberately return `Promise<SyncResult>` with `skipped` flag rather than throwing, so M2 `LocalVault.add*` wrappers can `catch -> toast local-only` non-blockingly as required.
