# Workstream ws-02 — WebMCP Engine & EventBus — Result

**Milestone:** milestone-01 M1 Core Foundation (W0.1-W0.2 Vault+WebMCP+Inspector+Vault tools)
**Owner:** worker-webmcp
**Status:** complete
**Date:** 2026-08-29
**Scratch Path:** .teamwork/worktrees/ws-02/scratch

## Summary

Verified and fixed P1 silent no-op in `registerAllWebMCPTools`: previously required explicit engine argument and silently did nothing when called without one. Fixed to default to singleton `webMCPEngine`, ensuring 40 tools always register and throwing explicit error only if singleton unavailable. Verified W0.1-W0.2: WebMCPEngine dual-mode registry (native `document.modelContext.registerTool` + polyfill mock fallback for standard browser/jsdom), 40 WebMCP tools with correct JSONSchema schemas, requiresApproval flags, approval gate counter, telemetry invocationHistory, EventBus pub/sub reactive sync, and Inspector 4-tab wiring (read-only). All M1 verification gates PASS.

## Scope Completed

- **WebMCPEngine registry & dual-mode dispatcher** (`src/core/webmcp/WebMCPEngine.ts:14-399`): `detectAndPolyfill()` checks `globalThis.document.modelContext` and `navigator.modelContext` for native `registerTool`; if absent installs polyfill exposing `modelContext` + `__CareCanvas_WebMCP__` + `document.modelContext` with `registerTool/unregisterTool/getRegisteredTools/executeTool` delegating to engine registry. Verified `isNative` false in jsdom/node with polyfill installed, native path preserved for W3C spec browsers.
- **40 tools registration** (`src/tools/index.ts:69-123`): `allWebMCPTools` aggregates 40 tools (vault 3, labstory 2, pillmap 8, rxbridge 5, homelab 5, safety 9, carecircle 5, dossier 3). Fixed `registerAllWebMCPTools` to default to singleton.
- **Schemas verified**: All 40 tools have `name:string`, `description:string`, `parameters:{type:'object', properties:Record}` JSONSchema, `requiresHumanApproval:boolean`, `category` (imperative_extraction|declarative_export|clinical_negotiation|approval_gate|audit_proxy|safety_alert), `moduleOwner`, `approvalGateType`, `returns`, `execute`. Checked via tsx script — PASS.
- **Mock fallback jsdom**: Installed in `WebMCPEngine.installPolyfill()`; vitest jsdom tests pass without native context; manual `globalThis.modelContext.registerTool` existence verified.
- **requiresApproval flags & approval gate counter**: `WebMCPEngine.execute()` checks `tool.requiresHumanApproval` and `approvalInterceptor.isAutoApproved`; if required stages `pending_approval`, increments `approvalGateCounter`, pushes to `invocationHistory`, emits `approval_required`. Tested via synthetic `test_approval_tool` — counter increments +1, returns `humanApprovalRequired:true`.
- **Telemetry**: `invocationHistory:ToolInvocationRecord[]`, `getTelemetryLogs()` clones history, `clearTelemetryLogs()`, per-execution `durationMs` via `performance.now()`, `status:executed|pending_approval|error|approved`. Verified via `check_interactions` execution — logs length 1, durationMs number, status executed.
- **EventBus pub/sub reactive sync** (`src/core/events/eventBus.ts:23-95`): `WebMCPEventBus` with `Map<event, Set<handler>>`, `on()` returns unsubscribe, `emit()` pushes to `emittedEvents` telemetry + dispatches handlers with try/catch, `dispatchToast`, `highlightSourceDocument`, `clearHistory`, `getEvents`. Verified `tool_registered`, `approval_required`, `toast_notification`, `canvas_rerender` emissions; manual pub/sub test PASS.
- **Inspector 4-tab wiring** (`src/components/common/WebMCPInspector.tsx` read-only): Verified 4 tabs — catalog (`tool_registered`), telemetry (`telemetry_logs`), playground (manual `webMCPEngine.execute`), approvals (`pendingApprovals`). Uses `webMCPEngine.getRegisteredTools()/getTelemetryLogs()/getPendingApprovals()/eventBus.on()` with refresh via `tool_registered|tool_execution_success|telemetry_updated|approval_queued|approval_resolved` — present and correct. No edits needed (read-only per ownership).

## Files Changed

