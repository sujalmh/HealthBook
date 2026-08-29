# Milestone M1 — Design System (Tokens, Typography, Spacing, Shadows)

**ID:** M1
**DependsOn:** none
**Status:** pending
**Workstreams:** ws-m1-01

## Objective
Centralize design tokens in `tailwind.config.js` and `src/index.css` to establish a modern, professional light theme (Apple Health / Linear / Stripe level). Replace dark #0F172A tokens with semantic light tokens, define typography scale (Inter/system), 4/8pt spacing, rounded xl/2xl, shadows sm/md/lg, clean scrollbar, focus rings, and base layer. Eliminate scattered hex (#EEF2FF, #3B5BDB etc.) by using tokens.

## Scope & Files
- `tailwind.config.js` — semantic colors: canvas.bg, canvas.card, surface, primary, muted, border, accent, semantic clinical preserved but refined
- `src/index.css` — base layer, typography, scrollbar-none, focus-visible, touch targets, overflow-x-hidden preserved
- `src/App.tsx` header token adoption (light header, no hard-coded hex)

## Acceptance
- [ ] tailwind.config has semantic tokens (canvas.bg #F8FAFC/#F3F4F6, card white, border slate-200, primary indigo 600 etc.), typography scale, rounded xl/2xl, shadow tokens
- [ ] No scattered #EEF2FF/#EEF2FF hardcodes remain — replaced by tokens/classes
- [ ] index.css refined: scrollbar, focus rings, base, responsive base preserved
- [ ] App header uses tokens
- [ ] tsc 0, build 1660+ modules, tests pass
- [ ] >=2 browser.capture screenshots (desktop 1280 + mobile 375) under .teamwork/snapshots/m1/

## Verification Gate
critic → challenger → auditor (live screenshot re-capture required)

## Ownership
- ws-m1-01: ["tailwind.config.js", "src/index.css", "src/App.tsx::header-token-pass"] — isolated .teamwork/worktrees/ws-m1-01/
