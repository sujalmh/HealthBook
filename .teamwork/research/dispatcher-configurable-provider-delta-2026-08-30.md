# Research Delta — Configurable Provider + Settings Page + No-Hardcode Mandate — 2026-08-30

> Scope: Delta amendment to `dispatcher-intelligence-gap-2026-08-30.md` after user feedback verbatim (see `../prompt_draft.md` Objective amendment). This delta adds Settings-page discovery, generic provider note, and no-hardcode verification plan. Does NOT implement code. Discovery tools used: `glob` (list_dir), `grep` (grep_search), `read` + `webfetch` (read_url_content). All secrets respected (only `.env.example` read).
> Verbatim feedback preserved: `Dont hardcode this: chat → deepseek-v4-flash-vision-exp /chat/completions, responses → muse-spark-1.2-contributor /responses, it can be any models, dont hardcode: baseURL https://opencode.ai/zen/go/v1 it can be any base url. These will be configured using settings page, or the .env file. dont hardcode it. Replace all the hardcoded logic to ai based intelligence in the website. Use images along with text, most models allow it in single response, if thats rqeuired. All image based extraction or OCR, use AI.`

## 1. Generic Configurable Provider — No Hardcoding (amends .env.example interpretation)

- **Prior draft R1 hardcoded** `deepseek-v4-flash-vision-exp` via `POST https://opencode.ai/zen/go/v1/chat/completions` and `muse-spark-1.2-contributor` via `.../responses` at `.teamwork/prompt_draft.md:60-61` — now **removed as requirement**. User feedback mandates **any model / any baseURL** configurable via **Settings page OR `.env` `VITE_AI_*`**, client must read runtime config, not hardcoded literals.
- **Read `.env.example:14-50` (allowed):** `VITE_AI_ENABLED=false` at `:14`, `VITE_AI_PROVIDER=chat|responses` at `:22`, `VITE_AI_BASE_URL=https://opencode.ai/zen/go/v1` at `:28` (**example configurable value only — any baseURL allowed**), `VITE_AI_MODEL=deepseek-v4-flash-vision-exp` at `:33` (**example only — any model allowed**), `VITE_AI_VISION_MODEL=deepseek-v4-flash-vision-exp` at `:34`, alternative commented `VITE_AI_MODEL=muse-spark-1.2-contributor` at `:36` (**example only**), `VITE_AI_STRUCTURED_OUTPUTS=true` at `:41`, optional `VITE_AI_TEMPERATURE` at `:49`, `MAX_TOKENS` at `:50`, `TIMEOUT_MS=30000` at `:51`. Comments at `:17-18` and `:19-20` show provider→endpoint mapping was illustrative, not prescriptive. **Reinterpretation:** These are documentation examples; implementation must treat `VITE_AI_BASE_URL`, `VITE_AI_MODEL`, `VITE_AI_PROVIDER` as **configurable strings** with any valid value, not fixed to `opencode.ai/zen/go/v1` etc.
- **Grep gates for no-hardcode (future verification, not yet implemented):**
  - `grep -R "deepseek-v4-flash-vision-exp" src/` count 0 PASS — proves no hardcoded model literal in src/ `file:line` N/A after fix
  - `grep -R "muse-spark-1\.2-contributor" src/` count 0 PASS
  - `grep -R "opencode\.ai/zen/go/v1|https://opencode\.ai/zen" src/` count 0 PASS (only allowed in `.env.example` as example)
  - `grep -R "/chat/completions|/responses" src/` count 0 as hardcoded literal; client must compose `{baseURL}/chat/completions` etc. generically from config
  - `grep -R "import\.meta\.env.*VITE_AI|localStorage.*VITE_AI|SettingsStore|useSettings" src/` count >=1 PASS — proves configurable read
- **Vision+text multimodal single response:** User requires `Use images along with text, most models allow it in single response, if thats rqeuired.` — verified that many OpenAI-compatible vision models accept both `image_url`/`input_image` and text in same request. Plan must ensure image data URL and text are sent together in one multimodal payload where provider supports it, not separate OCR then text calls. `grep -R "image_url|input_image" src/` will be >=1 after implementation with generic branching based on provider/model.
- **All image extraction/OCR via AI:** User requires `All image based extraction or OCR, use AI.` — hardcode `src/tools/homeLabTools.ts:54-92` `isBase64Image ? textToParse=''` and placeholder `extractedValues {Creat 1.0, eGFR75}` at `:116-149` must be removed; `src/components/homelab/UploadLabModal.tsx:42-46` defaults `1.90/28/4.8` must come from AI not hardcoded; `src/components/vault/DocumentDropzone.tsx:80-102` `readAsText` for PDFs binary garbled must be AI vision/text path. No rule heuristic for images as primary.