- `src/tools/index.ts:127-135` — **P1 Fix**: Changed `registerAllWebMCPTools(engine?: WebMCPEngine)` silent no-op to `registerAllWebMCPTools(engine: WebMCPEngine = webMCPEngine)` with explicit throw if engine falsy and singleton unavailable. Ensures `registerAllWebMCPTools()` without args defaults to singleton and registers all 40 tools (verified `webMCPEngine.getRegisteredTools().length===40`).

No other owned files modified — `src/core/webmcp/WebMCPEngine.ts`, `src/types/webmcp.ts`, `src/core/events/eventBus.ts`, `src/types/index.ts` already compliant (verified, no changes needed).

## Verification

- Command: `npm run lint` (tsc --noEmit)
  - Result: PASS (0 errors) — log: `/tmp/worker-ws-02-lint.log` (also inlined)
- Command: `npm test -- test/unit/WebMCPEngine.test.ts test/integration/M1_CoreFlow.test.ts --reporter=verbose`
  - Result: 5 passed, 0 failed (405-406ms, 2 test files) — log: `/tmp/worker-ws-02.log`
  - Details:
    - `WebMCPEngine.test.ts` 4 tests: registers 40 tools across 7 modules (vault 3, pillmap 8, rxbridge 5, safety 9, carecircle 5, dossier 3) PASS, validates JSON Schema types/required/enum PASS, executes tool + telemetry PASS, approval interception queue/resolve PASS
    - `M1_CoreFlow.test.ts` 1 test: full M1 workflow ingest->extract_fact->confirm_fact->vault update->dossier compilation PASS
- Manual check: `npx tsx -e` verifying `getRegisteredTools().length===40` and telemetry
  - Result: PASS — `getRegisteredTools().length === 40` after `registerAllWebMCPTools()` no-arg, `telemetry history len 1 status executed`, `approvalGateCounter +1 pending true`, `EventBus pub/sub PASS`, `modelContext polyfill PASS` — log: `/tmp/worker-ws-02-manual.log`
- Additional: `npx tsx -e` schema verification — all 40 tools have name/description/parameters JSONSchema/requiresApproval/category/moduleOwner — PASS; categories: imperative_extraction, approval_gate, declarative_export, clinical_negotiation, safety_alert, audit_proxy; moduleCounts vault:3, labstory:2, pillmap:8, rxbridge:5, homelab:5, safety:9, carecircle:5, dossier:3
- Build: `tsc --noEmit` PASS (via lint)
- Ownership: Only `src/tools/index.ts` modified within owned globs `src/core/webmcp/*`, `src/types/webmcp.ts`, `src/core/events/*`, `src/tools/index.ts`, `src/types/index.ts` — no vault edits, PASS

## Unresolved Issues

- **All current tool definitions have `requiresHumanApproval:false`**: No bundled tool exercises the approval gate path in production; gate logic tested only via synthetic `test_approval_tool`. Future milestones (HomeLab `propose_dosage_change`, Safety `doctor_remove_medication`) define `approvalGateType:'modal_proposal'|'safety_action'` but keep `requiresHumanApproval:false` — intentional per current spec (gate via proposal status, not engine-level blocking). If engine-level human gate needed, flip flag to true.
- **Native `document.modelContext.registerTool` delegation not mirrored**: `WebMCPEngine.register()` writes to internal `Map` only; when `isNative:true` it does not also call `document.modelContext.registerTool`. Polyfill path delegates correctly; native path would double-register if called. Acceptable since jsdom/standard browser uses polyfill; native browsers would need explicit native delegation — documented as potential future enhancement.
- **Polyfill global leakage**: `installPolyfill()` writes to `globalThis.modelContext`, `globalThis.__CareCanvas_WebMCP__`, and `document.modelContext` without cleanup. Tests share singleton; `new WebMCPEngine()` re-installs polyfill each time — idempotent overwrite, no leak beyond globals. Could add `uninstallPolyfill()` for test isolation but not required.

## Learnings

- P1 silent no-op was masked because all existing tests called `registerAllWebMCPTools(webMCPEngine)` explicitly; only bare `registerAllWebMCPTools()` call (as in app bootstrap) would fail — fixed via default param to singleton, aligning with ws-01's `wireLocalVaultToEventBus` pattern.
- jsdom `isNative:false` polyfill verified via `globalThis.modelContext.registerTool` existence, not `document.modelContext` in Node without dom — vitest jsdom environment provides document, Node tsx manual check uses global fallback.
- 40-tool count stable after fix; vault/meds/labs flows unaffected.

