# TEST_INFRA.md — CareCanvas AI Iterative Refactor — Thorough Multimodal Testing (teamwork-1788173131990)

Synthesized: 2026-08-31T10:54:06.010Z from spec-miner-tests-verification + patterns-agents-config + prompt.md R1-R3 — verification is mechanical reproducible per requirement
Working Dir: /Users/sujal/Projects/proj1/.teamwork (canonical)
Integrity: development rapid — thorough multimodal for both completions and responses with file inputs required
ExecutionPath: iterative-coding — single worker, small diff, no 6-viewport corpus but multimodal 4+ cases mandatory

## Test Commands (baseline 1672 modules, 174 vitest / 231 runner PASS pre-refactor, lint0 — must NOT regress, WebMCP 40)

- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone + Success Auditor, log .teamwork/logs/lint.log
- npm test -> vitest run (globals:true, jsdom, setupFiles: ./test/setup.ts:16) — expected 174 (or 149 per vite.config.ts:20 comment) PASS — include test/unit 10 + test/integration + test/tier3-integration 2 (vitest now 149 vs plan 174 divergence, both must PASS). Log .teamwork/logs/test.log
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness 231 tests across 15 suites — Tier1 40 tools 200 tests (vault 3 + labstory 2 + pillmap 8 + rxbridge 5 + homelab 5 + safety 9 + carecircle 8) + Tier2 T2-01..12 + Tier3 INT-01..12 + Tier4 workloads + E2E Flows A-E — expected ALL 231 PASS — logs .teamwork/logs/test-runner.log
- npm run build -> tsc && vite build — expected EXIT 0, 1672±10 modules dist valid (prior 1672 at build.log) — log .teamwork/logs/build.log
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts, supabase.test.ts, npx tsx test/test-runner.ts --tier1 etc

## Intelligence Verification Gates — Mechanical Reproducible (prompt.md R1-R3)

### R1 — No hardcoded AI responses; all file/multimodal extraction AI-driven when enabled

- **Grep gates (must ALL PASS with logs .teamwork/verification/no-hardcode-ai-responses.log etc):**
  - `grep -R "mock_photo|mock_photo_slip_blob_base64" src/` → 0 PASS (today 0 in src, only test mock_photo_edema.jpg)
  - `grep -R "syntheticImageDataUrl|syntheticText" src/` → 0 after refactor (today 7 hits at UploadLabModal.tsx:135-147 — must be 0) — log no-hardcode-ai-responses.log
  - `grep -R "isTestEnv.*return false" src/core/knowledge src/tools/pillMapTools.ts` → 0 after (today 2+ hits — must be 0, replace with deterministic mock fetch)
  - `grep -R "vaultHeuristicFallback|fallbackRegexExtract" src/tools/vaultTools.ts src/tools/labStoryTools.ts src/tools/homeLabTools.ts` — after refactor should be 1 source (fallback.ts import) not 3 duplicates; log shows dedup — check heuristicFallback import present
  - `grep -R "VITE_AI" src/core/ai` → ≥1 PASS (generic read still 62 hits)
  - `grep -R "deriveHomeLabBbox" src/` — after refactor only for text fallback, not file path; file path must be return [] without hash — count 5 today → only text fallback after
  - `grep -R "VITE_AI" src/core/ai | wc -l` ≥1, `grep -R "getAIEndpoint|getAIModel" src/core/ai | wc -l` ≥3 PASS (today 10), `grep -R "fetch(endpoint" src/core/ai | wc -l` ≥1 (today 7) and `grep -R "Authorization.*Bearer" src/core/ai | wc -l` ≥1 PASS, `grep -R "isTestEnvSignal.*undefined" src/core/ai | wc -l` 0 after (today 2 hits — must be 0 signal always)
- **Demo probe (isolated npx tsx without src edit):** With VITE_AI_ENABLED=true (mock fetch returning deterministic {"facts":[...]}), extract_fact with rawText Apixaban 5mg BID, Creatinine 1.90 mg/dL and with file input data:image/png;base64,… must return Fact[] with name matching AI mock not heuristic — verify via ai-request-verification.ts mock.

