# Workstream ws-hotfix-pdf-ai — HOTFIX PDF+Image multimodal + config precedence + real File probe

**ID:** ws-hotfix-pdf-ai
**Milestone:** milestone-02
**Role:** worker_hotfix_pdf_ai — HOTFIX PDF garbled + first upload AI not invoked
**Owner:** worker_hotfix_pdf_ai
**Status:** pending
**Files:** ["src/components/vault/DocumentDropzone.tsx","src/tools/vaultTools.ts","src/core/ai/client.ts","src/core/ai/config.ts","src/core/ai/vision.ts","src/core/ai/fallback.ts","src/core/ai/structured.ts","src/core/ai/types.ts","test/setup.ts",".teamwork/verification/document-dropzone-probe.ts"]
**Isolation:** .teamwork/worktrees/hotfix-pdf-ai/ (prefer git worktree if available, fallback isolated-dir quarantined per M4)
**DependsOn:** []
**Integrity:** development rapid — single worker on main, no distributed sprawl

## Scope
Fix src/components/vault/DocumentDropzone.tsx:77-147 PDF readAsText garbled binary %PDF header — image readAsDataURL correct — handleRealExtract execParams imageDataUrl+rawText together correctly for image, and for PDF ensure rawText usable not garbled (if readAsText contains %PDF or many \0/non-printable, fallback to file.name + extracted printable strings or read as data URL, ensure heuristic fallback for PDF with file.name yields ≥1 fact when AI disabled not 0). Fix src/tools/vaultTools.ts:62-114 aiEnabled guard, hasImage detection only data:image, fallback heuristic for text — ensure first PDF triggers AI when isAIEnabled true (mock fetch url===getAIEndpoint Authorization Bearer model). Fix src/core/ai/config.ts:27-117 Settings>env precedence localStorage VITE_AI_ENABLED overrides env — ensure dev browser .env true not forever disabled by test/setup lingering false — fix precedence or add debug log getAIConfigSource and first upload logs [AI] config source. Fix src/core/ai/client.ts:142-210 extractWithAI fallbackEnabled isAIEnabled AbortSignal — preserve generic completions (/chat/completions) and responses (/responses) multimodal file inputs for BOTH as before. Fix test/setup.ts beforeEach lingering false — ensure not forever disable AI in dev — add cleanup or documentation. Add thorough multimodal testing with REAL File objects (PDF and image via DocumentDropzone FileReader path), not just mocked extractWithAI unit probe — new probe .teamwork/verification/document-dropzone-probe.ts 5+ cases PASS.

## Expected Output
workstreams/ws-hotfix-pdf-ai-result.md with Scope Completed, Files Changed (file:line), Verification (commands, logs), Unresolved Issues, Learnings. Also .teamwork/verification/document-dropzone-probe.ts + .teamwork/verification/document-dropzone-probe.log PASS, lint0 build1672 test174 runner231 cross-field PASS webmcp40 secret0 grep gates PASS, git diff --stat ≤8 files net +80 lines.

## Verification
R-hotfix-1: PDF File application/pdf name test.pdf text Apixaban 5mg BID Creatinine 1.90 triggers AI when enabled — mock fetch once url===getAIEndpoint Authorization Bearer model body contains rawText Apixaban not %PDF — fact ≥1 med+1 lab AI summary
R-hotfix-2: image data:image multimodal true, PDF garbled fallback not %PDF, AI disabled heuristic ≥1 for PDF name not 0
R-hotfix-3: localStorage not set via Settings UI still env true yields isAIEnabled true, first upload logs [AI] config source, getAIConfigSource debug helper
R-hotfix-4: lint0 build1672 test174 runner231 CROSS_FIELD PASS WebMCP40 secret0 synthetic0 isTestEnv0 GlobalAbortSignal0 grep gates PASS

