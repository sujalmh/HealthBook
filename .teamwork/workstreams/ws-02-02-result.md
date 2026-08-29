## Workstream
ws-02-02 — M2 LocalVault Sync & Hydration Isolation Repair — owner: worker-repair-m2

## Scope Completed
- Fixed patient isolation leak in `src/core/vault/supabaseSync.ts:275-280` — previous code used `recPid = rec.patientId ?? raw.patient_id; if (recPid !== patientId) continue` which allowed row with `raw.patient_id='patient-other-999'` but `payload.patientId='patient-s-devi'` to leak into canonical vault via payload-preference in `normalizeRow`. Changed to dual exact validation with trim: `if (typeof rec.patientId !== 'string' || rec.patientId.trim() !== trimmedPatientId) continue; if (raw.patient_id != null && String(raw.patient_id).trim() !== trimmedPatientId) continue;` ensures BOTH sources must equal trimmed canonical, blocking server-misfilter PHI leakage.
- Added `trimmedPatientId = patientId.trim()` normalization and used it for `fetchSupabaseTable` calls and all isolation checks (whitespace defense).
- Fixed skipped semantics in `src/core/vault/supabaseSync.ts:306-310` — track `skippedTables` count; when `total===0 && skippedTables === HYDRATION_MAPPINGS.length` return `{hydrated:0, skipped:true}` so `postgresql://` without REST base correctly signals skipped for bootstrap fallback (`seedIfEmpty`), previously returned `skipped:false` with zero hydration.
- Preserved silent Map.set hydration (no EventBus emit), offline graceful, error handling intact. No changes to LocalVault.ts per isolation.

## Files Changed
- `src/core/vault/supabaseSync.ts` — repaired isolation check (lines 237-310): added trimmedPatientId, dual validation of rec.patientId and raw.patient_id, skippedTables tracking and all-skipped return. Single file ownership respected.

## Verification
- Command: `npx tsc --noEmit`
  - Result: PASS (0 errors) — clean after edit
  - Log: `/tmp/orchestrator-repair-m2.log` (TSC_EXIT:0)
- Command: `npx tsx /tmp/audit-m2-repro2.ts` (canonical leak repro from Auditor)
  - Result: PASS — before fix vault had `med-mismatch` leak, after fix `vault.meds.keys() === ['med-ok']`, `has leak false`, hydrated 4 (was 8 with leak), counts meds/medications each 1 canonical only
  - Log: `/tmp/orchestrator-repair-m2.log` (LEAK_NOT_PRESENT)
- Command: `npx tsx /tmp/audit-m2-repro2b.ts` (additional edge cases)
  - Result: PASS — postgresql:// returns `{hydrated:0, skipped:true}` (all 14 tables skipped), whitespace trimmed patientId hydrates correctly, reverse leak (payload other, raw canonical) blocked (hydrated 0, no leak)
  - Log: `/tmp/orchestrator-repair-m2.log`
- Command: `npm test` (vitest run)
  - Result: 133 passed, 1 skipped (134) — 10 files, 28 cohesion PASS, Duration 1.03s
  - Log: `/tmp/orchestrator-repair-m2.log` (NPM_EXIT:0)
- Command: `npm run build` (tsc && vite build)
  - Result: PASS — 1661 modules transformed, dist 750kB, 40 tools intact (was 1661 baseline+supabaseSync)
  - Log: `/tmp/orchestrator-repair-m2.log` (BUILD_EXIT:0)
- Command: `grep -R baqduk src` — 0 hits outside .env (exit 1 = no matches) PASS
- Command: `grep -R p_devi_78 src` — 0 hits PASS
- Command: `grep patientId === src/core/vault/supabaseSync.ts` — now uses trimmed exact `!== trimmedPatientId` isolation PASS

## Unresolved Issues
- None blocking. Hydration counts still double-count `medications`+`meds` alias (same vault map) — acceptable back-compat, no vault duplication due to Map.has dedup. Bootstrap integration owned by M3 ws-03-01 to consume corrected skipped semantics.

## Learnings
- Payload-preference in normalizeRow must not bypass outer `patient_id` validation — dual check is required for defense-in-depth when server misfilters or payload tampered. Single-source check (recPid fallback) is insufficient.
- postgresql:// URL without REST base returns `{skipped:true}` per table; hydration must aggregate to `skipped:true` when all tables skipped, otherwise bootstrap incorrectly treats local-only as remote-empty and may skip seed. Tracking skippedTables restores correct fallback.
- Trim normalization needed on both patientId param and stored values to prevent whitespace mismatch bypass while preserving exact === semantics (no includes/prefix).
