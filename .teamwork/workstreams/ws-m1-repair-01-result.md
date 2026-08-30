## Workstream
ws-m1-repair-01 — Repair Validation-Order Hazard (M1 Core Protocol Adapter) — owner: worker_m1_repair_validation_order — Role: worker_m1_repair_validation_order

## Integrity
> Integrity: demo — reproducible, verifiable, not mocked. Do not fabricate evidence; cite file:line and log paths.

## Scope Completed
- Repaired validation-order hazard at `src/core/webmcp/WebMCPEngine.ts:322-349` where existing tool was deleted BEFORE validation (delete-before-validate bug causing 40→39 permanent loss on invalid re-register).
- Reordered `register(toolDef)` to **VALIDATE BEFORE DELETE**: `validateToolName` (line 324), `validateToolDescription` (325), `JSON.stringify(schemaToSerialize)` circular check (326-333) now execute BEFORE any `abortControllers.delete`/`registry.delete`/`specRegistry.delete` + `_dispatchToolchange` dedup handling (336-348). This ensures challenger Case 22 (empty description) and Case 23 (circular inputSchema) both preserve 40/40 instead of deleting then throwing.
- Preserved Q3 AbortController dedup/HMR semantics: after validation, if `abortControllers.has(name)` aborts old controller then deletes maps and dispatches toolchange (336-343), else if `registry.has`/`specRegistry.has` deletes and dispatches (344-348). Valid duplicate replacement still works (40 stable via probe).
- Kept `src/types/webmcp.ts`, `src/core/webmcp/WebMCPAdapter.ts`, `src/tools/index.ts` untouched per ownership (only `src/core/webmcp/WebMCPEngine.ts` allowed). Polyfill `registerTool` path at WebMCPEngine.ts:123-175 already validated before duplicate check — no change needed there.
- Verified `toolchange` not fired on failed validation (Case 18 remains PASS), `inputSchema` serialization via `JSON.stringify` still throws `TypeError` on circular, `document.modelContext.registerTool` delegation still guarded by `isNative && document.modelContext?.registerTool` (387).

## Files Changed
- `src/core/webmcp/WebMCPEngine.ts:319-351` — reordered register() to validate-first then dedup; added comment explaining hazard fix. Ownership validated via PROJECT.md glob `src/core/webmcp/WebMCPEngine.ts` (worker_m1_repair_validation_order).
  - `322-333`: validation block moved before any delete (validateToolName, validateToolDescription, JSON.stringify check)
  - `335-348`: dedup/HMR block now after validation with comment `AFTER validation so invalid does not delete valid`
  - No other files modified (scope check PASS).

## Verification
- **Lint**: `npm run lint` → `tsc --noEmit` **PASS** (0 errors) — log: `.teamwork/worktrees/ws-m1-repair-01/logs/lint.log` (also `.teamwork/logs/lint.log`) excerpt: `> tsc --noEmit` + `lint exit:0`
- **Unit tests**: `npm test` → `vitest run` **172 passed, 1 skipped** (PASS) — log: `.teamwork/worktrees/ws-m1-repair-01/logs/test.log` — excerpt: `Test Files 12 passed | 1 skipped`, `Tests 172 passed | 1 skipped`, duration 1.32s
- **Runner**: `npx tsx test/test-runner.ts` → **231 PASS** — log: `.teamwork/worktrees/ws-m1-repair-01/logs/tier3.log` — excerpt:
  ```
  📦 TIER 1: 200 tests PASS (7 modules)
  🛡️ TIER 2: 12 PASS
  🔗 TIER 3: 12 PASS
  🏥 TIER 4: 2 PASS
  🚀 E2E Flows A-E: 5 PASS
  🎉 ALL 231 TESTS PASSED CLEANLY! Suites:15 Tests:231 passed
  ```
