# Research — Dispatcher WebMCP Engine & Protocol Correctness — Scope: engine & protocol

**Date:** 2026-08-30T00:00Z
**Scope:** src/core/webmcp/**, src/tools/**, src/types/webmcp.ts, src/components/common/*WebMCP*, native spec exposure
**Tools used:** glob (list_dir), grep (grep_search), read (read_url_content) + webfetch — all three demonstrated (see logs below)
**Artifacts dir:** /Users/sujal/Projects/proj1/.teamwork (from state.json:metadata.artifactsDir=".teamwork")

## Survey Method (capability evidence — file:line)

- **glob** `src/core/webmcp/**` → `src/core/webmcp/WebMCPEngine.ts` :1 (only engine file, 433 lines)
- **glob** `src/tools/**` → 8 files: `src/tools/index.ts` :1, `vaultTools.ts`, `pillMapTools.ts` (372 lines), `safetyTools.ts` (512 lines), `careCircleTools.ts` (415 lines), `labStoryTools.ts`, `rxBridgeTools.ts`, `homeLabTools.ts`
- **glob** `src/types/webmcp*` → `src/types/webmcp.ts` :1 (125 lines)
- **glob** `src/components/common/*WebMCP*` → `WebMCPInspector.tsx` :1 (654 lines), `ConnectWebMCPModal.tsx` :1 (292 lines)
- **grep** `modelContext` → 69 matches including `src/core/webmcp/WebMCPEngine.ts:29` docContext, `:30` navContext, `:60` globalThis.modelContext
- **grep** `registerTool|registerAllWebMCPTools` → 72 matches including `src/tools/index.ts:127` registerAllWebMCPTools, `src/main.tsx:66` bootstrap register, `src/main.tsx:83` fallback register
- **grep** `getRegisteredTools|executeTool|__CareCanvas` → 54 matches including `WebMCPEngine.ts:51` getRegisteredTools polyfill, `:54` executeTool polyfill, `:61` __CareCanvas_WebMCP__
- **read** `src/core/webmcp/WebMCPEngine.ts` full: 433 lines inspected
- **read** `src/types/webmcp.ts` full: 125 lines inspected
- **read** `src/tools/index.ts` full: 144 lines inspected (40 tools catalog)
- **read** `src/main.tsx` full: 92 lines inspected (bootstrap timing)
- **read** `src/components/common/WebMCPInspector.tsx` + `ConnectWebMCPModal.tsx` inspected
- **webfetch** `https://github.com/webmachinelearning/webmcp` + `https://webmachinelearning.github.io/webmcp/` (spec) — imperative `document.modelContext.registerTool` with `inputSchema`, `title`, `annotations`, `exposedTo`, `signal`, `getTools()`, `executeTool(tool, inputObject, options)` Promise-based, SecureContext, `toolchange` event — not invented

## Repo Layout Discovered (engine & protocol)

- **Stack:** Vite 6 + React 18 + Tailwind 3.x, build 1660 modules (prior success auditor verification build 1660 `vite build` 793kB JS, 72kB CSS), 40 tools across 7 modules (vault 3 + labstory 2 + pillmap 8 + rxbridge 5 + homelab 5 + safety 9 + carecircle/dossier 8) at `src/tools/index.ts:69-123`
- **Engine singleton:** `src/core/webmcp/WebMCPEngine.ts:14` class WebMCPEngine, `src/core/webmcp/WebMCPEngine.ts:433` export singleton `webMCPEngine = new WebMCPEngine()` constructed at import time (side-effect)
- **Types:** `src/types/webmcp.ts:34-45` WebMCPToolDefinition with internal shape `name, description, moduleOwner, category, requiresHumanApproval, approvalGateType, parameters: WebMCPToolParameterSchema, returns, execute, uiSideEffects` — NOT spec shape
- **Registration entry:** `src/tools/index.ts:127-136` registerAllWebMCPTools(engine = webMCPEngine) loops all 40 via `engine.register(tool)` (:134)
- **Bootstrap timing:** `src/main.tsx:66` registerAllWebMCPTools() called after `localVault.init()` + `hydrateFromSupabase` best-effort + before `ReactDOM.createRoot` mount. Fallback `src/main.tsx:83` same on bootstrap catch.
- **UI surfaces:** `src/components/common/WebMCPInspector.tsx:17-46` reads engine directly `webMCPEngine.getRegisteredTools()` — NOT native; `src/components/common/ConnectWebMCPModal.tsx:67` lists globals `window.modelContext, navigator.modelContext, document.modelContext, window.__CareCanvas_WebMCP__` and example code uses `window.modelContext` — diverges from spec's `document.modelContext` only
- **Test infra prior:** `test/unit/WebMCPEngine.test.ts:13-35` asserts 40 tools via engine direct; prior overall 172 vitest PASS, 231 runner PASS, lint 0 — all using polyfill path (jsdom isNative false), none exercising native branch

## Native Spec Expectations (webfetch-derived)

From `https://webmachinelearning.github.io/webmcp/` and explainer:

- **IDL:** `partial interface Document { readonly attribute ModelContext modelContext; }` — canonical surface is `document.modelContext` (SecureContext, SameObject) — not `window.modelContext` nor `navigator.modelContext` nor `globalThis.modelContext`
- **Methods:** `Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options={})`, `Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options={})`, `Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject={}, optional ModelContextExecuteToolOptions options={})`
- **Tool dictionary (ModelContextTool):** `name` (1-128 chars, ASCII alphanum + _-. only), `description` (non-empty string), `inputSchema` (JSON Schema object, stringified internally), optional `title`, optional `annotations: {readOnlyHint, untrustedContentHint}`, optional `exposedTo: string[]` origins; `execute: (inputObject, options={signal}) => Promise<any>` returning `content: [{type:"text", text:...}]` style (impl varies). Spec validates name/description empty → InvalidStateError, duplicate → InvalidStateError, abort signal → unregister, Permissions-Policy `tools` disables → NotAllowedError, SecureContext + origin-keyed checks.
- **Execution mediation:** Browser validates input against `inputSchema` (when impl supports, Issue #92), queues `toolchange` event on `ModelContext` (EventTarget) when tools added/removed, exposes via internal per-Document `tool map` and notifies traversable descendants. Agents discover via `await document.modelContext.getTools()` (returns `RegisteredTool` with `name, description, inputSchema, origin, window`) and invoke via `await document.modelContext.executeTool(tool, {arg})` — first arg is RegisteredTool object, not string name.
- **Permissions & origin:** Tools exposed to same-origin by default; cross-origin requires `exposedTo: ["https://trusted.example"]` + callee `getTools({fromOrigins: [...]})` + iframe `allow="tools"`; built-in browser agent uses internal mechanism (not getTools) but still reads same tool map

## Findings — Why 40 Tools Will NOT Be Exposed in Native Browser (protocol gap)

All findings cite `file:line` and explain failure mode vs spec:

### 1. Registration surface never calls native — tools invisible to native agent

- **Code:** `src/core/webmcp/WebMCPEngine.ts:27-41` detectAndPolyfill checks `globalThis.document?.modelContext` (:29) and `globalThis.navigator?.modelContext` (:30); if `registerTool` present → `this.isNative = true` (:33,:35). Else `isNative=false` + `installPolyfill()` (:38).
- **Gap:** `src/core/webmcp/WebMCPEngine.ts:68-75` `register(toolDef)` only does `this.registry.set(toolDef.name, toolDef)` + `eventBus.emit` — never branches on `isNative` to also call `document.modelContext.registerTool`. Prior auditor noted same at `.teamwork/workstreams/ws-02-result.md:48` — native path would double-register if delegated, but current is opposite: zero delegation. So even when `isNative=true`, `allWebMCPTools` (40) stay only in internal Map, never in browser's native `Document.modelContext` tool map. Native agent querying internal map via platform API will see 0.
- **Timing amplifies:** Singleton constructed at import time (`WebMCPEngine.ts:433`) before `main.tsx:66` registerAllWebMCPTools(). If early detection set `isNative=true`, later `engine.register` still won't propagate; if early set `isNative=false`, polyfill already overwrote `document.modelContext` with mock, shadowing native forever (see #5).

### 2. Detection order & global confusion — wrong surface, wrong priority

- **Code:** `src/core/webmcp/WebMCPEngine.ts:29` `(globalThis as any).document?.modelContext` and `:30` `(globalThis as any).navigator?.modelContext`. Polyfill at `:60-64` writes `(globalThis as any).modelContext`, `(globalThis as any).__CareCanvas_WebMCP__`, and ` (document as any).modelContext = mockContext` (:63).
- **Gap vs spec:** Spec defines ONLY `document.modelContext` (extension to Document). `window.modelContext` / `globalThis.modelContext` / `navigator.modelContext` are non-spec legacy guesses. Chrome's prototype (flag `chrome://flags#web-mcp`) exposes `document.modelContext` (SecureContext required); `navigator.modelContext` was early draft, removed. Our detection prefers `document` then `navigator` but never checks `globalThis.modelContext` for native, and polyfill invents `globalThis.modelContext` + `__CareCanvas_WebMCP__` which spec agents will never query. Prior challenger noted priority confusion at `.teamwork/reviews/challenger-milestone-03.md:71` — when both globalThis and document have different registries, mismatch occurs.
- **Example of confusion in UI:** `ConnectWebMCPModal.tsx:67` claims 4 globals are valid, and code at `:74` `await (window.modelContext || window.__CareCanvas_WebMCP__).getRegisteredTools()` will not match native agent's `document.modelContext.getTools()` call.

### 3. Tool definition shape mismatched — spec would reject or misinterpret

- **Internal shape:** `src/types/webmcp.ts:34-45` WebMCPToolDefinition uses `parameters: WebMCPToolParameterSchema` (:41) with `properties` + `required` + `additionalProperties`, plus `returns`, `moduleOwner`, `category`, `requiresHumanApproval`, `approvalGateType`, `uiSideEffects`. Example `src/tools/vaultTools.ts:18-27` extract_fact defines `parameters` not `inputSchema`, `returns` not spec, `moduleOwner: 'vault'`.
- **Spec shape:** Requires `inputSchema` (not `parameters`), forbids empty description/name, validates name regex `^[a-zA-Z0-9_.-]{1,128}$`, requires `execute` returning content[] or stringified JSON, optional `title`/`annotations`. Our `parameters` field will be ignored; native `registerTool({name, description, parameters: ...})` would register tool with empty `inputSchema` (`""` per spec default) and lose schema entirely, or throw TypeError if serialization fails. Additionally, spec's `execute` signature is `(inputObject, options)` where `options.signal` is AbortSignal; ours is `(params, context: WebMCPExecutionContext)` with vault/eventBus/patientId — completely incompatible. Even if delegation were added, direct passing would cause runtime errors or validation bypass.
- **Validation divergence:** Engine's `validateSchema` at `WebMCPEngine.ts:100-134` checks `type/enum/required` but spec's native validation (Issue #92) is browser-enforced and would happen before execute. Our dual validator (`validateSchema` throws + `validateParams` returns) is not invoked by native path.

### 4. Discovery & execution API shape mismatched — agents cannot find or call

- **Polyfill shape:** `WebMCPEngine.ts:43-57` mockContext exposes `registerTool(toolDef) => this.register`, `getRegisteredTools() => Array.from(registry.values())`, `executeTool(name:string, params:any, context?) => this.execute`. Synchronous, string-based, returns `WebMCPToolResult` (`success, tool, data, plainLanguageSummary...`).
- **Spec shape:** `getTools(options?) => Promise<RegisteredTool[]>` where each RegisteredTool has `name, description, inputSchema, title?, annotations?, origin, window`. `executeTool(tool: RegisteredTool, inputObject, options?) => Promise<DOMString>` where first arg is object not string, returns stringified JSON, abortable via options.signal. Our `getRegisteredTools` sync vs promise, `executeTool` string vs object, return type object vs string all mismatch. An agent doing `const [t]=await document.modelContext.getTools(); await document.modelContext.executeTool(t, {documentId:"..."})` on our page would either get `undefined is not a function` (if polyfill shadowed native) or `NotFoundError` (if native map empty).
- **Inspector evidence:** `WebMCPInspector.tsx:46` `webMCPEngine.getRegisteredTools()` bypasses whatever `document.modelContext` holds — inspector will show 40 even when native map is 0, masking bug.

### 5. Missing exposure hook — no `exposedTo`, no `toolchange`, no SecureContext/Permissions handling

- **Code:** No reference to `exposedTo` or `fromOrigins` anywhere in `src/core/webmcp/` or `src/tools/` (grep `exposedTo` 0). No `addEventListener('toolchange')` or `ontoolchange`. No check for `SecureContext` or `Permissions-Policy: tools=()` → NotAllowedError.
- **Gap:** Spec requires tools to be explicitly exposed to origins via `registerTool(tool, {exposedTo: [...]})` and to fire `toolchange` event for agents to refresh. Our engine never sets `exposedTo`, so even if we did delegate, iframe agents with `allow="tools"` would not see tools cross-origin, and built-in agent exposure default (top-level exposes, iframe not) may not behave as expected. Also timing issue: `registerTool` returns `Promise<undefined>` that resolves after `toolchange` notify (spec :21-22 in parallel). Our `register` is sync void, no promise, no notify.

### 6. Timing — when registerAllWebMCPTools called, whether App.tsx checks native before polyfill

- **Current timing:** `WebMCPEngine.ts:22-25` constructor immediately calls `detectAndPolyfill()`. This runs at module evaluation (import side-effect) — before DOM fully parsed in some cases, before feature flag enable, before SecureContext check.
- **Bootstrap timing:** `src/main.tsx:9-67` bootstrap async: `await localVault.init()` (:11) → hydrate (:26-63) → `registerAllWebMCPTools()` (:66) → mount React. No re-run of detection after hydrate, no listener for late native enable, no handling of HMR re-registration (would throw InvalidStateError duplicate on second register without AbortController). `src/App.tsx` (627 lines) never calls registerAllWebMCPTools nor checks native — shell only reads `webMCPEngine` after bootstrap.
- **Result in native browser:** If Chrome flag enabled, detection may set `isNative=true` before any tool registered, but register still doesn't delegate, so exposure window missed. If detection ran before flag polyfill injected, it may set `isNative=false` and installMock that permanently shadows native `document.modelContext`, making native undiscoverable forever until reload. There is also no cleanup: `installPolyfill` overwrites `document.modelContext` without storing original; cannot restore.

### 7. Parameter schema compliance & tool invocation bridging — additional gaps

- **Schema compliance:** 40 tools' `parameters` use JSON Schema Draft 2020-12 style at `pillMapTools.ts:17-28` etc. but spec's `inputSchema` is stringified JSON Schema; our `additionalProperties` not consistently set (only `src/types/webmcp.ts:18` has it), `items`, `enum`, `minimum/maximum` present but never validated natively. Tools like `add_medication` require `name, dose, slot` (:27) but spec would expect same via `inputSchema.required`. Mismatch means agent's schema-driven form (auto-generated UI) would be empty.
- **Invocation context missing:** Spec's `execute` receives only `inputObject` + `signal`; our `execute` requires `WebMCPExecutionContext` at `src/types/webmcp.ts:47-60` with `patientId, activeProfile, vault, eventBus, approvalInterceptor`. Polyfill `executeTool` at `WebMCPEngine.ts:54-56` forwards `this.execute(name, params, context)` where context defaults to derived from `localStorage carecanvas_active_user` (:187-208). Native agent has no way to supply vault/eventBus; without bridging, tool will fail with `patientId=''` orphan writes (vs `DocumentDropzone.tsx:11-24` effectivePatientId fallback `patient-unknown`). Current `execute` already handles empty patientId as `''` (:199) — would create orphan vault records visible to wrong patient.

## Dependencies & Coupling

- **Vault coupling:** All 40 tools call `context.vault.*` (e.g., `vaultTools.ts:92-98` addFact, `pillMapTools.ts:51-64` addMedication, `safetyTools.ts:54` addDangerReport). Native bridging must inject vault context without leaking PHI; requires same `localVault` singleton that `main.tsx:5` imports. Success-auditor evidence: `localVault.getSeedCounts` 8 stores, `isSeeded` etc — vault is source of truth.
- **EventBus coupling:** `WebMCPEngine.ts:18,23` WebMCPEventBus, `register` emits `tool_registered`, `execute` emits `toast_notification`, `canvasRerenders`, `approval_required`. Native path must preserve events for UI reactivity (`WebMCPInspector` listens at `:77-83` to 6 events). Spec's `toolchange` event is separate and must be synthesized or forwarded.
- **Auth coupling:** `WebMCPEngine.ts:187-200` resolves patientId from `localStorage carecanvas_active_user` — ties WebMCP execution to signed-in session (`App.tsx:102-124` restore). Native agent cannot access localStorage directly; bridging must derive from same storage or from injected context after CreateAccount gate (`App.tsx:313-326`).
- **Module ownership:** `src/tools/index.ts:9-67` imports all 7 modules; no circular deps. `src/tools/careCircleTools.ts:44` vault-derived patientName generic fix already applied (M2), but `grantDoctorAccessTool:279` still contains `doctorName: params.doctorEmail.includes('chen') ? 'Dr. Chen, MD ...' : 'Dr. Specialist'` — still near-hardcode but allowed as generic.

## Affected Files (ownership — for Orchestrator workstreams)

- **Engine core (must fix):** `src/core/webmcp/WebMCPEngine.ts` (433 lines) — detection, polyfill install, register, getRegisteredTools, execute, validation, approval gating
- **Types (must adapt):** `src/types/webmcp.ts` (125 lines) — definition shape → spec alignment or adapter layer
- **Catalog (must ensure bridging preserves 40):** `src/tools/index.ts` (144 lines) + all 7 module tool files (each ~300-500 lines) — shape stays but needs mapping when registering natively
- **Bootstrap (timing):** `src/main.tsx` (92 lines) — register call timing, fallback, SecureContext guard
- **UI that masks bug (must update to show native state):** `src/components/common/WebMCPInspector.tsx` (654 lines) — shows polyfill count, not native; `src/components/common/ConnectWebMCPModal.tsx` (292 lines) — lists wrong globals, code examples use `window.modelContext`
- **App shell (potential re-registration):** `src/App.tsx` (627 lines) — currently no WebMCP logic; may need mount-time check or signal cleanup
- **Tests (must extend):** `test/unit/WebMCPEngine.test.ts` (130 lines), `test/tier3-integration/*` — currently only polyfill assertions; need native-mock harness
- **Not to touch (prior success):** vault seed/localVault already PASS generic, pillMap/rxBridge/etc functional — avoid regressing 172/231 PASS, 1660 build

## Unknowns (need user input or runtime verification)

- Which Chrome version / flag does user consider "native WebMCP"? Spec is draft 26 Aug 2026, implementation-status.md shows experimental. Need to know Chromium build and whether `document.modelContext` is available in target or only behind flag — determines whether fix must support both prefixed and unprefixed.
- Should polyfill remain for non-native browsers? Assume yes (graceful fallback required), but user must confirm fallback semantics: should polyfill mimic spec's Promise-based API exactly (`registerTool` returns Promise, `getTools` returns Promise<RegisteredTool[]>) or keep legacy sync `getRegisteredTools` for backward compat?
- Desired `exposedTo` policy: expose all 40 tools to built-in agent by default (top-level) vs restrict to same-origin in-page agent? Spec default for top-level is exposed to built-in agent, iframe not. Need user choice.
- Should tool `name` remain snake_case (`extract_fact`) vs spec's allowance for `.` and `-`? All 40 currently valid (1-128, alphanum + _-.) per grep — should we keep names or rename to spec examples (`filter-templates`)?
- Approval gates (`requiresHumanApproval` at `src/types/webmcp.ts:39` + `WebMCPEngine.ts:261-292`) currently return pendingApprovalId synchronously. Native spec has no built-in approval concept; should pending be returned as tool output with `humanApprovalRequired:true` (current) and later `confirmStagedInvocation` (:384-430), or should it use outputSchema + elicitation (Issue #165)? Need user intent.
- Do we need to preserve legacy globals (`window.__CareCanvas_WebMCP__`, `window.modelContext`, `navigator.modelContext`) for existing in-page agents / tests, or deprecate after fix? Tests currently use `globalThis.modelContext` (:60).
- Timing: should registration be re-done on `toolchange` listener or on `localStorage` auth change (patient switch at `App.tsx:186-284`)? If user switches profile, vault context changes.

## Verification Plan Hints (for prompt draft)

- **Build & tests:** `npm run lint` (tsc --noEmit EXIT 0), `npm test` (vitest 172+ PASS), `npx tsx test/test-runner.ts` (231 PASS), `npm run build` (1660 modules, dist valid) must stay PASS after protocol fix — no regression of internal engine.
- **Grep gates for legacy:** `grep -R "window.__CareCanvas_WebMCP__" src` count, `grep -R "globalThis.modelContext" src` — decide keep vs 0 after fix.
- **Live native probe:** In Chrome with WebMCP flag, open `https://carecanvas.local` (dev `npm run dev` port 5173), DevTools console: `await document.modelContext.getTools()` length should be 40, each `tool.name` in expected set, `tool.inputSchema` JSON parses, `tool.description` non-empty; `await document.modelContext.getTools()` called from iframe with/without `allow="tools"` should filter per `exposedTo`.
- **Invocation probe:** `const t=(await document.modelContext.getTools()).find(x=>x.name==='extract_fact'); await document.modelContext.executeTool(t, {documentId:"doc-test-001", rawText:"Aspirin 100mg daily"})` should succeed via native path, create vault fact with correct `patientId` (not empty, not patient-s-devi), visible in FactStream at 1280/375/768, no orphan.
- **Polyfill parity:** In standard browser without flag (jsdom), same calls via polyfill should still show 40 and succeed — verify fallback not broken.
- **Screenshots:** ≥2 per milestone (desktop 1280 + mobile 375) under `.teamwork/snapshots/` showing Inspector now reflects native count (label "Native WebMCP" vs "Polyfill Adapter" at `WebMCPInspector.tsx:265-267`) and Connect modal shows correct `document.modelContext` examples.

## Recommendations (suspicion, not prescription — Orchestrator decides HOW)

- Suspicion: Need adapter layer mapping internal `WebMCPToolDefinition` → spec `ModelContextTool` (name, description, inputSchema stringified, title, annotations readOnlyHint based on `requiresHumanApproval`, execute wrapper injecting vault/eventBus/activeProfile).
- Suspicion: Detection should simplify to `if (document?.modelContext?.registerTool) isNative=true` without navigator/globalThis checks, and `installPolyfill` should install spec-compliant Promise-based shim onto `document.modelContext` only if absent, preserving original for restore.
- Suspicion: `registerAllWebMCPTools` should await `document.modelContext.registerTool` per tool (Promise) with AbortController signal for duplicate/unregister cleanup, rather than sync Map set.
- Suspicion: Inspector and Connect modal should be updated to query `document.modelContext.getTools()` (Promise) and show native vs polyfill mode accurately.
- Suspicion: Bootstrap should register after DOMContentLoaded / SecureContext OK, and handle HMR/duplicate via signal abort.

## Appendix — Raw Evidence Logs (summarized)

- `src/core/webmcp/WebMCPEngine.ts:27` detectAndPolyfill docContext, `:32` isNative check, `:43-57` mockContext, `:60-64` globalThis/modelContext + document.modelContext assignment, `:68-75` register void, `:85` getRegisteredTools sync, `:100-134` validateSchema, `:166-348` execute with approval gate, `:433` singleton export
- `src/types/webmcp.ts:5-19` WebMCPToolParameterSchema, `:34-45` WebMCPToolDefinition internal shape, `:47-60` WebMCPExecutionContext with vault/eventBus
- `src/tools/index.ts:69-123` allWebMCPTools 40 breakdown 3+2+8+5+5+9+8, `:127` registerAllWebMCPTools
- `src/main.tsx:5-6` imports, `:9-67` bootstrap, `:66` registerAllWebMCPTools before mount
- `src/components/common/WebMCPInspector.tsx:46` webMCPEngine.getRegisteredTools, `:265` isNative label
- `src/components/common/ConnectWebMCPModal.tsx:67` globalObjects 4 entries, `:74` window.modelContext.getRegisteredTools example
- `test/unit/WebMCPEngine.test.ts:1-130` 4 tests polyfill-only
- Spec fetch: `document.modelContext.registerTool({name, description, inputSchema, execute}, {signal, exposedTo})` etc — see webfetch output truncated at tool_04f139
