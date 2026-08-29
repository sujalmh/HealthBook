# Request — Remove AI Slop & Rewrite to Direct Functional Voice

## Objective
> **Verbatim user instruction (preserved):**
> ```
> 1 .Remove ai slop artifacts like 🔒 Private on your device, Local Vault (Zero Cloud PHI), Weekly pill box, etc. These pills serve no use, redundant. FInd more to remove.
> 2. Rewrite from 1st person 'we' to Direct function, instead "Drop a PDF or photo — we read it safely on your device, nothing leaves it." write " Drop a PDF or photo to get details or something like that, rewrite in entire website.
> ```

**Interpreted intent:**

Two-part language + UI cleanup across CareCanvas (React 18 + Tailwind 3.x, Vite 6, 8 modules: vault/My Records, labstory/Lab Results, pillmap/My Medicines, rxbridge/Medicine Review, homelab/Tests to Do, safety/Get Help, carecircle/Family, dossier/For My Doctor + shell `src/App.tsx` + common `PrivacyBadge/QuestionBank/WebMCPInspector/Toast/BoundingBoxViewer`):

1. **Remove AI-slop redundant pills/badges/labels** that repeat "private / local vault / zero cloud" marketing or serve no functional use. Known targets to delete or replace with functional equivalents:
   - `🔒 Private on your device` pill in `src/components/vault/DocumentDropzone.tsx:84`
   - `Local Vault (Zero Cloud PHI)` pill + `Zero-Cloud PHI Invariant` modal title + `aria-label="Zero-Cloud PHI Invariant"` + modal content `100% Client-Side In-Browser Execution` paragraph in `src/components/common/PrivacyBadge.tsx:93,102,114,128-134`
   - `Weekly pill box` label in `src/components/pillmap/PillMapView.tsx:460` (redundant heading; keep functional grid itself, drop decorative label) + `Interactive 7x4 Weekly Pillbox Grid` comment `635`
   - Find more slop: audit entire `src/` for decorative/seo fluff that duplicates function (e.g., `Private & Secure` chip `src/App.tsx:157` is functional status — keep but ensure not redundant; `Your health, all in one place` subtitle is okay if not over-claiming; but pills like `Local Vault`, `Zero Cloud PHI`, `🔒 Private`, `Weekly pill box` are redundant). Workers must `grep -R` for patterns: `Private on your device|Local Vault|Zero Cloud|Zero-Cloud|Weekly pill|pill box|on your device|safely on your device|100% Client-Side` and evaluate each hit for removal/simplification to functional language. Do NOT remove functional controls (buttons, grids, stats). Replace where needed with direct functional label (e.g., pill headings become "Your medicines for the week" already exists — keep; remove extra "Weekly pill box" heading above it).

2. **Rewrite from 1st-person 'we' to direct functional imperative** across entire website. Replace all user-facing copy containing `we / we're / we'll / we've / our / us` with direct second-person or imperative functional description. Canonical example: `src/components/vault/DocumentDropzone.tsx:79` `Drop a PDF or photo — we read it safely on your device, nothing leaves it.` → `Drop a PDF or photo to extract details` (or similar direct, e.g., `Drop a PDF or photo to extract medicines and labs`). Other confirmed hits to rewrite:
   - `src/components/vault/DocumentDropzone.tsx:125` `We'll pull out the important details for you to review` → `Important details appear for review`
   - `src/components/common/QuestionBank.tsx:186` `Add one above for your next visit — we'll keep it safe here.` → `Add one above for your next visit.`
   - `src/components/vault/FactStreamView.tsx:68` `Review what we found ({n})` → `Review extracted details ({n})` (already heading is `Review what we found` — change to `Review extracted details`)
   - `src/components/vault/FactStreamView.tsx:71` `We pulled these details from your document. Check them before they update your medicines and labs.` → `Details extracted from your document. Check before they update medicines and labs.`
   - Search and fix ALL other `src/components/**` hits; keep tool-generated doctor questions (`src/tools/**`, `src/core/knowledge/**`) as they are doctor-facing templates containing "we" intentionally — those are out of scope unless clearly user-facing slop. Limit rewrite scope to `src/components/**` + `src/App.tsx` (subtitle, toasts) for user-visible copy. Ensure `grep -Rn "\bwe\b|\bwe're\b|\bwe'll\b|\bWe\b" src/components` → 0 after fix (allow `weekly` etc. but not pronoun `we` as separate word; exception `Weekly` is not `we`).

Must preserve prior hardening: single canonical patient `patient-s-devi` `seed.ts` + `main.tsx` bootstrap, Supabase env-gated hydration, typed EventBus relevance matrix, 40 WebMCP tools, 1663 modules build, 74 live screenshots discipline. No backend logic change, only copy/label removal + rewrite. Live screenshots mandatory (browser.open/snapshot/capture at 1280/375/768) before/after.