- **Build**: `npm run build` → `tsc && vite build` **PASS** 1662 modules — log: `.teamwork/worktrees/ws-m1-repair-01/logs/build.log` — excerpt: `✓ 1662 modules transformed`, `dist/assets/index-ZwkyzCeM.js 816.21 kB gzip 195.65 kB`, `✓ built in 1.09s`
- **Grep gates**: `.teamwork/worktrees/ws-m1-repair-01/logs/grep-gates.log`
  - `registerTool` delegation >=1 PASS (6 hits at WebMCPEngine.ts:44,54,124,281,387,400)
  - `inputSchema` >=30 PASS (30 in types+core/webmcp, 38 overall, gate requires >=1)
  - `toolchange` >=23 PASS (23 hits, gate requires >=1)
  - `AbortController|signal` PASS (30+ hits Q3)
  - `Promise.allSettled` PASS at src/tools/index.ts:197
  - `isSecureContext` 0 in src (M1 not required; M2 bootstrap will add guard — verified not regressing)
  - Legacy globals: 5 hits in `src/components/common/ConnectWebMCPModal.tsx` — known M3 UI inspector scope, not engine; engine Q2 guard `if (document.modelContext?.registerTool) never overwrite` remains PASS per WebMCPEngine.ts:44/54
- **Probe — Validation-Order Hazard (40→40 PASS)**: `npx tsx .teamwork/worktrees/ws-m1-repair-01/probe-validation-order.mjs` — log: `.teamwork/worktrees/ws-m1-repair-01/logs/probe-validation-order.log` (also `.teamwork/logs/probe-validation-order.log`) — key excerpts:
  ```
  Initial registry size: 40 expected 40 => PASS
  --- Case 22: re-register existing extract_fact with invalid description "" ---
   threw InvalidStateError: Tool description must be non-empty string for "extract_fact"
   sizes: before 40/40 after 40/40
   PASS: BUG FIXED — 40→40 stable (before 40 after 40)
   extract_fact still exists? PASS true
  --- Case 23: re-register existing extract_fact with circular inputSchema ---
   threw TypeError: Converting circular structure to JSON
   circular test: before 40 after 40 threw true
   PASS: circular 40→40 BUG FIXED
  --- Valid duplicate replacement (HMR) — should succeed 40 stable ---
   re-register valid duplicate succeeded (no throw)
   after valid duplicate: 40/40 expected 40/40 => PASS
   extract_fact description updated? PASS true
  Final sizes: 40/40 expected 40/40 => PASS
  Overall: PASS — validation-order hazard FIXED (40→40 stable on invalid)
  ```
  Valid duplicate HMR stable confirms dedup still works after validation move.

- **Challenger adversarial re-probe**: `npx tsx ./challenger-m1-adversarial.mjs` (copied from /tmp/challenger-m1-adversarial.mjs, jsdom) — log: `.teamwork/worktrees/ws-m1-repair-01/logs/challenger-m1-adversarial.log` (also `.teamwork/logs/challenger-m1-adversarial.log` and `/tmp/challenger-m1-adversarial.log`) — summary:
  ```
  === Challenger M1 Adversarial Probes ===
  Total cases: 32 Passed: 30 Failed: 2
  Toolchange total: 310
  ```
  Before fix: `Total cases: 32 Passed: 28 Failed: 4` with FAIL at Case 22 `BUG: 40→39 hazard triggered (after 39)`, Case 23 `circular 40→39 bug`, Case 16 `patient-s-devi` leak, Case 24 `isNative cached`. After fix: Case 22 & 23 now **PASS** (`sizes: before 40/40 after 40/40`, `PASS: no hazard`), delta 28→30 PASS demonstrates fix. Remaining 2 fails are pre-existing out-of-scope:
    - Case 16 `patient-s-devi` leak at `src/core/supabase/client.ts:32` and `src/core/vault/seed.ts:16` `CANONICAL_PATIENT_ID = 'patient-s-devi'` — constants for Supabase seed, not runtime hardcode; auditor previously noted medium token-leakage not gate-blocking (M1 auditor PASS with caveats).
    - Case 24 `isNative cached fails lazy native detection` — design note that `isNative` cached per-instance (WebMCPEngine.ts:28-34) prevents lazy delegation if native appears after construction; per PROJECT.md Risks this is M2 bootstrap nuance, not M1 validation-order; challenger marks as Assumption Violation not critical break.

- **Toolchange not fired on failed validation**: Verified via probe-validation-order `toolchange before 0 after 0 => PASS no increment` and challenger Case 18 `PASS: failed validation should NOT fire toolchange 0==0 PASS=true`, confirming dedup dispatch only after validation passes.

