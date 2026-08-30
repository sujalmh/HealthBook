# TEST_INFRA.md — CareCanvas Intelligence Gap + WebMCP 40 Preserve (teamwork-1788097222690)

Synthesized: 2026-08-30T19:20Z from spec-miner-tests-verification + dispatcher deltas + prompt.md Independent Verification R1-R4 + vite.config harness; integrity demo reproducible verifiable not mocked — protocol toolchange/isSecureContext/Permissions-Policy real not mocked, LLM path mock-network allowed in CI but schema/vision shape real, no hardcoded provider literals in src/ (Q13)
Working Dir: /Users/sujal/Projects/proj1/.teamwork (Q1)

## Test Commands (baseline 1660 modules, 172 vitest / 231 runner PASS pre-gap, lint 0 — must NOT regress, WebMCP 40)

- npm run lint -> tsc --noEmit — expected EXIT 0, 0 errors — gate per milestone + Success Auditor, log .teamwork/logs/lint.log
- npm test -> vitest run (globals:true, jsdom, setup test/setup.ts clearAll) — expected 172+ PASS (currently 172) — after intelligence must stay 172+ PASS, test/unit/WebMCPEngine.test.ts 4 tests still 40 via engine direct + probes native Promise 40 inputSchema origin toolchange DOMString patientId probe-patient-001
- npx tsx test/test-runner.ts (npm run test:all) -> custom harness 231 tests across 15 suites — Tier1 40 tools 200 tests (vault 3 + labstory 2 + pillmap 8 + rxbridge 5 + homelab 5 + safety 9 + carecircle 8) + Tier2 T2-01..12 + Tier3 INT-01..12 + Tier4 workloads + E2E Flows A-E — expected ALL 231 PASS — after intelligence must stay 231 PASS, logs .teamwork/logs/tier3.log
- npm run build -> tsc && vite build — expected EXIT 0, 1660±delta modules dist valid (prior 1664 at build.log 793kB JS +72kB CSS) — log .teamwork/logs/build.log
- Tier splits: npm run test:tools --tier1, test:tier2 --tier2, test:tier3 --tier3, test:workloads --tier4, test:e2e:flows --e2e
- Per-file: npx vitest run test/tier3-integration/cohesion.test.ts 28, supabase.test.ts 8
- Native probe (manual/browser): In Chrome 149 flag localhost: await document.modelContext.getTools() length 40, JSON.parse(inputSchema) PASS, description non-empty, origin/window present, toolchange event count >=1 after register/unregister, isSecureContext true, executeTool object-based returns DOMString JSON.parse success, patientId correct not '' nor patient-s-devi — logs .teamwork/verification/webmcp-native-probe.log + webmcp-validation.log + toolchange.log
- Fallback parity probe (jsdom/tests): same calls via polyfill shim Promise shapes length 40 — logs webmcp-native-probe.log parity section

## Intelligence Verification Gates — Mechanical Reproducible (prompt.md R1-R4)

### R1 — Generic configurable extraction vision+text multimodal + structured outputs via generic configurable provider, all image OCR via AI, no hardcoding

- **Grep gates (must ALL PASS with logs):**
  - `grep -R "VITE_AI_ENABLED|VITE_AI_PROVIDER|VITE_AI_BASE_URL|VITE_AI_MODEL" .env.example` count >=4 PASS, log `.teamwork/verification/env-config.log` — .env.example 13 keys configurable examples
  - **No-hardcode provider gates (after implementation, count must be 0 in src/):** `grep -R "deepseek-v4-flash-vision-exp" src/` count 0 PASS; `grep -R "muse-spark-1\.2-contributor" src/` count 0 PASS; `grep -R "https://opencode\.ai/zen/go/v1" src/` count 0 PASS; `grep -R "opencode\.ai/zen" src/` count 0 PASS — proves no hardcoded model/baseURL literals in code (may exist only in .env.example as example). Log `.teamwork/verification/no-hardcode-provider.log`
  - **Configurable-read gate:** `grep -R "import\.meta\.env.*VITE_AI|VITE_AI.*localStorage|settings.*VITE_AI|useSettings|SettingsStore" src/` count >=1 PASS (verifies client reads runtime config from env OR Settings page, not literals). Log `.teamwork/verification/configurable-read.log` — today 0 green field, after M1 must be >=1
  - **Hardcoded bbox removal:** `grep -R "boundingBox.*x: 0\.08.*y: 0\.12" src/tools/vaultTools.ts` count 0 after implementation (today 2 at vaultTools:64,80 as evidence). Log `.teamwork/verification/no-hardcode-bbox.log`
  - **Vision multimodal gate:** `grep -R "vision|image_url|input_image" src/` count >=1 after implementation (before 0 — green field), and captured network probe shows single request containing both image data URL and text when image slip uploaded (multimodal single response), not two separate calls. Log `.teamwork/verification/vision-multimodal.log`
  - **Structured generic gate:** `grep -R "json_schema|json_object|response_format|text\.format|structured" src/` count >=1 after implementation (before 0) — generic structured mode not tied to single provider field. Log `.teamwork/verification/structured-generic.log`
  - **All OCR via AI gate:** `grep -R "extract.*text.*split.*rawText.*slice\(0,3\)|startsWith.*data:image.*textToParse.*''" src/tools/vaultTools.ts src/tools/homeLabTools.ts` count 0 after implementation (proves image OCR heuristic removed; today count >0 as evidence). Log `.teamwork/verification/no-hardcode-ocr.log`