## Constraints
- Use Antigravity Distributed Coding pattern (Sentinel → Orchestrator → Explorer/Workers → Critic → Challenger → Auditor → Success Auditor) per `teamwork/patterns/distributed-coding/pattern.json`
- Preserve OpenCode + Teamwork engine invariants: explicit per-workstream file ownership (no overlapping globs), DAG scheduling, isolated `.teamwork/worktrees/<ws>`, `state.json`+`progress.md` persistence, dispatch-only Sentinel/Orchestrator
- Do NOT read secrets (`.env`, `*.pem`, `credentials/**`) — use `import.meta.env` indirection only
- Do NOT regress cohesion: `grep -rn "p_devi_78" src` 0, `grep seedBaselineRegimen src` 0, `App.tsx` hidden wrappers `activeModule==='...'?'block':'hidden'` 8 intact, EventBus typed matrix preserved, `src/core/vault/*` + `src/core/supabase/*` untouched except allowed styling/copy hooks, 40 tools intact
- UI stack: React 18 + Tailwind 3.x only, no new framework. Extend tokens only if needed; primary work is text/label removal and copy rewrite
- Copy constraint: no first-person plural in `src/components/**` + `src/App.tsx` user-facing strings after fix; grep for `\bwe\b` case-insensitive as whole word must be 0 (except `weekly` etc. — word-boundary check). Tool templates in `src/tools/**` excluded
- Slop removal constraint: deleted pills must not leave empty gaps or broken layout — keep functional containers, adjust padding/gap if needed, keep screenshots clean
- Live screenshot discipline: every worker must capture at least 2 captures (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` before/after or final, auditor re-captures independently. Image input available.
- Keep functional status where needed: if `PrivacyBadge` pill is removed, keep badge stats/modal but retitle to functional `Local data` or remove redundant marketing sentence; do not delete entire file's functionality (FHIR export, stats counts).
- Vercel deployment must still build: `npm run build` 1663 modules

## Acceptance Criteria
- [ ] **Request artifact preserved** verbatim before Orchestrator start — this file at `.teamwork/request.md`
- [ ] **State initialized** via `TeamworkEngine.initProject` with new `teamwork-*` projectId for slop cleanup (prior `teamwork-1787989591222` archived to `/tmp/archive-ui-modern/`) — current `teamwork-1788010057462`
- [ ] **Explorer baseline**: `research/explorer-slop-*.md` documents grep inventory: all `Private on your device` / `Local Vault` / `Zero Cloud` / `Weekly pill` hits with file:line, plus full `we` pronoun inventory in `src/components`, plus before screenshots at 1280/375/768
- [ ] **Slop removal milestone**: at minimum these removed/simplified:
  - `src/components/vault/DocumentDropzone.tsx:84` `🔒 Private on your device` gone
  - `src/components/common/PrivacyBadge.tsx:93` `Local Vault (Zero Cloud PHI)` pill text replaced or removed (functional badge remains but no marketing slop)
  - `src/components/common/PrivacyBadge.tsx:114` `Zero-Cloud PHI Invariant` heading simplified to functional `Local data` or `Data storage` (no PHI marketing)
  - `src/components/pillmap/PillMapView.tsx:460` `Weekly pill box` heading removed (grid `Your medicines for the week` remains as functional heading)
  - All other discovered slop pills with `grep -R "Private & Secure"` evaluated — if redundant decorative pill, remove; if functional status chip, keep minimal (decision documented)
  - `grep -R "Private on your device|Local Vault|Zero-Cloud PHI Invariant|Zero Cloud" src` → 0 hits (except maybe comments/docs if justified) — audited
- [ ] **Voice rewrite milestone**: `src/components/vault/DocumentDropzone.tsx:79` changed to direct functional (e.g., `Drop a PDF or photo to extract details`), `:125` `We'll` removed, `src/components/common/QuestionBank.tsx:186` `we'll` removed, `src/components/vault/FactStreamView.tsx:68,71` `we` removed, plus all other `src/components/**` `we` hits fixed. Verification: `grep -P "\bwe\b" src/components --ignore-case` (word-boundary, not substring) → 0 hits in user-facing `src/components` (allow `weekly` etc. but not pronoun). Document `power` vs `we` split explicitly.
- [ ] **No decorative pill gaps**: layout still clean in screenshots at 320/375/768/1024/1280/1440 — header, DocumentDropzone, PrivacyBadge, PillMap all render without empty pill placeholders or broken gaps
- [ ] **Live screenshots**: every milestone result references ≥2 `browser.capture` (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` plus 768 tablet, auditor re-captures independently. Before/after or final state compared.
- [ ] **No regression**: `grep -rn "p_devi_78" src` 0, `isSupabaseEnabled` in `main.tsx` intact, `wireLocalVaultToEventBus` intact, 40 tools intact, `activeModule ===` 8 wrappers intact, `build` 1663 modules, `dist` built
- [ ] **Tests & build**: `npm run lint` (tsc --noEmit) 0, `npm test` 141+ PASS, `npx tsx test/test-runner.ts` 231 PASS, `npm run build` 1663+ modules — all still PASS after copy changes (copy shouldn't break tests)
- [ ] **Gates**: each milestone `critic → challenger → auditor` PASS with visual review (critic checks slop actually removed + functional voice, challenger tests edge viewports/long text/empty, auditor rebuilds + regreps + re-captures). Final Success Auditor PASS `verification/final.md` with independent dev-server screenshot audit before Done.

## Non-Goals
- Backend / Supabase / LocalVault functional changes — only copy/label removal + rewrite (no new features)
- Heavy redesign beyond slop removal — keep M1-M4 modern tokens/layout intact (only text/pill changes, minor padding adjustments if gaps)
- Tool-generated doctor questions (`src/tools/**` `Should we ...`) — out of scope, keep as is (clinical templates)
- EHR FHIR auto-pull / TrialBridge / Offline PWA / new design system — out of scope
- Reproducing proprietary Antigravity hidden prompts — observable architecture only

## Created
- Timestamp: 2026-08-29T18:58:00Z
- Source input hash: slop-cleanup-direct-voice-20260829
- Pattern: distributed-coding
- Prior project ref: teamwork-1787989591222 (UI modern M1-M4 PASS, 74 snapshots, vercel deployed) — archived to /tmp/archive-ui-modern/
- Engine projectId: teamwork-1788010057462 (generated via TeamworkEngine.initProject)
- Verification: live browser screenshots mandatory; image input available

## Artifact
- Path: /Users/sujal/Projects/proj1/.teamwork/request.md
- Pattern: distributed-coding
