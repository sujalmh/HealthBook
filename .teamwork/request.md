# Request — Remove Mock/Stub Data, Real Data with Create Account + WebMCP Chat

## Objective
> **Verbatim user instruction (preserved):**
> ```
> Now remove all mock, stub data. I want to use it with real data. First thing is create account, thats all. then everything works with webmcp, connected to chat apps.
> ```

**Interpreted intent:**

Make CareCanvas production-ready for real user data by **deleting all mock/stub/demo data** and making **Create Account the first-run gate**, after which the existing 40 WebMCP tools work end-to-end on the newly created user's real vault and are discoverable by chat apps via native WebMCP (`modelContext.registerTool`).

Current codebase is demo-seeded: `src/fixtures/*` (`patient_profiles.ts` `mockShantiDeviProfile`, `longitudinal_labs.ts` `mockShantiDeviLongitudinalLabs`, `discharge_lists.ts` `mockShantiDevi3ListDataset`, `documents.ts` `mockDischargeSummaryCardiacWard` etc.), `src/core/vault/seed.ts` `seedIfEmpty(CANONICAL_PATIENT_ID='patient-s-devi')` + `src/main.tsx` bootstrap seeding, `src/components/vault/DocumentDropzone.tsx` `sampleDocuments` array + `handleExtractSample` fake extraction, `src/tools/*` branching on `mock*` fixtures (`vaultTools.ts` returns fixture facts by `documentId`, `labStoryTools.ts` `mockLongitudinalLabs`, `rxBridgeTools.ts` `mockShantiDevi3ListDataset`, `homeLabTools.ts` `mockHomeLabPhotoSlip`), `src/App.tsx` hardcoded `activeProfile {userId:'patient-s-devi', name:'Shanti Devi'}` + proxy switcher, `LocalVault` pre-populated counts, `WebMCPEngine` fallback `mockContext`.

