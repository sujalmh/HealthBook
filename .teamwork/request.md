# Request — Remove Hard-Coded Hospital/Doctor/Proxy Names Thorough

## Objective
> **Verbatim user instruction (preserved):**
> ```
> Hard coded hospital names, doctor names, hard coded john proxy its mock data remove it. Do thorough check of such things and remove it.
> ```

**Interpreted intent:**

Thoroughly audit `src/` (and `test/` if mirrored) for **hard-coded hospital, doctor, proxy/caregiver, patient demo names** that are mock/stub data and replace with **generic real-data-driven values** derived from `activeProfile`, user input, or vault data. This continues prior mock removal (`mockShantiDevi*` fixtures) but hard-coded display strings remain and must be eliminated.

Confirmed hard-coded hits to remove/replace (grep `src/` 2026-08-29):

- **Hospital / facility:** `ST. JUDE MEDICAL CENTER` (`src/components/common/BoundingBoxViewer.tsx:118`), `Inpatient Discharge Summary & Transition Record` (`119`), `Metropolis Healthcare` (`src/core/vault/seed.ts:116`, `src/components/homelab/UploadLabModal.tsx:205,236`, `src/components/safety/SafetyView.tsx` view header, `DueCardList` provider fallback), `St. John's Wort` is drug name — keep (knowledge base).
- **Doctor names:** `Dr. Anita Patel, MD (Nephrology)` (`seed.ts:55,66,103`, `MedOverlayBands.tsx:54`, `LabStoryView.tsx:164` fallback, `ProposalCard.tsx:212`, `DoctorInbox.tsx:67,108`, `DueCardList.tsx:155` fallback `Prescribed by Dr. Anita...`, `FollowupScheduler.tsx:36` initial `providerName` state, `Safety`/`Triage`/`DoctorInbox`/`DangerSignModal` many `Dr. A. Patel, MD` (`homeLabTools.ts:241,304`, `safetyTools.ts:100,139,149,183,203,248,383,387,438,482`, `TriagePanel.tsx:47,63,73,98,134`), `Dossier`/`SourceLinkViewer` `Dr. A. Patel, MD, FACC` (`335`), `EmergencySnapshotCard.tsx:167` `Dr. Anita Patel, MD (Cardiology)`, `WebMCPInspector` `Dr. Patel Nephrology Clinic Review` (`149`), `ReconciliationWalk` placeholder `Remember to ask Dr. Patel...` (`349`).
- **Proxy / caregiver hard-codes:** `Raj Devi` (son) (`src/App.tsx:149,165`, `ScopedPermissionsModal.tsx:63,80,211`, `EmergencySnapshotCard.tsx:160` `name: 'Raj Devi'`), `Aarav Sharma` (child) (`App.tsx:169,176`), proxy switcher `Raj` label + `aria-label="Switch to Raj proxy"` (`App.tsx:315,317`), `CaregiverSwitcher` generic fallback still uses `Raj Devi` in demo links. The user says "hard coded john proxy" — interpret as any hard-coded proxy name like `Raj Devi`/`Aarav Sharma` must become generic: use `activeProfile.name` / `activeProfile.onBehalfOf` or input, not literal `Raj Devi`.
- **Patient demo remnants:** `Shanti Devi`, `Harold Jenkins`, `Aarav Sharma` already removed from `App.tsx` activeProfile default (now `null` gate), but still appear in `EmergencySnapshotCard` contacts, `SourceLinkViewer`, `seed.ts` narrative, and tools comments — those must be checked. Keep comments that say "no hardcoded Shanti" (they are docs), but remove actual hard-coded patient names in UI strings if any remain.
- **Find more:** workers must `grep -R -i -E "St\. Jude|ST\. JUDE|Metropolis|Patel|Anita Patel|Dr\. A\. Patel|Dr\. Anita|Raj Devi|Aarav Sharma|Aarav|Shanti|Harold Jenkins|John.*proxy|proxy.*John"` across `src/` and evaluate each hit: if hit is in `drug_knowledge.ts` clinical guidance mentioning a drug name (`St. John's Wort` is drug — keep), else hospital/doctor/patient/proxy display string → replace with generic (`Your hospital`, `Your doctor`, `Family member`, `Child`, `Parent`) or vault-derived (`activeProfile.name`, `proposal.doctorName` with fallback `Your doctor`, `vault.getDoctor`).

After fix: cold-start empty vault must show no hospital/doctor names until user adds real data or creates a doctor entry. Create Account gate already shows no `Shanti`; proxy switcher after account should show generic initials from `activeProfile.name` not `Raj Devi` literal. BoundingBoxViewer with no document must show `No document selected` only, not `ST. JUDE`.

Preserve prior hardening: real-data empty vault, Create Account email/password required + Sign In form + auto sign-in via `carecanvas_active_user` token, 40 WebMCP tools, 1660 modules build, tokens/direct voice, live screenshots.

## Constraints
- Use Antigravity Distributed Coding pattern (Sentinel → Orchestrator → Explorer/Workers → Critic → Challenger → Auditor → Success Auditor) per `teamwork/patterns/distributed-coding/pattern.json`
- Preserve OpenCode + Teamwork invariants: explicit per-workstream file ownership (no overlapping globs), DAG, isolated `.teamwork/worktrees/<ws>`, `state.json`+`progress.md` persistence, dispatch-only Sentinel/Orchestrator
- Do NOT read secrets (`.env`, `*.pem`, `credentials/**`) — `import.meta.env` indirection only
- Do NOT regress: real-data gate (CreateAccountView email/password required, SignInView email/password required, auto sign-in via token) must stay intact; `we` pronoun 0 in `src/components`, slop 0, 40 tools, hidden wrappers 8, EventBus, build 1660 modules, 6-viewport responsive no gaps
- Remove **display hard-codes only**; keep **clinical knowledge base** (`drug_knowledge.ts` 494 lines with `mockBrandGenericCatalog` etc.) and **type definitions** — those are not hospital/doctor display mocks
- Replacement must be generic functional: e.g., `BoundingBoxViewer` header `ST. JUDE MEDICAL CENTER` → `Medical Document` or vault-derived `document.fileName` or `No document selected` title; `Dr. Anita Patel` fallback → `Your doctor` or `proposal.doctorName || Your doctor` or `activeProfile.name` if doctor role; `Raj Devi` proxy → `activeProfile.name` or `Family member` placeholder; never leave empty pill gaps
- Live screenshot discipline: every worker ≥2 captures (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` plus 768 tablet, auditor re-captures independently. Image input available.
- Thorough check: Explorer must grep full list above plus case-insensitive scan for `hospital|clinic|medical center|doctor|Dr\.|Patel|Metropolis|Raj|Aarav|Shanti|Harold|John` in `src/` and document each hit as keep vs remove with rationale

## Acceptance Criteria
- [ ] **Request artifact preserved** verbatim before Orchestrator start — this file at `.teamwork/request.md`
- [ ] **State initialized** via `TeamworkEngine.initProject` with new `teamwork-*` projectId for hard-coded names cleanup (prior `teamwork-1788014473534` archived to `/tmp/archive-realdata/`) — current `teamwork-1788021761432`
- [ ] **Explorer baseline**: `research/explorer-hardcoded-*.md` documents full grep inventory of hard-coded hospital/doctor/proxy names with file:line, count per pattern, rationale keep/remove, plus before screenshots 1280/375/768 showing hard-coded names in BoundingBoxViewer (`ST. JUDE`), `CreateAccount` not, but `My Medicines`/`Lab Results` etc. if hard-coded doctor appears on empty vault
- [ ] **Hospital names removal**: `grep -R "ST\. JUDE\|ST JUDE\|Metropolis Healthcare" src` → 0 hits (except `ST. JUDE` in comment if justified, but display header at `BoundingBoxViewer.tsx:118` replaced). `BoundingBoxViewer.tsx:118` now generic `Medical Document` or `No document selected` header, not `ST. JUDE`. `seed.ts:116` `Metropolis Healthcare` fallback removed or made generic `Healthcare provider` or removed (seed is no-op anyway). `UploadLabModal.tsx:205,236` `Metropolis` removed. Live screenshots after fix show BoundingBoxViewer header generic.
- [ ] **Doctor names removal**: `grep -R "Dr\. Anita Patel\|Dr\. A\. Patel\|Dr\. Patel" src/components src/App.tsx src/core` → 0 hits in user-facing display code (tools fallback `doctorName: params.doctorName || 'Dr. A. Patel'` → must become `|| ''` or `|| 'Your doctor'` or `|| activeProfile.name`; allow `Dr. A. Patel` only inside `drug_knowledge` comments if any, but not in `src/components/**` default display). All `src/components/**` files verified: `LabStoryView.tsx:164` fallback now generic, `ProposalCard.tsx:212` fallback generic, `DueCardList.tsx:155` fallback generic, `FollowupScheduler.tsx:36` initial state generic/empty, `TriagePanel/DangerSignModal/SafetyView/DoctorInbox` no `Dr. Patel` literal in JSX, `EmergencySnapshotCard.tsx:167` now `Your doctor` or vault-derived, `SourceLinkViewer.tsx:335` generic, `WebMCPInspector.tsx:149` generic title. Tools fallback replaced: `homeLabTools.ts:241,304` `|| 'Your doctor'` etc. Verified via grep word-boundary.
- [ ] **Proxy names removal**: `grep -R "Raj Devi\|Aarav Sharma" src` → 0 hits (except maybe test fixtures legacyMocks allowed). `src/App.tsx:149,165` `name: 'Raj Devi'` removed → generic `activeProfile.name` or `Family member`; `315` `aria-label="Switch to Raj proxy"` → `Switch to proxy` generic or `Switch to ${patientShort} proxy`; `317` `Raj` label → generic `Proxy` or `Family`; `EmergencySnapshotCard.tsx:160` `Raj Devi` contact → generic `Family contact` or vault-derived `activeProfile.onBehalfOf`; `ScopedPermissionsModal.tsx:63,80,211` `Raj Devi` → generic `Family member` or `link.caregiverName || 'Family member'`. Thorough check includes `grep -R -i "john" src` → document if any `John` proxy found and removed (currently none, but search must be done).
- [ ] **No hard-coded patient demo names in UI**: `grep -R "Shanti Devi\|Harold Jenkins\|Aarav Sharma" src/components src/App.tsx` → 0 hits (comments in tools that say "no hardcoded Shanti" are allowed as docs, not display). Verified via grep.
- [ ] **Functional generic replacements**: all removed strings replaced with vault-derived or generic placeholder that still renders clean layout (no empty pills/gaps) at 320/375/768/1024/1280/1440 — verified via screenshots at 6 viewports, no broken gaps where hospital/doctor name was
- [ ] **Live screenshots**: every milestone result references ≥2 `browser.capture` (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` plus 768 tablet, auditor re-captures independently before/after. At least one milestone shows Create Account gate still required, one shows vault empty with generic headers (no ST. JUDE)
- [ ] **No regression**: `grep -rn "p_devi_78" src` 0, `grep -R "mockShanti" src` 0, `sampleDocuments` 0, `we` pronoun 0 in `src/components`, slop 0, 40 tools intact, hidden wrappers 8 intact, Create Account email/password required still required, Sign In email/password required still required, auto sign-in via `carecanvas_active_user` still works, `build` 1660 modules, `dist` built
- [ ] **Tests & build**: `npm run lint` 0, `npm test` 142+ PASS, `npx tsx test/test-runner.ts` 231 PASS, `npm run build` 1660+ modules — tests that referenced `Raj Devi`/`Aarav`/`Patel` must be updated to generic or vault-derived fixtures, not fail
- [ ] **Gates**: each milestone `critic → challenger → auditor` PASS with visual + grep review (critic checks hard-codes actually removed + generic replacements functional, challenger tests cold start empty, proxy switch no hard-code, long hospital name overflow, auditor rebuilds + regreps + re-captures). Final Success Auditor PASS `verification/final.md` with independent dev-server screenshot audit before Done.

## Non-Goals
- Backend Supabase Auth email verification / OAuth / RLS — keep localStorage `carecanvas_active_user` gate as is (email/password required already)
- EHR FHIR auto-pull / TrialBridge / Offline PWA / new design system — out of scope
- Proprietary Antigravity hidden prompts — observable architecture only
- Tool doctor templates `Should we ...` (clinical phrasing) — out of scope

## Created
- Timestamp: 2026-08-29T22:45:00Z
- Source input hash: hardcoded-names-cleanup-20260829
- Pattern: distributed-coding
- Prior project ref: teamwork-1788014473534 (real-data M1-M3 PASS, Create Account gate) — archived to /tmp/archive-realdata/
- Engine projectId: teamwork-1788021761432 (generated via TeamworkEngine.initProject)
- Verification: live browser screenshots mandatory; image input available

## Artifact
- Path: /Users/sujal/Projects/proj1/.teamwork/request.md
- Pattern: distributed-coding
