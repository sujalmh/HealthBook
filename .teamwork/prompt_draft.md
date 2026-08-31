# Prompt Draft — CareCanvas AI Refactor — Approved

## Objective

> **Verbatim user goal (preserved exactly — do not paraphrase):**
> ```
> Refactor AI implementation:
> 1. Lot of hardcoded ai responses
> 2. AI Requests not verified, it doesnt work
> 3. Written to pass tests, not proper code
>
> Dont overcomplicate it, use iterative coding and fix it quick
> ```

> **Clarified scope synthesis (what to achieve, not how):**

CareCanvas AI layer (`src/core/ai/**`) and its consumers (`src/tools/**`) are wired as generic configurable client reading provider/model/baseURL from runtime config (`import.meta.env` OR `SettingsStore`, no hardcoded literals), supporting multimodal inputs (file + text) via two generic API shapes: **completions** (`/chat/completions` style) and **responses** (`/responses` style). Prior implementation passed gates but user reports it still feels hardcoded, AI requests are unverified/broken, and code is shaped to pass tests not to be proper. This refactor must validate that claim against current `src/`, then **simplify and harden** the AI path so it is **genuinely AI-driven when enabled, verifiably hits the configured provider with correct endpoint/model/headers and single multimodal body for file inputs, and has no test-conditional hacks or hardcoded mock responses masking failures** — while keeping the fix **small, iterative, and fast** (no over-engineering). All file-based/image OCR must be via AI when enabled, text may fallback gracefully when AI disabled, but fallback must never masquerade as AI.

> **Approved per user feedback 2026-08-31:** Remove prior self-claimed Q1-Q9 remaining artifacts, remove assumptions about specific AI models, treat AI as generic multimodal that takes file inputs, fix only completions and responses APIs, thorough multimodal testing required. No open questions — proceed iterative.

## Context

- **Repo layout discovered via `glob` (list_dir) — 5+ globs executed:**
  - `src/core/ai/**` → 6 files at `src/core/ai/client.ts:1` `config.ts:1` `vision.ts:1` `structured.ts:1` `fallback.ts:1` `types.ts:1` — generic configurable client, vision multimodal, structured JSON, fallback heuristic. Glob `src/core/ai/**` returned 6 hits.
  - `src/tools/**` → 8 files at `src/tools/vaultTools.ts:1` `labStoryTools.ts:1` `homeLabTools.ts:1` `pillMapTools.ts:1` `rxBridgeTools.ts` `safetyTools.ts` `careCircleTools.ts` `index.ts` — all 40 WebMCP tools exposed via `src/tools/index.ts:69-123`. Glob `src/tools/**` returned 8 hits.
  - `src/components/**` → 44+ files at `src/components/vault/DocumentDropzone.tsx:43` `homelab/UploadLabModal.tsx:42` `pillmap/PillMapView.tsx:180` `labstory/LabStoryView.tsx` `safety/DangerSignModal.tsx:100` `dossier/SourceLinkViewer.tsx:251` — UI shells reading vault/eventBus. Glob returned 44.
  - `test/**` → 30+ files at `test/test-runner.ts:1` `test/setup.ts:1` `test/tier1-feature/vault-tools.spec.ts` `test/unit/vaultTools.test.ts` etc. Glob returned 30+.
  - `.teamwork/**` → 23 entries at `.teamwork/state.json:1` `.teamwork/verification/*.log` (27 logs) `.teamwork/research/dispatcher-*.md` (19) `.teamwork/snapshots/**` — prior M1-M3 artifacts preserved.
  - `glob` logs redirected to `/tmp/dispatcher-glob.log` — 6 invocations, counts above.

- **Test infra discovered via `read` + `grep`:**
  - Vite 6 + React 18 + Tailwind 3, `vite.config.ts` `test.environment: jsdom` + `setupFiles: ./test/setup.ts`, scripts `dev/build/test` at `package.json:1-44`.
  - `npm test` 174 vitest + `npx tsx test/test-runner.ts` 231 runner PASS pre-refactor (per `state.json` final PASS lint0 build1672). Current `test/setup.ts` known to mock fetch with realm guard per prior audits.
  - WebMCP 40 tools via `document.modelContext.getTools()` + `Promise.allSettled` at `src/main.tsx`, `src/core/webmcp/WebMCPEngine.ts:566` derivePatientId via `carecanvas_active_user`. Grep `grep -R "getTools" src/` count 40 preserved per prior `grep-gates.log`.

