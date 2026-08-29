# Plan: CareCanvas Patient-Facing Health Companion

## Architectural Vision
CareCanvas is an agent-native, patient-facing health companion built for The WebMCP Challenge.
It unifies 7 clinical modules around a single Approved Fact Vault (IndexedDB/LocalVault) with 30+ client-side WebMCP tools, interactive visual canvases, and strict human approval gating.

## Phase 0: Survey & Specification Extraction
- Spawn 3 Spec Miners in parallel:
  - `spec_miner_1`: WebMCP registration protocol, mock fallback adapter, 30+ tool schemas (input/output), tool execution engine, event/notification bus.
  - `spec_miner_2`: 7 Clinical modules functional specs, UI canvas requirements (7x4 PillMap, SVG conflict arcs, meal badges, LabStory DuckDB/Canvas, RxBridge 3-list reconciliation, HomeLab loop, Safety escalation, Family Care Circle, Continuity Dossier).
  - `spec_miner_3`: E2E test suite specs (Flows A-E), test tiers 1-4, test runner setup, sample document fixtures (PDF/images with bounding boxes, discharge lists, lab histories).

## Phase 1: PROJECT.md & TEST_INFRA.md Synthesis
- Synthesize all findings into `PROJECT.md` (Feature Inventory, Architecture, Interface Contracts, Milestones) and `TEST_INFRA.md`.

## Phase 2: Dual Track Execution
- Track A: E2E Testing Orchestrator (Tiers 1-4 test suites + test runner + Flows A-E verification).
- Track B: Implementation Milestones:
  - Milestone 1: LocalVault (IndexedDB), WebMCP Engine (30+ tools registration & mock adapter), Core Reactive State & Toast/Event system.
  - Milestone 2: LabStory Biomarker Causal Engine (DuckDB/Canvas timeline, unit normalization, reference/optimal ranges, med overlays, `extract_labs`, `correlate_meds`).
  - Milestone 3: PillMap Polypharmacy 7x4 Canvas (drag & drop, SVG drug-drug arcs, meal-time badges, duplicate ingredients, chronotype/timing shift preview, adherence simulator, export for pharmacist).
  - Milestone 4: RxBridge 3-List Reconciliation Walkthrough (Pre-admission / In-hospital / Discharge walk, plain language explanations, drug/diet/lab interaction checks, auto-populate PillMap, 1-page summary).
  - Milestone 5: HomeLab Remote Loop & Safety Alerts & Family Care Circle (due cards, photo uploads, pinned comments, dosage change proposals, danger sign reporting, doctor triage, calendar sync, caregiver proxy switcher, audited actions).
  - Milestone 6: Continuity Dossier & Cross-Module Integration (lifetime compilation, bounding box source highlights, time-bound doctor access grant/revoke, unified exports).
  - Milestone 7: Final Milestone (100% E2E test pass across all tiers + Tier 5 white-box adversarial hardening with Challengers).

## Phase 3: Final Verification & Delivery
- Forensic Audit, Reviewer approval, Challenger verification, comprehensive human report.
