# Milestone M3 — Module Polish (Vault, LabStory, PillMap, HomeLab, Safety, CareCircle, RxBridge, Dossier)

**ID:** M3
**DependsOn:** M2
**Status:** pending
**Workstreams:** ws-m3-01, ws-m3-02, ws-m3-03 (parallel, non-overlapping)

## Objective
Polish representative views to production quality: card elevation, consistent padding, empty/loading states, typography hierarchy. Token-align remaining modules.

## Scope & Files (partitioned, no overlap)
- ws-m3-01: `src/components/vault/*` (DocumentDropzone, FactStreamView, FactApprovalCard) + `src/components/labstory/*` (LabStoryView, BiomarkerChart, StorySentence, CausalQueryPanel, MedOverlayBands)
- ws-m3-02: `src/components/pillmap/*` (PillMapView, PillCard, PillboxGrid, Modals) + `src/components/homelab/*` (HomeLabView, DueCardList, ProposalCard, DoctorInbox, UploadLabModal)
- ws-m3-03: `src/components/safety/*` (SafetyView, TriagePanel) + `src/components/carecircle/*` (CareCircleView, AuditLogViewer, CaregiverSwitcher) + `src/components/rxbridge/*` + `src/components/dossier/*` — token alignment, card polish

## Acceptance
- [ ] 6+ views polished: vault dropzone/stream, labstory chart/story, pillmap cards/grid, homelab due/proposal, safety triage, carecircle — with elevation, padding, empty/loading, typography
- [ ] rxbridge/dossier token-aligned (no dark remnants)
- [ ] No functional regression: localVault, eventBus wired
- [ ] Cards use rounded xl/2xl, shadow sm/md, spacing 4/8 grid
- [ ] >=2 screenshots per workstream (desktop+mobile), aggregated under .teamwork/snapshots/m3/
- [ ] tsc 0, build 1660+

## Verification Gate
critic → challenger → auditor (visual audit across modules, long text/empty edge cases)

## Ownership
- ws-m3-01: ["src/components/vault/*", "src/components/labstory/*"] → .teamwork/worktrees/ws-m3-01/
- ws-m3-02: ["src/components/pillmap/*", "src/components/homelab/*"] → .teamwork/worktrees/ws-m3-02/
- ws-m3-03: ["src/components/safety/*", "src/components/carecircle/*", "src/components/rxbridge/*", "src/components/dossier/*"] → .teamwork/worktrees/ws-m3-03/