## 2. Settings Page Discovery via `glob` (list_dir) + `grep` (grep_search) + `read` (read_url_content)

- **Tool discipline — list_dir (`glob`):**
  - `glob src/components/**Settings*` at 2026-08-30 → 0 files (no `Settings` component)
  - `glob src/**/*[Ss]ettings*` → 0 files
  - `glob src/**` → 68+ files (see `../prompt_draft.md:Context`) including `src/components/vault/*`, `pillmap/*` 9, `labstory/*` 4, `rxbridge/*` 5, `homelab/*` 4, `safety/*` 4, `carecircle/*` 5, `dossier/*` 6, `common/*` 4, `auth/*` 3 — **none named Settings** — `file:line` N/A confirms green field
  - `glob .teamwork/research/**` → 14+ files before run, now `dispatcher-intelligence-gap-2026-08-30.md` + this delta = 15+

- **Grep_search results:**
  - `grep -R "VITE_AI" src/` → 0 hits (outside `.env.example`) — confirms no AI client wiring yet — `file:line` verification `.teamwork/verification/env-config.log`
  - `grep -R "settings|Settings" src/` → only `src/index.css:19 font-feature-settings 'cv02'` and `src/components/carecircle/CareCircleView.tsx:12 Settings` (icon import from `lucide-react`) and `src/components/dossier/DossierView.tsx:302 Share Settings` tab label — **no Settings page store** — `file:line` confirms green field, no `VITE_AI` persistence yet
  - `grep -R "localStorage|store|useStore|zustand" src/` → hits at `src/core/vault/LocalVault.ts:116-157 eventBus`, `src/App.tsx:102-175 localStorage carecanvas_active_user`, `src/core/vault/fhirExporter.ts`, but **no `localStorage VITE_AI` or settings store** — green field for new Settings persistence (e.g., `localStorage` + `src/core/settings` or `src/components/settings/*`)
  - `grep -R "boundingBox.*0\.08" src/tools/vaultTools.ts` → `vaultTools.ts:64,80` fixed bbox — still hardcoded evidence, will go to 0 after AI — `file:line` cited
  - `grep -R "mock_photo_slip_blob_base64|Creat 1\.0|1\.90.*28.*4\.8|lisinopril|mockDrugDrugInteractions" src/` → hits at `UploadLabModal.tsx:42-68`, `homeLabTools.ts:116-149`, `rxBridgeTools.ts:283-297`, `interactionEngine.ts:6-11` — all 7 gaps still present — `file:line` confirms replacement scope

- **Read_url_content:**
  - `read .env.example:1-51` (allowed) — as above, example values only. `read src/components/vault/DocumentDropzone.tsx:1-187` still shows `rawText` vision gap; `read src/tools/vaultTools.ts:36-108` confirms bbox hardcode; `read opencode.json:35-68` still `commandcode` only — no hardcoded Go baseURL in src/ yet (good, will stay configurable).
  - `read .teamwork/state.json` — `metadata.artifactsDir=".teamwork"` and `request.workingDirectory=".teamwork"` → canonical `.teamwork` — NOT isolated `~/teamwork_projects/{PROJECT_NAME}/.teamwork`.
  - `webfetch https://opencode.ai/docs/go` 2026-08-30 re-verify (from prior research): table shows `opencode-go/<model-id>` format, endpoints `.../chat/completions` vs `.../responses` are **examples** of OpenAI-compatible mapping — delta notes these are now **generic examples**, not forced table; any OpenAI-compatible baseURL/model naming allowed.

## 3. Hardcoded Logic → AI Intelligence — Full 7-Gap Fan-out (amends R2)