### R2 — AI requests verified and working (both completions and responses, multimodal file inputs) — THOROUGH

- **Grep + read gates:**
  - `grep -R "getAIEndpoint|getAIModel|isAIEnabled" src/core/ai/client.ts src/tools/vaultTools.ts` → ≥3 PASS
  - `grep -R "fetch(endpoint" src/core/ai/` → ≥1 and `grep -R "Authorization.*Bearer" src/core/ai/` → ≥1
  - `grep -R "isTestEnvSignal.*fetchSignal.*undefined" src/core/ai/` → 0 after (signal must be passed always via globalThis.AbortController)
  - `grep -R "GlobalAbortSignal|WindowAbortSignal|isTestEnvSignal" src/core/ai/` → 0 after — replaced by single globalThis.AbortController + signal always
- **Request verification probe (isolated npx tsx with mock fetch — thorough multimodal for both APIs — .teamwork/verification/ai-request-verification.ts → .teamwork/verification/ai-request-verification.log PASS):**
  - Mock global.fetch to capture url, headers.Authorization, body.model, body multimodal shape isMultimodalRequestBody.
  - **4 core cases:** (1) chat+file: execute extractWithAI('hello','data:image/png;base64,…','lab_slip_photo') with config baseURL https://example.com/v1 provider chat model test-model apiKey sk-test — assert url === https://example.com/v1/chat/completions, headers.Authorization === Bearer sk-test, body.model === test-model, isMultimodalRequestBody(body,'chat')===true (file+text in same body). (2) chat text-only: no file still correct endpoint/model/headers with structured params, isMultimodal false for text-only. (3) responses+file: baseURL https://example.com/v1 provider responses → url https://example.com/v1/responses + file input multimodal true (input_image+input_text). (4) responses text-only: correct endpoint/model/headers, isMultimodal false but structured params present.
  - **Error & timeout cases:** (5) Timeout probe: AbortController signal passed and AbortError throws "AI request timed out after 30000ms" not swallowed. (6) 500 error: mock fetch returns 500 !ok → extractWithAI must throw "AI request failed 500…" and vaultTools.extract_fact for file must return success true data [] with no heuristic (plainLanguageSummary Vision extraction failed), for text may fallback but must log AI extraction failed for text.
  - Also file input probe: real file Blob / dataURL via DocumentDropzone read path → verify single multimodal body contains file data + text together (not two requests) — verify via DocumentDropzone handleRealExtract path.
  - Log to .teamwork/verification/ai-request-verification.log with PASS for both completions and responses — thorough 4+ cases required, plus timeout and 500.
  - Thorough multimodal test suite: at least 4 cases — chat+file, chat text-only, responses+file, responses text-only — plus error surfacing (500, timeout) — all PASS.
- **Error surfacing probe:** With mock fetch returning 500 or !ok, extractWithAI must throw, vaultTools for file returns [] not heuristic, for text may fallback but log.

### R3 — Proper code, not test-passing, iterative quick fix with thorough testing (small diff)