- **Config probe (planning):** `cat .env.example` shows VITE_AI_* example keys; `cat` candidate Settings component `glob src/components/**Settings*` shows 0 files green field and `grep Settings` shows only carecircle/dossier labels — screenshot and log env-config.log PASS; `cat opencode.json` provider still commandcode only (plan notes future configurable Go wiring, not hardcoded — PASS for planning)
- **Demo probe (after implementation, not in M0):** Upload sample discharge PDF (text Apixaban 5mg BID, Creatinine 1.9 mg/dL, eGFR 28) via real DocumentDropzone drag-drop at http://localhost:5173 → modelContext.executeTool(find{extract_fact}, {documentId, rawText|imageBlob}) returns DOMString JSON parsed to Fact[] length >0 with at least one category:lab (Creatinine) and one category:medication (Apixaban) and each has boundingBox {pageIndex,x,y,width,height} not equal to 0.08/0.12 fixed and confidence>0; upload image slip (data URL) shows fetch body contains image_url or input_image plus text in single request via captured probe (mock network with schema validation) and no hardcoded provider literal in request URL (URL equals configurable VITE_AI_BASE_URL or Settings baseURL). Screenshot vision-upload-1280.jpg + 375.jpg + 768.jpg JFIF >5K under .teamwork/snapshots/intelligence/. Log structured-outputs.log. For M0 planning, this probe documented as future — not executed today.

### R2 — Every hardcoded branch replaced by AI + cross-field propagation

- **Glob/grep evidence (planning):** `glob src/components/**` 44 files + `read src/tools/vaultTools.ts:165-204` confirm propagation only touches single store; research/dispatcher-intelligence-gap-2026-08-30.md:3 enumerates 7 gaps with file:line (already PASS, grep -c "file:line" >0 in research). `grep -R "emitMedicationAdded|emitLabAdded|fact_status_changed|medication_added" src/core/vault/LocalVault.ts src/tools/vaultTools.ts` shows relevant-only fan-out exists but not intelligent orchestration — log propagation-grep.log
- **Hardcode branch elimination gates (after implementation, all counts 0 in src/):**
  - `grep -R "mock_photo_slip_blob_base64" src/` 0 PASS (no mock default)
  - `grep -R "Creat 1\.0.*eGFR.*75|extractedValues.*Creat" src/tools/homeLabTools.ts` 0 PASS (no placeholder)
  - `grep -R "creatinine.*1\.90.*egfr.*28" src/components/homelab/UploadLabModal.tsx` 0 PASS (no hardcoded editForm defaults — values must come from AI extraction)
  - `grep -R "if.*ctx\.includes.*lisinopril" src/tools/rxBridgeTools.ts` 0 PASS (no hardcoded 4-branch templates)
  - `grep -R "text\.match\(p\.regex\).*creatinine" src/tools/labStoryTools.ts` 0 PASS when AI enabled (regex fallback may remain as disabled-fallback but not primary)
  - `grep -R "mockDrugDrugInteractions|mockBrandGenericCatalog" src/core/knowledge/interactionEngine.ts` count may remain for fallback but AI path must exist and be primary when enabled — verify `grep -R "import\.meta\.env.*VITE_AI|AI.*interaction|AI.*correlate" src/` >=1
  - `grep -R "severity.*severe.*chest_pain|fileName.*edema" src/tools/safetyTools.ts` 0 when AI enabled (rule fallback not primary for photo vision)
  - Logs `.teamwork/verification/no-hardcode-branches.log`