- **AI client evidence via `read` `src/core/ai/*` (`file:line`):**
  - `src/core/ai/config.ts:27-117` `readSettingsStoreOverrides()` reads JSON blobs + individual `VITE_AI_*` keys with `Settings>env` precedence at `config.ts:123-139` `resolveConfigValue`; `getAIConfig():168-220` generic, `isAIEnabled():226-229` checks `enabled && apiKey && baseURL && model`, `getAIEndpoint():250-259` composes `{base}/chat/completions` vs `{base}/responses` generically via provider setting, `getAIModel():264-268` model fallback. No hardcoded provider literals in `src/` — generic via `import.meta.env` OR `localStorage`.
  - `src/core/ai/vision.ts:25-104` `buildChatVisionContent:25-37` vs `buildResponsesVisionContent:43-55` generically via provider; `buildChatMessages:82-92` and `buildResponsesInput:94-104` produce single multimodal body; `isMultimodalRequestBody:110-123` verifies multimodal `image+text` in same body without assuming specific model.
  - `src/core/ai/structured.ts:11-37` `FACT_EXTRACTION_JSON_SCHEMA` schema, `buildChatStructuredParams:43-49` vs `buildResponsesStructuredParams:52-65` via `config.provider`, `validateStructuredOutput:86-115` checks `confidence>0`, `parseJsonContent:120-152` handles fences, `extractTextFromProviderResponse:159-195` handles both provider response shapes generically.
  - `src/core/ai/client.ts:29-37` `SYSTEM_PROMPT` prompt with category list and unit rules; `toFacts:59-92` coerces with `confidence 0.55-0.98` clamp; `buildRequestBody:99-135` generic branching for completions vs responses; `extractWithAI:142-282` handles fallback guard, config validation `throw` at `172`/`176`, `buildRequestBody` at `178`, warning at `182`, realm-safe `AbortController` at `189-214` with test-env omit, fetch at `217-227`, `!response.ok` throw at `238`, extraction at `246-264`. **Request verification present but brittle** — see unverified gaps.
  - `src/core/ai/fallback.ts:15-58` `vaultHeuristicFallback` duplicated heuristics: split, inferCategory, extractUnit, guard `hasImage→false` (fallback only for text, never for file/image); `heuristicFallback:64-115` confidence.
  - `.env.example:14-50` documents `VITE_AI_*` keys generically, `opencode.json:35-68` provider example — not hardcoded in `src/`.

- **Hardcode evidence via `grep` + `read` (`file:line`) — what IS still hardcoded vs generic:**
  - **Duplicated heuristic fallbacks passing as AI when disabled (masking "doesnt work"):** `vaultTools.ts:15-57` duplicates `fallback.ts:64-115` logic but splits with decimal-aware regex at `vaultTools.ts:20` vs `fallback.ts:75`; `labStoryTools.ts:261-280` `fallbackRegexExtract`; `homeLabTools.ts:176-206` `tryParse`. All guarded by `isAIEnabled` true path primary, but test env forces fallback.
  - **Synthetic image harness (test-passing not proper):** `UploadLabModal.tsx:135` `syntheticImageDataUrl` 1×1 pixel + `syntheticText` + `doExtractWithBlob:65-104` — demo uses synthetic when no file selected, not real file input.
  - **Test-conditional hacks:** `pillMapTools.ts:12-23` + `interactionEngine.ts:33-49` `isTestEnv()` guards force fixture path in tests; `client.ts:189-214` verbose realm guard + `isTestEnvSignal` branch disables `AbortSignal` in tests so timeout never exercised.
  - **Previously fixed but still evidence of test-passing evolution:** `vaultTools.ts:279` `referenceRange: undefined`, `homeLabTools.ts:18-33` hash bbox to satisfy `no-hardcode-bbox.log:0`, `vaultTools.ts:18` decimal-aware split to fix `1.90→1` bug — proper cleanup needed.

- **AI request unverified evidence (`file:line` + `grep`):**
  - `client.ts:189-214` realm guard disables signal in tests; `client.ts:181-186` multimodal verification only `console.warn` not enforce; `client.ts:217-241` fetch throw masked by `vaultTools.ts:130-147` catching and falling back to heuristic for text (masks failure), for file returns `[]` not heuristic but user sees empty.
  - `pillMapTools.ts:20-23` `shouldUseAI()` returns `false` in test env — AI path never exercised, no verification that `fetch` hit configured `baseURL` with `Authorization` and `model` and single multimodal body for file inputs.
  - `labStoryTools.ts:323-421` `aiCorrelateNarrative` duplicates same fetch+realm guard unverified.

- **Working Directory:** `.teamwork` in current project (`/Users/sujal/Projects/proj1/.teamwork`) — per `state.json:metadata.artifactsDir` — NOT isolated `~/teamwork_projects/{NAME}/.teamwork`.

## Requirements (blocks — only what user cares about, ask don't assume)

> Capability-based: describe **what** must hold, not **how** to code it. No file-edit prescription. Orchestrator must NOT interpret these as implementation steps.