## Dual-Track Note
- Serialized repair — no parallel worker this batch per dispatch (`Parallel with no other worker — serialized repair`). Ownership conflict check PASS: only `src/core/webmcp/WebMCPEngine.ts` touched, disjoint from `src/tools/*`, `src/main.tsx`, `src/components/common/*`. No concurrent edits to shared artifacts except result report.

## Unresolved Issues
- `src/components/common/ConnectWebMCPModal.tsx:67,69,74,78` still references `window.modelContext`, `navigator.modelContext`, `window.__CareCanvas_WebMCP__` legacy globals and sync string API `getRegisteredTools()`/`executeTool('extract_fact', {...})` — out of scope for this repair (owned by `worker_ui_inspector` batch M3), flagged for M3 UI milestone. Engine Q2 guard itself is correct (WebMCPEngine.ts:44/54 never overwrites native).
- `src/core/supabase/client.ts:32` and `src/core/vault/seed.ts:16` export `CANONICAL_PATIENT_ID = 'patient-s-devi'` — causes challenger Case 16 FAIL via `grep patient-s-devi`. This is seed constant for DB bootstrap, not runtime `patientId` leak (runtime patientId correctly derived from `localStorage carecanvas_active_user` via `derivePatientContext` and WebMCPEngine.ts:569-580, verified probe patientId `test-patient-123` not hardcode). No src runtime leak; constants arguably intentional but challenger grep expects 0. Track for hardening (either rename constant or allowlist in grep gate).
- `WebMCPEngine.ts:28-34` `isNative` cached per-instance — challenger Case 24 VIOLATION `old engine would incorrectly go polyfill despite native existing`. This is M2 lazy-detection hazard per PROJECT.md Risks. Fix would be per-call detection or getter (`get isNative(){return !!document.modelContext?.registerTool}`) but out of scope for validation-order repair; escalate to `worker_bootstrap_platform` if needed. Current behavior matches prior M1 auditor (not blocking) and polyfill path still honors `if (this.isNative && document.modelContext?.registerTool)` branch — native delegation works for engines constructed after native appears, which is bootstrap flow.
- No snapshot re-capture required for M1 repair per dispatch (optional). Existing M1 snapshots under `.teamwork/snapshots/m1/` remain valid (1662 build). If auditor requests fresh capture, run `npm run dev` + `browser.capture` 1280/375/768.
- No Promise.all violation introduced — `src/tools/index.ts:197` still uses `Promise.allSettled` per Q10; no new `Promise.all` added.

## Learnings
- Delete-before-validate is easy to miss in HMR-friendly code: prior worker implemented dedup via `abortControllers.delete + registry.delete + dispatch` before any validation to maximize HMR convenience, but this created a silent data-loss path where an invalid redefinition (empty description or circular schema) permanently deleted a valid 1/40 tool. The fix is strictly ordering: validate → then delete. Even with `try/catch`, early delete cannot be rolled back without extra state.
- Validation includes three checks that must all precede delete: `validateToolName` regex (1-128 `^[a-zA-Z0-9_.-]+$` else InvalidStateError), `validateToolDescription` non-empty else InvalidStateError, and `JSON.stringify(inputSchema)` else TypeError on circular. The third check was duplicated later at line 355-373 for `inputSchemaString` creation; the early check prevents delete while the late check handles string-type edge where `JSON.parse` vs `JSON.stringify` differences exist. Keeping both is safe because early check already guarantees serializable; late check will not fail differently if early passed.
- Q3 dedup via `AbortController` per-tool Map remains correct after reorder: valid duplicate still aborts previous controller, deletes old, dispatches toolchange, then creates new controller and re-adds. The key insight is HMR should only happen on *valid* definitions; invalid definitions should not trigger abort/delete at all, which ordering ensures. Challenger's adversarial probe explicitly tests both paths and confirms 40→40 stability plus valid HMR 40→40 still succeeds.
- Toolchange dispatch count is observable via polyfill EventTarget (WebMCPEngine.ts:96-107 `dispatchToolchange` via `Event('toolchange')`). Failed validation must not increment count — verified by counting before/after. After fix, invalid path skips dispatch entirely, matching spec §4.4 `notify documents of a tool change` only on actual change.
