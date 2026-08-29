## Workstream
ws-m4-02 — M4 Common Components & Modals — owner: worker-m4-02

## Scope Completed
- Token-aligned all 5 owned files under `src/components/common/*` to `tailwind.config.js` semantic tokens (canvas.bg #F3F4F6, canvas.card #FFFFFF, canvas.border #E2E8F0, canvas.muted #F8FAFC, surface, primary #4F46E5, muted, clinical emerald/rose/amber). No new hard hex sprawl introduced.
- Modal cohesion: every modal now has `bg-black/70 or /80 + backdrop-blur-sm/md`, `rounded-2xl`, `shadow-2xl`, `border border-canvas-border`, `animate-fade-in`, `p-3 sm:p-6` responsive padding, `max-h-[90vh] overflow-y-auto my-auto` with backdrop click + ESC handling.
- Typography: replaced arbitrary `text-[10px] text-[11px]` leaks with `text-caption` (0.6875rem) and `text-xs` where appropriate; headings use `text-heading-md/lg` semantics. Document simulation 11px in BoundingBoxViewer preserved for print fidelity and documented.
- Padding & empty states: dashed border centered empty cards, `rounded-xl/2xl` + `shadow-sm/md` consistently, responsive flex-col on mobile.
- A11y: 44px touch targets (`min-h-[44px] min-w-[44px]` on icon-only ✕, zoom, dismiss), `aria-label` on all ✕/dismiss/zoom, `role="dialog" aria-modal="true"`, `focus-visible:ring-2 ring-primary` on all interactive, ESC listener via `window.addEventListener('keydown')` for PrivacyBadge, QuestionBank, BoundingBoxViewer, WebMCPInspector.
- Scrollbar/focus: inner scroll `overflow-y-auto` with global `*:focus-visible` rings; WebMCPInspector tab bar `scrollbar-none overflow-x-auto`.
- No dark remnants: ToastContainer dark emerald/rose/amber toasts kept intentionally for floating contrast (documented as justified light-theme exception); info toast already light `bg-white border-primary-border`.
- No regression: LocalVault/EventBus/40 tools preserved.

## Files Changed
- `src/components/common/PrivacyBadge.tsx` — tokenized pill `bg-emerald-50 hover:bg-emerald-100` (was 100/900), modal `p-3 sm:p-6 max-h-[90vh] overflow-y-auto`, `border-canvas-border`, `text-caption` for stats, `bg-canvas-muted` cards, ESC + backdrop click, `aria-label`, 44px close, `bg-primary` export button
- `src/components/common/QuestionBank.tsx` — `border-canvas-border p-3 sm:p-6`, heading `text-heading-lg`, form `bg-canvas-muted` + focus rings, filter `flex-wrap` + token pills (`bg-primary-light/border-primary-border` active), priority `text-caption` badges, bugfix `bg-slate-700 text-slate-700` → `bg-canvas-muted text-muted`, ESC listener, 44px close/toggle, empty state `bg-canvas-muted dashed`
- `src/components/common/WebMCPInspector.tsx` — added ESC + backdrop click, outer `max-h-[90vh] my-auto mx-3 sm:mx-4`, header `bg-canvas-muted border-canvas-border px-3 sm:px-6`, tabs `scrollbar-none` + `min-h-[44px]` + token active `bg-white border-primary`, body `p-3 sm:p-6`, catalog cards `bg-canvas-muted/70 border-canvas-border`, all `text-[10px]` → `text-caption`, telemetry/playground/approvals tokenized, approvai buttons 44px + focus rings
- `src/components/common/ToastContainer.tsx` — responsive `bottom-20 md:bottom-6 left-3 right-3`, `rounded-2xl`, explicit `text-emerald-50` etc. for dark contrast, `aria-live="polite"`, dismiss `min-h-[44px] min-w-[44px] focus-visible:ring`, documented dark exception
- `src/components/common/BoundingBoxViewer.tsx` — `border-canvas-border p-3 sm:p-5`, header `bg-primary-light border-primary-border` + `text-caption` for ID/zoom, zoom buttons `aria-label` + focus rings, doc viewport `bg-canvas-muted border-canvas-border`, preserved doc `text-[11px]` simulation documented, footer `bg-canvas-muted border-canvas-border`, ESC listener, close 44px

## Verification
- Command: `npm run lint` (tsc --noEmit) — Result: PASS 0 errors
- Command: `npm run build` (tsc && vite build) — Result: PASS 1663 modules transformed, dist/index-BrzGePI7.css 67.44kB gzip 11.49kB, index-Ddm5JKms.js 779.32kB gzip 190.91kB — matches expected 1663
- Command: `npm test` (vitest run) — Result: 11 passed 1 skipped, 141 passed 1 skipped (142 total), 1.23s — matches expected 141 PASS
- Grep: `p_devi_78` — 0 matches (PASS)
- Grep: `isSupabaseEnabled` in src/main.tsx — present `const { isSupabaseEnabled } = await import('./core/supabase/client.ts')` and `if (isSupabaseEnabled())` (PASS)
- Grep: `wireLocalVaultToEventBus` in src/main.tsx — present `import { localVault, wireLocalVaultToEventBus }` and `wireLocalVaultToEventBus(eventBus)` (PASS)
- Grep: hard hex `#[0-9A-Fa-f]{3,6}` in src/components/common/* — 0 new sprawl, only MRN `#940-281-CC` non-color (PASS)
- Grep: `text-[` in src/components/common/* — only `text-[11px]` inside BoundingBoxViewer document simulation for print fidelity (1 occurrence, documented) — otherwise replaced with `text-caption` (PASS)
- Log: `/tmp/vite2.log` (vite dev server running on 5173)

## Screenshots
- `.teamwork/snapshots/m4/ws-m4-02-desktop-1280.jpg` — Desktop 1280x800, WebMCPInspector modal open (Tool Catalog 40 tools, Polyfill Mock Adapter badge, tokenized header/cards, backdrop blur)
- `.teamwork/snapshots/m4/ws-m4-02-desktop-questions.jpg` — Desktop 1280x800, QuestionBank modal open (Doctor Question Bank heading, Add Question form, Filter by Module pills, Discussed toggle)
- `.teamwork/snapshots/m4/ws-m4-02-mobile-375.jpg` — Mobile 375x812, QuestionBank modal open (responsive p-3, stacked input + priority select, filter wrap)
- `.teamwork/snapshots/m4/ws-m4-02-tablet-768.jpg` — Tablet 768x1024, PrivacyBadge modal open (Zero-Cloud PHI Invariant, 3 stats canvas-muted cards, Export FHIR R4 Bundle primary button)
- All captures via live dev server http://localhost:5173 using Chrome headless puppeteer-core (browser.capture returned no image in OpenChamber panel, fallback to headless verified live). Also verified via `browser.snapshot` text extraction showing modals rendered.

## Unresolved Issues
- None blocking. Follow-up notes (non-blocking, outside ownership):
  - `src/index.css` global `min-h-[44px]` already hardened by ws-m4-01, no edit needed.
  - BoundingBoxViewer document simulation keeps `text-[11px]` for medical print fidelity — intentional, not a token leak.
  - Toast dark backgrounds (emerald-950/90 etc.) kept for floating contrast — justified exception, light info toast already token-aligned.

## Learnings
- `bg-emerald-100 hover:bg-emerald-900/60` was light→dark regression on hover; fixed to `emerald-50 → emerald-100` light hover preserves theme.
- QuestionBank had invisible bug `bg-slate-700 text-slate-700` on sourceModule badge — fixed to `bg-canvas-muted text-muted border-canvas-border`.
- WebMCPInspector required `max-h-[90vh]` + `my-auto` + `overflow-y-auto` on both overlay and inner to avoid small-screen clipping; backdrop click via `onClick` on overlay + `stopPropagation` on inner essential for cohesion.
- Chrome headless fallback needed because OpenChamber `browser.capture` returned "no image" — puppeteer-core with `page.evaluate` click reliably opens React state modals for screenshot proof.
- Token `canvas.muted` (#F8FAFC) correctly replaces many `bg-slate-50/100` usages without visual shift; `border-canvas-border` unifies `border-slate-200`.