### R1 — No hardcoded AI responses; all file/multimodal extraction is AI-driven when enabled

**Requirement:** When `isAIEnabled(getAIConfig())` true (provider/model/baseURL configured via `Settings>env` generically), any clinical fact extraction from documents/file inputs (text + file multimodal) must come from the AI response via generic completions or responses API (structured JSON), not from hardcoded heuristics, placeholder constants, or synthetic strings. Heuristic fallback may exist ONLY as the disabled-AI path for text (and never for file/image) and must be clearly gated, not primary. No synthetic file data masquerading as vision.

**Non-goals:** Domain constants (`BIOMARKER_STANDARDS` reference ranges) allowed as source of truth, not AI response; generic `VITE_AI_*` reads remain; `SYSTEM_PROMPT` is allowed as static domain instruction.

### R2 — AI requests are verified and actually work for both completions and responses with file inputs

**Requirement:** Every AI request must be verifiable for **both** completions and responses: composes `getAIEndpoint(config)` from configured `baseURL` + provider (`/chat/completions` vs `/responses`), sends `Authorization: Bearer <configured key>` + configured `model`, carries file + text in a SINGLE multimodal body when file present (not separate calls), uses structured params generically, honors `timeoutMs` via `AbortSignal`, and surfaces `!ok` / missing content as actionable result (not silently replaced by heuristic for files). Verification must be runnable without disabling signal.

**Non-goals:** No exposing `.env` secrets; no hardcoding any baseURL; no rehash of WebMCP 40 — that layer must stay PASS.

### R3 — Proper code, not test-passing hacks; simple iterative fix without over-engineering

**Requirement:** Code must be proper and simple: remove test-conditional disabling of AI, remove verbose realm-guard branching that omits signal, dedupe duplicated heuristic fallbacks to single source, remove synthetic file hacks, and replace hash-derived bbox placeholders with either AI-grounded bbox or empty for file path. Fix must be iterative and fast — single worker, small diff, no distributed worktree sprawl, thorough multimodal tests.

**Non-goals:** No new `SettingsStore` features beyond existing; no inventing new tool names — reuse existing 40.

## Independent Verification (per requirement — objective check)

> Each verification is mechanical, reproducible, runnable by reviewer without human judgment. Provide logs under `.teamwork/verification/` . Provide thorough multimodal testing covering both completions and responses with file inputs.

### R1 — No hardcoded AI responses

- **Grep gates (must ALL PASS with logs `grep -R` counts → `.teamwork/verification/no-hardcode-ai-responses.log`):**
  - `grep -R "mock_photo|mock_photo_slip_blob_base64" src/` → 0 PASS
  - `grep -R "syntheticImageDataUrl|syntheticText" src/` → 0 PASS after refactor (today 1 hit at `UploadLabModal.tsx:135-136` — must be 0)
  - `grep -R "isTestEnv.*return false" src/core/knowledge src/tools/pillMapTools.ts` → 0 after refactor (today 2 hits — must be 0, replace with deterministic mock fetch)
  - `grep -R "vaultHeuristicFallback|fallbackRegexExtract" src/tools/vaultTools.ts src/tools/labStoryTools.ts src/tools/homeLabTools.ts` — after refactor should be 1 source (`fallback.ts` import) not 3 duplicates; log shows dedup.
  - `grep -R "VITE_AI" src/core/ai` → ≥1 PASS (generic read still).

- **Demo probe (isolated `npx tsx` without `src/` edit):** With `VITE_AI_ENABLED=true` (mock fetch returning deterministic `{"facts":[…]}`), `extract_fact` with rawText `Apixaban 5mg BID, Creatinine 1.90 mg/dL` and with file input `data:image/png;base64,…` must return `Fact[]` with name matching AI mock not heuristic.

### R2 — AI requests verified and working (both completions and responses, multimodal file inputs)

- **Grep + read gates:**
  - `grep -R "getAIEndpoint|getAIModel|isAIEnabled" src/core/ai/client.ts src/tools/vaultTools.ts` → ≥3 PASS
  - `grep -R "fetch\(endpoint" src/core/ai/` → ≥1 PASS and `grep -R "Authorization.*Bearer" src/core/ai/` → ≥1 PASS
  - `grep -R "isTestEnvSignal.*fetchSignal.*undefined" src/core/ai/` → 0 after refactor (today 2 hits — must be 0; signal must be passed always)