Target behavior:
- **Cold start with no user:** app shows **Create Account** (sign-up / sign-in) as first screen — no vault content, no seeded patient, no sample docs visible until account exists. Account creation generates a real user identity (`userId` uuid or Supabase Auth id, stored in `localStorage` `carecanvas_active_user` + vault scoping). Subsequent launches auto-restore session; sign-out clears.
- **After account:** all 8 modules (`vault`, `labstory`, `pillmap`, `rxbridge`, `homelab`, `safety`, `carecircle`, `dossier`) operate on **real empty vault** (0 facts/meds/labs until user uploads). Empty states are clean functional copy (already direct-voice: `Drop a PDF or photo to extract details` etc.) — no demo cards.
- **Real data path:** `DocumentDropzone` must support **real file drop/paste** (FileReader → `extract_fact` with `rawText` from actual file, not `sampleDocuments` selector). `vaultTools.extractFact` must no longer branch on fixture `documentId`; instead extract from provided `rawText`/`documentId` via real vault write. Other tools must read from `LocalVault` for the `context.patientId` (the created account's id), not from `mock*` fixtures. If a tool needs knowledge, it may keep `drug_knowledge.ts` (clinical knowledge base — not user mock data) but must not auto-populate user data.
- **WebMCP + chat apps:** After account creation, `registerAllWebMCPTools` (40 tools) must be registered on native `modelContext` if present (ChatGPT/Claude WebMCP host), otherwise polyfill `globalThis.modelContext`. Chat apps discover tools via `getRegisteredTools()` and can `executeTool` against the real user's vault. No mock context.

Preserve prior hardening that is not mock: single-patient scoping becomes per-account scoping (`patientId === activeProfile.userId`), EventBus relevance matrix, 40 tool contracts, 1663 modules build discipline, modern tokens, direct functional voice, tailwind-only, live screenshots.

## Constraints
- Use Antigravity Distributed Coding pattern (Sentinel → Orchestrator → Explorer/Workers → Critic → Challenger → Auditor → Success Auditor) per `teamwork/patterns/distributed-coding/pattern.json`
- Preserve OpenCode + Teamwork invariants: explicit per-workstream file ownership (no overlapping globs), DAG, isolated `.teamwork/worktrees/<ws>`, `state.json`+`progress.md` persistence, dispatch-only Sentinel/Orchestrator
- Do NOT read secrets (`.env`, `*.pem`, `credentials/**`) — use `import.meta.env` indirection; account store is localStorage (or Supabase Auth if `VITE_SUPABASE_URL` + anon key present — gracefully fallback to local)
- Do NOT regress M1-M4 UI modern + slop-free direct voice: tokens stay, `🔒 Private` etc. remain removed, `we` pronoun 0 in `src/components`, 40 tools intact, `App.tsx` hidden wrappers `activeModule==='...'?'block':'hidden'` 8 intact, EventBus intact, `src/core/supabase/*` only touched for auth scoping if needed
- Remove **user mock data** only; keep **clinical knowledge base** `src/fixtures/drug_knowledge.ts` and types (`src/types/*`) — that is not user stub data. `src/fixtures/patient_profiles`, `longitudinal_labs`, `discharge_lists`, `documents` are user mocks to be deleted or gated (empty exports or removed). `src/fixtures/index.ts` may be deleted or re-export only knowledge.
- Account-first: unauthenticated `App.tsx` must not render vault grids with seeded data; show `src/components/auth/CreateAccountView.tsx` (or `AuthGate.tsx`) centered modal/card: name, email, password (optional), Create Account button, then Sign In link. Must work at 320/375/768/1024/1280/1440, 44px touch, WCAG AA.
- Real file handling: `DocumentDropzone` must hide `sampleDocuments` selector (delete array + `selectedSample` + `handleExtractSample` demo path) and implement `onDrop` + `<input type=file>` + FileReader → `localVault.addDocument` + `webMCPEngine.execute('extract_fact', {documentId, rawText})` with real content. Show functional empty state only.
- Live screenshot discipline: every worker ≥2 captures (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` plus 768, auditor re-captures independently. Image input available.
- Performance: no jank, build 1663 modules, CSS gz <50KB, vault empty still responsive.

## Acceptance Criteria
- [ ] **Request artifact preserved** verbatim before Orchestrator start — this file at `.teamwork/request.md`
- [ ] **State initialized** via `TeamworkEngine.initProject` with new `teamwork-*` projectId for real-data (prior `teamwork-1788010057462` archived to `/tmp/archive-slop/`) — current `teamwork-1788014473534`
- [ ] **Explorer baseline**: `research/explorer-mock-*.md` documents grep inventory: `grep -R "mockShanti\|mockHarold\|mockDischarge\|mockHomeLab\|sampleDocuments\|CANONICAL_PATIENT_ID.*patient-s-devi"` file:line hits across `src/fixtures`, `src/core/vault/seed.ts`, `src/main.tsx`, `src/components/vault/DocumentDropzone.tsx`, `src/tools/*`, plus `patient-s-devi` hardcode count in `src/App.tsx` — and before screenshots 1280/375/768 of seeded demo state (vault with 8 pending facts, pillbox with 7x4 mock meds)
- [ ] **Mock removal milestone**: after fix, `grep -R "mockShantiDeviProfile\|mockShantiDeviLongitudinalLabs\|mockShantiDevi3ListDataset\|mockHaroldJenkins\|mockDischargeSummaryCardiacWard\|mockHomeLabPhotoSlip\|mockNephrologyConsultDocument" src` → 0 hits (except maybe `drug_knowledge` kept — allow `mockBrandGeneric` etc. if documented as knowledge base, but user-mock fixtures 0). `grep -R "sampleDocuments" src` → 0, `grep -R "patient-s-devi" src/components src/App.tsx` → 0 (only `seed.ts` may keep `CANONICAL_PATIENT_ID='patient-s-devi'` as migration fallback if documented, but not used as default activeProfile). `src/fixtures/discharge_lists.ts`, `documents.ts`, `patient_profiles.ts`, `longitudinal_labs.ts` either deleted or emptied (or exports removed) — audited. `src/tools/vaultTools.ts` no longer imports/branches on `mockDischargeSummaryCardiacWard`, `labStoryTools` no longer imports `mockLongitudinalLabs`, `rxBridgeTools` no longer defaults to `mockShantiDevi3ListDataset` — all read from `context.vault` for `context.patientId` instead.
- [ ] **Create Account milestone**: new `src/components/auth/CreateAccountView.tsx` (or `src/core/auth/*`) implements: name/email/password fields, `Create Account` → generates `userId` (`crypto.randomUUID()` or `supabase.auth.signUp` if env present) + `localStorage.setItem('carecanvas_active_user', JSON.stringify(profile))` + `localVault` scoping + `eventBus.dispatchToast` + navigate to `vault`. `App.tsx` on mount checks `localStorage` — if no user, renders `<CreateAccountView onCreated={setActiveProfile} />` centered (no modules, no `Shanti Devi` hardcoded), else restores `activeProfile`. Sign-out clears storage + vault view. Live screenshots PASS at desktop 1280 + mobile 375 + tablet 768 of Create Account screen (centered card, 44px button, no seeded data visible). `src/App.tsx` hardcoded `userId:'patient-s-devi'` removed — now `userId` comes from auth state only.
- [ ] **Real data + WebMCP milestone**: `DocumentDropzone` real drop works: `grep -R "sampleDocuments" src` 0, instead `onDrop` handler with `FileReader` + `handleRealExtract` verified. `src/tools/vaultTools.ts` `extractFact` no longer returns fixture facts by `documentId` — it stores rawText-derived fact(s) into vault for `context.patientId` and returns success with that `patientId`. After account creation, uploading a real PDF/photo results in a new pending fact visible in `FactStreamView` for that `patientId` (not `patient-s-devi`). `src/core/webmcp/WebMCPEngine.ts` registers 40 tools on `globalThis.modelContext` and is discoverable: `getRegisteredTools().length === 40` via chat-app `executeTool`. Live screenshots of real-data empty vault (0 facts, `Add a document above…` empty state) + after real upload (if feasible in test, at least via `webMCPEngine.execute` in dev console) verified. Chat integration documented.
- [ ] **No empty-pill gaps**: removal of sample selector leaves no collapsed flex gaps; Create Account card centered `max-w-md mx-auto`, DocumentDropzone empty state clean at 320/375/768/1024/1280/1440
- [ ] **Live screenshots**: every milestone result references ≥2 `browser.capture` (desktop 1280 + mobile 375) under `.teamwork/snapshots/<milestone>/` plus 768 tablet, auditor re-captures independently before/after. At least one milestone shows Create Account screen, one shows real empty vault.
- [ ] **No regression**: `grep -rn "p_devi_78" src` 0, `grep seedBaselineRegimen src` 0, `wireLocalVaultToEventBus` intact, EventBus matrix intact, 40 tools intact, hidden wrappers 8 intact, direct voice `we` pronoun 0 in `src/components` intact, slop 0 intact, `App.tsx` header `Private & Secure` etc. intact, `build` 1663 modules, `dist` built
- [ ] **Tests & build**: `npm run lint` 0, `npm test` 141+ PASS, `npx tsx test/test-runner.ts` 231 PASS, `npm run build` 1663+ modules — after mock removal, tests that relied on `mockShantiDeviProfile` must be updated to use real account fixture or local test user, not fail. Drug knowledge tests may still use `mockBrandGeneric` as knowledge base — allowed.
- [ ] **Gates**: each milestone `critic → challenger → auditor` PASS with visual + grep review (critic checks mocks actually removed + account gate works + real data path, challenger tests cold start no user / empty vault / long name / real file drop / chat execute, auditor rebuilds + regreps + re-captures). Final Success Auditor PASS `verification/final.md` with independent dev-server screenshot audit (Create Account + empty vault) before Done.

## Non-Goals
- Full Supabase Auth email verification / OAuth / row-level security — localStorage account is sufficient for first iteration; if Supabase Auth env present, graceful fallback to local, not required to block
- EHR FHIR auto-pull / TrialBridge / Offline PWA / new design system — out of scope (keep existing knowledge engines)
- Proprietary Antigravity hidden prompts — observable architecture only
- Tool doctor templates `Should we ...` in `src/tools/**` — out of scope (clinical phrasing, not user mock)

## Created
- Timestamp: 2026-08-29T20:10:00Z
- Source input hash: real-data-create-account-webmcp-20260829
- Pattern: distributed-coding
- Prior project ref: teamwork-1788010057462 (slop cleanup M1-M2 PASS, 47 JPEG) — archived to /tmp/archive-slop/
- Engine projectId: teamwork-1788014473534 (generated via TeamworkEngine.initProject)
- Verification: live browser screenshots mandatory; image input available

## Artifact
- Path: /Users/sujal/Projects/proj1/.teamwork/request.md
- Pattern: distributed-coding
