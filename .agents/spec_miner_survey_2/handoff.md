# Handoff Report: CareCanvas Clinical Modules & Interactive Visual Canvases Specification

**Agent:** spec_miner_survey_2  
**Date:** 2026-08-28T20:46:00Z  
**Target:** Orchestrator (`parent`, ID: `e0a60435-1f62-4e99-b635-bf602b4e2524`)  
**Deliverable Path:** `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md`

---

## 1. Observation
- **Authoritative Source Documents Examined:**
  1. `/Users/sujal/Projects/proj1/.agents/ORIGINAL_REQUEST.md` (Lines 1–51): Defines requirements R1 (Approved Fact Vault & WebMCP Core Engine), R2 (LabStory & Longitudinal Biomarker Causal Engine), R3 (PillMap & Polypharmacy Negotiator), R4 (RxBridge Post-Discharge 3-List Reconciliation Walk), R5 (HomeLab Remote Loop, Safety Escalation & Continuity Dossier), and Acceptance Criteria for Flows A through E.
  2. `/Users/sujal/Projects/proj1/FEATURES_CHECKLIST.md` (Lines 1–188): Detailed feature checklist defining F0.1–F0.5 (Shared Foundation), LS1–LS8 (LabStory), PM1–PM9 (PillMap), RB1–RB10 (RxBridge), HL1–HL8 (HomeLab Loop), CD1–CD6 (Continuity Dossier), SF1–SF8 (Safety Alerts & Doctor Triage), G1–G6 (Family Care Circle), INT1–INT9 (Cross-Module Integrations), 30+ WebMCP Tools Inventory, and Demo Flows A–E.
  3. `/Users/sujal/Projects/proj1/trialbridge-labstory-pillmap-feature-planning-2026-08-28.md` (Lines 1–295): Detailed rationale for patient-approved fact vault, 3-list reconciliation walkthrough, drag-and-drop pillbox canvas with SVG conflict arcs, time-series lab correlation engine, and competitor differentiation.
  4. `/Users/sujal/Projects/proj1/.agents/orchestrator_1/plan.md` (Lines 1–29): Outlines Phase 0 through Phase 3 milestones for dual-track development.

- **Observed Scope & Feature Inventory:**
  - Total Clinical Modules Analyzed: 7 modules + 1 Shared Foundation (8 functional functional areas).
  - Specific Feature Codes Discovered and Fully Specified:
    - **Shared Fact Vault:** `F0.1` (Narrated Extraction), `F0.2` (Per-Fact Approve/Edit/Reject Gate), `F0.3` (Unified Multi-Partition Vault), `F0.4` (Privacy Badge & Local-Only Guarantee), `F0.5` (Question Bank).
    - **LabStory:** `LS1` (Multi-Doc Timeline Drop), `LS2` (Canvas/DuckDB Time Series), `LS3` (Ask Why / `correlate_meds`), `LS4` (Med Overlay Bands), `LS5` (Reference vs Optimal Toggle), `LS6` (Story Sentence), `LS7` (Doctor Question Generator), `LS8` (Doctor Pinned Comments).
    - **PillMap:** `PM1` (7x4 Pillbox Canvas), `PM2` (SVG Drug Conflict Arcs), `PM2b` (Diet Badges & Plate Arcs), `PM3` (Duplicate Ingredient Check), `PM4` (Schedule Shift Ghost Preview), `PM5` (Chronotype Calibration), `PM6` (Missed Dose Simulator), `PM7` (Consolidated Reminders), `PM8` (Pharmacist Export), `PM9` (Elder vs Caregiver View Toggle).
    - **RxBridge:** `RB1` (3-List Intake), `RB2` (Conversational Walk), `RB3` (5-State Change Badging), `RB4` (Per-Med Approval Gate), `RB5` (Drug-Drug Screen), `RB5b` (OTC Guard), `RB5c` (Diet Screen), `RB5d` (PillMap Correlation), `RB6` (Lab Context Flag), `RB7` (Doctor Question Generator), `RB8` (Teach-Back Comprehension Check), `RB9` (Day-0 PillMap Handoff), `RB10` (1-Page Patient Summary Export).
    - **HomeLab Remote Loop:** `HL1` (Prescribed Due Cards), `HL2` (Photo Upload & Parse), `HL3` (Doctor Inbox & Pinned Note), `HL4` (Dosage Proposal Card), `HL5` (Patient Approval & PillMap Animated Diff), `HL6` (LabStory Event Band), `HL7` (Next Due Auto-Set), `HL8` (Updated Patient Summary Export).
    - **Safety Alerts & Doctor Triage:** `SF1` (Danger Sign Reporting), `SF2` (Doctor Triage Console), `SF3` (Doctor Remote PillMap Controls), `SF4` (Patient Emergency Approval), `SF5` (Direct Follow-up Order), `SF6` (Calendar Sync), `SF7` (Overdue Nudges), `SF8` (Dossier Pinning).
    - **Family Care Circle:** `G1` (Linked Care Profiles), `G2` (Scoped Role Permissions), `G3` (Audited Proxy Actions), `G4` (Full Remote Loop on Behalf), `G5` (Elder Simple View), `G6` (Multi-Patient Dashboard).
    - **Continuity Dossier:** `CD1` (Lifetime Health Compilation), `CD2` (Timeline + Snapshot Card), `CD3` (Source Bounding-Box Deep Links), `CD4` (Time-Bound Doctor Access Grant/Revoke), `CD5` (Longitudinal Record Continuation), `CD6` (Standardized Export / FHIR Bundle).
    - **Cross-Module Integrations:** `INT1` through `INT9` mapped and verified.
    - **WebMCP Tool Inventory:** 40 client-side tool APIs mapped with signatures, parameters, return types, approval gating requirements, and reactive UI side-effects.