- **Grep gates:**
  - `grep -R "isTestEnv\(\)" src/tools/pillMapTools.ts src/core/knowledge/interactionEngine.ts` → 0 after
  - `grep -R "GlobalAbortSignal|WindowAbortSignal|isTestEnvSignal" src/core/ai/` → 0 after — replaced by single globalThis.AbortController + signal always
  - `grep -R "deriveHomeLabBbox" src/` — after refactor only for text fallback, not file path; file path must be return [] without hash — verify via code read homeLabTools.ts around 105-155
  - `git diff --stat` after iterative fix shows ONLY src/core/ai/* + src/tools/* + src/components/homelab/UploadLabModal.tsx + src/core/knowledge/interactionEngine.ts changed — small diff ≤6 files net +50 lines or less
  - Thorough test: `npm run lint` 0, `npm run build` valid 1672±10, `npm test` 174 (or 149), `npx tsx test/test-runner.ts` 231 still PASS, plus new multimodal verification probes PASS, no regression, iterative single-worker progress.md notes iterative-coding
  - `grep -R "mock_photo|syntheticImageDataUrl" src/` 0, `grep -R "isTestEnv" src/tools/pillMapTools.ts src/core/knowledge/interactionEngine.ts` 0 LOG no-test-hack.log 0

## Coverage & Regression Guards (no regression + intelligence)

- vitest 174 (149) covers LocalVault, vaultTools, pillMap, rxBridge, labStory, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine — after fix vaultTools still 40 tools, localVault scoped counts, WebMCPEngine still spec-correct dictionary
- test-runner 231 covers 40 tools + boundary T2 + cross-module INT + workloads + E2E A-E — workloads/profile tests use generic patientId via carecanvas_active_user not patient-s-devi, after fix must still 231 PASS
- Cohesion invariants must stay 0 except documented keep: 40 tools intact via src/tools/index.ts length 40 — grep pending
- Gates: grep -R registerTool src/core/webmcp >=1 delegation PASS, grep -R inputSchema src/types/webmcp src/core/webmcp >=1, grep -R toolchange src >=1, grep -R isSecureContext src >=1, grep -R permissionsPolicy src >=1, grep -R Promise.allSettled src/core/webmcp src/main.tsx >=1, grep -R AbortController src/core/webmcp src/main.tsx >=1
- Settings: VITE_AI src >=1, no hardcoded provider 0 (deepseek/muse/zen), image_url/input_image >=1, json_schema/json_object >=1 — already PASS per minerC logs (env-config 21, configurable-read 46, vision 26, structured etc)

## Snapshot Discipline (dev rapid — no 6-viewport corpus required for iterative quick fix, but thorough multimodal tests required)

- Worker >=1 verification log ai-request-verification.log thorough multimodal 4+ cases PASS via mock fetch captures url/headers/model/body — replaces browser.capture for iterative-coding
- Success Auditor independent lint/test/build/grep + multimodal probe + cross-field probe still PASS before Done — no browser capture needed for iterative rapid but may capture desktop if needed

## Verification Plan Per Milestone (mechanical reproducible probes — iterative DAG)

- **Survey Synthesis DONE:** 3 miners 3/3 → PROJECT.md + TEST_INFRA.md this file → plan.md DAG M1 single worker iterative — verified via ownership detectConflicts 0, spawn budget <16, dead-man armed
- **M1 Iterative AI Refactor (R1+R2+R3):** single worker iterative small diff on main — critic checks grep gates synthetic 0 isTestEnv 0 GlobalAbortSignal 0 VITE_AI>=1 getAIEndpoint>=3 fetch+Bearer>=1 isMultimodal single body for both providers, timeout+500 error surfacing, lint0 test174/149 runner231 build1672 WebMCP40, cross-field probe CROSS_FIELD PASS, no-hardcode gates 0, git diff --stat small ≤6 files — challenger edge image data URL single request not two, text PDF fallback, timeout 30000, invalid baseURL handling, key absent fallback to rule for text; auditor rebuilds + regreps + lint/test/build/runner + multimodal probe before PASS — then Success Auditor final independent lint/test/build/grep + thorough multimodal probe + cross-field + patient isolation + approval before Done
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log + .teamwork/verification/*.log
- Success Auditor final: independent lint/test/build/grep (registerTool, inputSchema, toolchange, legacy globals 0, isSecureContext, permissionsPolicy, allSettled, AbortController) + no-hardcode-provider 0 + configurable-read >=1 + vision multimodal >=1 + structured >=1 + cross-field CROSS_FIELD PASS + patient isolation + approval + thorough multimodal 4+ cases ai-request-verification.log PASS + git diff --stat small before Done

## Affected Files (test infra — iterative extended)

- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, test/unit/*, test/tier3-integration/*, src/core/webmcp/WebMCPEngine.ts, src/types/webmcp.ts, src/tools/index.ts + 7 modules, src/main.tsx, src/App.tsx, plus new verification .teamwork/verification/ai-request-verification.ts + ai-request-verification.log + no-hardcode logs, .teamwork/verification/grep-gates logs, .teamwork/logs/*.log
