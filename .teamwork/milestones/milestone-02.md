# Milestone M2 — Shell & Navigation (Header, Tabs, Bottom Nav, Profile, Badges)

**ID:** M2
**DependsOn:** M1
**Status:** pending
**Workstreams:** ws-m2-01

## Objective
Modernize shell: refined header (glass/soft shadow, logo, subtitle, Private & Secure chip), desktop pill tab bar with active states using tokens, mobile bottom nav with safe-area + 44px targets, polished profile switcher (S. Devi / Raj), Question/Activity badge polish, smooth transitions, cohesive spacing. Preserve 8 routes via hidden wrappers.

## Scope & Files
- `src/App.tsx` — sole owner (header, navItems, pastelActive replacement, desktop tabs, mobile bottom nav, profile switcher, Question/Activity buttons, main container max-w-7xl, transitions)

## Acceptance
- [ ] Header is modern professional (soft shadow, refined spacing, typography, status chip)
- [ ] Desktop tabs pill active states use tokens, cohesive padding
- [ ] Mobile bottom nav proper safe-area, 44px, polished active state
- [ ] Profile switcher refined, badges polished
- [ ] All 8 modules route correctly (hidden wrapper pattern intact)
- [ ] WCAG AA, keyboard nav, aria-labels intact
- [ ] >=2 screenshots desktop+mobile under .teamwork/snapshots/m2/, auditor re-captures
- [ ] No regression: p_devi_78 0, isSupabaseEnabled, wireLocalVaultToEventBus, 40 tools intact
- [ ] tsc 0, build 1660+ modules

## Verification Gate
critic → challenger → auditor (live screenshots at 375/768/1280)

## Ownership
- ws-m2-01: ["src/App.tsx"] — .teamwork/worktrees/ws-m2-01/
