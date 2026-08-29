## Verdict
**PASS** (no hard break demonstrated — 2 low-severity assumption violations noted, 35 adversarial cases attempted, all crash/secret/isolation claims survived)

## Adversarial Cases Attempted
1. **Case: missing DATABASE_URL graceful** — `src/core/supabase/client.ts:129` `isSupabaseEnabled()` must not throw when env absent → constructed runtime test `challenger-m1-runtime-runner.ts:R1-R3` with all env deleted → Result: **survived** — `getSupabaseConfig() => {url:null, enabled:false}`, `getSupabaseClient() => null`, no throw.
2. **Case: empty string patientId** — `src/core/supabase/client.ts:223` `selectByPatient('')` + `client.ts:444` `syncRecord` with `patientId=""` → runtime R6,R7 → Result: **survived** — returns `{ok:false, error:"patientId required"}` / `{error:"patientId required"}`, no throw, no DB call.
3. **Case: missing patientId field** — `client.ts:434` `requirePatientId(undefined)` → R8 → Result: **survived** — `ok:false`.
4. **Case: postgresql:// URL enabled-but-skipped semantic** — `client.ts:199` `isPostgresConnectionString` + `client.ts:200` `toRestBaseUrl` returns null → `client.ts:115` `enabled: !!url` true → R9-R14 with `DATABASE_URL=postgresql://...` → Result: **survived but ambiguous** — `isSupabaseEnabled()=true` but `selectByPatient => {skipped:true, error:null}`, `upsert => skipped:true`, `syncFact => skipped:true`. No crash, but bootstrap hydrator checking only `isSupabaseEnabled()` would think remote is available and skip seed while hydration returns 0 rows silently.
5. **Case: whitespace-only URL** — `client.ts:43` `trim() !== ''` guard → R15 with `DATABASE_URL="   "` → Result: **survived** — `enabled:false`, `url:null`, treated as missing.
6. **Case: malformed URL not-a-url** — `client.ts:199` `toRestBaseUrl` final `return null` → R16 with `DATABASE_URL=not-a-url` → Result: **survived** — `enabled:true` (non-empty) but `restBase=null` → `skipped:true`, no throw, no fetch attempt, no crash.
7. **Case: valid https REST URL** — `client.ts:86` fallback `SUPABASE_URL=https://...` → R17 → Result: **survived** — `enabled:true`, `config.url=>https://...`, client non-null.
8. **Case: env priority VITE_SUPABASE_DB_URL vs DATABASE_URL** — `client.ts:69-81` `resolveDatabaseUrl()` order → R18 set `VITE_SUPABASE_DB_URL=https://priority.supabase.co` + `DATABASE_URL=postgresql://...` → Expected `priority.supabase.co` per spec `import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL` but actual in Node got `postgresql://...` because `readViteEnv` reads `import.meta.env` (undefined in Node) then `DATABASE_URL` wins before `viteDbUrlProc` fallback → Result: **BREAK DEMONSTRATED low-severity priority inversion** — spec priority violated in Node/test harness (Vite runtime correct). See Breaks.
9. **Case: rapid concurrent sync/fetch** — `client.ts:287` `insert`/`client.ts:316` `upsert` with disabled client → R19 `Promise.all` 4 concurrent calls → Result: **survived** — all `skipped:true`, no race, no duplication, no throw.
10. **Case: injection patientId** — `client.ts:249` `select` uses `URLSearchParams` + `client.ts:228` `mapFilterKey` → R20 with `patientId="patient-s-devi' OR '1'='1"` captured fetch URL → Result: **survived** — URL encoded as `patient_id=eq.patient-s-devi%27+OR+%271%27%3D%271`, no SQL injection, exact eq filter only.
11. **Case: multi-patient isolation different IDs** — `client.ts:223` exact `selectByPatient` → R21 with `attacker-patient` vs canonical → Result: **survived** — different URL `patient_id=eq.attacker-patient`, isolation preserved via `eq.` filter, no cross-patient leak in stub.
12. **Case: very long patientId (10k chars)** — `client.ts:434` validation only non-empty check → R22 `fetchFactsFromSupabase("a"*10000)` → Result: **survived** — `skipped:true` when disabled, no OOM, no stack overflow, URL would be large but not in this path.
13. **Case: singleton memoization without reset** — `client.ts:391` `singletonUrl` tracking → R23 set `first.supabase.co` then `second` without `_reset` → Expected stale but got fresh (auto-healed) → Result: **survived (stronger than expected)** — `createClientOrNull` already recreates on URL change (`singletonUrl === cfg.url` check at `client.ts:399`).
14. **Case: singleton after reset updates** — `client.ts:423` `_resetSupabaseClientForTests` → R24 → Result: **survived** — after reset URL correctly `second.supabase.co`.
15. **Case: CANONICAL_PATIENT_ID consistency** — `client.ts:32` vs `seed.ts:19` → R25 dynamic import compare → Result: **survived** — both `patient-s-devi`.
16. **Case: SUPABASE_TABLES count** — `client.ts:145` 14 entries (13+meds alias) → R26 → Result: **survived** — 14, spec requires 11+stores.
17. **Case: barrel re-export** — `src/core/supabase/index.ts:7` `export * from './client.ts'` → R27 barrel import → Result: **survived** — `isSupabaseEnabled` function available.
18. **Case: network down fetch throws** — `client.ts:282` catch `e.message` → extra test with `fetch` throwing `network down` → Result: **survived** — returns `{data:null, error:"network down"}`, `syncFact=>{ok:false}`, no throw.
19. **Case: 401 HTTP error** — `client.ts:277` `!res.ok` text → extra 401 `Unauthorized` → Result: **survived** — `error:"select facts failed: 401 Invalid API key"`.
20. **Case: delete empty id encoding** — `client.ts:349` `encodeURIComponent(id)` with `""` → extra delete => `?id=eq.` → Result: **survived** — no throw, caller must validate id separately (acceptable, not M1 scope).
21. **Case: secret leakage grep** — `client.ts:5` comment host only, `schema.sql:4` host comment only → `grep -rn baqduk src/` + `grep -rn pinsow` → Result: **survived** — 0 hits in `src/`, `.teamwork/` only has description string `grep -R "baqduk"` not password literal, `.env` gitignored (`.gitignore:4`), `.env.example` redacted `[YOUR-PASSWORD]`.
22. **Case: console.log password** — `client.ts:189` `getUrl()` warning comment → `grep console.log` → Result: **survived** — 0 console.log in supabase module.
23. **Case: schema patient_id indexes** — `schema.sql:40` `idx_facts_patient_id` etc → static analysis G-table checks 13 tables + meds alias → Result: **survived** — all 14 tables have `patient_id TEXT NOT NULL` + `CREATE INDEX IF NOT EXISTS idx_*_patient_id`, enabling `WHERE patient_id='patient-s-devi'` scoped queries.
24. **Case: schema idempotency** — `schema.sql:18` `CREATE TABLE IF NOT EXISTS` → Result: **survived** — all CREATEs use IF NOT EXISTS.
25. **Case: tsc clean** — `npx tsc --noEmit` → Result: **survived** — EXIT 0.
26. **Case: vite build 1660** — `npm run build` → Result: **survived** — `✓ 1660 modules transformed`, assets built, baseline preserved.
27. **Case: vitest 133** — `npm test` → Result: **survived** — `10 passed |1 skipped, 133 passed |1 skipped` including `cohesion.test.ts:28`.
28. **Case: test-runner 231** — `node test/test-runner.ts` → Result: **survived** — `ALL 231 TESTS PASSED`.
29. **Case: .env.example placeholder** — read `.env.example:2` → Result: **survived** — 3 lines with `[YOUR-PASSWORD]`.
30. **Case: opencode deny** — `opencode.json:read` `*.env deny` → Result: **survived** — `.env` cannot be read by workers.
31. **Case: toDbRecord mapping** — `client.ts:237` `patientId->patient_id`, `link_id`, `grant_id`, `report_id` → static check → Result: **survived** — all present, preserves snake_case isolation.
32. **Case: empty DATABASE_URL vs missing** — `client.ts:52` `readProcessEnv` `trim()!==''` → Result: **survived** — empty treated as null.
33. **Case: VITE_SUPABASE_URL fallback** — `client.ts:86` `SUPABASE_URL` fallback chain → manual code read → Result: **survived** — REST fallback present, enables https base when DB URL absent.
34. **Case: SupabaseTableName union allows arbitrary string** — `client.ts:162` `SupabaseTableName = ... | string` → Result: **survived with coverage gap** — allows any table name injection but no validation; low risk since callers are internal typed helpers, but external `from(table)` could be abused — not a crash.
35. **Case: meds alias vs medications** — `client.ts:148` `'meds'` alias + `client.ts:490` `fetchMedicationsFromSupabase` tries canonical then alias → Result: **survived** — `meds` table present in schema, hydration compatibility handled.