- **Event matrix probe (after implementation):** After extract_fact doc doc-intel-001 with rawText containing 2 meds + 1 lab, confirm_fact approve all → assert within 2s that localVault.getMedications(patientId) grew by ≥2, localVault.getLabs(patientId) grew by ≥1 with normalized BIOMARKER_STANDARDS (e.g., Creatinine referenceRange {0.6,1.2} not {0,100}), getQuestionBankItems(patientId) grew by ≥1 via AI suggest_question, getDueCards/dangerReports updated if applicable — all for same patientId as localStorage carecanvas_active_user.userId, not ''. Verify via npx tsx .teamwork/verification/cross-field-probe.ts → CROSS_FIELD PASS log cross-field.log. UI probe: navigate vault→pillmap→labStory→rxBridge→dossier without reload, each shows new data; screenshots per canvas at 1280/375
- **Approval semantics probe:** Confirm unconfirmed facts never appear in compile_health_record confirmedFacts nor pillmap getActiveMedications, but after confirm_fact approve they do; reject removes from propagation set — verified via harness test/tier3-integration/cross-module-integration.spec.ts pattern
- **Patient isolation probe:** Set localStorage carecanvas_active_user to test-patient-intel-001, upload doc, assert vault.getFactsByPatient('')===0, getFactsByPatient('test-patient-intel-001').length>0, and getFactsByPatient('patient-s-devi')===0 — prevents orphan leak (same pattern as M1 challenger-m1-retry.mjs:282-315)

### R3 — Generic configurable LLM config wiring without regression, no hardcoding

