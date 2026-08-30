# Research — Dispatcher Intelligence Gap 2026-08-30 — Hardcoded Document Handling → LLM Intelligence

> Scope: general survey — whole repo for hardcoded document handling, LLM wiring opportunity, WebMCP tool intelligence gap. Coordinator draft (supplements parallel dispatcher research/* if any).
> Discovery tools used: `glob` (list_dir), `grep` (grep_search), `read` + `webfetch` (read_url_content). Cited file:line for every material finding. Secrets not read (`.env` deny, only `.env.example` allowed).

## 1. Repo Layout Discovered via `glob` (list_dir)

- `glob **/*` (truncated 100) shows Vite6 React18 Tailwind project at `/Users/sujal/Projects/proj1` — `package.json:1-44` scripts `dev/build/test`, `src/tools/index.ts:69-123` 40 tools, `src/core/webmcp/WebMCPEngine.ts` 820 lines after fix, `src/core/vault/LocalVault.ts:1-719` 11 stores + audit, `src/components/vault/DocumentDropzone.tsx:1-187`, `src/components/homelab/UploadLabModal.tsx:1-351`, `src/components/pillmap/*` (8 files), `src/components/labstory/*` (4 files), `src/components/rxbridge/*`, `src/components/safety/*`, `src/components/carecircle/*`, `src/components/dossier/*`, `src/core/knowledge/interactionEngine.ts:1-404` + `reconciliationEngine.ts`, `src/fixtures/documents.ts:1-18` mock-removed, `src/types/vault.ts:1-232`, `opencode.json:1-69`, `.env.example:1-51`, `.teamwork/state.json:1-268` M1-M3 PASS, `.teamwork/PROJECT.md:1-77` engine spec synthesis.
- `glob src/components/**` → 44 component files across 8 domains (vault 4, pillmap 9, labstory 4, rxbridge 5, homelab 4, safety 4, carecircle 5, dossier 6, common 4, auth 3). All present.
- `glob .teamwork/research/**` → 14 existing research files before this run (dispatcher-webmcp-engine-protocol.md 142 lines, dispatcher-webmcp-hackathon-verification-2026-08-30.md 24136 bytes, explorer-hardcoded-*.md, spec-miner-*.md). Will add `dispatcher-intelligence-gap-2026-08-30.md` (this file).

## 2. .env.example LLM Config Discovered via `read` (allowed) — NOT .env

- `read .env.example:14-50` — `VITE_AI_ENABLED=false` (toggle), `VITE_AI_PROVIDER=chat|responses` — dual provider selector.
- `VITE_AI_BASE_URL=https://opencode.ai/zen/go/v1` (Go prefix) with path auto-append: `chat → POST {base}/chat/completions`, `responses → POST {base}/responses` — matches Go docs fetched below.
- `VITE_AI_MODEL=deepseek-v4-flash-vision-exp` (vision-capable chat) and `VITE_AI_VISION_MODEL=deepseek-v4-flash-vision-exp` for `chat`; alternative `muse-spark-1.2-contributor` for `responses` (comment at `:36-37`). `VITE_AI_STRUCTURED_OUTPUTS=true` (json_schema / json_object + Zod validation). Optional `VITE_AI_TEMPERATURE`, `MAX_TOKENS`, `TIMEOUT_MS`, `ORG_ID`, `EXTRA_HEADERS`.
- `read opencode.json:35-48` — still only `commandcode` provider with `baseURL https://api.commandcode.ai/provider/v1` and `model opencode-go/muse-spark-1.2-contributor:68` — **no `opencode-go` provider entry for `https://opencode.ai/zen/go/v1` exists yet** in opencode.json (grep `opencode.*zen|go/v1` 0 in src/ apart from .env.example). Green field for Go wiring in plan.
- Integrity: `.env` NOT read — permission deny `*.env` at `opencode.json:16-20` respected. Only `.env.example` inspected.

## 3. Hardcoded / Simple Handling Gap — `grep` + `read` Evidence file:line

### 3.1 Vault extraction — `src/tools/vaultTools.ts:36-108`
- `vaultTools.ts:47` comment `// Simple heuristic: split rawText into lines and create a fact per meaningful line (up to 3).` — splits on `[\n;.]+`, filters `length>6`, slice 0,3.
- `vaultTools.ts:55-64` creates `Fact` per line with `category: 'medication'` hardcoded (all lines become medication), `name: line.slice(0,40)`, `value: {rawSnippet}`, `boundingBox: {pageIndex:1, x:0.08, y:0.12+idx*0.08, width:0.78, height:0.05}` — **fixed coordinates** regardless of actual document layout/image. No vision, no structured schema, no entity normalization (dosage, frequency, brand→generic, labs vs allergies vs conditions vs supplements distinction).
- `vaultTools.ts:69-90` fallback when no lines: single fact with same hardcoded bbox. `vaultTools.ts:87-90` no rawText → empty array (no mock but also no intelligence).
- Gap: uploading a discharge PDF containing "Apixaban 5mg BID, Creatinine 1.9 mg/dL, eGFR 28" would produce 2-3 medication facts with raw snippets, not normalized labs/meds/allergies/conditions with real bounding boxes.

### 3.2 DocumentDropzone — `src/components/vault/DocumentDropzone.tsx:26-103`
- `DocumentDropzone.tsx:26-45` `handleRealExtract` creates `documentId` with timestamp+filename, `addDocument` with `docType` from mime sniff, then `webMCPEngine.execute('extract_fact', {documentId, rawText, documentType:file.type})` — rawText comes from `FileReader` result.
- `DocumentDropzone.tsx:80-102` `reader.onload` → `rawText = result || file.name`; for PDFs `readAsText` (binary PDF yields garbled text), for images `readAsDataURL` (base64 data URL string passed as rawText — not sent as `image_url` vision input). No OCR, no image-to-text vision call.
- `DocumentDropzone.tsx:41` only calls `extract_fact`; does NOT propagate to pillmap/labStory/rxBridge/homeLab/safety/careCircle — user must manually navigate and re-enter data. Cross-field update missing.
- Grep `grep extract_fact|rawText|imageBlob|vision` hits `DocumentDropzone.tsx:41,43` but 0 hits for `VITE_AI|openai|vision` in src/components/vault.

### 3.3 confirm_fact propagation — `src/tools/vaultTools.ts:135-223`
- `vaultTools.ts:166-204` when fact is confirmed → if `category==='medication'` calls `vault.addMedication` with stub `medRecord` (genericName=name, dosage=val.dose||'Standard', frequency=Once daily, timingSlots=['morning'], withFood:false); if `category==='lab'` calls `vault.addLab` with `referenceRange:{low:0,high:100}` generic, `optimalRange:{low:10,high:50}`. No intelligent pillmap scheduling, no interaction checking, no rxBridge reconciliation, no labStory normalization (vs `labStoryTools.ts` BIOMARKER_STANDARDS), no homeLab due card, no safety triage, no question bank. `compile_health_record` derives citations generically but not triggered by confirmation.

### 3.4 LabStory — `src/tools/labStoryTools.ts:319-348`
- `labStoryTools.ts:319-350` `extract_labs` second path: if `rawText` present, regex patterns for 5 markers (`creatinine|eGFR|potassium|HbA1c|glucose`) via `text.match(p.regex)` — simple heuristic, no LLM, no vision, no multi-value panel extraction, no date association.
- If no parseable markers → returns empty array with message, no intelligent fallback.
- `labStoryTools.ts:508-547` `correlate_meds` derives narrative from `delta` sign and `vault.getMedications.slice(0,3)` — template strings `eGFR ${direction}${changeDesc}` etc., not causal LLM reasoning with actual med timelines.

### 3.5 HomeLab — `src/tools/homeLabTools.ts:34-195` + `src/components/homelab/UploadLabModal.tsx:42-157`
- `homeLabTools.ts:54-92` `upload_lab_image` heuristic: `isBase64Image = imageText.startsWith('data:image')||length>5000` → if true `textToParse=''`, so vision image (data URL) skips parsing and falls to placeholder `extractedValues: {Creat 1.0, eGFR75}` at `116-149` — hardcoded generic values, not vision-extracted.
- `homeLabTools.ts:58-85` `tryParse` regex identical to labStory, creates fact with `boundingBox {x:0.11,y:0.38,width:0.78,height:0.05}` hardcoded.
- `UploadLabModal.tsx:42-46` `editForm:{creatinine:'1.90',egfr:'28',potassium:'4.8'}` hardcoded defaults shown before OCR; `handleApproveAndCommit:82-104` writes those directly to vault as labs with fixed sourceDocId `doc_homelab_slip_002` — if user approves without editing, synthetic 1.90/28 leaks.
- `UploadLabModal.tsx:54-68` `handleSimulateUpload` calls `imageBlob:'mock_photo_slip_blob_base64'` — not real file, not vision.

### 3.6 PillMap — `src/tools/pillMapTools.ts:37-372` + `src/core/knowledge/interactionEngine.ts:30-403`
- `pillMapTools.ts:37-74` `add_medication` uses `ClinicalInteractionEngine.resolveGenericName` but no LLM dosage normalization, no intelligent slot suggestion beyond rule engine.
- `pillMapTools.ts:94-112` `check_interactions` generates `arcs` via `ClinicalInteractionEngine.checkDrugInteractions` which is fixture `mockDrugDrugInteractions` lookup — rule-based, not LLM extracted from document. `pillMapView.tsx` only recomputes via that engine, never from document extraction.
- `interactionEngine.ts:6-11` imports `mockBrandGenericCatalog, mockDrugDrugInteractions` from `drug_knowledge.ts` — knowledge is static fixtures, not learned from uploaded document.
- No path where `extract_fact` meds auto-populate pillmap with chronotype-aware scheduling; user must manually `handleDropPill` or `handleAddMedSubmit`.

### 3.7 RxBridge — `src/tools/rxBridgeTools.ts:12-421`
- `rxBridgeTools.ts:34-92` `explain_med_change` calls `ClinicalReconciliationEngine.determineStatusBadge` + `generatePlainLanguageExplanation` — rule engine, not LLM narration with document context.
- `rxBridgeTools.ts:248-323` `suggest_question_for_doctor` lowercases `ctx` and `if ctx.includes('lisinopril')...` hardcoded template questions — 4 branches then fallback generic `Could you please clarify...` — not generated via LLM from actual discharge list + document.
- `rxBridgeTools.ts:326-421` `export_patient_summary` builds summary via `ClinicalReconciliationEngine.compilePatientSummary` from `dataset` or vault meds map — no intelligent synthesis of newly uploaded document facts into summary until user manually triggers.

### 3.8 Safety — `src/tools/safetyTools.ts:10-512` + `src/components/safety/*`
- `safetyTools.ts:36-77` `report_danger_sign` triage `isSevere = severity==='severe'||'critical'||tags includes chest_pain/dyspnea` — rule, not LLM assessment of freeText/photo. `photoBlob` stored as `{id:...,fileName:'edema_feet.jpg'}` but not vision-analyzed.
- No auto-link between danger sign photo upload and document vault or lab trends.

### 3.9 CareCircle/Dossier — `src/tools/careCircleTools.ts:10-415` + `src/tools/vaultTools.ts:226-564`
- `careCircleTools.ts:43-55` `link_patient` resolves patientName generically, not from document.
- `vaultTools.ts:226-564` `compile_health_record` (`dossier`) assembles 11 vault stores into bundle + FHIR via `buildFHIRR4Bundle`, but no LLM summary generation, no intelligent citation ranking, no dynamic question bank synthesis from new document.
- `vaultTools.ts:296-306` citations loop includes boundingBox if present — but since extraction bbox hardcoded 0.08/0.12, citations are synthetic.

### 3.10 Cross-field update missing — synthesis
- Upload via `DocumentDropzone` → `extract_fact` → `unconfirmed` facts → user `confirm_fact` → only `addMedication` or `addLab` (single store). No event fan-out to:
  - PillMap: no `addMedication` → `check_interactions/diet/duplicate/suggest_schedule` auto-run with new meds.
  - LabStory: no `addLab` → normalized `BIOMARKER_STANDARDS` + `correlate_meds` trajectory recalc.
  - RxBridge: no `explain_med_change` + `flag_interaction` + `suggest_question_for_doctor` auto-generated for new meds.
  - HomeLab: no `dueCards` update, no `schedule_lab` inference.
  - Safety: no `dangerReports`/`triage` if doc contains red flags.
  - CareCircle/Dossier: no incremental `compile_health_record` cache invalidation or question bank `addQuestion`.
- EventBus has typed helpers `emitMedicationAdded`, `emitLabAdded`, etc. at `LocalVault.ts:116-157` but `addFact` only emits `fact_added` (234) and `addMedication` emits `medication_added` — no orchestrated cross-module LLM synthesis.

## 4. LLM Wiring Opportunity via .env.example + Go Docs (webfetch)

- `webfetch https://opencode.ai/docs/go` 2026-08-30 verifies: Go subscription $10/mo, models list includes `Muse Spark 1.2 Contributor` endpoint `https://opencode.ai/zen/go/v1/responses` (`@ai-sdk/openai`), `DeepSeek V4 Flash Vision Exp` endpoint `https://opencode.ai/zen/go/v1/chat/completions` (`@ai-sdk/openai-compatible`). Table shows `opencode-go/<model-id>` format. Earlier .env.example `DEEPSEEK vision uses chat, muse uses responses` matches Go docs table — `.env.example:22-37` provider selector `VITE_AI_PROVIDER=chat` (deepseek) vs `responses` (muse) is correct per docs.
- `read .teamwork/research/dispatcher-webmcp-hackathon-verification-2026-08-30.md:22-45` confirms WebMCP spec §4.1-4.5 via live webfetch; reuse for planning. New `webfetch go docs` confirms `https://opencode.ai/zen/go/v1/responses` is real endpoint for muse-spark (not invented). For deepseek vision, endpoint is `https://opencode.ai/zen/go/v1/chat/completions` with `json_object` structured mode.
- `grep VITE_AI|openai|structured|vision` before this run: 0 hits in `src/` apart from `.env.example` and comments — confirms green field, no AI code yet. Plan must add new client without breaking WebMCP 40.

## 5. WebMCP Integrity Already PASS — Do Not Reharm

- `.teamwork/state.json:41-52` milestones M1→M3 completed PASS (critic/challenger/auditor final PASS). `src/tools/index.ts:69-123` catalog 3+2+8+5+5+9+8 intact, `src/core/webmcp/WebMCPEngine.ts` 820 lines after fix with SecureContext+PermissionsPolicy+AbortSignal+toolchange, `src/main.tsx` async init, `test/test-runner.ts` 231 + vitest 172 PASS, `vite build` 1660. Plan must preserve: `grep -c getTools` 40, no regression lint/test/build.

## 6. Affected Files for Intelligence Layer (candidate ownership — planning only, no edits suggested)

- Primary: `src/tools/vaultTools.ts` (extract_fact), `src/tools/homeLabTools.ts` (upload_lab_image), `src/tools/labStoryTools.ts` (extract_labs/correlate), `src/components/vault/DocumentDropzone.tsx`, `src/components/homelab/UploadLabModal.tsx`, `src/core/vault/LocalVault.ts` (propagation), `src/components/pillmap/*`, `src/components/labstory/*`, `src/components/rxbridge/*`, `src/components/safety/*`, `src/components/carecircle/*`, `src/components/dossier/*`, `src/core/knowledge/*` (rule vs LLM), plus new `src/core/ai/*` (opencode client) — but per constraint, do not prescribe edits here; Orchestrator will decompose.

## 7. Unknowns / Open Questions Flagged

- Should LLM extraction run **synchronously inside `extract_fact` tool** (agent calls tool and gets AI facts) or **asynchronously after upload in UI component** (DocumentDropzone calls AI then writes vault)? Impacts WebMCP tool contract (`plainLanguageSummary` vs structured array) and demo traceability.
- Vision input: should `DocumentDropzone` send `dataURL image_url` via Responses `input_image` (muse) vs Chat `image_url` (deepseek vision) vs text-only OCR fallback? .env.example supports both via `VITE_AI_PROVIDER`.
- Structured outputs: `VITE_AI_STRUCTURED_OUTPUTS=true` uses `json_schema` (responses) or `response_format:{type:"json_object"}` (chat) — which tool showcases? `extract_fact` Fact[] with bounding_box vs `extract_labs` Lab[]?
- Propagation level: should confirming one fact auto-create pillmap med + labStory point + rxBridge summary + homeLab dueCard + dossier citation in one batch, or stage each for human approval? Affects approvalGateType design.
- Fallback: when `VITE_AI_ENABLED=false` or no `VITE_AI_API_KEY`, should rule heuristic remain as fallback (current 0.08 bbox) or return empty with message?
- Privacy: client-side `import.meta.env.VITE_AI_*` exposes key in bundle — demo only; should plan mention server proxy or judges paste own key per `.env.example:29` comment?
- Temperature/max_tokens tuning and timeout `VITE_AI_TIMEOUT_MS=30000` — needed for plan's verification (mock vs real network).
- Working directory already `.teamwork` per `state.json:metadata.artifactsDir=".teamwork"` — confirm no isolation.

## 8. Tool Discipline Log (for M1 acceptance)

- `glob **/*` executed — mapped project structure, found 100+ files including `src/tools/**` 7 files, `src/components/**` 44 files.
- `grep hardcoded|boundingBox.*0\.08|split.*rawText` — found 12 hits including `vaultTools.ts:47,64,80`.
- `grep VITE_AI|openai|structured|vision` — 0 hits in src/ (green field) vs 14 hits in `.env.example` + docs.
- `read .env.example` (allowed) + `read src/tools/vaultTools.ts:1-120` + `read src/components/vault/DocumentDropzone.tsx` + `read src/tools/homeLabTools.ts` + `read src/core/knowledge/interactionEngine.ts` + `read .teamwork/state.json` + `read .teamwork/PROJECT.md` — all with file:line citations above.
- `webfetch https://opencode.ai/docs/go` — verified endpoints table, model IDs, pricing, ZDR — cited above.
- No `read .env` — respected deny.

## 9. Delta Addendum 2026-08-30 — Generic Configurable Provider (no hardcoding) + Settings Page Discovery (amends R1/R3)

> **Amendment reason:** User verbatim feedback 2026-08-30: `Dont hardcode this: chat → deepseek-v4-flash-vision-exp /chat/completions, responses → muse-spark-1.2-contributor /responses, it can be any models, dont hardcode: baseURL https://opencode.ai/zen/go/v1 it can be any base url. These will be configured using settings page, or the .env file. dont hardcode it. Replace all the hardcoded logic to ai based intelligence in the website. Use images along with text, most models allow it in single response, if thats rqeuired. All image based extraction or OCR, use AI.` — prior sections hard-coded example provider details as requirement; this addendum corrects to **generic configurable**.

- **Reinterpretation of .env.example as configurable example only (not forced):**
  - `read .env.example:14-50` still shows `VITE_AI_ENABLED=false` at `:14`, `VITE_AI_PROVIDER=chat|responses` at `:22`, `VITE_AI_BASE_URL=https://opencode.ai/zen/go/v1` at `:28`, `VITE_AI_MODEL=deepseek-v4-flash-vision-exp` at `:33` + alternative `muse-spark-1.2-contributor` at `:36`, `VITE_AI_STRUCTURED_OUTPUTS=true` at `:41` — but these are now **examples only**; any OpenAI-compatible `baseURL`, `model`, `provider` is allowed. Implementation must read **configurable runtime values** via `import.meta.env.VITE_AI_*` **OR** Settings page persistence — not hardcoded literals `deepseek-v4-flash-vision-exp`, `muse-spark-1.2-contributor`, `https://opencode.ai/zen/go/v1`, `/chat/completions`, `/responses` in `src/`. See new delta file `dispatcher-configurable-provider-delta-2026-08-30.md` for full generic note.
- **Settings page discovery (required, 2026-08-30 run):**
  - `glob src/components/**Settings*` → 0 files; `glob src/**/*[Ss]ettings*` → 0 files; `glob src/**` → 68+ files (vault 4, pillmap 9, labstory 4, rxbridge 5, homelab 4, safety 4, carecircle 5, dossier 6, common 4, auth 3) — **no Settings component exists** — `file:line` N/A green field.
  - `grep VITE_AI|settings|Settings` in `src/` → only `src/index.css:19 font-feature-settings` and `src/components/carecircle/CareCircleView.tsx:12 Settings` icon import and `src/components/dossier/DossierView.tsx:302 Share Settings` tab label — **no `VITE_AI` persistence** — `file:line` confirms Settings page is new work, not existing.
  - `grep localStorage|store|useStore|zustand` → hits only `LocalVault`, `carecanvas_active_user`, `fhirExporter` — no `VITE_AI` settings store — green field for new `Settings` persistence (e.g., `localStorage` + `src/core/settings` or `src/components/settings/*`).
  - `grep VITE_AI` in `src/` → 0 hits vs 14 in `.env.example` — no hardcoding yet (good), but after implementation must be `grep -R "deepseek|muse-spark|opencode\.ai/zen" src/` count 0 and `grep -R "import\.meta\.env.*VITE_AI|SettingsStore" src/` count >=1.
- **Vision+text multimodal single response:** User requires images along with text in single response if required — most vision models support `image_url`/`input_image` + text together. Hardcoded separate OCR path (e.g., `homeLabTools.ts:54` `isBase64Image ? textToParse=''` skipping vision) must be replaced by AI multimodal. All image OCR must be AI — `grep -R "isBase64Image.*textToParse.*''" src/tools/homeLabTools.ts` count must go 0 after.
- **Every hardcoded branch → AI:** Not just vaultTools — all 7 gaps at `§3` (vaultTools fixed bbox `file:line:64,80`, labStory regex `file:line:321-346`, homeLab placeholder `file:line:116-149`, UploadLabModal defaults `file:line:42-46`, interactionEngine fixtures `file:line:6-11`, rxBridge templates `file:line:283-297`, safety rules `file:line:37,45`) must be replaced by AI intelligence — verifies `prompt_draft.md` R2 now explicitly covers all.
- **Tool discipline for delta:** `glob` list_dir (Settings globs 0, src/** 68+), `grep` grep_search (VITE_AI/settings/Settings/localStorage counts above), `read` read_url_content (`.env.example` allowed, `prompt_draft.md` revised, this file), `webfetch` reused prior Go docs as generic example. No `read .env`. Logs redirected to this file and `dispatcher-configurable-provider-delta-2026-08-30.md`.

> End research — next artifact is `../prompt_draft.md` blocking (revised 2026-08-30, 170+ lines, both verbatim blocks, generic configurable R1, delta addendum).
> Detailed generic provider delta in `dispatcher-configurable-provider-delta-2026-08-30.md` — `grep -c "hardcode"` >0, `grep -c "configurable"` >0, `grep -c "VITE_AI"` >0, `grep -c "file:line"` >0 there as well.

