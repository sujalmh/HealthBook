# Request — Modern Professional Intuitive UI

## Objective
> **Verbatim user instruction (preserved):**
> ```
> Make the UI modern professional and intuitive. Always use live screenshots to verify, you have image input.
> ```

**Interpreted intent:**

Transform CareCanvas from a functional health vault into a modern, professional, and intuitive application that feels like a polished consumer/production health product (e.g., Apple Health, Linear, Stripe Dashboard, Notion). Every view must be visually cohesive, typographically refined, and self-explanatory without training. Navigation must be obvious, information hierarchy clear, and interactions delightful yet clinical-appropriate. **Live screenshot verification is mandatory** — workers must run `npm run dev` (Vite) and use the OpenChamber browser tool (`browser.open`, `browser.snapshot`, `browser.capture`) to capture real rendered output at mobile (375px), tablet (768px), and desktop (1280px) before and after changes. Image input is available to reviewers for visual critique.

Scope covers the shell + all 8 modules: `vault` (My Records), `labstory` (Lab Results), `pillmap` (My Medicines), `rxbridge` (Medicine Review), `homelab` (Tests to Do), `safety` (Get Help), `carecircle` (Family), `dossier` (For My Doctor), plus common components (Header, Navigation, PrivacyBadge, Toast, QuestionBank, WebMCPInspector, Bottom Nav, Cards, Modals).

Must preserve all functional hardening from prior milestones: single canonical patient `patient-s-devi` with `seed.ts` + `main.tsx` bootstrap, Supabase env-gated `client.ts`/`supabaseSync.ts` hydration (never re-introduce `baqduk` hardcode), typed `EventBus` relevance matrix, 40 WebMCP tools, 1660+ modules build.

## Constraints
- Use Antigravity Distributed Coding pattern (Sentinel → Orchestrator → Explorer/Workers → Critic → Challenger → Auditor → Success Auditor) per `teamwork/patterns/distributed-coding/pattern.json`
- Preserve OpenCode + Teamwork engine invariants: explicit per-workstream file ownership (no overlapping globs), DAG scheduling, isolated `.teamwork/worktrees/<ws-id>/` scratch, `state.json`+`progress.md` persistence, dispatch-only Sentinel/Orchestrator
- Do NOT read secrets (`.env`, `*.pem`, `credentials/**`) — use `import.meta.env` indirection only (existing Supabase layer already satisfies)
- Do NOT regress prior cohesion: `grep -rn "p_devi_78" src` must stay 0, `grep seedBaselineRegimen src` 0, `App.tsx` hidden wrappers `when activeModule===` pattern intact, `eventBus` typed matrix preserved, `src/core/vault/*` + `src/core/supabase/*` untouched except for allowed styling hooks
- UI stack: React 18 + Tailwind 3.x only (no new heavy UI framework). Extend `tailwind.config.js` tokens and `src/index.css` — do not eject Vite
- Accessibility: WCAG AA contrast for text, `*:focus-visible` rings already present must be enhanced, 44px touch targets, keyboard-navigable tabs, `aria-label` on icon-only buttons
- Responsiveness: must work at 320px, 375px, 768px, 1024px, 1280px, 1440px. Bottom nav on <768px, top tabs on >=768px — keep existing breakpoint but refine spacing
- Performance: no layout jank; preserve `vite build` baseline (1660+ modules) and keep CSS < 50KB gzipped
- **Live screenshot discipline**: every worker must capture at least one `browser.capture` per milestone (desktop + mobile) and store under `.teamwork/snapshots/<milestone>/` or reference capture path in result.md. Critic/Challenger/Auditor must re-open browser to verify visually, not trust worker summary. `image input` available — reviewers should inspect snapshots for alignment, spacing, typography, color.
- Design tokens must be centralized (no ad-hoc hex sprawl): extend `tailwind.config.js` theme + CSS variables where needed; document usage
- Keep PHI handling: `PrivacyBadge` stays visible (desktop) but can be refined visually — not removed

