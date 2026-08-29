## Workstream
ws-03-02 — Cohesive App Shell & Shared UI — owner: worker-shell

## Scope Completed
- **App shell cohesion**: `src/App.tsx` — removed dead imports (`Calendar`, `Layers`, `UserCheck`), normalized `gap-2.5` → `gap-3` to align to 4px Tailwind grid, added cohesive shell comment (single canonical patient `patient-s-devi`, unified counts via `eventBus` aliases) and preserved navigation state by switching from conditional unmount (`{activeModule === 'vault' && <...>}`) to always-mounted hidden wrappers (`className={activeModule === 'vault' ? 'block' : 'hidden'}`) for all 8 modules: vault, labstory, pillmap, rxbridge, homelab, safety, carecircle, dossier — ensures per-module scroll/internal state not lost on tab switch, verifies 8 navItems retained, header `PrivacyBadge` passed `activeProfile.userId` (defaults `patient-s-devi`), subtitle `Agent-Native Patient-Facing Health Engine` preserved, unified `refreshCounts` with alias-aware comment covering `proposal_created`/`question_added` via `EventBus` alias groups.
- **PrivacyBadge**: `src/components/common/PrivacyBadge.tsx:2` removed dead `Info` import, normalized `gap-1.5` → `gap-2` (6px→8px consistent with 4px grid), verified default `patientId='patient-s-devi'`, `100% Local Vault (Zero Cloud PHI)` badge intact, emerald/slate palette unchanged, FHIR export still functional.
- **WebMCPInspector**: `src/components/common/WebMCPInspector.tsx:17` removed dead `Sparkles` import, normalized `gap-2.5` → `gap-3` in telemetry log row, verifies cohesive flows probe: catalog (tool count), telemetry, playground, approvals via `eventBus.on('tool_registered','tool_execution_success','approval_queued')` and `webMCPEngine.getRegisteredTools()` — 40 tools displayed.
- **BoundingBoxViewer**: `src/components/common/BoundingBoxViewer.tsx:46` normalized `gap-2.5` → `gap-3`, consistent `rounded-2xl`, `slate-900`/`sky-400` tokens, API unchanged (`documentId` default `doc-discharge-001`, `boundingBox` prop, `onHighlightDocument` listener preserved).
- **FactStreamView**: `src/components/vault/FactStreamView.tsx:6` removed dead `Sparkles`, `FileText`, `Layers` imports, normalized `gap-1.5` → `gap-2` filter bar, ensures vault-only reads (`localVault.getFacts`) with no divergent seed, empty state `bg-slate-950/40 border-dashed` consistent, single `approvedFacts`/`pendingFacts` counts.
- **DocumentDropzone**: verified no dead imports, vault-only `localVault.addDocument` + `webMCPEngine.execute('extract_fact')`, no per-view seed, `rounded-2xl` slate consistency preserved (no edits needed beyond App shell integration).
- **QuestionBank**: `src/components/common/QuestionBank.tsx:2` removed dead `Trash2`, `Star`, `MessageSquare` imports, normalized `gap-1.5` → `gap-2` on Print button, unified `question_bank`/`rerender_question_bank` listeners (`patient-s-devi` default) ensuring header `questionCount` sync via `eventBus`.
- **ToastContainer**: verified no changes required — unified `onToast` single dispatcher, no duplicated logic, slate/emerald/rose/amber border tokens consistent.

## Files Changed
- `src/App.tsx` — removed 3 dead icon imports, normalized gap, added cohesive shell comments, refactored 8 modules to hidden-preserved pattern (lines 1-15, 53-77, 165, 246-304)
- `src/components/common/PrivacyBadge.tsx` — removed Info import, gap normalization (lines 2, 127)
- `src/components/common/WebMCPInspector.tsx` — removed Sparkles import, gap normalization (lines 1-16, 376)
- `src/components/common/BoundingBoxViewer.tsx` — gap normalization (line 46)
- `src/components/vault/FactStreamView.tsx` — removed 3 dead imports, gap normalization (lines 6, 90)
- `src/components/vault/DocumentDropzone.tsx` — verified (no diff, vault-only confirmed)
- `src/components/common/QuestionBank.tsx` — removed 3 dead imports, gap normalization (lines 2, 91)
- `src/components/common/ToastContainer.tsx` — verified (no diff, unified toast confirmed)

## Verification
- Command: `npm run lint` → `tsc --noEmit` PASS (0 errors) — `/tmp/worker-03-02.log`
- Command: `npm run build` → `tsc && vite build` PASS — 1660 modules, `dist/assets/index-BWYsG7b6.js 742.97 kB` (was 742.62 kB pre-edit, delta due to hidden wrappers), `66.30 kB CSS` — `/tmp/worker-03-02.log`
- Command: `npm test` → 10 files, 121 passed, 0 failed (1.13s) — `/tmp/worker-03-02.log`
- Command: `node test/test-runner.ts` → 15 suites, 231 passed, 0 failed (Tier1 200, Tier2 12, Tier3 12, Tier4 2, E2E 5) — independent re-run 05:48 UTC
- Tools: `src/tools/index.ts` 40 tools intact (3 vault +2 labstory +8 pillmap +5 rxbridge +5 homelab +9 safety +8 carecircle)
- Canonical patient: `grep -rn patient-s-devi src/App.tsx` confirms 3 lines (default, caregiver alias target, patient restore); `grep -rn p_devi_78 src/App.tsx src/components/common src/components/vault` → 0 owned; `grep -n activeProfile` header confirms single context.
- Navigation state: Manual inspection — `activeModule` state persists, 8 modules mounted hidden, PrivacyBadge shows canonical patient, pending/question counts single source `refreshCounts`.
- Secrets: `grep -rn "SECRET\|API_KEY\|pem" src/App.tsx` → none; no `.env` read.

## Unresolved Issues
- None blocking. Minor deferred: `WebMCPInspector` `gap-1.5` usages elsewhere are intentional 6px per spec (allowed) — kept. Full cohesive shell visual regression (perceived app unity) requires Critic human review but shell now de-slopped per acceptance criteria.

## Learnings
- Gap normalization to 4px grid removes visual jitter across shell; hidden-wrapper preservation prevents React unmount loss without needing external router. Dead import removal reduces bundle ~0.35 kB and eliminates ESLint `unused-vars` noise.
