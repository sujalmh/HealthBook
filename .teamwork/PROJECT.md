# PROJECT.md — CareCanvas AI Iterative Refactor — Generic Multimodal completions/responses (teamwork-1788173131990)

Synthesized: 2026-08-31T10:54:06.010Z from 3 spec miners (project-structure-engine, tests-verification, patterns-agents-config) — file:line citations, hard counts, ownership ground truth for iterative single-worker small diff
Working Dir: /Users/sujal/Projects/proj1/.teamwork (canonical per state.json .teamwork, NOT isolated ~/teamwork_projects)
Integrity: development rapid — single worker iterative on main, no distributed worktrees sprawl
ExecutionPath: iterative-coding — single milestone M1 → Success Auditor — spawn budget 5/16

## Repo Layout (glob verified 2026-08-31)

- **AI Core:** `src/core/ai/**` → 6 files at `src/core/ai/client.ts:1` `config.ts:1` `vision.ts:1` `structured.ts:1` `fallback.ts:1` `types.ts:1` — generic configurable client, vision multimodal single request, structured JSON, fallback heuristic. Glob `src/core/ai/**` returned 6 hits. `types.ts:9` AIProvider chat|responses, AIConfig 9 fields.
- **Tools:** `src/tools/**` → 8 files at `src/tools/vaultTools.ts:1` `labStoryTools.ts:1` `homeLabTools.ts:1` `pillMapTools.ts:1` `rxBridgeTools.ts:1` `safetyTools.ts:1` `careCircleTools.ts:1` `index.ts:11` — all 40 WebMCP tools via `src/tools/index.ts:69-123` catalog 3+2+8+5+5+9+8=40. Glob returned 8 hits.
- **Knowledge:** `src/core/knowledge/**` → 2 files at `src/core/knowledge/interactionEngine.ts:1` `reconciliationEngine.ts:1` — AI reasoning primary when isAIEnabled, fixture fallback when disabled; share callKnowledgeAI pattern with same realm guard duplicated.
- **Vault/Events:** `src/core/vault/LocalVault.ts:1` 11 stores patient-isolated via carecanvas_active_user, `src/core/events/eventBus.ts:1` relevance matrix + alias groups, `src/types/vault.ts:1` Fact/BoundingBox/LabRecord.
- **UI:** `src/components/**` → 44+ files at `src/components/vault/DocumentDropzone.tsx:43` `homelab/UploadLabModal.tsx:29` `pillmap/PillMapView.tsx:180` etc. Glob returned 44. `src/components/homelab/UploadLabModal.tsx:135` synthetic harness 1×1 pixel must be removed.
- **Settings:** `src/core/settings/SettingsStore.ts:1` 13 keys, `src/components/settings/SettingsView.tsx` + `SettingsForm.tsx` — Settings>env precedence generic, no hardcoded provider. Glob `src/core/settings/*` 1 file + `src/components/settings/*` 2 files.
- **WebMCP:** `src/core/webmcp/WebMCPEngine.ts:1` + `WebMCPAdapter.ts:1`, `src/main.tsx:1` bootstrap Promise.allSettled per-tool + SecureContext + toolchange, `src/App.tsx:36` mounting Settings module.
- **Test:** `test/**` → 30+ files at `test/test-runner.ts:1` `test/setup.ts:1` `test/unit/*` 10 files + `test/tier3-integration/*` 2 files + harness under `test/tier1-feature` 7 + `tier2-boundary` + `tier4-workloads` + `e2e-flows` 5. Glob returned 30+. `vite.config.ts:34` include unit+integration+tier3. `package.json:6-19` scripts dev/build/test/test:all/lint.
- **Config:** `.env.example:1-51` 13 VITE_AI_* keys (ENABLED:14 PROVIDER chat:22 BASE_URL:28 API_KEY:29 MODEL:33 VISION_MODEL:34 STRUCTURED:41 ORG/PROJECT/EXTRA:44-46 TEMP:49 MAX:50 TIMEOUT:51), `opencode.json:35-48` commandcode provider baseURL https://api.commandcode.ai/provider/v1:41 + 3 models, `vite.config.ts:9-11` alias @, `.gitignore:4` .env.
- **Teamwork:** `.teamwork/**` → state.json projectId teamwork-1788173131990, plan.md iterative M1, verification logs (old) + research/* (19 files prior + 3 new miners), snapshots/**, worktrees/** (legacy 12 ws-* from distributed), handoff/**, BRIEFING.md/GATE_STATUS.md.

## AI Client Evidence via read file:line (current src)

- `src/core/ai/config.ts:27-117` readSettingsStoreOverrides() reads JSON blobs (carecanvas_settings etc) + individual VITE_AI_* keys with Settings>env precedence at `config.ts:123-139` resolveConfigValue; `getAIConfig():168-220` generic 10 keys, `isAIEnabled():226-229` checks enabled && apiKey && baseURL && model, `getAIEndpoint():250-259` composes {base}/chat/completions vs {base}/responses generically via provider, `getAIModel():264-268` visionModel fallback. No hardcoded provider literals in src — generic via import.meta.env OR localStorage. Counts VITE_AI src 62 (minerA) /167 (minerC) PASS >=1.
- `src/core/ai/vision.ts:25-104` buildChatVisionContent:25-37 image_url vs buildResponsesVisionContent:43-55 input_image generically; buildChatMessages:82-92 and buildResponsesInput:94-104 produce single multimodal body; isMultimodalRequestBody:110-123 verifies image+text in same body without assuming specific model. Count vision 26 log vision-multimodal.log PASS >=1.
- `src/core/ai/structured.ts:11-37` FACT_EXTRACTION_JSON_SCHEMA, buildChatStructuredParams:43-49 response_format json_object vs buildResponsesStructuredParams:52-65 text.format json_schema via provider, validateStructuredOutput:86-115 confidence>0, parseJsonContent:120-152 handles fences, extractTextFromProviderResponse:159-195 both provider shapes generically. Count structured 13 log structured-generic.log PASS >=1.
- `src/core/ai/client.ts:29-37` SYSTEM_PROMPT generic categories + unit rules; toFacts:59-92 clamp confidence 0.55-0.98; buildRequestBody:99-135 generic branching completions vs responses; extractWithAI:142-282 handles fallback guard isFallbackEnabled, config validation throw at 172/176, buildRequestBody at 178, warning at 182, realm-safe AbortController at 189-214 with test-env omit 26 lines hack, fetch at 217-227 Authorization Bearer, !response.ok throw at 238, extraction at 246-264. Request verification present but brittle — realm guard disables signal in tests, verification only warn.
- `src/core/ai/fallback.ts:15-58` UNIT_MAP + shouldUseHeuristicFallback:45 false for hasImage, heuristicFallback:64-115 confidence 0.65-0.88 hash, author system_heuristics. Text-only fallback, never for image (Q10).
- `.env.example:14-50` documents VITE_AI_* keys generically, `opencode.json:35-68` provider example — not hardcoded in src.

## Hardcode Evidence via grep + read file:line — still hardcoded vs generic

- **Synthetic image harness (test-passing not proper):** `UploadLabModal.tsx:135` syntheticImageDataUrl 1×1 pixel + syntheticText:136 + doExtractWithBlob:65-104 synthetic path when no file selected — grep syntheticImageDataUrl|syntheticText src 7 hits must be 0 after refactor. Verified minerA counts 7 FAIL.
- **Test-conditional hacks:** `pillMapTools.ts:12-23` isTestEnvPillMap shouldUseAI false in test env, `interactionEngine.ts:33-49` isTestEnv guard, `reconciliationEngine.ts:28`, `rxBridgeTools.ts:16`, `safetyTools.ts:14`, `careCircleTools.ts:14`, `labStoryTools.ts:371`, `client.ts:189-214` verbose realm guard + isTestEnvSignal disables AbortSignal in tests — total grep isTestEnv src 29 hits must be 0, grep GlobalAbortSignal|WindowAbortSignal|isTestEnvSignal src/core/ai 14 hits must be 0. Proper is single globalThis.AbortController + signal always.
- **Duplicated heuristic fallbacks:** `vaultTools.ts:15-57` vaultHeuristicFallback duplicates fallback.ts:64-115 with decimal-aware split (?<!\d)\.(?!\d) at vaultTools.ts:20 vs fallback.ts split [\n;]+; `labStoryTools.ts:261-280` fallbackRegexExtract 5 patterns; `homeLabTools.ts:176-206` tryParse regex — after refactor should be 1 source fallback.ts import not 3 duplicates; log shows dedup by importing heuristicFallback.
- **Hash bbox for files:** `homeLabTools.ts:18-33` deriveHomeLabBbox hash-derived 0-1000 not grounded OCR; for image path per Q10 should be return [] without hash. Grep deriveHomeLabBbox src 5 hits only for text fallback after refactor.
- **Previously fixed but still hack:** vaultTools bbox removed, homeLab hash bbox to satisfy no-hardcode-bbox.log:0 but not proper for files — proper cleanup is [] for files.
- **AI request unverified:** client.ts:189-214 realm guard disables signal, client.ts:181-186 multimodal only warn, vaultTools:130-147 catches and falls back to heuristic for text masks failure, for file returns [] not heuristic but empty without verification of url/headers/model/body. Need thorough multimodal verification for both providers.

## Modules & Ownership Map (ground truth for workstreams, no overlap within parallel batch — iterative single worker owns all listed files, no parallel conflict)

| Module | Files (glob) | Owner proposal (iterative single worker) | Risk |
|--------|--------------|--------------------------------------------|------|
| AI core client | src/core/ai/client.ts, src/core/ai/vision.ts, src/core/ai/structured.ts, src/core/ai/types.ts | worker_iterative_ai_refactor | Fix realm guard to globalThis.AbortController+signal always, ensure Authorization Bearer, endpoint /chat/completions vs /responses, model via getAIModel, isMultimodalRequestBody single body, timeout 30000, structured params generic |
| AI config + fallback | src/core/ai/config.ts, src/core/ai/fallback.ts | worker_iterative_ai_refactor (same) | Settings>env precedence already correct, ensure VITE_AI_* generic read >=1, dedupe fallback to single source import heuristicFallback, empty-string-as-unset fix preserved |
| Tools vault/home/lab/pillMap | src/tools/vaultTools.ts, src/tools/homeLabTools.ts, src/tools/labStoryTools.ts, src/tools/pillMapTools.ts, src/core/knowledge/interactionEngine.ts, src/core/knowledge/reconciliationEngine.ts, src/tools/rxBridgeTools.ts, src/tools/safetyTools.ts, src/tools/careCircleTools.ts | worker_iterative_ai_refactor (same) | Remove isTestEnv guards, remove GlobalAbortSignal/WindowAbortSignal/isTestEnvSignal verbose branches, dedupe vaultHeuristicFallback/fallbackRegexExtract to fallback.ts, remove hash bbox for file path (return []), keep text fallback only when AI disabled |
| UI homelab | src/components/homelab/UploadLabModal.tsx | worker_iterative_ai_refactor (same) | Remove syntheticImageDataUrl + syntheticText synthetic harness 7 hits → require real FileReader file, keep editForm '' + populateEditFormFromExtracted, synthetic 1×1 PNG must be 0 |
| Knowledge | src/core/knowledge/interactionEngine.ts, src/core/knowledge/reconciliationEngine.ts | worker_iterative_ai_refactor (same) | Same realm guard fix, AI primary via callKnowledgeAI generic structured, fixture fallback only when !isAIEnabled |
| Settings | src/core/settings/SettingsStore.ts, src/components/settings/SettingsView.tsx, src/components/settings/SettingsForm.tsx | worker_iterative_ai_refactor (if touched, minimal) — touches only if needed for VITE_AI read verification; currently PASS no need to edit, keep generic |
| WebMCP engine | src/core/webmcp/WebMCPEngine.ts, src/core/webmcp/WebMCPAdapter.ts, src/main.tsx, src/App.tsx | NOT OWNED this iteration — preserve WebMCP 40, document.modelContext SecureContext toolchange Permissions-Policy never overwrite native — no edits, verify grep still 7/39/33/6/6/12/37 PASS |
| Vault/events/types | src/core/vault/LocalVault.ts, src/core/events/eventBus.ts, src/types/vault.ts | NOT OWNED this iteration — preserve patient isolation carecanvas_active_user, only confirmed propagate, approval per-fact |
| Test infra | test/setup.ts, test/test-runner.ts, test/unit/*, test/tier3-integration/*, vite.config.ts, package.json | worker_iterative_ai_refactor (for verification only, not source edits beyond setup) — ensure mock fetch in test/setup.ts aligns realm, add .teamwork/verification/ai-request-verification.ts thorough multimodal 4+ cases |

**Overlap check:** Iterative single worker owns all listed files under src/core/ai/** + src/tools/** + src/core/knowledge/** + src/components/homelab/UploadLabModal.tsx — NO parallel workers so detectConflicts N/A PASS. Validated via ownership.ts#detectConflict before batch but single worker no overlap by design. Small diff ≤6 files net +50 lines iterative quick fix — keep diff stat small.

## Risks & Mitigations

- Hardcode literal leak — mitigate never write deepseek/muse/zen literals in src/; client must compose {baseURL}/chat/completions generically via VITE_AI_PROVIDER, read via import.meta.env OR SettingsStore; verify grep gates 0 after: grep -R deepseek-v4-flash-vision-exp/muse-spark/opencode.ai/zen src 0 PASS log no-hardcode-provider.log
- Vision shape divergence — mitigate handle both image_url (chat) and input_image (responses) generically based on provider, send image+text single response where model supports it, timeout 30000, isMultimodalRequestBody verifies single request image+text
- isTestEnv hack — mitigate remove all 29 isTestEnv guards, replace with deterministic mock fetch in test setup that returns {"facts":[...]} and keep AI path enabled; verify grep isTestEnv src/tools/pillMapTools src/core/knowledge/interactionEngine 0 after
- Realm guard omitting signal — mitigate replace 26-line GlobalAbortSignal/WindowAbortSignal/isTestEnvSignal branching with single globalThis.AbortController + signal always; verify grep GlobalAbortSignal|isTestEnvSignal src/core/ai 0 after, and ai-request-verification.log shows AbortSignal passed and timeout throws correctly
- Fallback dedup — mitigate import heuristicFallback from fallback.ts, remove vaultHeuristicFallback and fallbackRegexExtract duplicates
- Hash bbox for files — mitigate return [] not heuristic for file path when AI disabled/failed; hash only for text fallback if at all; verify deriveHomeLabBbox only for text fallback not file
- Synthetic file mock — mitigate remove syntheticImageDataUrl + syntheticText 7 hits → require real FileReader DataURL via handleFileSelected; demo probe with file input must use real file data URL
- Patient isolation regression — keep LocalVault patientId scoping via localStorage carecanvas_active_user same as WebMCPAdapter derive, never '' nor patient-s-devi
- Approval semantics — only confirmed propagate, unconfirmed staged, rejected never — preserve
- Build/tests regression — keep 40 tools intact snake_case, lint0 test174/149 runner231 build1672; gate behind VITE_AI_ENABLED/Settings fallback heuristic for text never for images Q10
- Spawn budget 16 — iterative 5 <16 safe, proactive succession not needed
- Dead-man 600s — arm at start + reset after synthesis + after M1 PASS, heartbeat via progress/state/BRIEFING/GATE_STATUS

## Decomposition Guidance (for plan.md DAG)

- Survey Phase (M2 core) — 3 miners parallel disjoint — DONE 3/3 — synthesis into PROJECT.md + TEST_INFRA.md — this file
- M1 Iterative AI Refactor (R1+R2+R3) — single worker iterative worker_iterative_ai_refactor — no dependency, small diff, thorough multimodal testing — owns src/core/ai/** + src/tools/** + src/core/knowledge/** + UploadLabModal.tsx — verification grep gates + ai-request-verification.log 4+ cases (chat+file, chat text-only, responses+file, responses text-only, timeout, 500) + lint0 build valid test174 runner231 cross-field PASS WebMCP40 — then Success Auditor final

## Counts Verification (mechanical)

- grep -R VITE_AI .env.example 13 keys >=4 PASS, src/ 62 (minerA)/167(C) vs 46 configurable-read log >=1 PASS, total 81 hits in .teamwork docs
- grep -R mock_photo src 0 PASS, syntheticImageDataUrl 7 today →0 after, isTestEnv src 29 today →0 after, GlobalAbortSignal src 14 today →0 after, deriveHomeLabBbox src 5 → only text fallback after, VITE_AI src >=1 PASS
- grep -R getAIEndpoint|getAIModel src/core/ai >=3 PASS (minerA 10), fetch(endpoint >=1 (7), Authorization Bearer >=1 PASS
- grep -R import.meta.env.*VITE_AI src >=1 after (today 62), image_url|input_image >=1 after (26), json_schema|response_format >=1 after (13), boundingBox 0.08 0 PASS
- git diff --stat small ≤6 files net +50 lines or less after iterative fix — to be verified post-worker
- lint0 build1672 test174/149 runner231 getTools40 remain PASS — verified post-worker + Success Auditor

## Native Spec Expectations (W3C WebMCP 26 Aug 2026 §4.1-4.5) — preserve

- §4.1 IDL partial interface Document { [SecureContext, SameObject] readonly attribute ModelContext modelContext; } canonical ONLY document.modelContext SecureContext required
- §4.2 ModelContext [Exposed=Window, SecureContext] interface ModelContext : EventTarget { Promise registerTool... getTools... executeTool... attribute EventHandler ontoolchange; }
- §4.5 SecureContext+Permissions-Policy tools policy disables → NotAllowedError; never overwrite native document.modelContext if present
- Implementation-status Chrome 149 Origin Trial live, polyfill required via WebMCPEngine detectAndPolyfill — preserve per src/main.tsx + WebMCPEngine.ts 7/39/33/6/6/12/37 grep gates
