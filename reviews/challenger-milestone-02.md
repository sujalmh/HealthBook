## Verdict
**FAIL** — demonstrated patient-isolation leak via payload vs raw mismatch (reproduced in `/tmp/challenger-m2-v2.log:42`); all other core behaviors survive but isolation guarantee is broken.

## Adversarial Cases Attempted
1. **Case: missing URL graceful (boundary empty env)** — `src/core/supabase/client.ts:69-81` env-gated `isSupabaseEnabled()` false → `src/core/vault/supabaseSync.ts:238-248` early return `{hydrated:0, skipped:true}` → constructed test `test/unit/challenger-m2-adversarial2.test.ts:18` mocking `isSupabaseEnabled=false` → Result: **survived**, no throw, skipped true (Case 1 PASS).

2. **Case: malformed inputs null/undefined/empty/ wrong type patientId** — `src/core/vault/supabaseSync.ts:238` checks `!patientId || typeof !==string || trim==''` → test `challenger-m2-adversarial2.test.ts:28` with `null|undefined|123|''` → Result: **survived** for hydrate (skipped true), but `syncToSupabase(null)` when disabled returns `ok:true skipped:true` not `ok:false` (see Breaks) → technique: malformed inputs.

3. **Case: syncFireAndForget missing patientId silent no duplication** — `src/core/vault/LocalVault.ts:67-71` checks `!record || !record.patientId` early return without toast, after `emit('medication_added')` → test `:34` malformed `med-no-pid` → 1 event 0 toast; rapid 10 adds → 10 events no duplication → **survived**. Technique: malformed + resource rapid.

4. **Case: Supabase upsert throw -> toast warning local preserved** — `src/core/vault/LocalVault.ts:72-105` fire-and-forget `.catch(()=>dispatchToast)` → mocked `upsertSupabaseRecord` rejected `network down` → test `:44` → after 60ms `toast=1` with `Saved locally, Supabase sync failed`, `medication_added=1` no duplication, local vault has medication → **survived**. Technique: failure path.

5. **Case: Supabase upsert ok:false -> toast, ok:true skipped:true -> no toast** — `LocalVault.ts:72-89` handles `res.ok` vs `res.skipped` → tests `:54,62` mocked rejected/ resolved → **survived**, branching correct, no event duplication. Technique: failure path.

6. **Case: hydration silent no EventBus inflation (interaction)** — `src/core/vault/supabaseSync.ts:268-293` silent `Map.set` without emit, per-table `has` check → mocked `fetchSupabaseTable` returns canonical med+lab → test `:68` → `hydrated>0`, vault has data, `bus.getEvents('medication_added')==0 && lab_added==0` → **survived**. Technique: interaction between changed components (vault + sync layer).

7. **Case: multi-patient isolation exact === vs includes + prefix trap (security/isolation)** — `src/core/vault/supabaseSync.ts:274-276` exact `recPid !== patientId` skip → mocked 4 rows: canonical, other, prefix `patient-s-devi-extra`, mismatch raw OTHER payload CANONICAL → test `:78` → canonical hydrated, other 0, prefix not in canonical (exact === holds) → **survived for prefix**, but **FAIL for mismatch** (see Breaks). Technique: security isolation + boundary.

8. **Case: snake_case id alias care_circle/doctor_grants/danger_reports** — `src/core/vault/supabaseSync.ts:191-204` normalize `link_id->linkId` etc and `:278-283` key resolution → mocked snake rows → test `:104` → `careCircle.has(link-snake-1)` true etc → **survived**.

9. **Case: duplicate hydration merge preserves local fields, no duplication (state)** — `src/core/vault/supabaseSync.ts:284-292` `has` -> merged `...existing, ...rec` → pre-seeded `lab-dup` with `localOnly`, hydrated remote with `extraField` → test `:122` → value 32 (remote wins), localOnly preserved, extraField present, second hydration still size 1, 0 events → **survived**. Technique: state out-of-order.

10. **Case: boundary long patientId 5000 chars, empty, 10k resource pressure** — `supabaseSync.ts:238` handles empty/truthy, loop handles 14 tables × rows → test `:139` longPid 5000 → hydrated 0 no crash; empty → skipped true; 10k labs → hydrated 10000 in <5000ms, vault size 10000 → **survived**. Technique: boundary + resource.

11. **Case: concurrency parallel hydrations race** — `supabaseSync.ts:250-301` sequential per-table but two parallel hydrates share same vault Map → test `:162` two `hydrateFromSupabase` parallel with 5ms delay each → both hydrated 1, vault size 1 no duplication → **survived** (no lost write). Technique: concurrency.

