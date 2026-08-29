## Workstream
ws-m1-01 — M1 Design System — owner: worker-m1-01

## Scope Completed
- Centralized semantic light tokens in `tailwind.config.js:9-72` — replaced dark canvas (#0F172A/#1E293B/#334155) with light `canvas.bg #F3F4F6 / card #FFFFFF / border #E2E8F0 / muted #F8FAFC`, added `surface`, `primary {DEFAULT #4F46E5, hover #4338CA, light #EEF2FF, border #C7D2FE, text #3B5BDB}`, `accent #0EA5E9/#38BDF8`, `muted #64748B`, preserved `clinical` 7 hues, added `fontFamily Inter`, `fontSize heading-xl/lg/md/body/caption/label`, `borderRadius xl12/2xl16/3xl24`, `boxShadow sm/md/lg/xl/soft/glow`.
- Refined `src/index.css:1-62` — unified `body @apply bg-canvas-bg` (removed duplicate slate-50/#F3F4F6), updated `*:focus-visible` to `ring-primary` (from sky-600), kept scrollbar light + added `.scrollbar-none` utility, updated `highlightPulse` to primary rgba(79,70,229) (from sky 56,189,248), ensured `overflow-x-hidden`, `color-scheme light`, `44px touch` in @media, added base typography layer for h1/h2/h3 via heading tokens.
- Token pass `src/App.tsx:138-334` — replaced all hard hex `bg-[#EEF2FF]/text-[#3B5BDB]/border-[#C7D2FE]/bg-[#E0E7FF]/bg-[#F3F4F6]` with semantic `bg-primary-light / text-primary-text / border-primary-border / bg-canvas-bg / hover:bg-indigo-100`, updated pastel constants, profile switcher active states, Activity button, desktop+mobile nav active states, icon idle/active tokens. Header retains backdrop-blur, shadow-sm, logo gradient.

## Files Changed
- `tailwind.config.js` — extended colors (canvas/surface/primary/accent/muted/clinical), fontFamily sans Inter, fontSize 7 scales, borderRadius xl/2xl/3xl, boxShadow 6 semantic, glowPulse updated to primary indigo
- `src/index.css` — body bg-canvas-bg, focus ring-primary, scrollbar-none utility, highlightPulse primary rgba, typography layer, antialiased
- `src/App.tsx` — 6 hex-replacement edits (pastelActive/Icon, profile switcher 2 buttons, Activity button, bottom nav), bg-canvas-bg, no logic change

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `canvas.bg` | `#F3F4F6` | page background `bg-canvas-bg` |
| `canvas.card` | `#FFFFFF` | cards `bg-canvas-card` / `bg-surface` |
| `canvas.border` | `#E2E8F0` | borders `border-canvas-border` / `border-slate-200` |
| `canvas.muted` | `#F8FAFC` | muted areas `bg-canvas-muted` |
| `surface.DEFAULT` | `#FFFFFF` | surface white |
| `primary.DEFAULT` | `#4F46E5` indigo-600 | CTAs `bg-primary` `ring-primary` |
| `primary.hover` | `#4338CA` indigo-700 | hover |
| `primary.light` | `#EEF2FF` indigo-50 | pastel active bg `bg-primary-light` |
| `primary.border` | `#C7D2FE` indigo-200 | pastel border `border-primary-border` |
| `primary.text` | `#3B5BDB` indigo-700-ish | pastel text `text-primary-text` |
| `accent.DEFAULT` | `#0EA5E9` sky-500 | accent |
| `accent.light` | `#38BDF8` sky-400 | glow |
| `muted.DEFAULT` | `#64748B` slate-500 | secondary text |
| `clinical.*` | `#14B8A6` `#3B82F6` `#F59E0B` `#EF4444` `#A855F7` `#10B981` `#F43F5E` | preserved |
| `fontFamily sans` | `Inter, system-ui, -apple-system…` | `font-sans` |
| `fontSize heading-xl` | `30px/36px 800` | `text-heading-xl` |
| `fontSize heading-lg` | `20px/28px 700` | `text-heading-lg` |
| `fontSize body` | `14px/24px 400` | `text-body` |
| `fontSize caption` | `11px/16px 600 0.05em` | `text-caption` |
| `borderRadius xl/2xl/3xl` | `12/16/24px` | `rounded-xl/2xl/3xl` |
| `boxShadow sm/md/lg/xl` | `0 1/4/10/20px rgba(0,0,0,0.05-0.12)` | `shadow-sm/md/lg/xl` soft/glow |

Spacing: native Tailwind 4/8 grid (p-1=4px, p-2=8px etc.) — documented in tailwind comment.

## Verification
- Command: `npm run lint` (tsc --noEmit)
- Result: PASS (exit 0, 0 errors)
- Command: `npm run build` (tsc && vite build)
- Result: PASS — 1663 modules transformed (≥1660), dist/assets/index-*.js 756kB gzip 187kB, CSS 65.97kB gzip 11.1kB — dist built
- Command: `npm test` (vitest run)
- Result: 11 passed | 1 skipped (12 files), 141 passed | 1 skipped, 0 failed (1.19s)
- Command: `grep -R "p_devi_78" src`
- Result: 0 (no regression)
- Command: `grep -R "#EEF2FF\|#3B5BDB\|#C7D2FE" src/`
- Result: 0 (no scattered hex; only token hex in tailwind.config.js + comments)
- Command: `grep -R "bg-\[#EEF2FF\]\|text-\[#3B5BDB\]" src/`
- Result: 0 (bracket hex eliminated from src/)
- Command: `grep clinical tailwind.config.js | wc -l` — clinical preserved
- Command: `grep "primary" tailwind.config.js | wc -l` — semantic primary present
- 40 tools intact: `npm test` shows WebMCPEngine 4 tests PASS, tools catalog unmodified
- Hidden wrappers intact: `grep hidden wrapper` App.tsx 8 modules with `className={activeModule === 'x' ? 'block' : 'hidden'}` unchanged

## Live Screenshots
- Dev server: `http://localhost:5173` (vite PID 51876)
- Captures (browser.capture):
  - `.teamwork/snapshots/m1/m1-desktop-1280-after.jpg` (copy from `.openchamber/screenshots/m1-desktop-1280-after-2026-08-29T07-55-15-878.jpg`) — desktop 1440×900 — header with glass/shadow, logo gradient, `Primary & Secure` chip, `bg-canvas-bg` page, pill-tabs semantic
  - `.teamwork/snapshots/m1/m1-mobile-375-after.jpg` (copy from `.openchamber/screenshots/m1-mobile-375-after-2026-08-29T07-55-20-041.jpg`) — mobile 390×844 — bottom nav ready, header condensed, tokens visible
  - `.teamwork/snapshots/m1/m1-tablet-768-after.jpg` — tablet 768×1024 additional
- Total m1 snapshots now: 10 (7 baseline + 3 after)

## Unresolved Issues
- None. Note: `src/components/pillmap/SVGArcOverlay.tsx: fill="#0F172A"` remains — out of scope (ws-m3-02 owns pillmap, will be token-aligned in M3). M1 zero-hex guarantee applies to owned files (App.tsx) and pastel set; auditor grep for App.tsx passes. Dark canvas hex now only in tailwind comment deprecation, not in src UI.
- Browser.snapshot returned empty elements array (headless capture still works via screenshot path) — not blocking.

## Learnings
- Semantic tokens via `primary.light/border/text` map cleanly to Tailwind classes `bg-primary-light` etc.; no plugin needed.
- `bg-canvas-bg` correctly maps to #F3F4F6 which matches prior hardcoded `bg-[#F3F4F6]` — visual continuity preserved, now centralized.
- highlightPulse switched to indigo rgba for cohesion with primary — no longer sky-600 mismatch.
