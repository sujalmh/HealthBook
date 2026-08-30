# Research — Spec Miner Structure-Engine — 2026-08-30

Scope: structure & engine (WebMCPEngine, LocalVault, knowledge, Settings green field)

## Findings file:line
- src/core/webmcp/WebMCPEngine.ts:24-820 singleton, detectAndPolyfill 38-50, toolchange shim 62-108, registerTool validation 130-145 regex ^[a-zA-Z0-9_.-]{1,128} max128, AbortController Map:29, specRegistry:27, branch native vs polyfill 387-442, dispatchToolchange 311
- src/core/webmcp/WebMCPAdapter.ts:11-134 TOOL_NAME_REGEX:11, serializeInputSchema 48-65, derivePatientContext 68-84 localStorage carecanvas_active_user, toSpecTool 93-134 parameters→inputSchema
- src/types/webmcp.ts:7-198 WebMCPToolDefinition parameters vs inputSchema alias, ModelContext Promise, WebMCPExecutionContext 120-133
- src/core/vault/LocalVault.ts:25-718 14 stores, validateBoundingBox 212-220, addFact 223-238 emits fact_added:234, patientId scoping getters 244-637, wireLocalVaultToEventBus 715
- src/core/knowledge/interactionEngine.ts:26-404 resolveGenericName 30-45 mockBrandGenericCatalog:7, checkDrugInteractions 50-88 mockDrugDrugInteractions:65, checkDiet 93-195, duplicate 200-280, suggestSchedule 285-345
- src/core/knowledge/reconciliationEngine.ts:23-560 reconcileThreeLists 27-155, generatePlainLanguageExplanation 196-252 Lisinopril 210 Apixaban 222, generateDoctorQuestions 257-314 hardcoded 283-297
- src/tools/vaultTools.ts:11-564 Gap1 heuristic split 47-64 fixed bbox x:0.08 y:0.12+idx*0.08 width:0.78 height0.05 categories medication line.slice(0,40)
- src/tools/labStoryTools.ts:13-578 Gap2 BIOMARKER_STANDARDS 13-159, extractLabs regex 5 markers 324-329 creatinine|eGFR|potassium|HbA1c|glucose, correlateMeds template 509 eGFR ${direction}
- src/tools/homeLabTools.ts:10-476 Gap3 isBase64Image 54 textToParse='' skip, placeholder Creat1.0 eGFR75 116-149, editForm defaults synthetic
- src/components/homelab/UploadLabModal.tsx:29-351 Gap4 editForm creatinine1.90 egfr28 potassium4.8 42-46, mock_photo_slip_blob_base64 58, handleApproveAndCommit synthetic doc_homelab_slip_002 103
- src/components/vault/DocumentDropzone.tsx:26-63 handleRealExtract DocumentDropzone rawText only FileReader readAsText/DataURL 96-102 no vision
- src/types/vault.ts:18-43 Fact bbox optional, DocumentRecord 47-61, etc
- Settings green field: glob src/components/settings/** 0 files, grep VITE_AI|settings 0 Settings page, localStorage|store no VITE_AI store
- .env.example:14-51 VITE_AI_ENABLED false:14 PROVIDER chat|responses:22 BASE_URL https://opencode.ai/zen/go/v1:28 MODEL deepseek-v4-flash-vision-exp:33 VISION_MODEL:34 STRUCTURED true:41 example only
- opencode.json:35-68 commandcode provider 1 baseURL https://api.commandcode.ai/provider/v1 model fallback muse-spark
- vite.config.ts:14-16 jsdom setupFiles, package.json scripts dev/build/test/lint

Counts: VITE_AI 81 total 0 in src green field, hardcode 100 configurable 94, deepseek/muse/zen 0 in src, bbox fixed 2 hits vaultTools:64,80, mock_photo 1 UploadLabModal:58, 1.90/28 4 hits, lisinopril branch 1 rxBridge:283, toolchange 2 hits

## Dependencies
DocumentDropzone→webMCPEngine.execute extract_fact→WebMCPEngine.execute derive patientId localStorage→vaultTools heuristic→vault.addFact→eventBus fact_added→FactStreamView/homeLab/Dossier listeners filter patientId; confirm_fact→updateFactStatus→addMedication/addLab→medication_added/lab_added→HomeLabView/pillMap/labStory interactionEngine

## Affected Files
src/core/webmcp/**, src/core/vault/**, src/core/knowledge/**, src/tools/**, src/types/**, src/components/vault/**, src/components/homelab/**, src/components/settings/** green field, .env.example, opencode.json, vite.config.ts, package.json, .teamwork/**

## Unknowns
Settings persistence shape, AI client location src/core/ai/*, vision payload image_url vs input_image generic branching, opencode Go provider not yet added, cross-field propagation orchestration not yet implemented

## Tool Discipline
glob list_dir, grep_search, read_url_content only, no bash, cited file:line above