12. **Case: postgres connection string fallback skipped semantics** — `src/core/supabase/client.ts:199-213` `toRestBaseUrl` null for `postgresql://` → `fetchSupabaseTable` returns `skipped:true` → `supabaseSync.ts:256-260` continues, final `hydrated:0 skipped:false` → test `:174` with mocked `skipped:true` for all tables → **survived but semantics violation** (see Assumption Violations). Technique: resource/time.

13. **Case: addFact duplicate id different patient throws** — `src/core/vault/LocalVault.ts:224-227` `if existing && patientId !== fact.patientId throw` → test `:182` adding same id with OTHER throws `Duplicate fact id` → **survived** (isolation enforced at write).

14. **Case: vault with undefined eventBus still local sync** — `LocalVault.ts:93-105` bus optional `dispatchToast` vs `emit('toast')` fallback wrapped in try → test `:189` `new LocalVaultManager()` no bus → addCaregiverLink/addDoctorGrant no throw, Map set → **survived**.

15. **Case: per-table error does not abort whole hydration** — `supabaseSync.ts:296-300` per-table try/catch `counts[table]=0` continue → mocked labs throw, meds ok → test `:197` → hydrated 1, meds present, labs count 0 → **survived**.

16. **Case: 100 large payloads 10k each non-blocking** — `LocalVault.ts:67-109` fire-and-forget with `.then/.catch` not awaited → test `:210` 100 adds each with 10k payload, upsert mocked 20ms delay → elapsed <200ms, 100 events, vault size 100 → **survived**, non-blocking verified. Technique: resource/memory pressure.

17. **Case: whitespace patientId validation** — `supabaseSync.ts:58` `pid.trim()==''` reject → test `:228` `'   '` → ok:false, `' patient-s-devi '` with spaces passes (trim not applied to value, only emptiness check) → demonstrates weak validation (see Assumption Violations).

## Breaks Demonstrated
**`src/core/vault/supabaseSync.ts:274-276` — patient isolation leak via payload trust**: hydration resolves `rec = normalizeRow(raw)` which prefers `raw.payload.patientId` if present (`supabaseSync.ts:176` `base = payload.patientId ? payload : raw`), then checks `recPid = rec.patientId ?? raw.patient_id` against `patientId`. If an attacker/DB row has `raw.patient_id = 'patient-other-999'` but `payload.patientId = 'patient-s-devi'`, `recPid` becomes canonical and passes `recPid !== patientId` check, so the row is hydrated into canonical vault despite raw indicating other patient. Reproduced in `test/unit/challenger-m2-adversarial2.test.ts:78` with `med-mismatch` row: `LEAK_DETECTED: payload mismatch hydrated despite raw patient_id OTHER` logged to `/tmp/challenger-m2-v2.log:42`, assertion `expect(hasMismatch).toBe(false)` **FAILED** (vitest `expected true to be false`). This violates spec “patient isolation exact === (never includes, never prefix) — skip mismatched rows even if server misfilters” and the comment `supabaseSync.ts:234` `Patient isolation exact === (never includes, never loose) — skip mismatched rows even if server misfilters`. Fix requires checking BOTH payload and raw: `if (rec.patientId !== patientId || (raw.patient_id && raw.patient_id !== patientId)) continue;` or ignoring payload patientId when raw present.

**`src/core/vault/supabaseSync.ts:55-58` + `src/core/supabase/client.ts:448-451` — whitespace patientId not normalized**: `syncToSupabase` checks `pid.trim()==''` for emptiness but does not trim for comparison; `' patient-s-devi '` passes validation and would upsert with spaced patientId, fragmenting patient data. Not a crash but violates exact `=== CANONICAL_PATIENT_ID` scoping. Reproduced in `challenger-m2-adversarial2.test.ts:228` where `' patient-s-devi '` returns `ok:true`. Low severity.

**`src/core/vault/supabaseSync.ts:256-302` — skipped semantics for postgres URL**: when `DATABASE_URL` is `postgresql://` (real `.env`), `getSupabaseClient().config.enabled=true` but `toRestBaseUrl` null → `fetchSupabaseTable` returns `{skipped:true}` per table. Loop `if (skipped) continue` leaves `total=0` and returns `{hydrated:0, skipped:false}`. Bootstrap `M3` that checks `if (hydrated>0) skip seed else seed` would correctly seed, but a check of `skipped` alone would misclassify offline as online. Verified in `challenger-m2-adversarial2.test.ts:174` where all-skipped returns `skipped:false`. Not a crash but contradicts M2 comment `supabaseSync.ts:9` `Supabase down => {hydrated:0, skipped:true}` — for postgres URL, skipped should be true.