## Acceptance Criteria
- [ ] **Request artifact preserved** verbatim before Orchestrator start — this file at `.teamwork/request.md`
- [ ] **State initialized** via `TeamworkEngine.initProject` with new `teamwork-*` projectId for UI modernization (previous supabase project archived)
- [ ] **Explorer baseline**: `research/explorer-*.md` documents current visual inventory: screenshots of header/nav/cards/modals at 3 viewports, tailwind token audit (colors, fonts, rounding, shadows), accessibility audit (contrast, focus, touch), and proposes modern design system approach
- [ ] **Design system milestone (M1)**: centralized tokens in `tailwind.config.js` (semantic colors: `canvas.bg`, `canvas.card`, `surface`, `primary`, `muted`, etc.), typography scale (heading/body/caption with Inter/system), spacing 4/8pt grid, rounded `xl`/`2xl`, shadow `sm`/`md`/`lg`, refined `src/index.css` (clean scrollbar, focus, base layer). No hard-coded `#EEF2FF` scattering — tokens used everywhere. `App.tsx` header updated to use tokens.
- [ ] **Shell & Navigation milestone (M2)**: `src/App.tsx` — modern professional header (glass/soft shadow, refined logo, clear subtitle, status chip), desktop tab bar with pill/active states using tokens, mobile bottom nav with proper safe-area, polished profile switcher (S. Devi / Raj), Question/Activity buttons with badge polish, smooth transitions, cohesive spacing. All 8 nav items still route correctly via `activeModule` hidden wrappers (no regression). Live screenshots PASS at desktop + mobile.
- [ ] **Module polish milestone (M3)**: at least 6 representative views polished — `vault` (DocumentDropzone + FactStreamView), `labstory` (BiomarkerChart, StorySentence), `pillmap` (PillCard, PillboxGrid), `homelab` (DueCardList, ProposalCard), `safety` (TriagePanel), `carecircle` (CareCircleView) — with card elevation, consistent padding, empty states, loading skeletons, and improved typography. Remaining modules (`rxbridge`, `dossier`) at least get shell/card token alignment. No functional regression: `localVault` and `eventBus` still wired.
- [ ] **Responsive / Polish milestone (M4)**: `src/index.css` responsive refinements, consistent `max-w-7xl` containers, overflow fixes (`overflow-x-hidden` preserved), Tailwind `scrollbar-none` hidden but accessible, modals (`QuestionBank`, `WebMCPInspector`, `AddMedicationModal`, etc.) visually cohesive. All common components (`PrivacyBadge`, `ToastContainer`, `BoundingBoxViewer`) updated to tokens.
- [ ] **Live screenshot verification**: every milestone result.md references at least 2 `browser.capture` outputs (desktop 1280 + mobile 375) showing before/after or final state. `.teamwork/snapshots/` contains images. Auditor independently re-captures and compares against acceptance (spacing, alignment, typography, color coherence, intuitive hierarchy). No milestone passes without screenshot evidence.
- [ ] **No regression**: `grep -rn "p_devi_78" src` 0, Supabase `isSupabaseEnabled` import still in `main.tsx`, `wireLocalVaultToEventBus` intact, 40 tools in `src/tools/index.ts` still registered, `seedIfEmpty` still canonical.
- [ ] **Tests & build**: `npm run lint` (`tsc --noEmit`) 0 errors, `npm test` 149+ PASS (vitest: unit+integration+tier3 28 cohesion intact), `node test/test-runner.ts` 231 PASS, `npm run build` 1660+ modules, `dist/` built, 40 WebMCP tools intact. No new test failures introduced by UI changes.
- [ ] **Gates**: each milestone `critic → challenger → auditor` PASS with visual review (critic checks design correctness, challenger tests edge viewports/broken states/long text/empty, auditor verifies evidence and rebuilds). Final Success Auditor PASS `verification/final.md` with independent dev-server screenshot audit.
- [ ] **Docs**: `TEAMWORK_DELIVERABLES.md` or `progress.md` updated with design tokens table and screenshot paths

## Non-Goals
- Backend / Supabase / LocalVault functional changes — preserve M1-M4 supabase hardening (only styling hooks)
- EHR FHIR auto-pull / TrialBridge / Offline PWA / new feature logic — out of scope
- Introducing heavy component libraries (MUI, Ant Design, Chakra) — Tailwind only
- Reproducing proprietary Antigravity hidden prompts — observable architecture only
- Long Proof / Self Verification patterns — future

## Created
- Timestamp: 2026-08-29T13:16:00Z
- Source input hash: ui-modern-professional-20260829
- Pattern: distributed-coding
- Prior project ref: teamwork-1787976000076 (supabase persistence, 4 milestones PASS, snapshots preserved in /tmp)
- Engine projectId: teamwork-1787989591222 (generated via TeamworkEngine.initProject)
- Verification: live browser screenshots mandatory; image input available

## Artifact
- Path: /Users/sujal/Projects/proj1/.teamwork/request.md
- Pattern: distributed-coding
