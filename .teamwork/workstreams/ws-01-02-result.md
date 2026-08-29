## Workstream
ws-01-02 — Fixture & Bootstrap Unification — owner: worker-fixtures-bootstrap

## Scope Completed
- Migrated `src/fixtures/discharge_lists.ts:20` from `p_devi_78` to canonical `patient-s-devi` (kept `p_jenkins_72` as secondary for CareCircle demo)
- Migrated `src/fixtures/documents.ts` all 15 occurrences of `patientId: 'p_devi_78'` → `'patient-s-devi'` (discharge summary doc + 8 facts, homelab slip doc + 3 facts, nephrology consult doc + 1 fact)
- Verified `src/fixtures/drug_knowledge.ts` clean — no hardcoded patient IDs (494 lines, only drug/diet interaction rules)
- Updated `src/fixtures/index.ts` to unified barrel: re-exports documents, longitudinal_labs, drug_knowledge, discharge_lists, patient_profiles + convenience re-export `{ CANONICAL_PATIENT_ID, seedIfEmpty, seedVault, isSeeded }` from `../core/vault/seed.ts`
- Verified `src/types/vault.ts` and `src/types/index.ts` remain generic (`patientId: string` on all records, 232 lines, no hardcoded legacy IDs)
- Centralized bootstrap seeding in `src/main.tsx`: async `bootstrap()` now does `await localVault.init()` → `wireLocalVaultToEventBus(eventBus)` → `seedIfEmpty(localVault, CANONICAL_PATIENT_ID)` idempotently before `registerAllWebMCPTools()` and React mount; handles StrictMode double-invoke and fallback mount on error

## Files Changed
- `src/fixtures/discharge_lists.ts` — patientId unified to patient-s-devi
- `src/fixtures/documents.ts` — 15 patientId fields migrated to patient-s-devi
- `src/fixtures/index.ts` — added canonical seed re-export and header comment
- `src/fixtures/drug_knowledge.ts` — verified clean (no changes)
- `src/types/vault.ts` — verified generic patientId (no changes)
- `src/types/index.ts` — verified generic re-exports (no changes)
- `src/main.tsx` — refactored to async bootstrap with idempotent seedIfEmpty(CANONICAL_PATIENT_ID)

## Verification
- Command: `npm run lint` (tsc --noEmit)
- Result: PASS (0 errors) — log: `.teamwork/worktrees/ws-01-02/scratch/worker-01-02-lint.log`
- Command: `npm run build` (tsc && vite build)
- Result: PASS — 1660 modules transformed, gzip 183.89 kB — log: `.teamwork/worktrees/ws-01-02/scratch/worker-01-02-build.log` (excerpt: `✓ 1660 modules transformed. ✓ built in 1.27s`)
- Command: `npm test` (vitest run)
- Result: 121 passed, 0 failed across 10 files (1.27s) — log: `.teamwork/worktrees/ws-01-02/scratch/worker-01-02-test.log`
- Command: `node --import tsx` idempotency harness (seedIfEmpty twice on fresh LocalVaultManager)
- Result: PASS — first seed inserted 5 meds / 35 labs / 3 conditions / 1 allergy / 1 dueCard / 1 proposal / 1 dangerReport / 2 calendarEvents; second seed `skipped:true, reason:already_seeded, inserted all 0` — counts unchanged — log: `.teamwork/worktrees/ws-01-02/scratch/worker-01-02-idempotent.log`
- Grep evidence (owned files):
  - `grep -rn "p_devi_78" src/fixtures/discharge_lists.ts src/fixtures/documents.ts src/fixtures/drug_knowledge.ts src/fixtures/index.ts src/types/vault.ts src/types/index.ts src/main.tsx` → 0 hits (was 16 before)
  - `grep -rn "p_devi_78" src/` → only out-of-scope leftovers: `src/tools/vaultTools.ts:262`, `src/core/webmcp/WebMCPEngine.ts:186`, `src/components/dossier/EmergencySnapshotCard.tsx:6` (owned by ws-01-01 / M3, not this workstream)
  - `grep -rn "patient-s-devi" src/fixtures/discharge_lists.ts src/fixtures/documents.ts` → all 16 entries canonical (1 discharge + 15 docs/facts)
  - Secondary `p_jenkins_72` preserved: `src/fixtures/discharge_lists.ts:97` and `src/fixtures/patient_profiles.ts:14` entries intact
- Log: `/tmp/worker-01-02.log` excerpt n/a — per-workstream logs in `.teamwork/worktrees/ws-01-02/scratch/`
- Build: `tsc --noEmit` PASS, `vite build` PASS

## Unresolved Issues
- None in ownership. Remaining `p_devi_78` hits in `src/tools/vaultTools.ts`, `src/core/webmcp/WebMCPEngine.ts`, `src/components/dossier/EmergencySnapshotCard.tsx` are out-of-scope per workstream globs — to be migrated by ws-01-01 (LocalVault/patient_profiles) and M3 deduplication. No action needed here.
- `src/fixtures/index.ts` re-export of `../core/vault/seed.ts` introduces a barrel-level import of seed → patient_profiles; seed imports directly from `../../fixtures/patient_profiles.ts` (not via barrel) so no circular runtime, verified by successful build and idempotency test.

## Learnings
- `src/core/vault/seed.ts` already existed (created by ws-01-01) with `CANONICAL_PATIENT_ID` and `seedIfEmpty` — main.tsx now correctly sequences `await init()` before wire/seed, fixing prior fire-and-forget `localVault.init().then()` race.
- `replaceAll` edit on `src/fixtures/documents.ts` with 4-space indented `patientId` string nonetheless covered 6-space indented fact entries (substring match) — verified via post-edit grep all 15 migrated.
- Barrel re-export is optional per task; added as convenience forwarding so `import { seedIfEmpty } from '@/fixtures'` works, primary remains direct `src/core/vault/seed.ts` import used by main.tsx.