## Assumption Violations
**`src/core/vault/LocalVault.ts:67-71`**: assumes `record.patientId` presence is sufficient for sync gating; ignores `record.patient_id` snake case. A caller that constructs a record with snake `patient_id` (e.g., from hydration round-trip or manual `put`) will silently skip sync without toast, even though `syncToSupabase` also rejects but hydration supports snake. Assumption that all callers use camelCase is undocumented; interaction gap between `LocalVault` fire-and-forget and `supabaseSync` snake support.

**`src/core/vault/LocalVault.ts:72-105`**: assumes `isSupabaseEnabled()` is stable during sync; with real `.env` containing `postgresql://`, enabled true but REST base null leads to silent `skipped:true` no toast. Caller sees no error but data is not persisted remotely — offline fallback is silent, not warning. M3 bootstrap will see `hydrated 0` and re-seed locally, but durability expectation is violated without user feedback.

**`src/core/vault/supabaseSync.ts:213-228`**: `HYDRATION_MAPPINGS` includes both `medications` and `meds` pointing to same vault `meds` Map. If both tables contain distinct rows with same `id`, hydration double-counts `hydrated` total and second write overwrites first (last table wins). Acceptable per `ws-02-01-result.md` but violates idempotency assumption for total count. Current test `:284` merge preserves local but not inter-table precedence.

**`src/core/vault/supabaseSync.ts:282-293`**: assumes `idField` string key always present and `typeof key === 'string'`; if server returns numeric id or missing `id`/`link_id`/`grant_id`, row is silently skipped without error reporting. No validation log, so data loss is invisible. Tested with malformed rows (not in harness) would be skipped.

**`src/core/vault/LocalVault.ts:224`**: `addFact` duplicate check throws synchronously, but `syncFireAndForget` after emit would have already emitted `fact_added` before throw? Actually throw is before `Map.set` and emit, so order is correct. However `updateFactStatus` etc. mutate `fact` object in place (`Object.assign(med, updates)` at `LocalVault.ts:330`) — concurrent hydration merge ` { ...existing, ...rec }` creates new object but local reference held by UI may be stale. No break demonstrated but shared-reference assumption is fragile.

## Coverage Gaps
- No test for `addDocument` / `addCondition` / `addAllergy` / `addDueCard` syncFireAndForget paths with Supabase error toast vs skipped branching (only `addMedication` exercised for toast).
- No test for `hydrateFromSupabaseToVault` overload `(patientId, vault)` legacy signature vs `(vault, patientId)` — both work but only one exercised.
- No test for `normalizeRow` when `raw.payload` is string, null, or missing `patientId` but snake columns present — fallback to raw merge not fully adversarially proven beyond snake id aliases.
- No test for `EventBus` matrix preservation after hydration with 10k rows (relevant-only still holds but not re-verified post-hydration).
- No test for `clear()` racing with in-flight `syncFireAndForget` (clear deletes Map while upsert promise pending — no crash but stale upsert may recreate entry if retry logic added later).
- No `grep baqduk 0 outside .env` regression re-run after challenger temp files removed (now PASS, but not in challenger harness until final `npm run build`).

## Summary
M2 LocalVault Sync & Hydration is largely **robust**: 16 of 18 adversarial executions **survived** without crash — non-blocking fire-and-forget (`LocalVault.ts:67-109`) correctly emits before sync, never duplicates domain events, shows toast only on `ok:false`/reject (not on `skipped`), preserves `EventBus` relevance matrix during silent `Map.set` hydration, handles empty/null/whitespace/long patientId without throw, handles 10k payloads and parallel hydrations without memory leak or duplication, and respects per-table error fallback. `tsc` clean, `build` 1661 modules, vitest cohesion 28 still PASS, `grep baqduk src` 0 outside `.env`.

However, **one blocking isolation break demonstrated**: `supabaseSync.ts:274-276` trusts `payload.patientId` over `raw.patient_id`, allowing a DB row with mismatched payload to leak into canonical vault (`med-mismatch` LEAK_DETECTED). This violates the hard invariant `patientId === CANONICAL_PATIENT_ID` exact and must be repaired before Auditor PASS. Repair: in `hydrateFromSupabase` validate **both** sources — `if (rec.patientId !== patientId) continue; if (raw.patient_id && String(raw.patient_id) !== patientId) continue;` — and in `normalizeRow` do not prefer payload when raw patient_id differs. Also address minor whitespace and postgres skipped semantics for M3 bootstrap clarity. Until payload-mismatch check is fixed, milestone should **FAIL** and not proceed to M3.

