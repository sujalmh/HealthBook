# Milestone-02 HOTFIX — First PDF upload via DocumentDropzone does NOT invoke AI

**ID:** milestone-02
**DependsOn:** ["milestone-01"]
**Status:** in_progress
**Workstreams:** ws-hotfix-pdf-ai (worker_hotfix_pdf_ai) — single iterative hotfix

## Objective
Fix DocumentDropzone PDF readAsText garbled (%PDF binary) so first PDF upload via "Add Your Health Papers Drop a PDF or photo to extract details" DOES invoke AI when isAIEnabled true, and heuristic fallback yields ≥1 staged fact when AI disabled (not 0). Preserve WebMCP40, patient isolation, approval, no secret leak, lint0 build1672 test174 runner231 still PASS. Keep diff small ≤8 files net +80 lines iterative single worker on main, thorough multimodal testing with REAL File objects.

## Scope & Files (ownership per PROJECT.md, no overlap)
- ws-hotfix-pdf-ai: src/components/vault/DocumentDropzone.tsx:77-147 (PDF readAsText garbled, image readAsDataURL correct, handleRealExtract execParams), src/tools/vaultTools.ts:62-114 (aiEnabled guard, hasImage detection only data:image, fallback heuristic for text), src/core/ai/config.ts:27-117 (Settings>env precedence, localStorage VITE_AI_ENABLED overrides env), src/core/ai/client.ts:142-210 (extractWithAI fallbackEnabled, isAIEnabled, AbortSignal), src/core/ai/vision.ts, src/core/ai/fallback.ts, src/core/ai/structured.ts, src/core/ai/types.ts, test/setup.ts, .teamwork/verification/document-dropzone-probe.ts

## Acceptance (hotfix narrow, mechanical)
- [ ] R-hotfix-1 Upload PDF via DocumentDropzone handleFiles (File type application/pdf, name test.pdf with text "Apixaban 5mg BID, Creatinine 1.90 mg/dL") correctly triggers AI path when isAIEnabled true (mock fetch capturing url===getAIEndpoint, Authorization Bearer, model, single multimodal body for PDF? — at least text path via rawText not empty, not garbled %PDF). When AI enabled with mock fetch, extract_fact returns Fact[] with ≥1 med + ≥1 lab from AI mock, not 0, and plainLanguageSummary indicates AI extraction. Reproduce via npx tsx probe that simulates DocumentDropzone FileReader flow for PDF (create File/Blob, read via FileReader in jsdom or via direct call to vaultTools extract_fact with rawText="Apixaban..."), verify AI invoked (fetch called) and staged facts >0.
- [ ] R-hotfix-2 Image/PDF file input via handleRealExtract sends imageDataUrl+rawText together correctly for image, and for PDF ensures rawText is usable text (not garbled binary %PDF header) — fix PDF read: if readAsText result contains %PDF or many \0/non-printable, fallback to file.name + extracted text strings or read as data URL? Ensure heuristic fallback for PDF with file.name also yields ≥1 fact when AI disabled, not 0.
- [ ] R-hotfix-3 isAIEnabled false due to localStorage VITE_AI_ENABLED false lingering from test/setup.ts beforeEach should NOT forever disable AI in dev browser when .env has VITE_AI_ENABLED true — fix precedence or ensure DocumentDropzone path respects .env when SettingsStore not explicitly set via Settings UI (treat localStorage false set by tests as test-only, not persistent in dev? Or add debug log getAIConfigSource). At least add verification that getAIConfig correctly reads VITE_AI_ENABLED via import.meta.env when localStorage not set via Settings UI (not test harness), and that first upload logs [AI] config source.
- [ ] R-hotfix-4 No regression: lint0, build1672, test174, runner231, CROSS_FIELD PASS, WebMCP40, secret0, grep gates synthetic0 isTestEnv0 GlobalAbortSignal0, plus new DocumentDropzone integration test npx tsx .teamwork/verification/document-dropzone-probe.ts PASS.

## Verification Gate
critic(challenger) auditor batched — verify garbled detection, multimodal single body, config precedence, heuristic fallback not 0, lint/build/test/runner/cross-field/webmcp gates

## Ownership
- ws-hotfix-pdf-ai: ["src/components/vault/DocumentDropzone.tsx","src/tools/vaultTools.ts","src/core/ai/client.ts","src/core/ai/config.ts","src/core/ai/vision.ts","src/core/ai/fallback.ts","src/core/ai/structured.ts","src/core/ai/types.ts","test/setup.ts",".teamwork/verification/document-dropzone-probe.ts"] → .teamwork/worktrees/hotfix-pdf-ai/