- **Grep gates:**
  - `grep -R "VITE_AI" src/` after implementation count >=1 PASS (client reads import.meta.env VITE_AI_* or Settings store generically) — planning gate today count 0 documented as green field
  - `grep -R "\.env" .gitignore` count >=1 PASS (ensures .env not committed)
  - `grep -R "apiKey.*VITE_AI|import\.meta\.env" src/` count >=1 after implementation (never hardcoded key literal)
  - **No-hardcode secret/model/baseURL in src:** `grep -R "deepseek|muse-spark|opencode\.ai/zen" src/` 0 PASS (proves configurable); `grep -R "sk-" src/` 0 PASS (no literal key)
  - `cat opencode.json | grep -A2 opencode-go` shows Go provider after implementation only if team opts and with configurable baseURL (not forced) — planning gate logs current commandcode only and notes delta
  - `npm run lint` (tsc --noEmit) 0, `npm run build` valid 1660±delta, `npm test` 172 PASS, `npx tsx test/test-runner.ts` 231 PASS — logs .teamwork/logs/*.log + .teamwork/verification/final.md (after implementation); for M0, prior M1-M3 logs already PASS and must stay PASS (no src edits in M0, so automatically preserved)
- **Secret leak gate:** `git diff --stat` shows only .teamwork/** changed in M0 (no src/), `git ls-files | xargs grep -l "sk-"` 0, `grep -R "VITE_AI_API_KEY" src/` never contains literal value — documented in research file
- **Settings page gate (after implementation):** `glob src/components/**Settings*` and `grep -R "Settings" src/` should show Settings component exists and that it persists VITE_AI_* (baseURL/model/provider) to localStorage/store; `grep -R "localStorage.*VITE_AI|settings.*store" src/` >=1 PASS — log settings-config.log

### R4 — Planning before implementation (M0 gate)

- **Artifacts existence (must all exist before implementation — today M0 check):**
  - `.teamwork/prompt_draft.md` with ## Objective (both verbatim blocks), ## Context (repo layout + gap file:line + .env.example config + Settings grep discovery + webfetch citations), ## Requirements (R1-R4 capability blocks with non-goals, generic configurable wording, no hardcoded model/baseURL), ## Independent Verification (per requirement mechanical including no-hardcode gates), ## Acceptance Criteria (checkboxes), ## Working Directory (.teamwork in current project), ## Integrity Mode, ## Execution Path (distributed-coding two-phase blocking), ## Open Questions (Q1..Qn), and > Status: AWAITING_FEEDBACK blocking line — grep -c "## Objective" .teamwork/prompt_draft.md >=1 PASS, grep -c "file:line" in research >0 PASS, grep -c "hardcode" .teamwork/prompt_draft.md >0 PASS, grep -c "configurable" .teamwork/prompt_draft.md >0 PASS, grep -c "VITE_AI" .teamwork/prompt_draft.md >0 PASS
  - `.teamwork/research/dispatcher-intelligence-gap-2026-08-30.md` with file:line citations + tool discipline log (this run) — ls -lh .teamwork/research/dispatcher-*.md 3+ files PASS (delta file added)
  - `.teamwork/research/dispatcher-configurable-provider-delta-2026-08-30.md` with Settings-page grep results and generic provider note (new delta file, see Verifiable Success) — grep -c "VITE_AI" >0 PASS
  - `.teamwork/research/spec-miner-*.md` 3 files scope A/B/C with file:line, hardcode/configurable/VITE_AI counts >0 — PASS
  - `.teamwork/PROJECT.md` delta 129 lines + addendum intelligence gap generic configurable provider Settings>env multimodal all OCR via AI 7 gaps replaced — grep hardcode/config/VITE_AI >0 PASS — this file
  - `.teamwork/TEST_INFRA.md` delta vision/multimodal/structured/cross-field/no-hardcode/patient isolation etc — grep probe gates documented — this file
  - `.teamwork/plan.md` DAG M0→M1→M2→M3 with ownership disjoint isolated worktrees 16 spawn budget dead-man 600s verification plan demo script — PASS
  - **M0 src no-edit gate:** `git diff --stat | grep -v ".teamwork/"` count 0 (only .teamwork/ touched) — proves planning did not mutate src/ — log .teamwork/verification/planning-gate.log with stat .teamwork/prompt_draft.md mtime vs stat src/tools/vaultTools.ts mtime (planning mtime < src mtime after implementation will show ordering)

- **Orchestrator gate (after approval):** `cat .teamwork/state.json` shows plan.createdAt before progress.completedWorkstreams[0] timestamp (enforced by Sentinel — orchestrator must NOT start Phase 2 until AWAITING_FEEDBACK resolved via RequestFeedback). For today, Sentinel surfaces prompt_draft.md as blocking artifact without spawning orchestrator beyond M0 planning.

## Coverage & Regression Guards (R5 no regression + intelligence)

- vitest 172 covers LocalVault, vaultTools, pillMap, rxBridge, labStory, continuityDossier, homeLabSafetyCareCircle, teamwork-orchestration, WebMCPEngine — after intelligence vaultTools still 40 tools, localVault scoped counts, pillMap no gap, WebMCPEngine still spec-correct dictionary
- test-runner 231 covers 40 tools + boundary T2 + cross-module INT + workloads + E2E A-E — workloads/profile tests use generic patientId via localStorage carecanvas_active_user not patient-s-devi, after fix must still 231 PASS
- Cohesion invariants (grep -rn) must stay 0 except documented keep:
  - ST. JUDE / Metropolis 0 in src/ (already 0 after prior M1-M3)
  - Dr. Anita Patel / Raj Devi etc 0 in src/ (already 0)
  - p_devi_78 0 in src/ (test legacyMocks allowed, src 0)
  - mockShanti 0 in src/
  - we pronoun 0 in src/components (direct voice) if prior
  - slop 0
  - 40 tools intact via src/tools/index.ts length 40 — grep -R "registerTool" src/core/webmcp/ count >=1 with document.modelContext.registerTool delegation PASS, grep -R "inputSchema" src/types/webmcp.ts src/core/webmcp/ validates adapter, grep -R "parameters" src/tools/ still 40 but adapter converts (not bare native)
  - New WebMCP gates must PASS:
    - grep -R "registerTool" src/core/webmcp/ >=1 with document.modelContext.registerTool delegation PASS
    - grep -R "inputSchema" src/types/webmcp.ts src/core/webmcp/ >=1 PASS
    - grep -Rn "toolchange|ontoolchange" src >=1 after fix PASS (prior 0 bug)
    - grep -R "globalThis.modelContext|window.modelContext|navigator.modelContext|__CareCanvas_WebMCP__" src -- Q2: production grep should be 0 for window/navigator/legacy except test adapter jsdom guard if (document.modelContext?.registerTool) before overwrite + test vitest shim may have 1-2 but prod 0 — verifier checks Connect modal shows only document.modelContext examples, not 4 globals
    - grep -R "isSecureContext" src >=1 PASS (bootstrap guard)
    - grep -R "permissionsPolicy.*allowsFeature.*tools|Permissions-Policy" src >=1 or try/catch NotAllowedError check PASS
    - grep -R "Promise.allSettled" src/core/webmcp src/main.tsx >=1 PASS (Q10 not Promise.all)
    - grep -R "AbortController|signal" src/core/webmcp src/main.tsx >=1 PASS (Q3 dedup)
  - Intelligence new gates after M1-M3 (generic configurable, no hardcoding):
    - grep -R "VITE_AI" src/ >=1 after (import.meta.env VITE_AI_* or SettingsStore generic) PASS
    - grep -R "deepseek|muse-spark|opencode.ai/zen" src/ 0 PASS
    - grep -R "image_url|input_image" src/ >=1 PASS vision multimodal
    - grep -R "json_schema|json_object|response_format|text.format" src/ >=1 PASS structured generic
    - grep -R "boundingBox.*0\.08.*y: 0\.12" src/tools/vaultTools.ts 0 PASS
    - grep -R "mock_photo_slip_blob_base64" src/ 0 PASS
    - grep -R "creatinine.*1\.90.*egfr.*28" src/components/homelab/UploadLabModal.tsx 0 PASS
    - grep -R "if.*ctx\.includes.*lisinopril" src/tools/rxBridgeTools.ts 0 PASS
    - Prior product invariants still 0: grep -R "ST. JUDE" src 0 stays 0, etc.

## Snapshot Discipline (live browser mandatory, demo integrity — intelligence + WebMCP)

- Every worker >=2 browser.capture (desktop 1280 + mobile 375) + tablet 768 under .teamwork/snapshots/intelligence/ + .teamwork/snapshots/webmcp-<milestone>/ ; auditor re-captures independently at 3 viewports
- Required viewports: 320/375/768/1024/1280/1440 — verify no gaps, Inspector shows 40 and correct Native vs Polyfill label, Connect modal shows document.modelContext examples, vault empty No records here yet, Create Account gate still required, after executeTool pending fact visible with correct patientId, plus intelligence vision-upload 1280/375/768 + cross-field vault→pillmap→labStory→rxBridge→dossier without reload 6-viewport
- Live dev server npm run dev port 5173, browser.open http://localhost:5173 viewport desktop|mobile|tablet + snapshot + capture ; fallback puppeteer-core justified if browser capture fails — must still produce JPEG valid >5K (file magic JFIF via file + wc -c >5K)
- Baselines: cold start empty vault before/after each milestone; native probe screenshots under .teamwork/snapshots/webmcp-native/ showing Inspector catalog count 40 and mode label; invoke screenshots under webmcp-invoke showing pending fact at 1280/375/768; intelligence vision-upload-{1280,375,768}.jpg under intelligence/ showing upload via DocumentDropzone + Settings page
- Auditor commands: lint+test+build+grep regrep + live re-capture 3 viewports (desktop 1280 mobile 375 tablet 768) must show Inspector 40, no gaps, JFIF >5K, verification logs present, 6-viewport audit 320-1440 no gaps

## Verification Plan Per Milestone (机械 reproducible probes — intelligence DAG M0→M1→M2→M3)

- M0 Planning (R4 BLOCKING no src edits): critic checks prompt_draft sections + file:line >0 + hardcode/config/VITE_AI counts>0, research deltas exist 3+ files spec-miner 3, PROJECT.md delta 129 lines addendum, TEST_INFRA.md delta, plan.md DAG M0→M1→M2→M3 ownership disjoint isolated worktrees, git diff --stat only .teamwork, stat mtime ordering plan before src edits, state.json timestamps ordering, grep gates research file:line>0, hardcode>0 configurable>0 VITE_AI>0, no src edit gate 0; challenger edge no src mutation, ensures plan DAG dependencies topological, ownership detectConflicts 0, spawn budget <16, dead-man armed; auditor rebuilds + regreps no-hardcode initial 0 in src (already), Settings green field, env-config example, + re-captures not needed for M0 but verifies artifacts exist
- M1 Intelligence Core (R1 extraction, generic configurable): critic checks generic AI client wrapper src/core/ai/** reads import.meta.env VITE_AI_* OR SettingsStore generic precedence not literals, vision multimodal src still 0 today → >=1 after, structured-generic >=1, bbox removal 0, configurable-read >=1, no-hardcode-provider 0, all OCR via AI gate 0 for images, lint0 test172 runner231 build1660 still PASS, demo probe Fact[] mixed categories grounded bbox ≠0.08 via vision-multimodal.log + structured-outputs.log; challenger edge image slip data URL single request not two, text PDF fallback, timeout 30000, invalid baseURL handling, key absent fallback to rule for text, patient isolation preserved; auditor rebuilds + regreps vision/structured/configurable + re-captures 1280/375/768 vision-upload JFIF>5K + 6 viewports no gaps
- M2 Propagation (R2 every branch replaced + cross-field): critic checks every hardcoded branch replaced via no-hardcode-branches.log 0, cross-field probe npx tsx cross-field-probe.ts → CROSS_FIELD PASS + UI navigate vault→pillmap→labStory→rxBridge→dossier without reload 6-viewport screenshots, patient isolation ''0 test-patient>0 patient-s-devi0, approval semantics unconfirmed not propagate confirmed propagate rejected never, lint0 test172 runner231 build1660; challenger edge duplicate questionBank dedup, dueCards idempotent, dangerReports not spurious, rapid 10 adds, irrelevant events not spurious; auditor rebuilds + regreps + re-captures + 6 viewports
- M3 Hardening & Verification (R1+R2+R3 + no regression + no hardcoding): critic checks generic wiring Settings>env via grep VITE_AI src >=1 configurable-read PASS settings-config.log PASS, no secret committed git ls-files sk- 0 .gitignore .env, opencode.json configurable baseURL not forced, lint0 build1660 test172 runner231 getTools40, patient isolation, approval, 6-viewport intelligence + webmcp; challenger adversarial hardcoded literal injection attempt, cross-patient leak attempt, image vs text fallback boundary; auditor full lint/test/build/runner + grep + screenshot audit + native probe + 6 viewports + cross-field + isolation + approval before PASS
- Gates track in GATE_STATUS.md per milestone critic|challenger|auditor PASS/FAIL with evidence paths + logs /tmp/*.log + .teamwork/verification/*.log + snapshots JFIF>5K
- Success Auditor final: independent lint/test/build/grep (registerTool delegation, inputSchema, toolchange, legacy globals 0, isSecureContext, permissionsPolicy, allSettled, AbortController) + no-hardcode-provider 0 + configurable-read >=1 + vision multimodal >=1 + structured >=1 + cross-field CROSS_FIELD PASS + patient isolation + approval + live dev-server probe await getTools 40 inputSchema 40 toolchange 44 DOMString 932 patientId probe-patient-001 + 6-viewport screenshots ≥2 per milestone desktop1280+mobile375+tablet768 under .teamwork/snapshots/intelligence/ JFIF >5K + verification logs env-config/no-hardcode-provider/configurable-read/vision-multimodal/structured-generic/no-hardcode-bbox/no-hardcode-ocr/no-hardcode-branches/cross-field/settings-config/planning-gate/final.md + 40 tools hidden + Flows A-E — must PASS before Sentinel Done Ralph Loop max3

## Affected Files (test infra — intelligence extended)

- package.json, vite.config.ts, tailwind.config.js, tsconfig.json, test/test-runner.ts, test/setup.ts, test/unit/WebMCPEngine.test.ts, test/tier3-integration/*, src/core/webmcp/WebMCPEngine.ts, src/types/webmcp.ts, src/tools/index.ts + 7 modules, src/main.tsx, src/components/common/WebMCPInspector.tsx + ConnectWebMCPModal.tsx, src/core/vault/LocalVault.ts, src/core/events/eventBus.ts, verification logs, snapshots, plus new src/core/ai/**, src/core/settings/**, src/components/settings/**, src/tools/vaultTools.ts etc hardened, .teamwork/verification/env-config.log + no-hardcode-provider.log + vision-multimodal.log + structured-generic.log + cross-field.log + settings-config.log + planning-gate.log