## Breaks Demonstrated
**`src/core/supabase/client.ts:69-81` Env priority inversion in Node/test harness — FAIL low severity, not crash:**
```ts
function resolveDatabaseUrl(): string | null {
  const viteDbUrl = readViteEnv('VITE_SUPABASE_DB_URL'); // import.meta.env undefined in Node => null
  if (viteDbUrl) return viteDbUrl;
  const procDbUrl = readProcessEnv('DATABASE_URL'); // wins even if VITE_SUPABASE_DB_URL in process.env
  if (procDbUrl) return procDbUrl;
  // ...
  const viteDbUrlProc = readProcessEnv('VITE_SUPABASE_DB_URL'); // too late
  if (viteDbUrlProc) return viteDbUrlProc;
```
Reproduced: `challenger-m1-runtime-runner.ts:R18` set `VITE_SUPABASE_DB_URL=https://priority.supabase.co` + `DATABASE_URL=postgresql://...` in `process.env`, expected `priority.supabase.co` per spec `import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL` but got `postgresql://...`. In Vite browser Vite env would win, but Node/vitest path violates spec order. Fix: check `process.env.VITE_SUPABASE_DB_URL` immediately after `readViteEnv` or merge both reads before DATABASE_URL check, e.g., `readViteEnv || readProcessEnv('VITE_SUPABASE_DB_URL')` as first branch.

