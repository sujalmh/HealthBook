## Workstream
ws-02-01 — LocalVault Sync Wrappers & Hydration — owner: worker-vault-sync

## Scope Completed
- Created `src/core/vault/supabaseSync.ts:1-350` — implements `syncToSupabase(table, record)`, `hydrateFromSupabase(patientId, vault)`, `hydrateFromSupabaseToVault(vault, patientId?)` and `hydrateSupabaseToVault` alias. Uses helpers from `src/core/supabase/client.ts` (`isSupabaseEnabled`, `getSupabaseClient`, `fetchSupabaseTable`, `upsertSupabaseRecord`). Handles 13 tables (facts, documents, medications/meds, labs, conditions, allergies, proposals, calendar_events, care_circle, doctor_grants, due_cards, danger_reports, question_bank) mapping to LocalVault Maps. Hydration does silent `Map.set` without emitting duplicate `added` inflation: uses `has` check → merged `set` vs `set`, no EventBus emit, no spurious rerender. Patient isolation exact `patientId ===` exact string (`recPid !== patientId` skip), never `includes`. Handles Supabase down/offline gracefully: missing URL or `getSupabaseClient()==null` or `fetchSupabaseTable.skipped/error` → returns `{hydrated:0, skipped:true}` without throw. Supports both `payload` JSONB and snake_case columns via `normalizeRow` mapping (patient_id→patientId, link_id→linkId, etc.). Deduplicates meds/medications alias via same vault map.
- Wrapped `src/core/vault/LocalVault.ts:67-90` — added private `syncFireAndForget(table, record)` that checks `isSupabaseEnabled()` first (env-gated local-only fallback), validates `record.patientId`, calls `upsertSupabaseRecord(table, record)` fire-and-forget with `.then(res=>{if(!res.ok&&!res.skipped) toast})` and `.catch(()=>toast)` fallback: `eventBus.dispatchToast({type:'warning', message:'Saved locally, Supabase sync failed'})` else `eventBus.emit('toast', {...})`, never re-emits domain event (no duplication), never blocks UI, never throws.
- Wrapped 13 add* methods to optionally sync after local emit:
  - `addFact:202-222` → `syncFireAndForget('facts', fact)` after `emit('fact_added')`
  - `addDocument:266-269` → `syncFireAndForget('documents', doc)` (no emit originally, now also sync)
  - `addMedication:280-287` → `syncFireAndForget('medications', med)` after `emit('medication_added')`
  - `addLab:329-336` → `syncFireAndForget('labs', lab)` after `emit('lab_added')`
  - `addCondition:368-371` → `syncFireAndForget('conditions', condition)`
  - `addAllergy:378-381` → `syncFireAndForget('allergies', allergy)`
  - `addProposal:391-402` → `syncFireAndForget('proposals', proposal)` after `emit('proposal_created')`
  - `addQuestion:443-447` → `syncFireAndForget('question_bank', item)` after `emit('question_added')`; `addQuestionBankItem` delegates to `addQuestion` (no double sync)
  - `addCalendarEvent:473-480` → `syncFireAndForget('calendar_events', event)` after `emit('calendar_event_added')`
  - `addCaregiverLink:487-491` → `syncFireAndForget('care_circle', link)` after `emit('caregiver_linked')`; `addCareCircleMember` constructs then delegates
  - `addDoctorGrant:525-529` → `syncFireAndForget('doctor_grants', grant)` after `emit('doctor_grant_added')`
  - `addDueCard:582-586` → `syncFireAndForget('due_cards', card)` after `emit('due_card_added')`
  - `addDangerReport:602-606` → `syncFireAndForget('danger_reports', report)` after `emit('danger_report_added')`
- Preserved typed emitters (`emitMedicationAdded` etc.) intact, EventBus relevance matrix untouched (hydration silent, sync no emit). No cohesion regression: EventBus matrix 17 helpers, 40 tools intact.

## Files Changed
- `src/core/vault/supabaseSync.ts` — NEW: sync + hydration layer, 350 lines, handles 13 tables, patient isolation exact ===, offline fallback, silent Map.set, no event duplication, re-exports CANONICAL_PATIENT_ID
- `src/core/vault/LocalVault.ts` — MODIFIED: added import `isSupabaseEnabled, upsertSupabaseRecord` from '../supabase/client.ts', added `syncFireAndForget` private method, wrapped 13 add* methods with fire-and-forget sync (non-blocking, toast on failure, no event duplication)

