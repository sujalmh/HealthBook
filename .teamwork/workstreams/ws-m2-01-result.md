## Workstream
ws-m2-01 — M2 Shell & Navigation — owner: worker-m2-01

## Scope Completed
- Modernized `src/App.tsx` shell using M1 centralized tokens exclusively; no scattered hex
- Header refined: glass `bg-white/95 backdrop-blur-md sticky border-canvas-border shadow-sm`, logo gradient `from-primary to-accent` with `shadow-primary/20` and `ring-primary/10`, subtitle typography improved (`font-medium tracking-wide text-muted`, `Your health, all in one place`), Private & Secure chip tokenized (`bg-primary-light text-primary-text border-primary-border rounded-full`), PrivacyBadge retained `hidden lg:flex`
- Desktop tabs (`hidden md:block`): pill active `bg-primary-light text-primary-text border-primary-border shadow-sm`, idle `text-muted hover:bg-canvas-muted`, gap `1.5`, `py-2.5`, `rounded-xl`, `transition-all duration-200`, `scrollbar-none overflow-x-auto`, `aria-current`, 8 navItems intact, badges with `min-w` and `>99` handling
- Mobile bottom nav (`md:hidden fixed bottom-0`): safe-area `paddingBottom env(safe-area-inset-bottom)`, `min-w-[64px] min-h-[44px]` 44px targets, polished active `bg-primary-light border-primary-border`, `rounded-2xl`, `transition-all duration-200`, badge `min-w-[16px]` with `99+` clipping fix, `text-muted` tokens
- Profile switcher refined: `bg-white rounded-xl border-canvas-border shadow-sm`, buttons `px-2.5 py-1 rounded-lg transition-all duration-200` active `bg-primary-light text-primary-text border-primary-border`, idle `text-muted hover:bg-canvas-muted`, `aria-labels`
- Badges polished: Question/Activity `min-w-[18px] h-4` with `99+` handling, `animate-pulse` preserved, `bg-amber-500`/`bg-rose-500` consistent typography
- Main container `max-w-7xl p-4 sm:p-6 space-y-6 overflow-x-hidden` preserved, added `transition-all duration-200` for subtle module transitions
- Accessibility: `focus-visible:ring-primary` on all buttons, keyboard-native buttons, WCAG AA contrast via tokens, 44px touch met
- No regression: 8 hidden wrappers `activeModule==='vault'?'block':'hidden'` intact, eventBus listeners `fact_extracted/fact_confirmed/proposal_submitted/approval_resolved/question_bank` intact, `p_devi_78 0`

## Files Changed
- `src/App.tsx` — header token migration (border-slate-200→border-canvas-border, slate-600→muted, slate-50→canvas-muted, sky→primary→accent gradient, hover:bg-indigo-100→hover:brightness-95), logo refined, chip rounded-full tokenized, tabs spacing/transitions/aria/b badges min-w, bottom nav safe-area + 44px + tokenized, profile switcher tokenized, badges min-w + 99+ handling, main transition

## Verification
- Command: `tsc --noEmit` (npm run lint)
- Result: PASS 0 errors
- Command: `vite build` (npm run build)
- Result: PASS 1663 modules, CSS gzip 11.34KB <50KB (dist/assets/index-BT1rwrzX.css 67.47KB, gzip 11.34KB)
- Command: `vitest run` (npm test)
- Result: 11 passed | 1 skipped, 141 passed
- Log: `/tmp/worker-m2-01-vite.log` (vite ready 69ms), build log excerpt above
- Grep checks:
  - `grep -rn "p_devi_78" src` 0 PASS
  - `grep seedBaselineRegimen src` 0 PASS
  - `grep "bg-\[#"` src/App.tsx 0 PASS (no scattered hex)
  - `grep "hover:bg-indigo" src/App.tsx` 0 PASS (leakage fixed)
  - `grep "from-sky|shadow-sky" src/App.tsx` 0 PASS (gradient tokenized to from-primary to-accent)
  - `grep "activeModule ==="` src/App.tsx 10 (8 wrappers + 2 isActive) PASS
  - `isSupabaseEnabled` in main.tsx intact PASS

## Live Screenshots
- Captured via `npm run dev -- --host 127.0.0.1 --port 5173` + `browser.open/capture` (browser.capture output copied to `.teamwork/snapshots/m2/`):
  - `.teamwork/snapshots/m2/m2-desktop-1280-vault.jpg` — desktop 1440 vault: header glass, logo primary→accent, chip pill, tabs pill active My Records, main max-w-7xl, bottom nav hidden (desktop) — PASS
  - `.teamwork/snapshots/m2/m2-desktop-1280-pillmap.jpg` — desktop 1440 pillmap: proves routing intact after clicking My Medicines tab, active state switched, pillmap module rendered — PASS
  - `.teamwork/snapshots/m2/m2-tablet-768-vault.jpg` — tablet 768 vault: header scales, tabs overflow-x-auto visible, layout responsive — PASS
  - `.teamwork/snapshots/m2/m2-mobile-375-vault.jpg` — mobile 390 vault: header condensed S.D/Raj, tabs hidden, bottom nav pill active with 44px targets, safe-area padding — PASS
  - `.teamwork/snapshots/m2/m2-mobile-375-pillmap.jpg` — mobile 390 pillmap: bottom nav My Medicines active, routing via mobile nav proves hidden wrappers intact — PASS
