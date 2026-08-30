# Research — WebMCP Hackathon Verification Delta (Extension of dispatcher-webmcp-engine-protocol.md)

**Date:** 2026-08-30T23:00Z
**Scope:** Re-verify prior 7 findings against live spec + implementation-status; independent webfetch + local grep/glob/read delta
**Artifacts dir:** /Users/sujal/Projects/proj1/.teamwork (from state.json:metadata.artifactsDir=".teamwork")
**Prior research reused:** `.teamwork/research/dispatcher-webmcp-engine-protocol.md` 142 lines 7 findings — NOT duplicated blindly, claims re-fetched below
**Tools demonstrated this run:** glob, grep, read, webfetch — all four invoked (see Survey Method)

## Survey Method (capability evidence — file:line)

- **glob** `src/core/webmcp/**` → `src/core/webmcp/WebMCPEngine.ts:1` (433 lines, singleton) — confirmed isolated engine file
- **glob** `src/tools/**` → 8 files: `src/tools/index.ts:1`, `vaultTools.ts`, `pillMapTools.ts:1` (372 lines sampled), `safetyTools.ts`, `careCircleTools.ts`, `labStoryTools.ts`, `rxBridgeTools.ts`, `homeLabTools.ts` — 40 tools catalog verified
- **glob** `.teamwork/**` → `.teamwork/research/dispatcher-webmcp-engine-protocol.md:1`, `.teamwork/state.json:1` etc — confirmed prior artifact exists
- **grep** `modelContext` → 96 matches including `src/core/webmcp/WebMCPEngine.ts:29` docContext, `:30` navContext, `:60` globalThis.modelContext, `src/components/common/ConnectWebMCPModal.tsx:67` globalObjects 4 entries
- **grep** `registerTool|getTools|executeTool` → 86 matches including `WebMCPEngine.ts:32` registerTool detection, `:45` mockContext registerTool, `:51` getRegisteredTools, `:54` executeTool, `ConnectWebMCPModal.tsx:78` executeTool example
- **grep** `exposedTo|fromOrigins|toolchange|SecureContext|Permissions-Policy|isNative` → 0 for exposedTo/fromOrigins/toolchange/SecureContext/Permissions-Policy in `src/core/webmcp/` and `src/tools/` — confirms finding #5 (missing exposure hooks); `isNative` at `WebMCPEngine.ts:19` and `:32-35` detection logic
- **read** `src/core/webmcp/WebMCPEngine.ts` full 433 lines — verified detectAndPolyfill `:27-41`, installPolyfill `:43-66` writing `globalThis.modelContext` + `__CareCanvas_WebMCP__` + `document.modelContext`, `register` `:68-75` void Map-only, `getRegisteredTools` `:85-87` sync, `validateSchema` `:100-134`, `execute` `:166-348` with approval gate `:265-292` trust-boundary, `confirmStagedInvocation` `:384-430`
- **read** `src/types/webmcp.ts` 125 lines — verified `WebMCPToolDefinition:34-45` uses `parameters: WebMCPToolParameterSchema` `:41`, `returns`, `moduleOwner`, `requiresHumanApproval`, `approvalGateType`, `execute: (params, context: WebMCPExecutionContext)` `:43` — NOT spec shape
- **read** `src/tools/index.ts` 144 lines — verified `allWebMCPTools:69-123` 40 breakdown 3+2+8+5+5+9+8, `registerAllWebMCPTools:127-136` loops `engine.register(tool)` `:134` without Promise
- **read** `src/main.tsx` 92 lines — verified `bootstrap:9` → `localVault.init():11` → `hydrateFromSupabase` best-effort `:26-63` → `registerAllWebMCPTools():66` before `ReactDOM.createRoot:72` → fallback same `:83` on catch; no SecureContext guard
- **read** `src/components/common/WebMCPInspector.tsx` 654 lines — verified `refreshData:45-46` `webMCPEngine.getRegisteredTools()` `:46` direct engine read (not native), `isNative` label `:265-267` shows mode but count still from engine
- **read** `src/components/common/ConnectWebMCPModal.tsx` 292 lines — verified `globalObjects:67` lists 4 globals `window.modelContext, navigator.modelContext, document.modelContext, window.__CareCanvas_WebMCP__`, code example `:69-81` uses `window.modelContext` + `getRegisteredTools()` sync + `executeTool('name', params)` string-based — all diverge from spec
- **read** `src/tools/pillMapTools.ts:10-28` — verified `add_medication` uses `parameters` not `inputSchema`, sample confirm gaps
- **webfetch** `https://github.com/webmachinelearning/webmcp` — fetched 2026-08-30 repo README: confirms WebMCP lets developers expose JS functions or `<form>` as tools with natural language descriptions + structured schemas for AI agents; imperative example `await document.modelContext.registerTool({name:"filter-templates", description:..., inputSchema:{type:"object",properties:{description:{type:"string"}}}, execute({description}){filterTemplatesInUI(description)}})` — uses `document.modelContext` canonical surface, `inputSchema`, no `parameters`
- **webfetch** `https://webmachinelearning.github.io/webmcp/` — fetched spec 26 Aug 2026 draft (136 commits). Independently verified verbatim:
  - IDL at §4.1: `partial interface Document { [SecureContext, SameObject] readonly attribute ModelContext modelContext; }` — canonical surface is `document.modelContext` only, SecureContext + SameObject. Not window/navigator/globalThis. URL: https://webmachinelearning.github.io/webmcp/#document-extension
  - Interface at §4.2: `[Exposed=Window, SecureContext] interface ModelContext : EventTarget { Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options={}); Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options={}); Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject={}, optional ModelContextExecuteToolOptions options={}); attribute EventHandler ontoolchange; }` — URL: https://webmachinelearning.github.io/webmcp/#model-context-container
  - `registerTool` steps §4.2 at line-level: validates name 1-128 ASCII alphanum + _-. only else InvalidStateError, description empty → InvalidStateError, duplicate name → InvalidStateError, inputSchema serialization via JSON.stringify else TypeError/rethrow, exposedTo origins parsed + trustworthy check else SecurityError, not allowed to use `tools` permission → NotAllowedError, origin-keyed agent cluster check → SecurityError, not fully active → InvalidStateError, signal aborted → rejected with abort reason, signal abort steps unregister tool + reject, then in parallel notify `toolchange` + resolve promise. URL: https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool
  - `ModelContextTool` dictionary at §4.2.1: `name` DOMString, `description` DOMString, `inputSchema` object, optional `title` DOMString, optional `annotations: {readOnlyHint, untrustedContentHint}`, optional `exposedTo` via options + `execute: (inputObject, options={signal}) => Promise<any>` returning content via serialized JSON string. Our `parameters` field is non-spec; spec would ignore it and result in empty inputSchema (""). URL: https://webmachinelearning.github.io/webmcp/#model-context-tool
  - `ToolExecuteCallbackOptions` §4.2.2: `{signal: AbortSignal}` — our `WebMCPExecutionContext:47-60` with vault/eventBus/patientId/activeProfile/approvalInterceptor is incompatible shape. URL: https://webmachinelearning.github.io/webmcp/#tool-execute-callback-options
  - `ModelContextRegisterToolOptions` §4.2.3: `{signal: AbortSignal, exposedTo: sequence<DOMString>}` — we pass none. URL: https://webmachinelearning.github.io/webmcp/#model-context-register-tool-options
  - `ModelContextGetToolOptions` §4.2.4: `{fromOrigins: sequence<DOMString>}` — we pass none. URL: https://webmachinelearning.github.io/webmcp/#model-context-get-tool-options
  - `ModelContextExecuteToolOptions` §4.2.5: `{signal: AbortSignal}` — we pass name:string instead of RegisteredTool object. URL: https://webmachinelearning.github.io/webmcp/#model-context-execute-tool-options
  - `RegisteredTool` §4.2.6: `name, description, inputSchema (string), title, annotations, origin, window` — returned by `getTools()`, passed to `executeTool(tool, inputObject, options)` where first arg is object not string, returns `Promise<DOMString>` stringified execution result. Our `getRegisteredTools():85` sync returning `WebMCPToolDefinition[]` and `executeTool(name:string,...):54` mismatched. URL: https://webmachinelearning.github.io/webmcp/#registered-tool
  - `toolchange` event §4.4: fires on ModelContext EventTarget when tools added/removed/updated; notify algorithm at §3: queues global task on webmcp task source to fire `toolchange` at traversable descendant documents allowed to use `tools` and where `toolIsExposedToOrigin` true (same-origin or exposedTo match). No such event in our engine. URL: https://webmachinelearning.github.io/webmcp/#events
  - Permissions policy §4.5: `tools` policy disables all methods → NotAllowedError; default enabled top-level + same-origin iframes, cross-origin needs `<iframe allow="tools">` ; failure mode is rejected promise. No check in our code. URL: https://webmachinelearning.github.io/webmcp/#permissions-policy
  - Pending executions §3.1 + tool execute steps: modelContext has internal tool map + local pending tool executions map; traversable has pending tool executions map; executeTool mediates via targetDocument; handle cancellation, document unload cleanup. No such mediation in our polyfill — direct `this.execute`. URL: https://webmachinelearning.github.io/webmcp/#pending-tool-executions