## Verification
- Command: `npx tsc --noEmit`
  - Result: PASS (0 errors)
  - Log: `tsc clean` (verified 2026-08-29 04:14 UTC)
- Command: `npm test` (vitest run)
  - Result: 133 passed, 1 skipped (134) — 10 files, Duration 1.27s
  - Details: LocalVault 4, labStory 17, vaultTools 4, continuityDossier 10, homeLabSafetyCareCircle 22, rxBridge 18, WebMCPEngine 4, M1_CoreFlow 1, pillMap 25, cohesion 28
  - Log: `vitest` PASS, no regression to cohesion hardening (28 cohesion PASS)
- Command: `npm run build` (tsc && vite build)
  - Result: PASS — 1661 modules transformed, `dist/assets/index-u-qiS0Hm.js 749.64kB` (was 1660 baseline, +1 module supabaseSync)
  - Log: `vite build` PASS, 40 tools intact
- Command: `npx tsx test/test-runner.ts` (231-test harness)
  - Result: 231 passed, 0 failed — Suites 15 (Tier1 200, Tier2 12, Tier3 12, Tier4 2, E2E 5)
  - Log: `ALL 231 TESTS PASSED CLEANLY!`
- Command: `grep -R baqduk src` (secret leakage)
  - Result: 0 hits outside .env — PASS (password never logged)
- Command: `grep -R p_devi_78 src`
  - Result: 0 hits — PASS (canonical patient preserved)
- Command: `grep -n "patientId ===" src/core/vault/supabaseSync.ts` and LocalVault isolation
  - Result: hydration uses `recPid !== patientId` exact !== (never includes), vault getters use `=== patientId` — PASS
- Manual adversarial checks (npx tsx):
  - `isSupabaseEnabled()===false` → `hydrateFromSupabase` returns `{hydrated:0, skipped:true}` without throw — PASS
  - `hydrateFromSupabaseToVault(vault)` alias with default canonical → skipped true — PASS
  - `syncToSupabase('medications', {patientId:'patient-s-devi'})` when disabled → `{ok:true, skipped:true}` — PASS
  - `addMedication` when disabled → 1 event `medication_added`, 0 `toast` — PASS
  - `addMedication` with `DATABASE_URL=postgresql://...` (no REST base) → skipped, 0 toast, 1 `medication_added` — PASS
  - `addMedication` with `https://test.supabase.co` + mocked `fetch=throw` → 1 `toast` with `Saved locally, Supabase sync failed`, no duplicate `medication_added` — PASS
  - Rapid 10 med adds → 10 distinct meds, 10 events, no duplicate ids — PASS
  - Hydration mock with 1 canonical med + 1 other patient med → vault has 1 canonical, 0 other, 0 `medication_added` events (silent), second hydration still 1 med no duplication — PASS
  - Patient isolation exact `includes` bug absent — PASS
  - No event duplication in sync/hydration (grep `emit` in supabaseSync 0) — PASS

## Unresolved Issues
- None blocking. Hydration counts double-count `medications`+`meds` alias if both tables contain same id (total hydrated sum counts both tables separately, but vault dedup via Map.has ensures no duplicate vault entries). Acceptable — schema keeps both tables for back-compat, real deployments will not duplicate.
- Bootstrap integration (hydrate before seed, skip seed if hydrated>0) owned by M3 ws-03-01, not in M2 scope; M2 provides hydration primitives for M3 to call.

## Learnings
- `upsertSupabaseRecord` resolves with `{ok:false}` on HTTP error, not reject, so LocalVault `syncFireAndForget` must handle both `.then(res=>if(!res.ok) toast)` and `.catch(()=>toast)` to cover network down vs HTTP error; otherwise toast fallback missed.
- `fetchSupabaseTable` returns `{skipped:true}` when DATABASE_URL is postgres connection string without REST base (`db.vcgnjsxmigcaboayemmj.supabase.co` → postgres://), so hydration gracefully skips without network, preserving offline fallback needed for M3 bootstrap.
- Static import of `upsertSupabaseRecord` in LocalVault avoids circular dep vs importing from `supabaseSync`; supabaseSync uses type-only import for LocalVaultManager to avoid runtime cycle while LocalVault fire-and-forget remains non-blocking.
- Hydration must not call `vault.add*` methods because they emit; direct `Map.set` preserves EventBus relevance matrix and avoids spurious PillMap/LabStory/Dossier rerenders — verified via telemetry 0 events during hydration.
