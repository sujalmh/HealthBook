# Milestone M4 — Responsive & Final Hardening (Layouts, Common Components, Modals, Polish)

**ID:** M4
**DependsOn:** M3
**Status:** pending
**Workstreams:** ws-m4-01, ws-m4-02 (parallel, non-overlapping)

## Objective
Responsive refinements, layout cohesion, overflow fixes, common components token-aligned, modals cohesive. Ensure 320/375/768/1024/1280/1440 works, max-w-7xl consistent, scrollbar-none, focus rings enhanced, performance CSS <50KB gz.

## Scope & Files (partitioned)
- ws-m4-01: `src/index.css` responsive refinements + `src/App.tsx` container/overflow polish (max-w-7xl, overflow-x-hidden, padding, transitions)
- ws-m4-02: `src/components/common/*` (PrivacyBadge, QuestionBank, WebMCPInspector, ToastContainer, BoundingBoxViewer) + modal polish across codebase (QuestionBank, WebMCPInspector, AddMedicationModal, etc. via common)

## Acceptance
- [ ] index.css responsive: 320-1440, bottom nav <768, top tabs >=768, 44px touch, focus rings, scrollbar-none accessible
- [ ] max-w-7xl containers consistent, overflow fixes, no horizontal scroll
- [ ] Common components token-aligned, visually cohesive
- [ ] Modals cohesive (backdrop blur, rounded 2xl, shadow lg)
- [ ] PrivacyBadge still visible desktop, refined
- [ ] >=2 screenshots desktop+mobile+tablet under .teamwork/snapshots/m4/, auditor re-captures at 3 viewports
- [ ] tsc 0, npm test 149+ PASS, test-runner 231 PASS, build 1660+ modules, dist built
- [ ] Grep checks: p_devi_78 0, isSupabaseEnabled intact, wireLocalVaultToEventBus intact, 40 tools
- [ ] Docs: tokens table + snapshot paths in progress.md

## Verification Gate
critic → challenger → auditor + Success Auditor final (independent dev-server screenshot audit, lint/test/build/grep)

## Ownership
- ws-m4-01: ["src/index.css", "src/App.tsx"] → .teamwork/worktrees/ws-m4-01/
- ws-m4-02: ["src/components/common/*"] → .teamwork/worktrees/ws-m4-02/
