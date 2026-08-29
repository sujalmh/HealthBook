# Original User Request

## 2026-08-28T20:42:36Z

CareCanvas is an agent-native, patient-facing health companion built for The WebMCP Challenge (OpenAI, Google, Microsoft, W3C WebML) that unifies 7 clinical modules (Approved Fact Vault, LabStory, PillMap, RxBridge, HomeLab Loop, Continuity Dossier, Safety Alerts & Family Care Circle) where the web application provides interactive visual canvases (drag-and-drop 7x4 pillbox, lab trend graphs with med overlay bands, 3-list reconciliation diffs, source-linked PDF highlights) while all heavy cognitive analysis (multi-doc OCR, 3-list reconciliation, drug-drug/diet interaction flags, lab-med correlation, doctor question generation) is exposed as client-side WebMCP tools (`document.modelContext.registerTool`) with mandatory human approval gates.

Working directory: /Users/sujal/Projects/proj1
Integrity mode: demo

## Requirements

### R1. Approved Fact Vault & WebMCP Core Engine
Expose client-side WebMCP tools (`extract_fact`, `confirm_fact`, `compile_health_record`) operating over an append-only, privacy-first local store (IndexedDB/LocalVault). Every extracted lab, medication, allergy, condition, and OTC supplement must be narrated in plain language with source bounding-box highlights on original documents and require explicit patient `Approve / Edit / Reject` actions before propagating to downstream modules.

### R2. LabStory & Longitudinal Biomarker Causal Engine
Provide an interactive time-series biomarker visualization (DuckDB/Canvas chart) supporting multi-year PDF/photo lab drops, unit normalization, reference vs. optimal range toggling, and doctor-prescribed due dates. Implement WebMCP tools `extract_labs` and `correlate_meds` that enable chat agents to analyze causal trends (e.g. glucose spikes vs. prednisone timing, eGFR decline vs. NSAIDs) and auto-generate actionable questions for doctor appointments.

### R3. PillMap & Polypharmacy Negotiator
Build an accessible 7x4 weekly pillbox canvas (Mon–Sun × Morning/Noon/Evening/Bedtime) with drag-and-drop pill placement. Implement WebMCP tools `add_medication`, `check_interactions`, `check_diet_interactions`, `check_duplicate_ingredient`, `suggest_schedule`, `simulate_adherence`, and `export_for_pharmacist`. Conflicting pills are visually connected by colored SVG arcs (red/orange/yellow), diet interactions display meal-time badges with plate arcs, and timing shifts render ghost previews that animate upon patient approval.

### R4. RxBridge Post-Discharge 3-List Reconciliation Walk
Enable conversational 3-list reconciliation (Pre-admission, In-Hospital, Discharge) via WebMCP tools `explain_med_change`, `flag_interaction`, `flag_diet_interaction`, `suggest_question_for_doctor`, and `export_patient_summary`. The agent walks the patient through each med change (Continued, Dose Doubled, Stopped, New, Held) in plain English, checks discharge Rx against patient OTCs and diet habits, auto-populates PillMap on approval, and generates a one-page patient home discharge summary.

### R5. HomeLab Remote Loop, Safety Escalation & Continuity Dossier
Support remote doctor-prescribed lab due cards, photo upload, doctor pinned comments, and dosage proposal cards (`propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal`). Implement danger sign reporting with doctor triage and pillbox remote adjustments (`report_danger_sign`, `doctor_change_dose`, `schedule_followup`), calendar sync (`sync_to_calendar`), multi-patient proxy switching with audited actions (`link_patient`, `grant_caregiver_access`, `act_on_behalf`), and lifetime continuity dossier export (`grant_doctor_access`, `revoke_access`).

## Acceptance Criteria

### WebMCP API Conformance & Tool Exposure
- [ ] All 30+ tools defined in the inventory register successfully via `document.modelContext.registerTool` or fallback mock adapter when WebMCP flag is not active.
- [ ] Every tool execution returns structured schema responses with plain-language explanations.
- [ ] Tool executions trigger reactive DOM updates, animated transitions (e.g. pill shifts, dosage pulses), and toast notifications without full page reloads.

### Human-in-the-Loop Trust & Approval Gating
- [ ] No unconfirmed fact from an uploaded document affects PillMap canvas or LabStory timeline until explicitly confirmed via `confirm_fact` or UI Approve button.
- [ ] Dosage adjustments proposed by doctor or agent remain in pending state until patient or caregiver approves.
- [ ] Audit trail records author and proxy metadata (e.g., `Approved by Raj (son) on behalf of S. Devi`).

### Visual Canvas & Interaction Verification
- [ ] PillMap correctly draws interactive SVG arcs between conflicting pills and meal badges with clickable detail sheets.
- [ ] LabStory renders responsive biomarker charts with overlaid medication timeline bands.
- [ ] RxBridge renders 3-list reconciliation comparison with status badges and teach-back comprehension prompts.
- [ ] Continuity Dossier displays source highlight links that pan/zoom to the exact bounding box on the original PDF/image.

### End-to-End Demo Flows (Flows A through E)
- [ ] Flow A: Discharge 3-list upload → agent explains changes → 2 drug & 1 diet flag detected → PillMap populated with diet-aware times.
- [ ] Flow B: PillMap drag OTC supplement → red arc drawn → timing shift previewed & approved → missed dose simulation.
- [ ] Flow C: HomeLab prescribed creatinine due card → photo upload → doctor pinned note & dose reduction proposal → patient approves → PillMap animated diff & LabStory band updated.
- [ ] Flow D: Danger sign (edema) reported → doctor removes NSAID & orders 3-day follow-up → calendar sync.
- [ ] Flow E: Caregiver proxy switch → audited approval on behalf → time-bound doctor access grant → Continuity Dossier compilation with source highlights.
