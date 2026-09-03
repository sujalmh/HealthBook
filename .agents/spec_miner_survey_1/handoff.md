# Handoff Report: WebMCP Core Engine & Tools Specification Survey

**Agent:** `spec_miner_survey_1`  
**Working Directory:** `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_1`  
**Deliverable Document:** `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_1/webmcp_engine_spec.md`  
**Target Milestone:** Phase 0 / Phase 1 — WebMCP Core Architecture & Tools Specification  
**Recipient:** `parent` (`e0a60435-1f62-4e99-b635-bf602b4e2524`)

---

## 1. Observation

Direct observations from the authoritative source files:
- **`ORIGINAL_REQUEST.md` (Lines 12–50):** Specifies 5 core requirements (R1: Approved Fact Vault & WebMCP Core Engine, R2: LabStory Biomarker Causal Engine, R3: PillMap Polypharmacy Negotiator, R4: RxBridge Post-Discharge 3-List Reconciliation Walk, R5: HomeLab Remote Loop, Safety Escalation & Continuity Dossier). Requires client-side registration via `document.modelContext.registerTool`, 30+ tools inventory, append-only LocalVault (IndexedDB), bounding-box coordinates for PDF/image source highlights, and 5 mandatory End-to-End Flows (Flows A through E).
- **`FEATURES_CHECKLIST.md` (Lines 10–158):** Defines the full feature taxonomy across 7 clinical modules:
  - Shared Foundation (F0.1–F0.5): `extract_fact`, `confirm_fact`, `compile_health_record`, Question Bank auto-collector.
  - LabStory (LS1–LS8): `extract_labs`, `correlate_meds`.
  - PillMap (PM1–PM9): `add_medication`, `check_interactions`, `check_diet_interactions`, `check_duplicate_ingredient`, `suggest_schedule`, `simulate_adherence`, `export_for_pharmacist`, `set_reminder`.
  - RxBridge (RB1–RB10): `explain_med_change`, `flag_interaction`, `flag_diet_interaction`, `suggest_question_for_doctor`, `set_reminder`, `export_patient_summary`.
  - HomeLab Loop (HL1–HL8): `upload_lab_image`, `doctor_review_comment`, `propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal`.
  - Continuity Dossier (CD1–CD6): `compile_health_record`, `grant_doctor_access`, `revoke_access`, `view_timeline`.
  - Safety Alerts + Doctor Control + Follow-up & Calendar (SF1–SF8): `report_danger_sign`, `notify_doctor`, `doctor_add_medication`, `doctor_remove_medication`, `doctor_change_dose`, `approve_pillmap_change`, `schedule_followup`, `schedule_lab`, `sync_to_calendar`.
  - Family Care Circle (G1–G6): `link_patient`, `grant_caregiver_access`, `revoke_caregiver_access`, `switch_profile`, `act_on_behalf`.
- **`trialbridge-labstory-pillmap-feature-planning-2026-08-28.md` (Lines 166–295):** Replaces trial matching with post-discharge 3-list reconciliation (`RxBridge`) and establishes the competitive novelty thesis (patient-at-home co-pilot with approval gates vs static clinician dashboards).

---

## 2. Logic Chain

1. **Extraction of Full Tool Manifest:** Cross-referencing `ORIGINAL_REQUEST.md` (R1–R5) and `FEATURES_CHECKLIST.md` (§0–§9) reveals a comprehensive inventory of **40 WebMCP tools** across all 7 modules (exceeding the 30+ tool mandate).
2. **Standardization of Tool Contract:** To conform to W3C WebML/WebMCP specifications, every tool definition requires:
   - Unique name and module ownership.
   - Strict JSON Schema parameter definitions with types, required fields, and constraints.
   - Structured return payload with human-readable `plainLanguageSummary` and error structures.
   - Explicit `requiresHumanApproval` boolean flag and `approvalGateType`.
   - Explicit `uiSideEffects` contract (state mutations, DOM animations, canvas re-renders, toast notifications).
3. **WebMCP Fallback Mock Architecture:** In standard browser environments where `document.modelContext` or `navigator.modelContext` may not yet be exposed, the engine must initialize a high-fidelity client-side polyfill (`window.__Healthbook_WebMCP__`) that exposes the exact registration, execution, and event emitter lifecycle.
4. **In-App Inspector Requirement:** The WebMCP Challenge judging requires live proof of tool execution. The spec includes a 4-tab in-app inspector: Tool Catalog, Live Invocation Telemetry Log, Manual Trigger Playground, and Human Approval Interceptor.
5. **LocalVault IndexedDB 11-Store Data Architecture:** All data must be private, local, and append-only. The 11 object stores (`facts`, `documents`, `meds`, `labs`, `conditions`, `allergies`, `audit_log`, `proposals`, `calendar_events`, `care_circle`, `doctor_grants`) model all clinical entities, relationships, indexes, and proxy audit trails.
6. **Grounding & Question Bank:** Bounding-box normalized coordinates `[pageIndex, x, y, width, height]` provide interactive source grounding to original PDFs/scans, while the Question Bank schema aggregates questions across RxBridge, LabStory, HomeLab, and Safety into a centralized agenda.

---

## 3. Caveats

- **External FHIR Server Sync:** In accordance with `FEATURES_CHECKLIST.md` Line 6 and Line 175, full EHR bidirectional FHIR sync and external clinician server portals are deliberately marked out of scope; however, `compile_health_record` provides declarative FHIR R4 JSON export capabilities.
- **Client-Side PDF/OCR Runtime:** In the demo runtime, OCR and bounding box text extraction operate using in-browser PDF.js and pre-annotated fixtures; real-world live OCR processing latency in browser was factored into the asynchronous tool execution lifecycle.
- **No other caveats.**

---

## 4. Conclusion

The specification analysis is complete, fully documented, and verified against all requirements. The authoritative specification document `/Users/sujal/Projects/proj1/.agents/spec_miner_survey_1/webmcp_engine_spec.md` provides complete, implementation-ready JSON schemas, execution contracts, and architecture definitions for:
- 40 WebMCP tools across all 7 modules.
- WebMCP Dual-Mode Registration & Fallback Mock Adapter.
- In-App WebMCP Inspector, Live Invocation Logger & Trigger Panel.
- LocalVault IndexedDB Schema (11 object stores with keys & indexes).
- Normalized Bounding-Box Coordinate Mapping System.
- Unified Question Bank Schema.
- Adversarial & Edge-Case Behavior Matrix.

---

## 5. Verification Method

To independently verify the completeness and correctness of the specification:
1. **Inspect Deliverable Document:**
   ```bash
   view_file AbsolutePath="/Users/sujal/Projects/proj1/.agents/spec_miner_survey_1/webmcp_engine_spec.md"
   ```
2. **Verify Tool Inventory Completeness:**
   Confirm that all 40 tools in Section 6 match the tools cataloged across `FEATURES_CHECKLIST.md` Sections 0–9.
3. **Verify Schema Conformance:**
   Inspect JSON schemas in Section 5 to confirm valid JSON Schema Draft 2020-12 structures (types, required arrays, properties).
4. **Verify LocalVault Object Stores:**
   Confirm that all 11 object stores in Section 4.1 have defined key paths, index lists, and TypeScript entity contracts.