---

## 2. Logic Chain
1. **Fact Vault as Immutable Anchor:** By reviewing `ORIGINAL_REQUEST.md` (R1) and `FEATURES_CHECKLIST.md` (0. Shared Foundation), it is evident that without a central approved vault, the 7 clinical modules would become disconnected silos requiring redundant document parsing. Thus, the specification establishes `LocalVault` (IndexedDB) as the sole source of truth with strict status partitioning (`staged` vs `approved`).
2. **Visual Canvases Replace Complex Tables:** Seniors and post-discharge patients struggle with standard EHR clinical tables. By specifying an accessible 7x4 weekly pillbox grid with SVG bezier conflict arcs and meal badges (PillMap), high-performance DuckDB/Canvas time-series charts with med overlays (LabStory), and a conversational 3-list comparison walk (RxBridge), the interface provides immediate cognitive clarity.
3. **Mandatory Human-in-the-Loop Approval:** In accordance with WebMCP principles and healthcare safety constraints, every agent extraction, doctor dosage titration proposal, and schedule shift is architecturally gated behind an explicit `Approve / Edit / Reject` human decision before modifying active regimens or schedules.
4. **Closed Remote Loop:** The HomeLab and Safety modules close the loop between patient and clinician through doctor-prescribed cadences, remote photo capture, dosage proposal cards, and bi-directional calendar synchronization (`.ics`), fully logged to the Continuity Dossier.
5. **Audited Caregiver Delegation:** The Family Care Circle module provides role-based proxy execution (`View Only`, `Manage`, `Full`) ensuring that elderly or young dependents receive care with full legal audit attribution on every proxy action.

---

## 3. Caveats
- **External EHR FHIR Live Synchronization:** Per `FEATURES_CHECKLIST.md` (Section 11, Won't), bi-directional live FHIR sync with hospital EHR systems is out of scope for the hackathon; export as FHIR R4 JSON bundle is fully supported.
- **On-Device OCR & ML Model Inference:** Photo extraction and bounding box alignment rely on browser-level WebAssembly / Tesseract.js / WebLLM capabilities; appropriate fallback handlers and manual edit loupes have been specified for low-confidence scans.
- **Calendar Synchronization Protocols:** External calendar sync is specified via standard `.ics` payload export and Web Calendar URI integration, ensuring universal compatibility without requiring proprietary Google/Apple API keys.

---

## 4. Conclusion
The comprehensive specification document `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md` is complete, exhaustive, and fully aligned with all requirements of `ORIGINAL_REQUEST.md`, `FEATURES_CHECKLIST.md`, and `trialbridge-labstory-pillmap-feature-planning-2026-08-28.md`. All 64 feature points across the 8 clinical areas, 40 WebMCP tools, 9 cross-module integrations, 18 edge cases/failure modes, full TypeScript schemas, and 5 E2E demo flows (A through E) are formally specified for immediate implementation and testing.

---

## 5. Verification Method
1. **Document Completeness Check:**
   - Inspect `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md` using `view_file` or word count. Confirm that all feature sections (F0.1–F0.5, LS1–LS8, PM1–PM9, RB1–RB10, HL1–HL8, SF1–SF8, G1–G6, CD1–CD6, INT1–INT9, WebMCP Tools 1–40, Flows A–E) are fully populated.
2. **Schema & Contract Consistency Check:**
   - Validate that the TypeScript schemas defined in Section 13 cover all required data entities (ApprovedFact, LabMarkerValue, MedicationScheduleItem, DrugInteractionArc, DietInteractionBadge, ReconciliationItem, DosageChangeProposal, DangerSignAlert, LinkedCareProfile, DoctorAccessGrant).
3. **Workflow State Machine Alignment:**
   - Cross-check the interaction state machines (Section 12) against the Acceptance Criteria in `ORIGINAL_REQUEST.md` (Lines 29–51) to confirm 100% testable trace coverage.