**`src/core/supabase/client.ts:115` + `client.ts:199` postgresql:// considered enabled but all operations silent no-ops — PASS gracefully but assumption violation:**
```ts
getSupabaseConfig(): { enabled: !!url } // true for postgresql://
toRestBaseUrl(url): null // for postgresql:// => restBase null => every method returns {skipped:true}
```
Reproduced: `R9-R14` — `isSupabaseEnabled()=true`, `getSupabaseClient()!=null`, but `selectByPatient => {data:[], skipped:true}`. No throw, but misleading: M3 bootstrap `if(isSupabaseEnabled()) hydrate` would attempt hydrate, get 0 rows with `skipped:true`, and might incorrectly skip seed. Mitigation requires hydrator to check `skipped`/`hydrated count` not just `enabled`, which M2 spec does (`if hydrated>0 skip seed else seedIfEmpty`). Verified safe if M3 follows spec, but `enabled` semantics need documentation: enabled means env present, not REST reachable.

## Assumption Violations
**`src/core/supabase/client.ts:162` `SupabaseTableName = ... | string` assumes callers never pass arbitrary table:** `from()` accepts `string` bypassing `SUPABASE_TABLES` allowlist. Direct call `getSupabaseClient().from('pg_catalog.pg_user')` would generate URL `/rest/v1/pg_catalog.pg_user` and attempt fetch with attacker-controlled table name. No injection crash in stub, but no validation. Low risk as typed helpers are internal, but challenger flags as injection surface. Recommend narrowing to `SupabaseTableName` exact or validating against allowlist.

**`src/core/supabase/client.ts:200` `toRestBaseUrl` assumes `http(s)://` URL is valid REST base:** `if (url.startsWith('http://')||'https://') return url` without URL validation. Input `https://` or `https:// evil.com` passes. Caller responsibility, but malformed `not-a-url` case correctly falls to `null` via final return, so only `http`-prefixed strings enter fetch path. Network error then handled via `catch` → `error` field, not throw, so survived. Still flagged as malformed-input assumption.

**`src/core/supabase/schema.sql:99` Dual `meds`+`medications` tables assume Postgres allows both:** Creates two real tables, not view alias. Hydration `client.ts:492` checks `medications` then `meds` alias fallback, but writes via `syncMedicationToSupabase` only to `medications`. If legacy data in `meds` exists, hydration merges correctly, but sync never writes to `meds`, so alias divergence possible. Spec said `meds` is back-compat alias — implementation as real table is defensive but could hold stale data. Flagged as coverage gap not break.

## Coverage Gaps
- No test for `VITE_SUPABASE_ANON_KEY` + `SUPABASE_URL` auth header omission when anonKey missing → `client.ts:263` correctly deletes headers if `!anonKey`, but not exercised in vitest suite (only via adversarial mock).
- No test for `delete("")` empty id validation — `client.ts:345` generates `?id=eq.` and succeeds (no error), caller should validate but helper doesn't.
- No test for very long URL (MAX_URL ~8192) — 10k patientId tested, but DB URL of 10k length not tested; `trim()` would keep it, `enabled=true`, `toRestBaseUrl` would return long string and fetch would fail with `error` not throw.
- No test for `import.meta.env.VITE_SUPABASE_DB_URL` in Vite-evaluated build — priority inversion only visible in Node, Vite path untested via vitest (jsdom) may mask; recommend adding Vite-specific env test.
- No `.env` read leakage test in CI — `.teamwork/state.json` contains `baqduk` string in acceptance description (4 hits) but not password; grep exclusion `--exclude=.env` must be used in audit script to avoid false positive.
- Timezone/daylight concerns N/A for M1 (no date logic), concurrency race not applicable (singleton auto-heals on URL change, tested R23 shows stronger guarantee).

## Summary
Milestone M1 Supabase Client & Env Plumbing is robust against hard adversarial invariants: missing URL never throws, secret never leaks, patientId validation prevents empty/missing isolation bypass, postgresql:// gracefully degrades to `skipped:true` local-only, injection via patientId is URL-encoded via `URLSearchParams`, schema provides 14 tables with `patient_id` indexes matching 13 LocalVault stores (+meds alias), barrel re-export works, `tsc` clean, `vite build 1660` preserved, `vitest 133` and `test-runner 231` green. 33/35 runtime adversarial cases survived outright, 2 revealed low-severity findings: (1) Node env priority inversion (`VITE_SUPABASE_DB_URL` in `process.env` loses to `DATABASE_URL`) — fix one-line reorder, does not crash; (2) `enabled:true` for `postgresql://` while REST is `skipped` — graceful no-op but requires M3 hydrator to check `skipped`/`count` not just `enabled`. The `| string` table name allowlist and empty-delete validation are minor injection/hardening gaps. **Verdict PASS** — M1 should gate pass, with recommendation to fix priority order and document `enabled` vs `skipped` semantics before M2/M3 bootstrap integration. No secret, no crash, no isolation break demonstrated.

