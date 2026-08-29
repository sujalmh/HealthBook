## Workstream
ws-repair-m02-01 — M2 Repair: RxBridge wiring, fact alias transitive, Dossier guard — owner: worker-repair-m2

## Scope Completed
- Fixed `src/components/rxbridge/RxBridgeView.tsx:98-110` — replaced NO-OP handlers with functional `loadReconciliation(activeDataset)` guarded by patientId, added `activeDataset` dep to avoid stale closure, preserves no infinite loop (handlers only setState, no emit).
- Fixed `src/core/events/eventBus.ts:131-140` — merged split fact alias groups into single canonical `['fact_confirmed','fact_status_changed','fact_added','fact_extracted']`, added `medication_created` to `EventName` union, kept other groups intact.
- Fixed `src/components/dossier/DossierView.tsx:93-114` — replaced flawed precedence guard (`p?.grantId && p?.patientId` + permissive `return true`) with correct `??` chain + explicit `auditGuard` for `audit_logged` without patientId.

## Files Changed
- `src/components/rxbridge/RxBridgeView.tsx` — lines 94-110 updated: handlers now call `loadReconciliation(activeDataset)` and dep `[patientId, activeDataset]`
- `src/core/events/eventBus.ts` — lines 64-66 added `medication_created`, lines 133-140 merged fact groups, comment updated
- `src/components/dossier/DossierView.tsx` — lines 93-114 replaced guard/mk logic, `u9` now uses `mkAudit`

## Verification
- Command: `npm run lint` (tsc --noEmit)
- Result: PASS 0 errors exit 0
- Log: terminal output empty (clean)

- Command: `npm test`
- Result: 10 files, 121 passed, 0 failed (1.60s)
- Log excerpt: `✓ test/unit/pillMap.test.ts (25 tests)` `✓ test/unit/rxBridge.test.ts (18 tests)` etc.

- Command: `npm run build` (tsc && vite build)
- Result: PASS 1660 modules transformed, dist 746.44kB gzip 185.05kB
- Log: `✓ built in 1.14s`

- Telemetry: `npx tsx` inline verification (lab_added -> RxBridge, fact alias, Dossier guards)
  - Test1 lab_added -> RxBridge loadCalled=1 rxExecuted=true expected 1 => PASS
  - Test2 fact_extracted -> fact_confirmed listeners 1 expected 1 => PASS
  - Test2b fact_added -> all fact family aliases 1 each => PASS
  - Test3a dossierGuard no pid => false PASS, Test3b wrong patient => false PASS, Test3c correct => true PASS, Test3d via fact.patientId => true PASS, Test3e auditGuard no pid => true PASS, Test3f auditGuard wrong => false PASS
  - Test4 medication_created -> medication_added 1 PASS
  - Test5 precedence bug fix undefined PASS

- Grep evidence:
  - `grep -n loadReconciliation src/components/rxbridge/RxBridgeView.tsx` => lines 81,91,99,100,101 all functional
  - `grep -n EVENT_ALIAS src/core/events/eventBus.ts -A 6` => single fact group `['fact_confirmed','fact_status_changed','fact_added','fact_extracted']`
  - `grep -n medication_created src/core/events/eventBus.ts` => line 66 union + line 139 alias
  - `grep -n "const guard|const auditGuard" src/components/dossier/DossierView.tsx` => correct `??` chain, `return false` vs `return true` for audit

## Unresolved Issues
- None. No other files touched. Preserves 40 tools, 121 vitest, build green. RxBridge now reactively refreshes eGFR flags on lab_added and proposal changes per M2 spec. Fact alias transitive now covers legacy `fact_extracted` emitted in `src/App.tsx:63`. Dossier guard now correctly isolates per-patient and allows audit_logged without patientId.

## Learnings
- Fact alias split via shared `fact_added` hub caused non-transitive dispatch: emitting `fact_extracted` only reached `fact_added`, not `fact_confirmed`. Merging into single group fixes via Set union in getAliasEvents without needing transitive closure algorithm.
- Dossier guard precedence `p?.grantId && p?.patientId` evaluates to boolean not string; `??` chain avoids precedence trap and is consistent with LabStory guard pattern.
- RxBridge stale closure risk if `activeDataset` not in dep array; adding dep ensures recompute uses latest selectedCase (shanti/jenkins) without loop because handlers do not mutate `activeDataset`.
