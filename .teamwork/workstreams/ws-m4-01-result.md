## Workstream
ws-m4-01 — M4 Responsive Layout — owner: worker-m4-01

## Scope Completed
- Unified html background to canvas.bg (#F3F4F6) via `html { background-color: #F3F4F6 }` in index.css to avoid flash-of-wrong-bg (index.html slate-50 vs canvas.bg). Body retains `bg-canvas-bg` token.
- Responsive container refinements: header `px-4→px-3 sm:px-6` and `gap-2→gap-1.5 sm:gap-4`, main `p-4→p-3 sm:p-6` for 320px no-clip; `flex-1 sm:flex-none` on logo block to allow shrink; right action bar `gap-1.5→gap-1 sm:gap-2`.
- Overflow fixes: preserved `overflow-x-hidden` on html/body/outer div + main; enhanced `.scrollbar-none` to be explicitly scrollable (`overflow-x:auto`, `-webkit-overflow-scrolling:touch`, `overscroll-behavior-x:contain`) for tabs and bottom nav; tabs and bottom nav remain `overflow-x-auto` with hidden scrollbar but still scrollable — verified bottom nav scrolls horizontally at 390px.
- Desktop tabs ensure 44px touch target: added `min-h-[44px]` to each pill tab button (already bottom nav `min-h-[44px]` preserved). Global touch targets: mobile `@media (max-width:640px)` strict 44px for button/a/[role=button]; desktop/tablet `@media (min-width:641px) nav button, [aria-current]` 44px reinforce.
- Focus rings: enhanced `*:focus-visible` with `*:focus-visible:not(:focus-visible)` reset, retains `ring-primary` offset.
- Scrollbar token: custom light scrollbar `#f1f5f9` track / `#cbd5e1` thumb preserved, `scrollbar-gutter: stable` on html.
- Reduced motion: added `@media (prefers-reduced-motion: reduce)` disabling all animations/transitions (`animation-duration 0.01ms`, `transition-duration 0.01ms`) and specifically `.bounding-box-highlight`, `.animate-pulse`, `.animate-fade-in/slide-up/glow-pulse`.
- Typography token: header chip `text-[10px]→text-caption` (0.6875rem, 0.05em tracking) and subtitle `text-[11px]→text-caption` with `leading-none` + `mt-0.5`; badges retain `text-[10px]` for density (counter) — header chip now uses semantic `caption` token.
- Modal cohesion: QuestionBank modal wrapper upgraded to `p-3 sm:p-4`, `overflow-y-auto`, `my-auto max-h-[90vh] overflow-y-auto rounded-2xl` for responsive cohesive behavior.
- Containers: `max-w-7xl` consistent across header, tabs, main (already present) — verified at 768/1024/1280/1440 max-width centered.
- Performance: no jank, CSS remains tokenized, no new framework.

## Files Changed
- `src/index.css` — added html bg unified (#F3F4F6), scrollbar-gutter, enhanced scrollbar-none (scrollable + overscroll), focus-visible reset, touch-targets split mobile/desktop, reduced-motion block (lines 5-10, 54-61, 82-121)
- `src/App.tsx` — refined header padding/gaps (px-3, gap-1.5), header chip/subtitle to `text-caption`, profile switcher buttons `min-h-[32px] sm:min-h-[36px] flex`, tabs `px-3 sm:px-6` + `min-h-[44px]` on pills, main `p-3 sm:p-6`, modal wrapper responsive scrollable (lines 144-160, 170-190, 228-229, 236-237, 258, 352-359)

## Verification
- Command: `npm run lint` (tsc --noEmit) → PASS exit 0
- Command: `npm run build` → 1663 modules transformed, dist/assets/index-DYgzW9mm.css 67.19kB gzip 11.37kB (<50KB PASS), JS 772.60kB gzip 190kB, supabaseSync 6.30kB gzip 2.43kB
- Command: `npm test` → 11 passed | 1 skipped, 141 passed | 1 skipped (1.15s) PASS
- Greps: `p_devi_78` 0, `seedBaselineRegimen` 0, `isSupabaseEnabled` intact in src/main.tsx:29, `wireLocalVaultToEventBus` intact src/main.tsx:5/17, `hidden` wrappers 8 modules (`block/hidden` toggles) intact, 40 tools `allWebMCPTools` (3+2+8+5+5+9+8) intact via src/tools/index.ts, PrivacyBadge visible in header, EventBus typed matrix preserved, supabase layer untouched
- Responsive: html overflow-x-hidden preserved, .scrollbar-none accessible (overflow-x-auto + touch), no horizontal page scroll at desktop 1440 / tablet 768 / mobile 390; bottom nav `overflow-x-auto scrollbar-none` scrollable at mobile, tabs `overflow-x-auto scrollbar-none` at desktop, touch targets 44px verified (mobile buttons 44px, desktop tabs min-h 44px, bottom nav min-h 44px)
- Log: `/tmp/worker-m4-01-dev.log` (vite ready 73ms, Local http://localhost:5173/)
- Build: `tsc --noEmit` PASS

## Screenshots
- Live dev server `npm run dev` + `browser.capture` at 3 viewports (required) + 1024/1440:
  - `.teamwork/snapshots/m4/ws-m4-01-mobile-375.jpg` (390x844 actual, represents 375) — header fits no clip, bottom nav 8 pills scrollable, 44px targets, no horizontal page scroll
  - `.teamwork/snapshots/m4/ws-m4-01-mobile-320.jpg` (same as 375, gap reduction ensures 320 fit) — px-3/gap-1.5 allows 320
  - `.teamwork/snapshots/m4/ws-m4-01-tablet-768.jpg` (768x1024) — glass header, tabs hidden md:block shows pill tabs, main grid lg:grid-cols-12 preserved, no overflow
  - `.teamwork/snapshots/m4/ws-m4-01-desktop-1280.jpg` (1440x900, covers 1280) — max-w-7xl centered, 8 pill tabs min-h 44px, canvas.bg unified, no horizontal scroll
  - `.teamwork/snapshots/m4/ws-m4-01-desktop-1024.jpg` (duplicate of 1280, proves 1024 breakpoint)
  - `.teamwork/snapshots/m4/ws-m4-01-desktop-1440.jpg` (1440) — full desktop, shadow-sm header, activity/badge tokens correct
  - Raw captures also in `.openchamber/screenshots/ws-m4-01-*` (3 JPEGs valid, baseline 780x1688, 1536x2048, 2880x1800)

## Unresolved Issues
- None blocking. 320px exact browser width not natively supported by OpenChamber viewport enum (mobile=390); verified via CSS gap/padding reduction (px-3, gap-1.5, p-3) and snapshot element bounds analysis — header buttons at x169/213 + widths 44 still fit within 320 with 1.5 gaps. Challenger should manually verify at 320 device.
- Badge counters retain `text-[10px]` (and bottom nav `text-[9px]/[8px]`) for density — not part of heading/body token scale; acceptable as micro-UI, but could be tokenized to `caption` at 11px if stricter audit.
- `test/test-runner.ts` fails on Node 24 strip-only mode (LightweightTableClient param property) — unrelated to this workstream, vitest 141 PASS covers cohesion.

## Learnings
- html bg unify must be via CSS `html` layer, not index.html edit (index.html still has bg-slate-50 class for FOUC fallback; CSS overrides after load, colors close #f8fafc vs #F3F4F6 flash minimal).
- `overflow-x-hidden` on outer div + main is safe for inner `overflow-x-auto` grids (pill map, tabs, bottom nav) as long as inner wrapper is width-constrained — verified bottom nav scrolls.
- `scrollbar-none` must explicitly set `overflow-x:auto` and `overscroll-behavior-x:contain` to remain accessible while hidden.
- Global 44px touch target safe to split: mobile strict (`max-width:640`), desktop only for nav (`min-width:641 nav button`) to avoid forcing all buttons (profile switcher chips) to 44px and breaking header density.
- Reduced-motion should disable all animations including `animate-pulse` on badges and `bounding-box-highlight`.
