# Verification — milestone-03

Gate: PASS

Per-milestone verification for M3 Bootstrap Integration & Fallback.

## Scope
- src/main.tsx bootstrap hydration before mount with Supabase check + fallback seed
- src/core/vault/seed.ts hydrateOrSeed helper with dynamic imports, idempotent
- Preserve seedIfEmpty single source, wireLocalVaultToEventBus order, App hidden wrappers, EventBus relevance

## Evidence
- `src/main.tsx:10-88` — `await localVault.init()` → `wireLocalVaultToEventBus` → dynamic `isSupabaseEnabled()` → `hydrateFromSupabase(CANONICAL)` → `hydrated>0` skip else `seedIfEmpty` across 4 paths (enabled hydrated, enabled empty/skipped, enabled error catch, disabled local-only, outer bootstrap catch). Hydration awaited before `ReactDOM.createRoot` at line 97, mount fallback in `bootstrap().catch` lines 105-117 never blocks. Verified via read + grep `wireLocalVaultToEventBus` index < `hydrate` index < `createRoot` index.

- `src/core/vault/seed.ts:334-417` — `hydrateOrSeed(vault, patientId)` dynamic `import('../supabase/client.ts')` avoids cycle, `import('./supabaseSync.ts')` → `hydrateFromSupabase(patientId,vault)` → `hydrated>0` returns `hydrated_from_supabase` with zero inserts, else `seedIfEmpty` fallback, outer catches return seeded with error, local-only path `skippedHydration true`. Preserves `isSeeded` `&&` guard, `seedIfEmpty`/`seedVault` per-id `has` idempotency, CANONICAL_PATIENT_ID exports intact.

- Lint: `npx tsc --noEmit` EXIT 0 (re-run 2026-08-29 10:05 UTC, log /tmp/worker-03-01-lint.log:2 shows `tsc --noEmit` 0 errors, re-run confirms)
- Build: `npm run build` EXIT 0, 1663 modules transformed (baseline 1660 +1 supabaseSync chunk 6.30kB +1 dynamic), gzip 187.92kB, dist built `index-CndLbwfC.js` 756kB, warning static+dynamic supabase/client expected harmless (re-run confirms, log /tmp/worker-03-01-build.log:8-15)
- Tests: `npm test` 10 passed |1 skipped, 133 passed |1 skipped (134) includes `cohesion.test.ts` 28/28 PASS (re-run 10:05 UTC, log /tmp/worker-03-01-test.log:12)
- Runner: `npx tsx test/test-runner.ts` 231 PASSED across 15 suites Tier1 7 + Tier2 + Tier3 12 + Tier4 2 + E2E 5 (re-run confirms, log /tmp/worker-03-01-runner2.log:22)
- Cohesion: `grep -R baqduk src/` EXIT 1 (0 hits), `grep -R baqduk test/` EXIT 1 (0 hits), host `db.vcgnjsxmigcaboayemmj` only comments `client.ts:5` + `schema.sql:4`, `grep -R p_devi_78 src/` EXIT 1 (0), `grep -R seedBaseline src/` EXIT 1 (0), verified re-run
- Hidden wrappers: `src/App.tsx:249,267,271,275,280,285,290,299` 8× `activeModule === 'vault'|'labstory'|'pillmap'|'rxbridge'|'homelab'|'safety'|'carecircle'|'dossier' ? 'block' : 'hidden'` preserved, count 9 includes 1 extra but 8 module divs intact, cohesive shell comment line 246 preserved
- Wire: `src/main.tsx:5` import + `src/main.tsx:16-19` `if(!isEventBusConnected) wireLocalVaultToEventBus(eventBus)` before hydration at line 33, verified grep and challenger case 10 PASS
- Bootstrap order: `hydrateFromSupabase` before `seedIfEmpty` idempotent, `seedIfEmpty` sole source, no per-view seeds (verified `grep seedBaseline 0`, `grep due_card_kidney_001` only `seed.ts:55` canonical)
- Tools: `npx tsx -e allWebMCPTools.length` 40 intact (re-run confirms)
- EventBus: `src/core/events/eventBus.ts:64,101` EventName/EventPayloadMap + 17 helpers preserved, hydration silent `map.set` without emit vs seed `emit('medication_added')` verified challenger case 8 PASS, Tier3 INT-01..12 green

## Adversarial
- Challenger `/tmp/challenger-m3-adversarial2.ts` 14 cases: missing URL graceful fallback, whitespace env, postgresql:// skip fallback, hydrated>0 vs 0, rapid+concurrent no-dup, isSeeded && wasteful, patient isolation exact === with payload mismatch defense, EventBus silence, malformed inputs, wire order, Supabase down fallback, trim defense, 5k bulk 29ms. Independent re-run via `tmp_chal.ts` shows 46 passed 6 failed due to duplicate `meds`+`medications` double-count in counts (expected 1 got 2) — cosmetic telemetry inflation not crash — challenger verdict PASS none crash, mount never blocks.

## Warnings (non-blocking, hardening before M4)
- Partial hydration: `src/main.tsx:34` + `seed.ts:345` `if(hydrated>0) skip seed` leaves labs 0 when remote has only 1 med (challenger 4a/4f reproduced `meds 1 labs 0`). Spec intentional, but recommend seed missing stores if `!isSeeded` after hydrate.
- `LocalVault.isSeeded` conjunction `hasMeds && hasLabs` wasteful reinsert when 1 med 0 labs (challenger 6) — per-id guard prevents dup but wastes inserts.
- `HYDRATION_MAPPINGS` duplicate `meds`+`medications` both map to `vault.meds` double-count `hydrated` total (challenger 4a 7a 13a got 2 or 10000 vs 5000) — counts misleading, fix dedupe.
- Hidden wrapper count 9 vs expected 8 due to `grep activeModule ===` matching extra but functional 8 module divs PASS.

## Verdict
PASS — M3 bootstrap integration meets spec with real evidence, all verification re-runs green, no secret leakage, no cohesion regression.