- **Request verification probe (isolated `npx tsx` with mock fetch — thorough multimodal for both APIs):**
  - Mock `global.fetch` to capture `url`, `headers.Authorization`, `body.model`, `body` multimodal shape.
  - Execute `extractWithAI('hello', 'data:image/png;base64,…', 'lab_slip_photo')` with config `baseURL https://example.com/v1 provider chat model test-model apiKey sk-test` — assert `url === https://example.com/v1/chat/completions`, `headers.Authorization === Bearer sk-test`, `body.model === test-model`, `isMultimodalRequestBody(body, 'chat') === true` (file+text in same body). Repeat for `responses` provider `https://example.com/v1/responses` + file input multimodal true.
  - Also test text-only (no file) still sends correct endpoint/model/headers with structured params, and `isMultimodalRequestBody` false for text-only but true when file present.
  - Timeout probe: `AbortController` signal passed and `AbortError` throws `AI request timed out after 30000ms` not swallowed.
  - File input_probe: real file Blob / dataURL via `DocumentDropzone` read path → verify single multimodal body contains file data + text together (not two requests).
  - Log to `.teamwork/verification/ai-request-verification.log` with PASS for both completions and responses.
  - Thorough multimodal test suite: at least 4 cases — chat+file, chat text-only, responses+file, responses text-only — plus error surfacing (500, timeout) — all PASS.

- **Error surfacing probe:** With mock fetch returning `500` or `!ok`, `extractWithAI` must throw `AI request failed 500…` and `vaultTools.extract_fact` for file must return `success true data []` with no heuristic, for text may fallback but must log `AI extraction failed for text, falling back`.

### R3 — Proper code, not test-passing, iterative quick fix with thorough testing

- **Grep gates:**
  - `grep -R "isTestEnv\(\)" src/tools/pillMapTools.ts src/core/knowledge/interactionEngine.ts` → 0 after refactor
  - `grep -R "GlobalAbortSignal|WindowAbortSignal|isTestEnvSignal" src/core/ai/` → 0 after refactor — replaced by single `globalThis.AbortController` + signal always passed.
  - `grep -R "deriveHomeLabBbox" src/` — after refactor only for text fallback, not file path; file path must be `return []` without hash.
  - `git diff --stat` after iterative fix shows ONLY `src/core/ai/*` + `src/tools/*` + `src/components/homelab/UploadLabModal.tsx` + `src/core/knowledge/interactionEngine.ts` changed — small diff.
  - Thorough test: `npm run lint` 0, `npm run build` valid, `npm test` 174+, `npx tsx test/test-runner.ts` 231 still PASS, plus new multimodal verification probes PASS, no regression, iterative single-worker `progress.md` notes `iterative-coding`.

## Acceptance Criteria (testable DONE)

- [ ] **R1 DONE — No hardcoded AI responses:** Grep gates `mock_photo 0 syntheticImage 0 isTestEnv guard 0 duplicate fallback 1 source` all PASS with logs `no-hardcode-ai-responses.log`; demo probe with mock AI returns facts from mock not heuristic; `VITE_AI` generic read still ≥1.
- [ ] **R2 DONE — AI requests verified and working (completions + responses, multimodal file inputs):** Request verification probe `ai-request-verification.log` shows `url` matches `getAIEndpoint`, `Authorization Bearer sk-test`, `model` matches `getAIModel`, multimodal `true` for file+text single body for BOTH `chat` (`completions`) and `responses` (file inputs), text-only correct, structured params present, `AbortSignal` passed and timeout throws correctly, `!ok` throws and file path returns `[]` not heuristic — thorough 4+ cases all PASS.
- [ ] **R3 DONE — Proper iterative quick fix with thorough testing:** `no-test-hack.log` 0, realm guard simplified to `globalThis.AbortController` + signal always, duplicated fallbacks deduped to `fallback.ts`, synthetic file removed, hash bbox for files removed, `git diff --stat` small (≤6 files), `lint 0` `build` valid `test` PASS `runner` PASS plus multimodal probes PASS, iterative single-worker.

## Working Directory

**`.teamwork` in current project (`/Users/sujal/Projects/proj1/.teamwork`)** — per `state.json:metadata.artifactsDir=".teamwork"`. All artifacts live under `.teamwork/` (`research/`, `prompt_draft.md`, `verification/`).

## Integrity Mode

**development (rapid)** — per user hint "Dont overcomplicate it, use iterative coding and fix it quick" — quick single-worker iterative loop, mock fetch for verification, concise logs. Prior demo integrity preserved for WebMCP but not required for this iterative fix.

## Execution Path

**`iterative-coding` — per explicit user instruction "use iterative coding" and scope size.**

- Scope is surgical ~6 files — single worker iterative loop is fastest, no need for distributed worktrees.
- "Dont overcomplicate it" — iterative is one branch, one loop, `npm run lint/build/test` quick checks plus thorough multimodal probes.
- Prior distributed-coding DONE; iterative successor reuses existing artifacts under same `.teamwork` without new isolated project.

> Status: APPROVED — proceed to Phase 2 iterative implementation