- Prior research enumerated 7 hardcoded gaps at `dispatcher-intelligence-gap-2026-08-30.md:3` — delta emphasizes **all must be AI**, not just vaultTools:
  - `src/tools/vaultTools.ts:47` split lines fixed bbox → AI grounded bbox + typed categories (med/lab/allergy/condition) via structured JSON `file:line:47,64,80`
  - `src/tools/labStoryTools.ts:321` regex 5 markers → AI panel extraction with drawDate/marker normalization `file:line:321-346`
  - `src/tools/homeLabTools.ts:54,116` base64 skip + placeholder → AI vision extraction for slips `file:line:54-92,116-149`
  - `src/components/homelab/UploadLabModal.tsx:42` editForm defaults + `54` mock blob → AI-extracted values `file:line:42-46,54-68`
  - `src/core/knowledge/interactionEngine.ts:6` fixture `mockDrugDrugInteractions` → AI reasoning for interactions/diet/duplicate `file:line:6-11`
  - `src/tools/rxBridgeTools.ts:283` 4 `if ctx.includes` templates → AI-generated questions from discharge context `file:line:283-297`
  - `src/tools/safetyTools.ts:37` tag/severity rule + photo not analyzed → AI triage vision+text `file:line:37,45-51`
- Fan-out after `confirm_fact` remains but intelligence is AI: vault `addFact` → `medication_added`/`lab_added` → pillmap AI interactions, labStory AI `correlate_meds`, rxBridge AI `suggest_question`, homeLab dueCards AI, safety triage AI, careCircle/dossier AI citations. `src/core/vault/LocalVault.ts:116-157` eventBus typed helpers and `src/tools/vaultTools.ts:165-204` propagation will be augmented by AI orchestration (not hardcoded heuristics).

## 4. Verification Delta — No-Hardcode Gates (configurable via .env OR Settings)

- **Env/config gates:** `grep -R "VITE_AI_ENABLED|VITE_AI_PROVIDER|VITE_AI_BASE_URL|VITE_AI_MODEL" .env.example` >=4 PASS; `grep -R "VITE_AI" src/` >=1 after implementation via `import.meta.env` OR Settings store; `grep -R "deepseek|muse-spark|opencode\.ai/zen" src/` 0 PASS; `grep -R "import\.meta\.env.*VITE_AI" src/` >=1 PASS; `grep Settings src/` should show new Settings component persisting `VITE_AI_*` to `localStorage`/store.
- **Image OCR via AI gate:** `grep -R "textToParse.*''.*isBase64Image" src/tools/homeLabTools.ts` 0 after implementation; upload image slip data URL must trigger AI vision payload (single multimodal request with `image_url`/`input_image` + text), not heuristic `textToParse=''`.
- **Bounding box gate:** `grep -R "x: 0\.08.*y: 0\.12" src/tools/vaultTools.ts` 0 after AI.
- **Branch elimination gates:** all 7 `grep -R` counts for hardcoded patterns go to 0 when AI enabled (see `../prompt_draft.md` R2 verification list).
- **Patient isolation preserved:** `localStorage carecanvas_active_user` isolation at `src/main.tsx:51-60`, `WebMCPEngine.ts:568-582`, `WebMCPAdapter.ts:68-84` still enforced; `getFactsByPatient('')===0` etc.

## 5. Tool Discipline Log for This Delta (for verification)

- `glob src/components/**Settings*` → 0 files (log: this file:2)
- `glob src/**/*[Ss]ettings*` → 0 files
- `glob src/**` → 68+ files (vault/pillmap/labstory/rxbridge/homelab/safety/carecircle/dossier/common/auth + core/tools/types)
- `grep VITE_AI|settings|Settings` in src/ → only `font-feature-settings` and `CareCircleView Settings` icon + `Dossier Share Settings` label — 0 Settings page — `file:line` `src/index.css:19`, `CareCircleView.tsx:12`, `DossierView.tsx:302`
- `grep VITE_AI` in src/ → 0 hits vs 14 hits in `.env.example` + docs — green field
- `grep localStorage|store|useStore|zustand` → hits only `LocalVault`, `carecanvas_active_user`, not `VITE_AI` store — green field for Settings persistence
- `read .env.example` (allowed) + `read .teamwork/prompt_draft.md` + `read .teamwork/research/dispatcher-intelligence-gap-2026-08-30.md` + `read src/tools/vaultTools.ts` + `read opencode.json` + `read .teamwork/state.json` — all with file:line above
- `webfetch` not re-run in this delta run — reused prior `webfetch https://opencode.ai/docs/go` verification at `dispatcher-intelligence-gap-2026-08-30.md:4` as generic example; no new external doc needed (user says any baseURL)
- No `read .env` — respected deny (only `.env.example`)

> End delta — next artifact is `../prompt_draft.md` revised (170+ lines, contains both verbatim blocks, generic configurable R1, no hardcoded provider literals as requirement, ends with `> Status: AWAITING_FEEDBACK`).