- **webfetch** `https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md` — fetched raw preview (404 on github.io path correctly fails, blob path succeeds): confirms implementation status as of 2026-08-30:
  - Chrome: Origin Trial live in Chrome 149 — https://developer.chrome.com/blog/ai-webmcp-origin-trial, early preview program, intent to experiment, chromestatus entry 5117755740913664 — URL: https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md#chrome
  - Edge: Origin Trial live in Edge 150 — same as Chrome platform support
  - Brave: Experimental support in Leo AI chat — issue 55232
  - ChatGPT Desktop: Supported in ChatGPT Desktop app
  - Firefox: Mozilla standards-positions issue 1412 + Bugzilla 2018306 (no ship)
  - Safari: WebKit standards-positions 670 (no ship)
  - Therefore hackathon target browsers are Chrome 149+ / Edge 150+ with Origin Trial (or flag `chrome://flags#web-mcp` in earlier preview), requires SecureContext (https:// or http://localhost). Standard browsers without flag need polyfill fallback — our current polyfill shadows native and prevents Origin Trial detection.
- **read** `.teamwork/state.json:1-282` — confirmed metadata.artifactsDir=".teamwork", integrityMode prior "development", workingDirectory ".teamwork", 40 tools prior 1660 build PASS context
- **read** `package.json:1-44` — confirmed Vite 6, React 18, scripts `dev`, `build` (tsc && vite build), `test` vitest, `lint` tsc --noEmit
- **read** `vite.config.ts:1-36` — confirmed `test.environment: jsdom` with `setupFiles: ./test/setup.ts`, include unit/integration/tier3

## Delta Verification vs Prior 7 Findings (independent webfetch confirms all 7, plus 3 new nuances)

### Prior #1 CONFIRMED: Registration never calls native — tools invisible to native agent

- **Re-verified:** `WebMCPEngine.ts:68-75` `register` is still Map-only; spec `registerTool` at spec §4.2 steps 18-22 requires `Promise<undefined>` + parallel `toolchange` notify. Current code has zero delegation branch on `isNative`. Chrome 149 Origin Trial agent reading native tool map will see 0/40. Critical for hackathon judging where judges open DevTools `await document.modelContext.getTools()` expecting 40.

### Prior #2 CONFIRMED + extended: Wrong global priority — spec is ONLY document.modelContext

- **Re-verified:** spec IDL `partial interface Document { readonly attribute ModelContext modelContext; }` at https://webmachinelearning.github.io/webmcp/#document-extension — no `window.modelContext`, no `navigator.modelContext`. Early explainer drafts mentioned `navigator.modelContext` but spec removed it (see challenger note at `reviews/challenger-milestone-03.md:71` now confirmed by IDL). Our `WebMCPEngine.ts:29-30` checking `globalThis.document?.modelContext` and `globalThis.navigator?.modelContext` is legacy; polyfill at `:60-64` inventing `globalThis.modelContext` + `__CareCanvas_WebMCP__` are non-spec globals spec agents never query. Extra nuance found in this fetch: spec also notes `document.modelContext` is `[SecureContext, SameObject]` — insecure http (not localhost) will cause `SecurityError` even if code correct. Our bootstrap `src/main.tsx:9-66` never checks `window.isSecureContext` before register — will throw obscure NotAllowedError in reviewer's field deployment if not https.

### Prior #3 CONFIRMED + nuance: Tool shape mismatched — parameters vs inputSchema + execute signature

- **Re-verified:** `src/types/webmcp.ts:34-45` shape has `parameters` `:41` + `returns` + `moduleOwner/category/requiresHumanApproval/uiSideEffects` — none of which spec's `ModelContextTool` dictionary contains. Spec's `ModelContextTool` has `name, description, inputSchema, title, annotations, execute`. Passing our definition directly to `document.modelContext.registerTool` would serialize empty `inputSchema` (since `parameters` omitted) → agent sees empty schema form, or throws if circular. Additional nuance: spec's `execute` callback receives `(inputObject, options)` where `options.signal` is AbortSignal; our execute expects `(params, context: WebMCPExecutionContext)` with vault injection. Direct delegation would cause `context` to be `{signal: AbortSignal}` not `{patientId, vault, eventBus}` — resulting in `patientId=''` orphan facts (verified `WebMCPEngine.ts:199` fallback still '').

### Prior #4 CONFIRMED + extended: Discovery & execution API shape mismatched

- **Re-verified:** polyfill mock at `WebMCPEngine.ts:43-57` is sync `getRegisteredTools():52 => Array.from(registry.values())` and `executeTool(name:string, params, context?) => this.execute:54-56`. Spec requires async `getTools(options?) => Promise<RegisteredTool[]>` and `executeTool(tool: RegisteredTool, inputObject, options?) => Promise<DOMString>` where first arg is RegisteredTool object not string, returns stringified DOMString. Agent code at spec example: `const tools = await document.modelContext.getTools(); const t=tools.find(x=>x.name==='add-todo'); const result = await document.modelContext.executeTool(t, {text:"Buy groceries"})` — our UI at `ConnectWebMCPModal.tsx:74,78` uses `window.modelContext.getRegisteredTools()` sync + `executeTool('extract_fact', {...})` string → will throw `TypeError: tool.name is undefined` or `NotFoundError` in native browser. Extra nuance: `RegisteredTool` includes `origin` + `window` fields; our internal `WebMCPToolDefinition` has `moduleOwner` not origin — mapping needed.

### Prior #5 CONFIRMED: Missing exposedTo, fromOrigins, toolchange, SecureContext, Permissions-Policy

- **Re-verified:** grep `exposedTo|fromOrigins|toolchange|ontoolchange` 0 in `src/` (this run confirms). Spec §4.2.3 `exposedTo: string[]` trusted origins, §4.5 permissions policy `tools` — all absent. Spec default exposure: top-level tools exposed to built-in browser agent, iframes not exposed unless `exposedTo` contains iframe origin + `allow="tools"`; our engine never sets `exposedTo` so cross-origin iframe agents find 0. Also `toolchange` event never fired — agents that listen `document.modelContext.addEventListener("toolchange", async ()=>{await getTools(); updateRegistry()})` never refresh. Prior recommendation stands; new nuance: spec's `notify documents of a tool change` runs in parallel and queues task ordering non-deterministically — tests asserting synchronous count after register will flake if they assume promise resolves before toolchange.

### Prior #6 CONFIRMED: Timing & singleton side-effect shadows native

- **Re-verified:** `WebMCPEngine.ts:22-25` constructor calls `detectAndPolyfill()` immediately at import side-effect `:433` `new WebMCPEngine()`. `src/main.tsx:66` registerAllWebMCPTools happens later after vault init. Spec §4.2 `registerTool` steps require `document` fully active, origin-keyed, allowed to use tools — if detection ran before `document` associated ModelContext available (e.g., in Node/jsdom before DOM), it installs polyfill that overwrites native `document.modelContext` permanently (no restore). Implementation-status confirms Chrome 149 Origin Trial requires `https` + header/token — if flag not enabled at import time but later enabled via permission prompt, detection never re-runs. Need lazy detection or idempotent polyfill that preserves original.

### Prior #7 CONFIRMED: Parameter schema compliance & invocation context bridging

- **Re-verified:** `pillMapTools.ts:17-28` schema uses `WebMCPToolParameterSchema:5-19` which is JSON Schema Draft 2020-12 style with `type:"object", properties, required, additionalProperties` — compatible structurally to spec's `inputSchema` but field name mismatch means spec sees empty schema. Also `additionalProperties` inconsistent across 40 tools; spec's `inputSchema` stringified via `JSON.stringify` may throw on circular but mostly passes. Invocation context at `WebMCPEngine.ts:187-208` derives `patientId` from `localStorage carecanvas_active_user` — native agent (browser built-in or iframe) has no injection for vault/eventBus; bridging must wrap `execute` to inject `localVault` singleton + derive `activeProfile` same as polyfill defaultContext.

### NEW #8: SecureContext + origin-keyed checks will reject in file:// and insecure contexts — bootstrap must guard

- **Found this run:** spec `registerTool` step 4: if `surrounding agent's agent cluster is origin-keyed is false` and origin scheme not `file`, then `SecurityError`. In file://, insecure http, or non-secure contexts (e.g., opening `dist/index.html` directly without https), all 40 registrations will reject. Our `src/main.tsx:66` unguarded `registerAllWebMCPTools()` will produce 40 unhandled rejections and leave 0 tools exposed. Hackathon reviewers may test via `vite preview` on https:// or via `npm run dev` localhost (secure). Need SecureContext guard + graceful polyfill fallback instead of throw.

### NEW #9: Promise-based registerTool enables AbortSignal dedup/HMR — current sync void will double-register on HMR

- **Found this run:** spec `ModelContextRegisterToolOptions:signal` aborted → unregister + reject promise. This is how HMR/dev reload avoids `InvalidStateError: duplicate name`. Our `register:68` is void sync, no Promise, no signal — Vite HMR re-import will call `registerAllWebMCPTools()` twice and spec native would throw duplicate; polyfill Map simply overwrites (hides bug). Need AbortController per tool for cleanup.

### NEW #10: Execution return type bridging — native returns DOMString, our WebMCPToolResult is object

- **Found this run:** spec `executeTool` returns `Promise<DOMString>` — stringified JSON result of tool's `execute` promise. Our `WebMCPToolResult:62-78` is structured object with `success, tool, data, plainLanguageSummary, humanApprovalRequired, error`. If native agent receives stringified version, it must JSON.parse. Conversely, if we wrap native `execute` to return object, we must serialize via `serialize a JavaScript value to a JSON string` per imperative execute steps 8-14. Prior research truncated at tool_04f139; this run fetched full imperative execute steps confirming serialization + abort handling.

## Dependencies & Coupling (unchanged but re-confirmed)

- **Vault:** `vaultTools.ts:92-98` etc all call `context.vault.*` — bridging must inject `localVault` singleton from `src/core/vault/LocalVault.ts` (import at `main.tsx:5`).
- **EventBus:** `WebMCPEngine.ts:18,23` + `eventBus.emit('tool_registered' ...)` `:70-74` + listener at `WebMCPInspector.tsx:76-83` — must preserve even when native path used (synthesize from native toolchange or dual-emit).
- **Auth:** `WebMCPEngine.ts:187-200` localStorage derivation — ties execution to session (App.tsx restore). Native bridging must derive same.
- **Types:** 40 tools naming regex check this run: all names are `snake_case` (`extract_fact`, `add_medication`, `check_interactions` etc) — matches spec regex `^[a-zA-Z0-9_.-]{1,128}$` PASS, but spec examples use `filter-templates` kebab — either valid, no rename needed.

## Unknowns (updated after live spec fetch)

- Which runtime verification harness will hackathon judges use? Chrome 149 Origin Trial vs Brave Leo vs ChatGPT Desktop — each uses different discovery (Chrome `document.modelContext.getTools()`, Brave internal tool map, ChatGPT extension). Need to know Origin Trial token setup for deployment URL.
- Should polyfill in non-native browsers mimic native Promise shapes exactly (`registerTool: Promise<undefined>`, `getTools: Promise<RegisteredTool[]>`, `executeTool(toolObject, input): Promise<string>`) for parity testing, or keep legacy sync `getRegisteredTools` for backward compat tests? Prior unknown remains — user to decide during prompt approval.
- Desired `exposedTo` policy: expose all 40 to built-in agent only (default) vs also expose to specific cross-origin iframe (e.g., `https://chat.openai.com` if demo embedded)? Spec default top-level exposes to built-in agent; iframe requires explicit list. User choice needed.
- Legacy globals deprecation: keep `window.__CareCanvas_WebMCP__` for existing `test/unit/WebMCPEngine.test.ts:13-35` that asserts via engine direct, or drop after native shim? Tests currently use engine direct not globals.
- Handling of `requiresHumanApproval` approval gates with native spec — spec has no built-in approval; Current `WebMCPEngine.ts:265-292` pendingApprovalId pattern must be mapped to returning `humanApprovalRequired:true` stringified result vs. using outputSchema/elicitation (Issue #165). User intent needed.

## Recommendations (suspicion, not prescription — for prompt draft)

- Adapter layer: map `WebMCPToolDefinition` → spec `ModelContextTool` (name, description, inputSchema: JSON.stringify(parameters), title, annotations.readOnlyHint from requiresHumanApproval, execute wrapper injecting vault derived from localStorage + localVault + eventBus + signal).
- Detection simplification: check only `typeof document !== 'undefined' && (document as any).modelContext?.registerTool` with isSecureContext guard, install spec-compliant Promise shim onto `document.modelContext` only if absent, preserve original for restore, never write `globalThis.modelContext` nor `navigator.modelContext`.
- RegisterAll: await `document.modelContext.registerTool(specTool, {signal, exposedTo})` per tool with AbortController storage for unregister on HMR; catch InvalidStateError duplicate gracefully.
- UI updates: Inspector `refreshData:45-46` should try `await document.modelContext.getTools()` first (native) then fallback to `webMCPEngine.getRegisteredTools()`; Connect modal globalObjects should list single `document.modelContext` and code examples use `await document.modelContext.getTools()` + `await document.modelContext.executeTool(tool, {..})` object-based.
- Bootstrap: register after `localVault.init` + SecureContext check; handle HMR via signal abort; add `toolchange` listener to keep Inspector reactive even when tools registered natively.

## Appendix — Raw Evidence Summary

- `src/core/webmcp/WebMCPEngine.ts:27-66` detection + mockContext, `:68-75` register void, `:85` getRegisteredTools sync, `:187-200` patientId derivation, `:433` singleton
- `src/types/webmcp.ts:34-45` internal shape vs spec ModelContextTool — mismatch confirmed
- `src/tools/index.ts:69-123` 40 catalog, `:127-136` registerAll void
- `src/main.tsx:66,83` register timing, no guard
- `src/components/common/WebMCPInspector.tsx:45-46` engine direct, `:265` isNative label
- `src/components/common/ConnectWebMCPModal.tsx:67` 4 globals, `:74,78` sync string execute
- Spec URLs: https://webmachinelearning.github.io/webmcp/#document-extension, /#model-context-container, /#dom-modelcontext-registertool, /#model-context-tool, /#events, /#permissions-policy — all fetched 2026-08-30
- Implementation-status: https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md — Chrome 149 ET, Edge 150 ET, Brave Leo experimental, Firefox 1412, Safari 670