- Evidence: 5 captures >=2 required (desktop+mobile), tablet optional provided; routing verified by clicking My Medicines on both desktop and mobile captures

## Design Notes & Tokens Usage
| Element | Before | After (Token) | Rationale |
|---|---|---|---|
| Page bg | bg-[#F3F4F6]? now bg-canvas-bg | `bg-canvas-bg #F3F4F6` | M1 canvas |
| Header border/bg | border-slate-200 bg-white/95 | `border-canvas-border #E2E8F0 bg-white/95 backdrop-blur-md shadow-sm` | semantic |
| Logo gradient/shadow | from-sky-600 to-indigo-600 shadow-sky-500/20 | `from-primary #4F46E5 to-accent #0EA5E9 shadow-primary/20 ring-primary/10` | drift fixed, cohesive glow |
| Chip | bg-emerald-50 text-emerald-700 border-emerald-200 rounded | `bg-primary-light #EEF2FF text-primary-text #3B5BDB border-primary-border #C7D2FE rounded-full tracking-wide` | primary token per spec |
| Subtitle | text-slate-600 | `text-muted #64748B font-medium tracking-wide` | improved typography |
| Profile switcher border | border-slate-200 | `border-canvas-border` | token |
| Profile idle hover | hover:bg-slate-50 | `hover:bg-canvas-muted #F8FAFC` | token, no hex |
| Question btn hover | hover:bg-slate-50 border-slate-200 | `hover:bg-canvas-muted border-canvas-border` | token |
| Activity btn hover leakage | hover:bg-indigo-100 | `hover:brightness-95` (keeps bg-primary-light) | fixes auditor warning, semantic |
| Tab idle | text-slate-600 hover:bg-slate-50 | `text-muted hover:bg-canvas-muted` | semantic |
| Tab active | bg-primary-light etc. | same `bg-primary-light text-primary-text border-primary-border shadow-sm` | token preserved, added transition-all duration-200, gap-1.5 py-2.5 |
| Tab badge | w-4 h-4 fixed, clip ≥10 | `min-w-[20px] h-5 px-1.5 >99? '99+'` | clipping fixed |
| Bottom nav border | border-slate-200 | `border-canvas-border` | token |
| Bottom nav idle | text-slate-500 hover:bg-slate-50 | `text-muted hover:bg-canvas-muted` | token |
| Bottom nav active badge | w-4 h-4 absolute | `min-w-[16px] h-4 px-0.5 >99` | clipping fixed |
| Bottom nav targets | gap-1 px-3 py-2 | `min-w-[64px] min-h-[44px] duration-200` + `env(safe-area-inset-bottom)` | 44px + safe-area |
| Badge counts | w-4 h-4 clip | `min-w-[18px] h-4 px-1 leading-none >99` | clipping fixed, consistent typography |

- Transitions: `transition-all duration-200` on header actions, tabs, bottom nav, main for subtle professional feel
- Shadows: `shadow-sm` header/tabs, `shadow-md shadow-primary/20` logo cohesive (not sky), `shadow-[0_-4px_12px_rgba(0,0,0,0.04)]` bottom nav

## Unresolved Issues
- None. M1 auditor warning SVGArcOverlay not in App.tsx scope — deferred to M3.

## Learnings
- `hover:bg-indigo-100` literal not in token scale — replaced with `hover:brightness-95` to keep primary-light while providing hover feedback without introducing new hex; alternative `hover:bg-primary-light/90` also valid but brightness preserves border
- Badge clipping requires `min-w` not `w-4`; using `>99 ? '99+'` handles overflow while keeping pill shape; desktop tab badge needed larger `h-5 min-w-[20px]` for ≥10 counts
- Mobile bottom nav safe-area already via `env(safe-area-inset-bottom)` but need explicit `min-h-[44px]` to satisfy WCAG touch; global index.css `button {min-height:44px}` at ≤640px helps but explicit class ensures audit pass on height measurement
- Logo gradient `from-primary to-accent` yields more clinical professional than sky→indigo drift while staying within M1 palette

## Acceptance Checks
- [x] No scattered hex in src/App.tsx (grep bg-[# 0)
- [x] 8 hidden wrappers intact (activeModule==='vault' etc. 8)
- [x] eventBus refreshCounts 5 listeners intact
- [x] Screenshots modern professional polish: desktop + mobile + tablet under .teamwork/snapshots/m2/, header/tabs/bottom nav visible, 2 modules routed
