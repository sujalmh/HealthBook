# CareCanvas — Comprehensive Test Architecture & E2E Verification Specification

> **Document Version:** 1.0.0-PROD-SPEC  
> **Target System:** CareCanvas (WebMCP Patient-Facing Health Companion)  
> **Author:** `spec_miner_survey_3`  
> **Status:** Authoritative Test & Verification Specification  

---

## 1. Executive Summary & Verification Strategy

CareCanvas is an agent-native, patient-facing health companion unifying seven clinical modules:
1. **Approved Fact Vault** (Shared privacy-first local source of truth)
2. **LabStory** (Doctor-prescribed longitudinal biomarker causal engine)
3. **PillMap** (Visual 7x4 polypharmacy negotiator with SVG conflict arcs and diet badges)
4. **RxBridge** (Post-discharge 3-list conversational reconciliation)
5. **HomeLab Remote Loop** (Doctor-prescribed lab due cards, photo capture, dosage proposal cards, animated diffs)
6. **Safety Alerts & Follow-up** (Danger sign triage, doctor remote pill adjustments, multi-user calendar sync)
7. **Family Care Circle & Continuity Dossier** (Scoped proxy access, immutable audit logging, lifetime handover with PDF bounding-box highlights)

### 1.1 Core Verification Tenets
1. **Mandatory Human Approval Gate**: No cognitive output from AI/WebMCP tools (extracted facts, dosage proposals, schedule shifts, medication deletions) alters state or canvas without explicit patient or caregiver approval.
2. **Strict Client-Side Privacy**: All vault transactions, DuckDB-Wasm queries, and WebMCP tool executions run locally without exfiltrating unapproved Protected Health Information (PHI).
3. **Multi-Tiered Test Pyramid**:
   - **Tier 1**: Exhaustive Tool & Feature Coverage ($\ge 5$ test cases per feature across all 30+ WebMCP tools).
   - **Tier 2**: Boundary, Stress, and Corner Case Hardening.
   - **Tier 3**: Cross-Module Pairwise Integration Verification.
   - **Tier 4**: Real-World Complex Patient Journeys.
4. **End-to-End Golden Demonstration Flows**: Deterministic verification of Flows A through E covering the complete patient post-discharge lifecycle.

---

## 2. E2E Acceptance Test Flows (Flows A through E)

```
+----------------------------------------------------------------------------------------------------+
|                                CARECANVAS POST-DISCHARGE LIFECYCLE                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ FLOW A: Discharge Night ]                                                                       |
|  Upload 3 Med Lists -> Walk-Through -> 2 Drug + 1 Diet Flags -> Question Bank -> Diet-Aware PillMap |
|         |                                                                                          |
|         v                                                                                          |
|  [ FLOW B: Weekly Living ]                                                                         |
|  Drag OTC Supplement -> Red Conflict Arc -> Timing Shift Ghost Preview -> Missed Dose Adherence    |
|         |                                                                                          |
|         v                                                                                          |
|  [ FLOW C: Prescribed HomeLab Loop ]                                                               |
|  Due Card -> Lab Slip Photo -> Doctor Triage Note & Dose Reduction -> PillMap Diff & LabStory Band  |
|         |                                                                                          |
|         v                                                                                          |
|  [ FLOW D: Safety Escalation ]                                                                     |
|  Report Swelling (Edema) -> Doctor Removes NSAID & 3-Day Follow-Up -> Multi-User Calendar Sync     |
|         |                                                                                          |
|         v                                                                                          |
|  [ FLOW E: Caregiver Proxy & Doctor Switch ]                                                       |
|  Caregiver Proxy Switch -> Audited Action on Behalf -> Time-Bound Doctor Grant -> Dossier Bounding |
+----------------------------------------------------------------------------------------------------+
```

---

### Flow A: Post-Discharge 3-List Reconciliation & PillMap Onboarding

#### Primary Objective
Verify that a newly discharged patient can load three disparate medication lists (Pre-Admission, In-Hospital, Discharge), undergo an AI-guided conversational reconciliation walk with plain-language explanations, detect drug-drug and drug-diet conflicts, curate questions for the doctor, export a discharge home sheet, and seamlessly initialize Day 0 of the PillMap canvas with meal-timing constraints.

#### Test Execution Steps & Verification Matrix

| Step # | User Action | WebMCP Tool Invocations | Expected System State & UI Assertions | Human Approval Gate |
|---|---|---|---|---|
| **A.1** | User uploads 3 discharge documents: `preadmission_meds.pdf`, `inhospital_chart.pdf`, `discharge_orders.pdf`. | `extract_fact(document_id, doc_type)` | 1. PDF previews render with zoom/pan controls.<br>2. 9 distinct medication entries are extracted with normalized generic/brand names, dosages, and bounding boxes.<br>3. UI shows 3-column comparative view (Pre-admission, In-hospital, Discharge). | Pending review (`vault_status: pending_confirmation`). |
| **A.2** | User initiates Reconciliation Walk. | `explain_med_change(med_id, pre, in_hosp, post)` | 1. Agent walks med-by-med in plain language:<br> - *Metformin*: "Dose increased from 500mg to 1000mg twice daily to control blood sugar."<br> - *Lisinopril*: "STOPPED — hold due to kidney strain."<br> - *Apixaban*: "NEW — blood thinner started for atrial fibrillation."<br>2. Each item displays category badge: `[Continued]`, `[Dose Changed]`, `[Stopped]`, `[New]`, `[Held/Resumed]`. | Patient clicks `Approve Clarification` for each of the 9 items. |
| **A.3** | Agent evaluates regimen against OTCs, diet, and lab history. | `flag_interaction()`, `flag_diet_interaction()` | 1. **Flag 1 (Drug-Drug Major)**: Apixaban (Discharge) $\leftrightarrow$ OTC Fish Oil (Omega-3 1000mg from Vault) $\rightarrow$ "Additive bleeding risk."<br>2. **Flag 2 (Drug-Drug Severe)**: Lisinopril (Pre-admit accidentally resumed) $\leftrightarrow$ Spironolactone $\rightarrow$ "Severe hyperkalemia risk."<br>3. **Flag 3 (Drug-Diet Amber)**: Atorvastatin 40mg $\leftrightarrow$ Daily Grapefruit Intake $\rightarrow$ "CYP3A4 inhibition increases statin blood level and muscle toxicity risk." | UI displays interactive conflict warning cards with severity color coding (`red`, `orange`, `amber`). |
| **A.4** | User requests clarification on held medications. | `suggest_question_for_doctor(context)` | 1. Generates targeted questions:<br> - *"Why was Lisinopril stopped and should my primary doctor recheck kidney labs before restarting?"*<br> - *"Can I safely substitute Omega-3 with dietary flaxseed while on Apixaban?"*<br>2. Questions automatically append to the **Question Bank** (`F0.5`). | User taps `Add to Question Bank`. |
| **A.5** | User clicks `Export Patient Summary`. | `export_patient_summary(format='one_page_pdf')` | 1. Generates single-page printable patient summary containing: What Changed, Active Daily Schedule, Food/Diet Rules ("Take Levothyroxine on empty stomach 30m before breakfast; avoid grapefruit with Atorvastatin"), Red Flag Warning Symptoms, and Doctor Questions. | Declarative export preview rendered; patient downloads/prints. |
| **A.6** | User completes reconciliation and navigates to PillMap. | `set_reminder(schedule_map)` | 1. PillMap 7x4 canvas automatically populates Day 0 (Mon–Sun across Morning, Noon, Evening, Bedtime).<br>2. Diet badges attached to slots: `Levothyroxine` has `[🍽️ Empty Stomach]` badge; `Atorvastatin` has `[🚫 Grapefruit]` badge.<br>3. SVG conflict arc drawn between `Apixaban` (Morning) and `OTC Fish Oil`. | Canvas rendered with zero manual re-entry required. |

#### Post-Conditions & Invariants
- `IndexedDB/LocalVault.facts` contains 9 confirmed medication facts with author `patient`.
- `IndexedDB/LocalVault.questions` contains $\ge 2$ structured doctor questions.
- PillMap grid state matches reconciled discharge prescription list.

---

### Flow B: Weekly PillMap Visual Polypharmacy & Adherence Simulation

#### Primary Objective
Verify that a patient managing a weekly 7x4 pillbox can drag-and-drop an OTC supplement, receive immediate visual SVG conflict arcs, explore plain-language interaction mechanics, preview and approve chronotype-aware timing shifts, simulate missed dose clinical risk deltas, and export a one-page schedule for their pharmacist.

#### Test Execution Steps & Verification Matrix

| Step # | User Action | WebMCP Tool Invocations | Expected System State & UI Assertions | Human Approval Gate |
|---|---|---|---|---|
| **B.1** | User views active 7x4 PillMap canvas (7 Days $\times$ Morning, Noon, Evening, Bedtime). | `add_medication(name, dose, slot)` | 1. Canvas displays active prescription medications in designated time slots.<br>2. Pill icons display high-contrast color badges, strength, and meal icons. | Initial state loaded from confirmed Vault facts. |
| **B.2** | User drags `OTC St. John's Wort 300mg` from the supplement drawer into the `Morning` slot (already containing `Apixaban 5mg` and `Sertraline 50mg`). | `check_interactions()`, `check_duplicate_ingredient()` | 1. **Red SVG Arc** drawn between `St. John's Wort` and `Sertraline` (Pharmacodynamic Serotonin Syndrome risk).<br>2. **Orange SVG Arc** drawn between `St. John's Wort` and `Apixaban` (CYP3A4/P-gp induction reduces Apixaban blood level and increases stroke risk).<br>3. Pill icons pulse with severity border (`#EF4444` and `#F97316`). | Dynamic client-side calculation within $<50\text{ms}$. |
| **B.3** | User clicks on the Red SVG Arc between St. John's Wort and Sertraline. | N/A (Client modal/sheet view) | 1. Bottom sheet slides in with plain-language explanation: *"Taking St. John's Wort with Sertraline can cause excess serotonin levels leading to shivering, confusion, and high blood pressure."*<br>2. Clinical recommendation displayed: *"Discontinue St. John's Wort or consult physician for herbal alternatives."* | User reviews warning details. |
| **B.4** | User requests automated schedule optimization. | `suggest_schedule(chronotype='night_owl', diet_rules=true)` | 1. Agent computes non-conflicting timing shifts considering drug absorption and chronotype (wakes at 09:00, sleeps at 23:30).<br>2. PillMap renders **Ghost Previews** (translucent animated outlines) showing proposed moves:<br> - Move `Atorvastatin` from Morning to Bedtime.<br> - Separate `Calcium Carbonate` from `Levothyroxine` by 4 hours (Morning $\rightarrow$ Noon). | User presented with `[Approve Schedule Shift]` and `[Discard]` buttons. |
| **B.5** | User clicks `Approve Schedule Shift`. | Internal Canvas Animation Dispatch | 1. Ghost pills animate smoothly (CSS transform bezier curve) into target slots.<br>2. Conflict arcs recalculate and dissolve.<br>3. Vault schedule configuration is updated. | Patient explicit approval triggers commit. |
| **B.6** | User tests adherence resilience by dragging `Metformin 1000mg` off the `Tuesday Morning` slot into the discard zone. | `simulate_adherence(missed_med='Metformin', slot='Tuesday_Morning')` | 1. Adherence Simulation overlay renders:<br> - Plain-language clinical impact: *"Missing Tuesday morning Metformin increases estimated 24h peak glucose by ~35 mg/dL."*<br> - Recommendation: *"Take dose as soon as remembered unless within 4 hours of next scheduled dose. Do NOT double dose."* | Informational simulation without permanent schedule deletion. |
| **B.7** | User clicks `Export for Pharmacist`. | `export_for_pharmacist(format='pdf_map')` | 1. Generates 1-page visual map showing 7x4 color-coded grid, generic/brand crosswalk, drug-drug separation rules, and pharmacist verification notes. | Declarative download modal triggered. |

#### Post-Conditions & Invariants
- PillMap DOM contains valid SVG paths linking node coordinates $(x_1, y_1)$ to $(x_2, y_2)$.
- Ghost preview states clear upon approval confirmation.
- Adherence simulation returns deterministic clinical risk projections.

---

### Flow C: Prescribed HomeLab Loop (Due Card $\rightarrow$ Photo Upload $\rightarrow$ Doctor Dosage Proposal $\rightarrow$ PillMap & LabStory Sync)

#### Primary Objective
Verify the closed-loop HomeLab workflow where a patient receives a doctor-prescribed lab due card, uploads a smartphone photo of a remote lab result, undergoes automated narration and human approval, triggers doctor inbox review, receives a dosage adjustment proposal, approves the diff, and observes reactive updates across PillMap, LabStory, and calendar sync.

#### Test Execution Steps & Verification Matrix

| Step # | User Action | WebMCP Tool Invocations | Expected System State & UI Assertions | Human Approval Gate |
|---|---|---|---|---|
| **C.1** | Patient opens HomeLab dashboard. | N/A (Reads `IndexedDB/LocalVault.prescribed_labs`) | 1. Due Card displayed: `🧪 Serum Creatinine & eGFR — Due in 2 weeks (Prescribed by Dr. Patel at discharge)`.<br>2. Status badge: `[Due Soon]`. | N/A |
| **C.2** | Patient taps `Upload Labs` on the due card and captures photo of local lab slip (`homelab_creatinine_slip.jpg`). | `upload_lab_image(image_blob)`, `extract_labs(image_id)` | 1. Image preview displays with optical bounding box overlays.<br>2. Agent narrates extracted values:<br> - *"Serum Creatinine: 1.9 mg/dL (High — increased from 1.3 mg/dL at discharge)"*<br> - *"eGFR: 28 mL/min/1.73m² (Stage 4 Kidney Strain — decreased from 42)"* | Patient clicks `Approve Lab Values` (`confirm_fact`). |
| **C.3** | Lab values propagate into LabStory engine. | `confirm_fact(fact_id)` | 1. Due Card updates status to `[Completed]`.<br>2. LabStory DuckDB time-series appends new data point at date `2026-08-28`.<br>3. Urgent notification routed to Doctor Inbox (`doctor_review_queue`). | Vault commit verified. |
| **C.4** | Doctor reviews incoming alert in Triage Inbox. | `doctor_review_comment(lab_id, note)` | 1. Doctor attaches pinned comment to the `2026-08-28` creatinine data point: *"eGFR dropped below 30 mL/min; halving Metformin dose to avoid lactic acidosis risk."*<br>2. LabStory timeline displays pinned stethoscope icon on the data point. | Doctor authentication verified. |
| **C.5** | Doctor submits dosage change proposal. | `propose_dosage_change(med='Metformin', from_dose='1000mg', to_dose='500mg', reason='eGFR 28')` | 1. System generates a **Dosage Proposal Card** in the patient's HomeLab feed:<br> - Header: `👨‍⚕️ Dr. Patel recommends a medication adjustment`<br> - Change: `Metformin 1000mg Morning ➔ 500mg Morning`<br> - Rationale: `Protect kidney function due to recent lab result (eGFR 28)`. | Proposal remains in `pending_patient_approval` state. |
| **C.6** | Patient opens HomeLab and reviews Dosage Proposal Card. | `approve_dosage_change(proposal_id)` | 1. Patient reviews before/after comparison and taps `[Approve Change]`.<br>2. System executes `sync_pillmap_from_proposal()`. | Explicit Patient / Caregiver Approval Gate. |
| **C.7** | System synchronizes PillMap, LabStory, and Prescribed Cadence. | `sync_pillmap_from_proposal()`, `schedule_lab(cadence='4_weeks')`, `sync_to_calendar()` | 1. **PillMap Visual Diff**: Old 1000mg Metformin pill fades out (`opacity: 0`), new 500mg pill pulses with green ring.<br>2. **LabStory Med Band**: A new colored dosage intervention band begins at `2026-08-28` labeled `Metformin 500mg QD`.<br>3. **Next Lab Due Card Auto-Set**: New due card created: `🧪 Repeat Creatinine & Potassium — Due in 4 Weeks (2026-09-25)`.<br>4. Calendar entry synced with device alert. | Full reactive DOM update across all 3 modules. |

#### Post-Conditions & Invariants
- `IndexedDB/LocalVault.proposals` transitions from `pending` to `approved` with timestamp.
- LabStory timeline renders unbroken historical trend with superimposed med band.
- PillMap active regimen reflects Metformin 500mg in Morning slot.

---

### Flow D: Safety Alert Escalation & Doctor Remote Pill Adjustment

#### Primary Objective
Verify the rapid clinical safety escalation loop when a patient reports acute red-flag danger signs (bilateral peripheral edema, breathlessness), enabling physician triage, remote medication removal (NSAID de-escalation), direct in-person 3-day follow-up scheduling, multi-user calendar synchronization (patient and caregiver), and permanent pinning to the Continuity Dossier.

#### Test Execution Steps & Verification Matrix

| Step # | User Action | WebMCP Tool Invocations | Expected System State & UI Assertions | Human Approval Gate |
|---|---|---|---|---|
| **D.1** | Patient taps `Report Danger Sign` on Home/Safety dashboard. | `report_danger_sign(symptom_list, severity, notes, photo_blob)` | 1. Modal displays structured danger sign checklist: `[x] Swelling in ankles/feet (Edema)`, `[x] Shortness of breath`, `[ ] Chest pain`, `[ ] Dizziness`.<br>2. Free text entered: *"Feet are noticeably swollen since yesterday, shoes won't fit."*<br>3. Patient attaches photo `edema_feet.jpg`. | Patient taps `Submit Urgent Report`. |
| **D.2** | System triages report and notifies clinician. | `notify_doctor(priority='URGENT', alert_payload)` | 1. Patient UI displays emergency reassurance banner: *"Report sent to Dr. Patel's triage queue. If you experience severe chest pain or sudden inability to breathe, call 911 immediately."*<br>2. Doctor Triage Portal receives high-priority alert flashing red. | Automated notification dispatch. |
| **D.3** | Doctor reviews alert with complete clinical context. | `compile_health_record(patient_id)` | 1. Doctor views unified triage split-screen: Danger Sign Photo + Recent eGFR 28 + Active PillMap showing `Ibuprofen 400mg TID` and `Furosemide 20mg QD`.<br>2. Clinical inference: NSAID-induced fluid retention and nephrotoxicity on underlying CKD. | Doctor reviews complete dossier context. |
| **D.4** | Doctor orders immediate removal of Ibuprofen and schedules urgent follow-up. | `doctor_remove_medication(med='Ibuprofen', reason='Fluid retention & AKI risk')`, `schedule_followup(date='+3d', type='In-Person Clinic', reason='Edema evaluation')` | 1. System issues an urgent **Doctor Action Card** to the patient and linked caregiver.<br>2. Action Card: `Dr. Patel recommends STOPPING Ibuprofen immediately due to swelling and orders an in-person clinic visit in 3 days.` | Action awaiting patient / proxy approval. |
| **D.5** | Patient / Caregiver approves the doctor's safety action. | `approve_pillmap_change(action_id)` | 1. Patient taps `[Approve & Stop Ibuprofen]`.<br>2. PillMap animates Ibuprofen icon dissolving with red strikethrough.<br>3. All interaction arcs connected to Ibuprofen are purged from canvas. | Patient / Proxy explicit approval. |
| **D.6** | System creates calendar appointments for Patient and Caregiver. | `sync_to_calendar(event_details)` | 1. Calendar event created: `🏥 Dr. Patel Follow-up: Edema & Kidney Check — Thursday at 10:00 AM`.<br>2. Reminders configured for 24 hours prior (SMS/Push) and 2 hours prior.<br>3. Identical calendar invite dispatched to linked caregiver (`Raj`). | Native calendar export / Web Calendar API dispatched. |
| **D.7** | Safety event is logged in Continuity Dossier. | Internal Vault Audit Commit | 1. Continuity Dossier timeline appends complete incident record: Danger Sign Report $\rightarrow$ Clinician Triage $\rightarrow$ Ibuprofen Discontinuation $\rightarrow$ 3-Day Follow-Up Booking. | Immutable audit entry created. |

#### Post-Conditions & Invariants
- `Ibuprofen` is marked `status: discontinued` in Vault.
- PillMap canvas no longer renders Ibuprofen in any slot.
- Calendar store contains verified 3-day follow-up event.

---

### Flow E: Family Care Circle Proxy Switch & Time-Bound Doctor Handover

#### Primary Objective
Verify caregiver proxy switching with fine-grained scoped permissions, audited approvals on behalf of elderly/pediatric patients, generation of the compiled Continuity Dossier with interactive bounding-box source links, and time-bound clinician access granting and revocation.

#### Test Execution Steps & Verification Matrix

| Step # | User Action | WebMCP Tool Invocations | Expected System State & UI Assertions | Human Approval Gate |
|---|---|---|---|---|
| **E.1** | Caregiver (`Raj`, son) logs into CareCanvas. | `switch_profile(target_patient_id='p_devi_78')` | 1. Caregiver dashboard displays patient profile switcher: `[Self] | [S. Devi (Mother - 78yo)]`.<br>2. Active profile switches to `S. Devi`.<br>3. Header displays persistent proxy banner: `👁️ Managing Care for S. Devi (Mother) — Manage Permissions Active`. | Authenticated proxy session. |
| **E.2** | Caregiver reviews pending Doctor Proposal (Metformin dose reduction from Flow C). | `act_on_behalf(action='approve_dosage_change', payload)` | 1. Caregiver taps `[Approve on Behalf]`.<br>2. Vault audit log records transaction metadata: `{"author": "Raj (Son)", "on_behalf_of": "S. Devi", "role": "caregiver_manage", "timestamp": "2026-08-28T13:40:00Z"}`.<br>3. UI shows: *"Approved by Raj (son) on behalf of S. Devi"*. | Audited Proxy Approval Gate. |
| **E.3** | Patient/Caregiver prepares for consultation with a new Nephrologist (`Dr. Chen`). | `compile_health_record(patient_id='p_devi_78')` | 1. Continuity Dossier compiles all 7 modules into a unified longitudinal view:<br> - Demographics & Allergies (Penicillin - Anaphylaxis)<br> - 5-Year LabStory time-series with normal vs optimal bands<br> - RxBridge 3-list reconciliation diff history<br> - Current 7x4 PillMap regimen with meal badges<br> - HomeLab review timeline & pinned doctor comments<br> - Safety Alert incident log & danger sign photo<br> - Complete Caregiver Proxy audit trail. | Dynamic local compilation from IndexedDB. |
| **E.4** | User clicks on source citation for historical diagnosis: *"CKD Stage 3b diagnosed on 2024-04-12"*. | `view_timeline(item_id)` | 1. Built-in PDF/document viewer splits screen.<br>2. Document automatically scrolls, zooms to 150%, and draws a translucent blue bounding box `[x: 120, y: 340, w: 220, h: 45]` around the text on the original scan `nephrology_consult_2024.pdf`. | Precise bounding-box coordinate matching verified. |
| **E.5** | Patient/Caregiver grants time-bound access to Dr. Chen. | `grant_doctor_access(doctor_email='dr.chen@nephrology.org', duration='7d')` | 1. Generates secure, ephemeral time-bound access token (expires in 7 days).<br>2. Access control table records active grant.<br>3. Privacy Badge reflects: `1 Active Clinician Access Grant (Dr. Chen)`. | Patient / Caregiver explicit grant confirmation. |
| **E.6** | User tests emergency access revocation. | `revoke_access(grant_id)` | 1. User taps `[Revoke Access Immediately]`.<br>2. Ephemeral token invalidated in LocalVault.<br>3. Subsequent access attempts by Dr. Chen return `403 Forbidden: Access Grant Revoked`. | Immediate security termination. |

#### Post-Conditions & Invariants
- Audit log contains unalterable cryptographic hash of proxy actions.
- Source highlight viewer correctly maps normalized bounding-box coordinates $[0-1000]$ to viewport pixels.
- Revoked doctor tokens cannot retrieve dossier payloads.

---

## 3. 4-Tier Test Suite Specification

```
+----------------------------------------------------------------------------------------------------+
|                                    4-TIER TEST SUITE PYRAMID                                       |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ TIER 4: Real-World Workload Scenarios ]                                                      |
|    Complete complex multi-condition longitudinal patient histories (CKD, T2D, HFpEF, Polypharmacy) |
|                                                                                                    |
|    [ TIER 3: Cross-Feature Integration Combinations ]                                              |
|    12 Pairwise integration channels across Vault, LabStory, PillMap, RxBridge, HomeLab, Safety, Circle|
|                                                                                                    |
|    [ TIER 2: Boundary, Stress & Edge Cases ]                                                      |
|    Empty lists, extreme labs (eGFR<10), 15+ meds, multi-conflict cascades, OCR noise, auth limits  |
|                                                                                                    |
|    [ TIER 1: Feature Coverage (>=5 Tests per Feature across 30+ Tools) ]                          |
|    Comprehensive functional verification of all WebMCP tool contracts, inputs, outputs, schemas   |
+----------------------------------------------------------------------------------------------------+
```

---

### Tier 1: Exhaustive Feature Coverage ($\ge 5$ Test Cases per Feature across 30+ Tools)

#### Module 0: Approved Fact Vault Engine

##### Tool: `extract_fact(document_id, doc_type)`
- **TC-V01-01 (Standard Lab Fact Extraction)**: Input valid PDF lab slip $\rightarrow$ Output structured array with `fact_type: 'lab'`, `biomarker: 'Creatinine'`, `value: 1.8`, `unit: 'mg/dL'`, `plain_narration: 'Kidney function low'`, `bounding_box: [100, 200, 150, 30]`. Assert state: `status: 'pending'`.
- **TC-V01-02 (Medication Fact Extraction)**: Input discharge order $\rightarrow$ Output `fact_type: 'medication'`, `drug_name: 'Apixaban'`, `dose: '5mg'`, `frequency: 'BID'`, `route: 'oral'`, `plain_narration: 'New blood thinner'`.
- **TC-V01-03 (Allergy Fact Extraction)**: Input clinical history $\rightarrow$ Output `fact_type: 'allergy'`, `allergen: 'Penicillin'`, `reaction: 'Anaphylaxis'`, `severity: 'severe'`.
- **TC-V01-04 (Condition Fact Extraction)**: Input diagnosis text $\rightarrow$ Output `fact_type: 'condition'`, `condition: 'Type 2 Diabetes Mellitus'`, `icd10: 'E11.9'`, `status: 'active'`.
- **TC-V01-05 (Malformed Document Handling)**: Input corrupted image $\rightarrow$ Output error payload `{"error": "PARSE_FAILED", "message": "Document unreadable, please upload higher resolution image"}`.

##### Tool: `confirm_fact(fact_id, action, edits)`
- **TC-V02-01 (Fact Approval)**: Call with `action: 'approve'` $\rightarrow$ Fact status in IndexedDB updates to `confirmed`; emits `fact_confirmed` event; fact propagates to LabStory/PillMap.
- **TC-V02-02 (Fact Rejection)**: Call with `action: 'reject'` $\rightarrow$ Fact status updates to `rejected`; never propagates to downstream canvases.
- **TC-V02-03 (Fact In-Line Edit & Approve)**: Call with `action: 'edit'`, `edits: { dose: '20mg' }` $\rightarrow$ Fact value overwritten with audit trail noting patient modification; status updates to `confirmed`.
- **TC-V02-04 (Idempotency Guard)**: Call confirm on already confirmed fact $\rightarrow$ Returns existing confirmed state without duplicating records.
- **TC-V02-05 (Invalid Fact ID)**: Call with non-existent ID `fact_9999` $\rightarrow$ Returns error `{"error": "FACT_NOT_FOUND"}`.

##### Tool: `compile_health_record(patient_id, sections)`
- **TC-V03-01 (Full Lifetime Compilation)**: Call with `sections: ['all']` $\rightarrow$ Returns JSON bundle aggregating demographics, confirmed conditions, multi-year labs, medication diffs, danger alerts, and caregiver audit log.
- **TC-V03-02 (Partial Section Filter)**: Call with `sections: ['labs', 'meds']` $\rightarrow$ Returns scoped payload omitting allergies and proxy logs.
- **TC-V03-03 (Privacy Exclusion Verification)**: Verify that facts with `status: 'rejected'` or `status: 'pending'` are strictly excluded from compiled output.
- **TC-V03-04 (Source Link Preservation)**: Every compiled record includes valid `source_doc_id` and normalized `bounding_box` coordinates.
- **TC-V03-05 (Empty Vault Compilation)**: Call on brand-new patient $\rightarrow$ Returns valid empty schema without null pointer exceptions.

---

#### Module 1: LabStory Causal Biomarker Engine

##### Tool: `extract_labs(document_id)`
- **TC-LS01-01 (Multi-Marker Extraction)**: Input Comprehensive Metabolic Panel $\rightarrow$ Returns array of 14 normalized lab markers (Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, Chloride, CO2, Calcium, Protein, Albumin, Bilirubin, AST, ALT).
- **TC-LS01-02 (Unit Normalization)**: Input lab report with Glucose in `mmol/L` (7.0) $\rightarrow$ Automatically normalizes and converts to `mg/dL` (126.0) with original unit preserved in metadata.
- **TC-LS01-03 (Borderline Buffer Detection)**: Input Potassium 5.1 mEq/L (Reference max 5.0) $\rightarrow$ Flags `is_borderline: true` with warning `"Slightly elevated (within 10% buffer)"`.
- **TC-LS01-04 (Historical Date Parsing)**: Input lab with collection date `14-Jan-2023` $\rightarrow$ Converts to ISO 8601 `2023-01-14T08:00:00Z` and places correctly on DuckDB time-series axis.
- **TC-LS01-05 (Duplicate Lab Rejection)**: Upload identical lab slip twice $\rightarrow$ Detects matching timestamp, marker, and value; flags duplicate without creating redundant chart nodes.

##### Tool: `correlate_meds(biomarker, start_date, end_date)`
- **TC-LS02-01 (Glucose vs Prednisone Correlation)**: Query `biomarker: 'Glucose'`, spanning Prednisone course $\rightarrow$ Returns causal narrative: *"Fasting blood glucose spiked from 110 mg/dL to 215 mg/dL coincident with starting Prednisone 20mg on 2026-02-10."*
- **TC-LS02-02 (eGFR vs NSAID Correlation)**: Query `biomarker: 'eGFR'`, spanning Ibuprofen intake $\rightarrow$ Returns narrative: *"eGFR declined by 26% during regular NSAID use."*
- **TC-LS02-03 (A1c vs Metformin Adherence)**: Query `biomarker: 'HbA1c'` with simulated adherence data $\rightarrow$ Returns adherence correlation curve.
- **TC-LS02-04 (Potassium vs ACEi + Spironolactone)**: Query `biomarker: 'Potassium'` $\rightarrow$ Returns causal correlation showing additive drug effect.
- **TC-LS02-05 (No Medication Correlation)**: Query biomarker with stable values and no active med changes $\rightarrow$ Returns *"No significant medication-induced biomarker fluctuations detected."*

---

#### Module 2: PillMap Visual Polypharmacy Negotiator

##### Tool: `add_medication(name, dose, frequency, slot)`
- **TC-PM01-01 (Standard Placement)**: Add `Lisinopril 10mg` to `Morning` slot $\rightarrow$ Returns success; creates pill node on 7x4 canvas.
- **TC-PM01-02 (Multi-Dose Schedule)**: Add `Metformin 500mg` `BID` $\rightarrow$ Populates both `Morning` and `Evening` slots across Mon–Sun.
- **TC-PM01-03 (PRN As-Needed Med)**: Add `Albuterol Inhaler 2 puffs PRN` $\rightarrow$ Places in designated PRN drawer off the main 7x4 grid.
- **TC-PM01-04 (Invalid Slot Validation)**: Add med with slot `Midnight_Snack` $\rightarrow$ Returns schema validation error `{"error": "INVALID_SLOT", "allowed": ["Morning", "Noon", "Evening", "Bedtime"]}`.
- **TC-PM01-05 (Duplicate Med Addition)**: Add existing med with identical parameters $\rightarrow$ Prompts user with *"Medication already in this slot. Update dose instead?"*.

##### Tool: `check_interactions(med_list)`
- **TC-PM02-01 (Contraindicated Pair - Red Arc)**: Evaluate `Warfarin` + `Aspirin` + `Ibuprofen` $\rightarrow$ Returns Red Contraindicated alert: Severe gastrointestinal hemorrhage risk.
- **TC-PM02-02 (Major Pair - Orange Arc)**: Evaluate `Ciprofloxacin` + `Calcium Carbonate` $\rightarrow$ Returns Orange Major alert: Chelation reduces antibiotic bioavailability by >70%.
- **TC-PM02-03 (Moderate Pair - Yellow Arc)**: Evaluate `Amlodipine` + `Simvastatin` $\rightarrow$ Returns Yellow Moderate alert: Increased risk of myopathy; suggest limiting Simvastatin to 20mg daily.
- **TC-PM02-04 (Clean Multi-Drug Regimen)**: Evaluate 5 non-interacting medications $\rightarrow$ Returns `interactions: []` with canvas clear of conflict arcs.
- **TC-PM02-05 (Triple Whammy Interaction)**: Evaluate `ACE Inhibitor` + `Loop Diuretic` + `NSAID` $\rightarrow$ Returns severe acute renal failure warning.

##### Tool: `check_diet_interactions(med_list, patient_diet)`
- **TC-PM03-01 (Statin + Grapefruit)**: Evaluate `Atorvastatin` + Diet `grapefruit: true` $\rightarrow$ Returns amber badge on Atorvastatin and meal warning *"Avoid grapefruit and grapefruit juice"*.
- **TC-PM03-02 (Warfarin + High Vitamin K Greens)**: Evaluate `Warfarin` + Diet `spinach_kale_frequent: true` $\rightarrow$ Returns warning *"Maintain consistent dietary vitamin K intake to avoid INR fluctuations"*.
- **TC-PM03-03 (Levothyroxine + Dairy/Breakfast)**: Evaluate `Levothyroxine` $\rightarrow$ Returns timing rule *"Take 30 to 60 minutes before breakfast with water only; separate from dairy/calcium by 4 hours"*.
- **TC-PM03-04 (Metronidazole + Alcohol)**: Evaluate `Metronidazole` $\rightarrow$ Returns severe warning *"Disulfiram-like reaction: completely avoid alcohol during and 48h after therapy"*.
- **TC-PM03-05 (ACE Inhibitor + High Potassium Salt Substitutes)**: Evaluate `Lisinopril` + Diet `potassium_salt: true` $\rightarrow$ Returns hyperkalemia warning.

##### Tool: `check_duplicate_ingredient(med_list)`
- **TC-PM04-01 (Acetaminophen Hidden Duplicate)**: Evaluate `Tylenol 500mg` + `Percocet (Oxycodone/APAP 5/325mg)` $\rightarrow$ Returns duplicate APAP alert; calculates cumulative daily dose (e.g. 4300mg > 4000mg max safe limit).
- **TC-PM04-02 (NSAID Hidden Duplicate)**: Evaluate `Advil (Ibuprofen 200mg)` + `Aleve (Naproxen 220mg)` $\rightarrow$ Flags concurrent dual NSAID toxicity.
- **TC-PM04-03 (Statin Duplicate)**: Evaluate `Lipitor` + `Atorvastatin` (Brand/Generic overlap) $\rightarrow$ Flags exact chemical duplicate.
- **TC-PM04-04 (No Duplicates Clean Regimen)**: Evaluate 8 distinct active ingredients $\rightarrow$ Returns `duplicates: []`.
- **TC-PM04-05 (Combination Drug Deconstruction)**: Evaluate `Janumet (Sitagliptin/Metformin)` + `Metformin 500mg` $\rightarrow$ Accurately extracts metformin from combination and sums total daily milligram intake.

##### Tool: `suggest_schedule(med_list, chronotype, preferences)`
- **TC-PM05-01 (Night Owl Statin Optimization)**: Input `Atorvastatin`, `Levothyroxine`, `Omeprazole`, `chronotype: 'night_owl'` $\rightarrow$ Schedules Levothyroxine at 09:30 (waking), Omeprazole at 10:00 (before meal), Atorvastatin at 23:30 (bedtime).
- **TC-PM05-02 (Early Bird Multi-Drug Separation)**: Input `Calcium`, `Iron`, `Levothyroxine`, `chronotype: 'early_bird'` $\rightarrow$ Separates absorption-competing cations by $\ge 4$ hours across Morning, Noon, Evening.
- **TC-PM05-03 (Diuretic Timing Protection)**: Input `Furosemide 40mg` $\rightarrow$ Schedules in Morning (08:00) and Noon (13:00); strictly blocks Bedtime scheduling to prevent nocturia.
- **TC-PM05-04 (Sedative Bedtime Placement)**: Input `Zolpidem 5mg` $\rightarrow$ Automatically locks to Bedtime slot.
- **TC-PM05-05 (Ghost Preview Generation)**: Verify tool returns coordinates and CSS delta payloads for rendering translucent visual ghost previews on the canvas before confirmation.

##### Tool: `simulate_adherence(med_list, missed_dose)`
- **TC-PM06-01 (Missed Antihypertensive)**: Simulate missing `Amlodipine 10mg` Tuesday Morning $\rightarrow$ Returns projected BP rebound risk (+12-18 mmHg systolic) and recovery instructions.
- **TC-PM06-02 (Missed Anticoagulant)**: Simulate missing `Apixaban 5mg` Evening $\rightarrow$ Returns stroke risk delta and half-life decay warning.
- **TC-PM06-03 (Missed Insulin/Hypoglycemic)**: Simulate missing `Glipizide` before lunch $\rightarrow$ Returns postprandial hyperglycemia projection.
- **TC-PM06-04 (Missed Antibiotic)**: Simulate missing dose 4 of 10 for `Amoxicillin` $\rightarrow$ Returns bacterial resistance risk and adherence catch-up protocol.
- **TC-PM06-05 (Multi-Dose Omission)**: Simulate missing 3 consecutive days of `Beta Blocker` $\rightarrow$ Returns urgent warning on rebound tachycardia and hypertensive crisis.

##### Tool: `export_for_pharmacist(format)`
- **TC-PM07-01 (PDF Map Export)**: Request `format: 'pdf_map'` $\rightarrow$ Returns base64/binary PDF buffer containing complete 7x4 visual grid, pill photos, brand/generic map, and food timing rules.
- **TC-PM07-02 (JSON Data Interchange)**: Request `format: 'json'` $\rightarrow$ Returns standardized schema consumable by pharmacy management systems.
- **TC-PM07-03 (Print-Optimized High Contrast Layout)**: Verifies layout stylesheet applies pure black/white high-contrast typography suitable for thermal/office printers.
- **TC-PM07-04 (Pharmacist Signature Block Inclusion)**: Generated document includes verification checklist and PharmD signature block.
- **TC-PM07-05 (Empty Regimen Export Guard)**: Request export with 0 medications $\rightarrow$ Returns error `{"error": "CANVAS_EMPTY", "message": "Cannot export empty schedule"}`.

##### Tool: `set_reminder(slot_reminders)`
- **TC-PM08-01 (Morning Batch Reminder)**: Set reminder for `Morning: '08:00'` $\rightarrow$ Registers local notification trigger for 08:00 daily containing all morning pills in one notification.
- **TC-PM08-02 (Slot-Grouped Alert Optimization)**: Verify reminders are grouped by *time slot* rather than firing individual alerts for each separate pill.
- **TC-PM08-03 (Persistence Across App Restart)**: Verify reminders persist in IndexedDB and re-register on browser reload.
- **TC-PM08-04 (Snooze Logic)**: Trigger reminder $\rightarrow$ User selects `Snooze 15 min` $\rightarrow$ Re-fires at $T+15\text{min}$.
- **TC-PM08-05 (Invalid Time Format)**: Set reminder with invalid string `25:99` $\rightarrow$ Returns validation error.

---

#### Module 3: RxBridge Post-Discharge Reconciliation Engine

##### Tool: `explain_med_change(med_id, pre_hosp, in_hosp, discharge)`
- **TC-RB01-01 (Dose Escalation Explanation)**: `Pre: Metformin 500mg QD`, `Post: Metformin 1000mg BID` $\rightarrow$ Returns plain explanation: *"Your Metformin dose was increased to 1000mg twice daily to improve blood sugar control."* Badge: `[Dose Changed]`.
- **TC-RB01-02 (Discontinued Medication)**: `Pre: Lisinopril 20mg`, `Post: None` $\rightarrow$ Returns: *"Lisinopril was stopped in the hospital to protect your kidneys."* Badge: `[Stopped]`.
- **TC-RB01-03 (New In-Hospital Addition)**: `Pre: None`, `Post: Apixaban 5mg BID` $\rightarrow$ Returns: *"Apixaban is a new blood thinner started to prevent blood clots."* Badge: `[New]`.
- **TC-RB01-04 (Held in Hospital & Resumed)**: `Pre: Atorvastatin 40mg`, `In-Hosp: Held`, `Post: Atorvastatin 40mg` $\rightarrow$ Returns: *"Atorvastatin was paused during your stay and is now resumed at your home dose."* Badge: `[Held & Resumed]`.
- **TC-RB01-05 (Unchanged Continuous Med)**: `Pre: Levothyroxine 100mcg`, `Post: Levothyroxine 100mcg` $\rightarrow$ Returns: *"Continued without changes."* Badge: `[Continued]`.

##### Tool: `flag_interaction(discharge_list, pre_admit_otcs)`
- **TC-RB02-01 (Discharge Rx vs Pre-Admit OTC)**: Discharge `Apixaban` vs Home `Fish Oil 1200mg` $\rightarrow$ Flags bleeding risk and prompts patient approval to hold supplement.
- **TC-RB02-02 (Discharge Rx vs Pre-Admit Herbal)**: Discharge `Warfarin` vs Home `Ginkgo Biloba` $\rightarrow$ Flags severe hemorrhage hazard.
- **TC-RB02-03 (Dual Anticoagulation Discrepancy)**: Discharge contains both `Enoxaparin (Lovenox)` and `Rivaroxaban (Xarelto)` $\rightarrow$ Triggers critical hospital discharge error alert.
- **TC-RB02-04 (Lab Contextualized Flag)**: Discharge `Spironolactone 50mg` + LabStory `Potassium 5.4 mEq/L` $\rightarrow$ Contextualizes warning with live lab biomarker value.
- **TC-RB02-05 (Zero Conflict Discharge)**: Reconciles clean regimen $\rightarrow$ Returns `flags: []`.

##### Tool: `flag_diet_interaction(discharge_list, patient_diet_profile)`
- **TC-RB03-01 (Statin + Citrus Diet)**: Checks discharge `Simvastatin` vs profile `drinks_grapefruit_daily: true` $\rightarrow$ Flags severe rhabdomyolysis risk.
- **TC-RB03-02 (Anticoagulant + Vitamin K Diet)**: Checks `Warfarin` vs `vegetarian_greens: true` $\rightarrow$ Flags dietary INR instability.
- **TC-RB03-03 (Antibiotic + Dairy)**: Checks `Doxycycline` vs `dairy_breakfast: true` $\rightarrow$ Recommends timing shift to avoid chelation.
- **TC-RB03-04 (Diuretic + Licorice)**: Checks `Hydrochlorothiazide` vs `black_licorice_candy: true` $\rightarrow$ Flags hypokalemia and hypertension risk.
- **TC-RB03-05 (Diet Record Persistence)**: Verifies user-entered diet preferences persist in Vault and auto-apply to future reconciliation runs.

##### Tool: `suggest_question_for_doctor(reconciliation_item)`
- **TC-RB04-01 (Unclear Discontinuation Question)**: Item: `Atenolol STOPPED (Reason not stated in discharge summary)` $\rightarrow$ Generates: *"Why was my Atenolol stopped, and should I monitor my heart rate at home?"*
- **TC-RB04-02 (Dose Double Check Question)**: Item: `Prednisone 40mg (High dose)` $\rightarrow$ Generates: *"What is the taper schedule for my Prednisone?"*
- **TC-RB04-03 (Lab Monitoring Question)**: Item: `New Furosemide + Low eGFR` $\rightarrow$ Generates: *"When should I get my kidney function and potassium rechecked?"*
- **TC-RB04-04 (Auto-Aggregation to Bank)**: Approved questions automatically append to `IndexedDB/LocalVault.question_bank`.
- **TC-RB04-05 (Custom Patient Question Input)**: Allows patient to edit or append custom personal questions into the bank.

##### Tool: `export_patient_summary(format)`
- **TC-RB05-01 (One-Page PDF Discharge Sheet)**: Generates formatted patient sheet with: Reconciled Med List, Clear Changes, Meal Rules, Doctor Questions, Red Flags.
- **TC-RB05-02 (Teach-Back Confirmation Checklist)**: Includes verified patient comprehension responses in the generated summary.
- **TC-RB05-03 (Multi-Language Export)**: Generates discharge sheet in patient's preferred language (e.g. English, Spanish).
- **TC-RB05-04 (QR Code Verification Link)**: Includes secure local QR code allowing offline mobile scanning of the reconciled regimen.
- **TC-RB05-05 (Emergency Contact Block)**: Automatically embeds clinic follow-up phone number and discharge ward contact.

---

#### Module 4: HomeLab Remote Prescribed Loop Engine

##### Tool: `upload_lab_image(image_blob, metadata)`
- **TC-HL01-01 (Standard Photo Slip Ingestion)**: Ingests 4MB JPEG photo of remote lab slip $\rightarrow$ Stores local blob, runs local image pre-processing (contrast auto-levels, deskew), and returns `image_id`.
- **TC-HL01-02 (PDF Scan Ingestion)**: Ingests multi-page PDF lab report $\rightarrow$ Extracts rasterized page buffers for OCR.
- **TC-HL01-03 (Low Lighting / Blurry Image Warning)**: Ingests blurred image (Laplacian variance $< 100$) $\rightarrow$ Returns warning: *"Image appears blurry. Please verify extracted numbers carefully."*
- **TC-HL01-04 (Metadata Tagging)**: Correctly tags `prescribed_due_card_id`, `patient_id`, and `upload_timestamp`.
- **TC-HL01-05 (Storage Quota Check)**: Handles local IndexedDB storage limits gracefully by compressing image buffers before storage.

##### Tool: `doctor_review_comment(lab_id, comment_text, pinned_marker)`
- **TC-HL02-01 (Pin Comment to Biomarker Point)**: Doctor posts note to Creatinine point `2026-08-28` $\rightarrow$ Pinned comment icon appears on LabStory chart node.
- **TC-HL02-02 (General Visit Note)**: Doctor posts overall review note $\rightarrow$ Appends to HomeLab review log.
- **TC-HL02-03 (Audit Timestamp & Credentials)**: Attaches doctor ID `dr_patel_md`, NPI, and ISO timestamp to the pinned comment.
- **TC-HL02-04 (Patient Read Receipt)**: When patient views pinned comment in UI, status updates to `read: true`.
- **TC-HL02-05 (Empty Comment Rejection)**: Submitting empty string $\rightarrow$ Returns validation error.

##### Tool: `propose_dosage_change(med_name, current_dose, proposed_dose, reason, linked_lab_id)`
- **TC-HL03-01 (Standard Reduction Proposal)**: Proposes `Metformin 1000mg -> 500mg` linked to `Creatinine 1.9 mg/dL` $\rightarrow$ Creates proposal card in `status: 'pending'`.
- **TC-HL03-02 (Medication Discontinuation Proposal)**: Proposes stopping `Spironolactone` due to `Potassium 5.8 mEq/L` $\rightarrow$ Formats proposal as `[DISCONTINUE]`.
- **TC-HL03-03 (Dose Increase Proposal)**: Proposes increasing `Levothyroxine 75mcg -> 88mcg` due to `TSH 6.2` $\rightarrow$ Formats proposal as `[TITRATE_UP]`.
- **TC-HL03-04 (Plain-Language Explanation Generation)**: Automatically generates patient explainer: *"Your doctor recommends changing Metformin from 1000mg to 500mg because your kidney lab showed reduced filtering capacity."*
- **TC-HL03-05 (Duplicate Proposal Guard)**: Proposing change on medication with already active pending proposal $\rightarrow$ Replaces or updates pending proposal without creating orphan records.

##### Tool: `approve_dosage_change(proposal_id, approved_by)`
- **TC-HL04-01 (Patient Direct Approval)**: Patient approves proposal $\rightarrow$ Proposal status updates to `approved`; triggers downstream sync.
- **TC-HL04-02 (Caregiver Proxy Approval)**: Caregiver approves with role `caregiver_manage` $\rightarrow$ Records proxy audit trail `approved_by: 'Raj (Son) on behalf of S. Devi'`.
- **TC-HL04-03 (Proposal Rejection)**: Patient rejects proposal $\rightarrow$ Status updates to `rejected`; PillMap remains unchanged; notification sent back to doctor inbox.
- **TC-HL04-04 (Edit & Counter-Propose)**: Patient requests alternate timing $\rightarrow$ Creates negotiation note for doctor.
- **TC-HL04-05 (Expired Proposal Handling)**: Approving proposal older than 30 days $\rightarrow$ Prompts: *"Proposal expired. Please request updated clinician review."*

##### Tool: `sync_pillmap_from_proposal(proposal_id)`
- **TC-HL05-01 (PillMap Reactive Replacement)**: Updates 7x4 canvas to swap 1000mg pill for 500mg pill across all scheduled days.
- **TC-HL05-02 (Visual Diff Animation Trigger)**: Emits DOM animation event: previous pill triggers fade-out transition (`duration: 400ms`), new pill triggers pulse glow (`#22C55E`).
- **TC-HL05-03 (Interaction Re-Check Execution)**: Automatically re-runs `check_interactions()` and `check_diet_interactions()` on the newly modified canvas state.
- **TC-HL05-04 (LabStory Intervention Band Trigger)**: Dispatches event to LabStory to draw a continuous vertical med band starting from the approval date.
- **TC-HL05-05 (Rollback on Sync Failure)**: If IndexedDB transaction aborts, canvas restores previous state with zero UI corruption.

---

#### Module 5: Safety Alerts, Doctor Triage & Multi-User Calendar

##### Tool: `report_danger_sign(symptom_tags, free_text, severity_rating, photo_blob)`
- **TC-SF01-01 (Acute Fluid Overload Report)**: Submit `tags: ['edema_feet', 'dyspnea']`, `severity: 'severe'` $\rightarrow$ Creates high-priority safety alert in Vault; returns emergency guidance.
- **TC-SF01-02 (Hypoglycemia Warning Report)**: Submit `tags: ['shakiness', 'sweating', 'confusion']` $\rightarrow$ Delivers immediate first-aid advice (15g fast-acting carbs rule) while alerting doctor.
- **TC-SF01-03 (Hypertensive Urgency Report)**: Submit `BP: '185/115'`, `tags: ['headache', 'vision_changes']` $\rightarrow$ Escalates to critical red alert.
- **TC-SF01-04 (Photo Attachment Ingestion)**: Attaches photo of pedal edema $\rightarrow$ Stores compressed blob and generates thumbnail for doctor triage view.
- **TC-SF01-05 (Emergency Contact Display)**: Verified that emergency 911 banner and clinic direct-dial buttons are prominently displayed on all danger sign confirmation views.

##### Tool: `notify_doctor(priority, alert_payload)`
- **TC-SF02-01 (Urgent Triage Push)**: Call with `priority: 'URGENT'` $\rightarrow$ Enqueues triage ticket at top of doctor inbox with visual flashing indicator.
- **TC-SF02-02 (Standard Triage Routing)**: Call with `priority: 'ROUTINE'` $\rightarrow$ Enqueues in standard non-emergency review queue.
- **TC-SF02-03 (Payload Schema Completeness)**: Verifies payload includes `patient_id`, `symptoms`, `vital_signs`, `active_meds`, `last_lab_summary`, and `timestamp`.
- **TC-SF02-04 (Notification Rate Limiting)**: Prevents notification spam by consolidating duplicate alerts submitted within 5 minutes into a single incident thread.
- **TC-SF02-05 (Offline Queuing)**: If client is temporarily offline, queues notification in IndexedDB and flushes upon network reconnection.

##### Tool: `doctor_remove_medication(med_name, reason, patient_id)`
- **TC-SF03-01 (Emergency NSAID Removal Proposal)**: Doctor removes `Ibuprofen` due to `Edema + AKI` $\rightarrow$ Issues high-priority action card to patient.
- **TC-SF03-02 (Anticoagulant Hold Proposal)**: Doctor holds `Apixaban` due to active bleeding report $\rightarrow$ Issues urgent stop order card.
- **TC-SF03-03 (Audit Rationale Requirement)**: Rejects command if `reason` string is empty or less than 5 characters.
- **TC-SF03-04 (Patient Gating Verification)**: Verified that medication is NOT removed from PillMap until patient/caregiver approves the removal card.
- **TC-SF03-05 (Simultaneous Multi-Med Removal)**: Doctor orders removal of two conflicting drugs $\rightarrow$ Groups into single unified approval action card.

##### Tool: `approve_pillmap_change(action_id, approved_by)`
- **TC-SF04-01 (Medication Removal Execution)**: Patient approves Ibuprofen removal $\rightarrow$ Ibuprofen is deleted from 7x4 canvas; conflict arcs recalculate.
- **TC-SF04-02 (Medication Addition Execution)**: Patient approves doctor-added diuretic $\rightarrow$ New pill placed in Morning slot with highlight pulse.
- **TC-SF04-03 (Caregiver Audit Trail)**: Caregiver approves change $\rightarrow$ Logs proxy signature to Dossier.
- **TC-SF04-04 (Rejection Handling)**: Patient rejects doctor modification $\rightarrow$ Pill remains; alert returned to doctor with patient's reason.
- **TC-SF04-05 (Undo Buffer)**: Allows patient a 10-second "Undo" toast window before permanent commit.

##### Tool: `schedule_followup(date, appointment_type, reason, provider_name)`
- **TC-SF05-01 (3-Day Urgent Follow-Up)**: Schedules in-person clinic visit in 3 days for edema review $\rightarrow$ Creates appointment record in LocalVault.
- **TC-SF05-02 (Tele-Health Review Scheduling)**: Schedules video consultation in 1 week $\rightarrow$ Generates tele-health video room link stub.
- **TC-SF05-03 (Automated Reminder Rule Attachment)**: Attaches notification schedule: 24 hours prior and 2 hours prior.
- **TC-SF05-04 (Doctor Question Linking)**: Automatically attaches current pending Question Bank items to the follow-up appointment sheet.
- **TC-SF05-05 (Reschedule / Cancellation)**: Updates existing appointment record and recalculates reminder triggers.

##### Tool: `schedule_lab(cadence, test_panel, target_date)`
- **TC-SF06-01 (4-Week Creatinine Cadence)**: Doctor sets `cadence: '4_weeks'`, `test_panel: 'Renal Function Panel'` $\rightarrow$ Generates new HomeLab due card for target date.
- **TC-SF06-02 (3-Month HbA1c Cadence)**: Sets `cadence: '3_months'`, `test_panel: 'HbA1c'` $\rightarrow$ Schedules future due card.
- **TC-SF06-03 (Overdue Nudge Automation)**: When current date passes target date without uploaded lab, status changes to `[Overdue]` and triggers gentle banner nudge.
- **TC-SF06-04 (Lab Fasting Rule Attachment)**: Attaches instructions: *"Fasting required for 8-12 hours prior to draw."*
- **TC-SF06-05 (Multiple Concurrent Lab Cadences)**: Supports distinct independent cadences for renal, lipid, and glycemic panels.

##### Tool: `sync_to_calendar(event_details)`
- **TC-SF07-01 (ICS File Generation)**: Generates standard RFC 5545 `.ics` iCalendar file payload with VEVENT, DTSTART, DTEND, SUMMARY, DESCRIPTION, and VALARM.
- **TC-SF07-02 (Google Calendar URI Formatting)**: Generates valid Web intent URL `https://calendar.google.com/calendar/render?action=TEMPLATE...`.
- **TC-SF07-03 (Multi-Recipient Sync)**: Dispatches calendar sync payload to both Patient and Caregiver email/profile.
- **TC-SF07-04 (Alarm / Notification Offsets)**: Verifies VALARM blocks are set for `-P1D` (24h) and `-PT2H` (2h).
- **TC-SF07-05 (Special Character Escaping)**: Properly escapes commas, semicolons, and newlines in calendar summary/description strings.

---

#### Module 6: Family Care Circle & Continuity Dossier Engine

##### Tool: `link_patient(patient_id, relationship, authorization_token)`
- **TC-FC01-01 (Caregiver Profile Linking)**: Raj links mother `S. Devi` using authorization consent token $\rightarrow$ Patient appears in Caregiver Profile Switcher.
- **TC-FC01-02 (Pediatric Linking)**: Parent links minor child $\rightarrow$ Assigns guardian management scope.
- **TC-FC01-03 (Invalid Token Rejection)**: Submitting expired or incorrect authorization token $\rightarrow$ Returns `{"error": "AUTH_FAILED"}`.
- **TC-FC01-04 (Separate Data Isolation)**: Verifies that linked patient's LocalVault database is completely isolated from caregiver's personal vault.
- **TC-FC01-05 (Multi-Patient Linking)**: Caregiver successfully links 3 family profiles (Mother, Father, Child) with independent dashboard tiles.

##### Tool: `grant_caregiver_access(caregiver_id, permission_level)`
- **TC-FC02-01 (View Only Permission)**: Grant `View Only` $\rightarrow$ Caregiver can view LabStory/PillMap; cannot approve proposals or upload danger signs.
- **TC-FC02-02 (Manage Permission)**: Grant `Manage` $\rightarrow$ Caregiver can upload lab slips, report danger signs, approve dosage diffs, and sync calendar.
- **TC-FC02-03 (Full Permission)**: Grant `Full` $\rightarrow$ Caregiver can manage access grants and export legal health dossiers.
- **TC-FC02-04 (Permission Level Downgrade)**: Patient downgrades caregiver from `Full` to `View Only` $\rightarrow$ Immediate enforcement in UI.
- **TC-FC02-05 (Revoke Caregiver Access)**: Patient revokes caregiver $\rightarrow$ Profile is immediately removed from caregiver's switcher.

##### Tool: `act_on_behalf(action_name, action_payload)`
- **TC-FC03-01 (Audited Dosage Approval)**: Caregiver approves dosage proposal on behalf of patient $\rightarrow$ Creates immutable log record with proxy identity and timestamp.
- **TC-FC03-02 (Audited Lab Upload)**: Caregiver uploads lab photo on behalf of patient $\rightarrow$ Document tagged with uploader metadata.
- **TC-FC03-03 (Audited Danger Report)**: Caregiver submits emergency report on behalf of patient $\rightarrow$ Doctor triage view displays uploader identity and relationship.
- **TC-FC03-04 (Permission Enforcement Check)**: Caregiver with `View Only` attempts `act_on_behalf('approve_dosage_change')` $\rightarrow$ Blocked with `403 Unauthorized`.
- **TC-FC03-05 (Audit Log Tamper Proofing)**: Verifies audit log entries are append-only and cannot be edited or deleted.

##### Tool: `switch_profile(target_patient_id)`
- **TC-FC04-01 (Active Context Switch)**: Caregiver switches from `Self` to `Mother` $\rightarrow$ Active UI state, PillMap, LabStory, and HomeLab reload to reflect Mother's vault data.
- **TC-FC04-02 (Elder / Simplified Mode Toggle)**: When viewing Mother's profile, UI toggles to high-contrast simplified mode (large tiles, essential actions).
- **TC-FC04-03 (Multi-Patient Due Card Aggregation)**: Caregiver overview dashboard aggregates pending due cards across all linked profiles on a single screen.
- **TC-FC04-04 (Fast Context Switching)**: Switches profile in $<100\text{ms}$ without full page reload.
- **TC-FC04-05 (Session Persistence)**: Selected profile persists during session until explicitly switched.

##### Tool: `grant_doctor_access(doctor_email, duration, scope)`
- **TC-CD01-01 (7-Day Temporary Access Grant)**: Generates 7-day time-bound access token for Dr. Chen $\rightarrow$ Token recorded in LocalVault with expiration timestamp `T+7d`.
- **TC-CD01-02 (Emergency Snapshot Scope)**: Grants access with `scope: 'snapshot_only'` $\rightarrow$ Clinician view limited to active medications, allergies, and last 3 lab results.
- **TC-CD01-03 (Full Dossier Scope)**: Grants access with `scope: 'full_dossier'` $\rightarrow$ Clinician view includes complete longitudinal history and source document bounding boxes.
- **TC-CD01-04 (Access Log Tracking)**: Every time doctor accesses dossier using token, access timestamp and IP are logged to patient's security audit trail.
- **TC-CD01-05 (Revoke Access Execution)**: Patient invokes `revoke_access(grant_id)` $\rightarrow$ Doctor's active session is terminated immediately.

##### Tool: `view_timeline(item_id, options)`
- **TC-CD02-01 (Chronological Timeline Query)**: Query lifetime events $\rightarrow$ Returns unified chronological stream of labs, med changes, danger reports, and doctor reviews.
- **TC-CD02-02 (Source Bounding Box Coordinate Return)**: Query lab event $\rightarrow$ Returns exact document ID and bounding box `[x, y, w, h]` on original scanned PDF/image.
- **TC-CD02-03 (Interactive PDF Split-Screen Pan/Zoom)**: Tapping timeline item dispatches event to PDF viewer to scroll to page and draw highlighted overlay rectangle.
- **TC-CD02-04 (Filter by Event Category)**: Filter timeline by `['med_changes', 'danger_signs']` $\rightarrow$ Returns filtered stream.
- **TC-CD02-05 (Snapshot One-Page Summary View)**: Generates emergency snapshot card optimized for ER clinicians.

---

### Tier 2: Boundary, Stress, Edge & Corner Cases

#### Test Cases Specification

| ID | Category | Scenario / Input Condition | Expected System Behavior & Invariants | Error / Warning Format |
|---|---|---|---|---|
| **T2-01** | Empty Regimen | User enters RxBridge and PillMap with 0 pre-admission and 0 discharge medications. | System renders clean empty state with welcoming prompt: *"No medications active. Upload a discharge summary or add pills manually to begin."* No crash or undefined property errors. | Clean UI state. |
| **T2-02** | Extreme Lab Value | Lab uploaded with `Creatinine: 9.4 mg/dL`, `eGFR: 4 mL/min`, `Potassium: 7.2 mEq/L`. | LabStory renders extreme value point with dark-red critical alert badge; generates urgent clinical banner: *"Critical Lab Value Detected: Seek Emergency Care Immediately."* Auto-populates high-priority doctor triage alert. | `CRITICAL_LAB_ALERT` |
| **T2-03** | Severe Polypharmacy | Patient regimen loaded with 18 distinct medications across all 4 daily slots (Morning: 6, Noon: 4, Evening: 5, Bedtime: 3). | PillMap canvas scales grid cells dynamically, applies scrollable/paginated pill clusters within slots, maintains 60fps drag-and-drop responsiveness, and computes multi-arc intersections without SVG rendering freeze. | Responsive layout preserved. |
| **T2-04** | Simultaneous Conflict Cascade | Regimen containing 5 overlapping conflicts: (1) Warfarin + Aspirin, (2) Lisinopril + Spironolactone, (3) Atorvastatin + Grapefruit, (4) Ciprofloxacin + Calcium, (5) Tylenol + Percocet (APAP duplicate). | PillMap renders multi-colored SVG arcs (Red, Orange, Yellow) with layered $z$-index and arc curvature offsets to prevent visual overlap; side-sheet displays grouped conflict accordion. | Multi-arc visual resolution. |
| **T2-05** | Corrupt / Unreadable Image | Upload zero-byte file or corrupted JPEG header for HomeLab slip. | Pre-processing engine catches error during decompression; displays friendly error toast: *"We could not read this image file. Please upload a clear photo in JPEG or PNG format."* | `{"error": "FILE_CORRUPT"}` |
| **T2-06** | Blurry / Low OCR Confidence | Photo uploaded with OCR confidence $< 0.35$ due to motion blur. | System extracts tentative values, flags each with yellow question badge `[⚠️ Low Confidence]`, and forces patient to manually verify and confirm each numeric value before commit. | `OCR_CONFIDENCE_LOW` |
| **T2-07** | Extreme Multi-Year Timeline | Ingestion of 150 longitudinal lab records spanning 8 years across 12 distinct biomarker panels. | DuckDB-Wasm executes query in $<50\text{ms}$; Canvas chart applies virtualized point rendering and aggregation downsampling for 5Y zoom view; memory footprint $< 80\text{MB}$. | Performant chart virtualization. |
| **T2-08** | Malformed WebMCP Payload | Client sends JSON-RPC tool invocation missing mandatory parameters (e.g. `add_medication` without `name`). | WebMCP tool validator catches schema violation, rejects invocation, and returns structured JSON-RPC error `-32602: Invalid params` without crashing engine. | `INVALID_PARAMS` |
| **T2-09** | Expired Doctor Token | Doctor attempts to view dossier using token with `expiry_date` in the past. | Server/LocalVault rejects request with `401 Unauthorized: Access token expired on 2026-08-20. Please request fresh access from patient.` | `TOKEN_EXPIRED` |
| **T2-10** | Unauthorized Role Escalation | Caregiver with `View Only` permission attempts to invoke `act_on_behalf('doctor_remove_medication')`. | Security middleware intercepts call, blocks execution, logs security violation attempt to audit trail, and returns `403 Forbidden`. | `PERMISSION_DENIED` |
| **T2-11** | Local Storage Quota Exhaustion | IndexedDB approaches browser storage quota (e.g. 50MB of high-res photos). | System activates automatic image optimization (converts photos to compressed WebP 1200px max width) and warns user before storage rejection. | `STORAGE_OPTIMIZED` |
| **T2-12** | Offline / Disconnected State | Network disconnects while using CareCanvas. | All core modules (Vault, PillMap, LabStory, RxBridge) continue functioning 100% offline via local IndexedDB and client-side WebMCP engine; sync queues for background flush. | `OFFLINE_MODE_ACTIVE` |

---

### Tier 3: Cross-Module Integration Matrix (12 Pairwise Channels)

```
+----------------------------------------------------------------------------------------------------+
|                                CROSS-MODULE INTEGRATION MATRIX                                     |
+-------------------+--------------------------------------------------------------------------------+
| Integration Path  | Verified Behavioral Interaction Contract                                       |
+-------------------+--------------------------------------------------------------------------------+
| INT-01: Vault ->  | Confirmed lab facts in Vault instantly stream to DuckDB-Wasm to update         |
|         LabStory  | longitudinal time-series; rejected lab facts are never queried or charted.     |
+-------------------+--------------------------------------------------------------------------------+
| INT-02: Vault ->  | Confirmed medication facts automatically populate 7x4 weekly pillbox grid;     |
|         PillMap   | unconfirmed facts remain locked in staging drawer.                             |
+-------------------+--------------------------------------------------------------------------------+
| INT-03: Vault ->  | Discharge 3-list reconciliation reads confirmed baseline meds and OTC          |
|         RxBridge  | supplements from Vault; approved reconciled items commit directly back to Vault.|
+-------------------+--------------------------------------------------------------------------------+
| INT-04: LabStory  | Historical eGFR/Creatinine/Potassium values from LabStory dynamically feed     |
|      -> RxBridge  | into RxBridge interaction checks (e.g. flagging NSAID/ACEi contraindications). |
+-------------------+--------------------------------------------------------------------------------+
| INT-05: RxBridge  | Reconciled discharge medication regimen automatically initializes Day 0        |
|      -> PillMap   | PillMap schedule, applying diet and food-timing badges without re-entry.       |
+-------------------+--------------------------------------------------------------------------------+
| INT-06: PillMap   | Adherence history and active medication schedules from PillMap render as       |
|      -> LabStory  | colored intervention bands on LabStory charts for causal med-lab correlation.   |
+-------------------+--------------------------------------------------------------------------------+
| INT-07: HomeLab   | Doctor dosage change proposals approved in HomeLab trigger reactive visual     |
|      -> PillMap   | diffs on PillMap (old dose fades out, new dose pulses in with green glow).     |
+-------------------+--------------------------------------------------------------------------------+
| INT-08: HomeLab   | Approved dosage adjustments create continuous labeled intervention bands on    |
|      -> LabStory  | LabStory biomarker charts starting from the approval date.                     |
+-------------------+--------------------------------------------------------------------------------+
| INT-09: Safety -> | Doctor remote medication removals (e.g. stopping NSAID) clear the pill node   |
|         PillMap   | from the 7x4 canvas and dissolve associated conflict arcs upon patient approval.|
+-------------------+--------------------------------------------------------------------------------+
| INT-10: Safety -> | Danger sign triage and follow-up orders automatically create multi-user        |
|        Calendar   | calendar invites (ICS / Google) for both Patient and linked Caregivers.        |
+-------------------+--------------------------------------------------------------------------------+
| INT-11: Care Circle| Proxy actions taken by linked caregivers (`act_on_behalf`) inject immutable    |
|     -> All Modules| audit signatures across Vault, PillMap, HomeLab, and Safety logs.              |
+-------------------+--------------------------------------------------------------------------------+
| INT-12: Dossier ->| Continuity Dossier aggregates facts from all 7 modules; clicking any claim     |
|        Documents  | instantly pans and zooms document viewer to exact bounding box on original doc.|
+-------------------+--------------------------------------------------------------------------------+
```

---

### Tier 4: Real-World Workload Scenarios

#### Workload Scenario 1: Complex Multi-Morbid Polypharmacy Journey
- **Patient Profile**: Harold Jenkins, 72-year-old male.
- **Clinical Diagnoses**: Chronic Kidney Disease (CKD Stage 3b, baseline eGFR 34), Type 2 Diabetes Mellitus (HbA1c 8.2%), Heart Failure with Preserved Ejection Fraction (HFpEF, NYHA Class II), Hypertension, Osteoarthritis.
- **Active Regimen (12 Meds)**: Metformin 1000mg BID, Empagliflozin 10mg QD, Sacubitril/Valsartan 49/51mg BID, Furosemide 40mg QAM, Carvedilol 12.5mg BID, Atorvastatin 40mg QHS, Allopurinol 100mg QD, Acetaminophen 500mg TID PRN, OTC Glucosamine/Chondroitin, OTC St. John's Wort 300mg, OTC Daily Multivitamin, Melatonin 3mg QHS.
- **Longitudinal Journey Verification**:
  1. *Discharge Reconciliation*: Harold arrives home after acute HF decompensation. RxBridge reconciles 3 lists, flags St. John's Wort interaction, explains Sacubitril/Valsartan titration, and populates PillMap.
  2. *LabStory Correlation*: 5-year lab history loaded. Harold asks *"Why did my eGFR drop in March?"* Agent correlates eGFR dip to 28 with temporary Ketorolac (NSAID) prescribed for arthritis flare.
  3. *HomeLab Prescribed Loop*: Day 14 creatinine due card triggers photo upload. Result: Creatinine 2.1 mg/dL, eGFR 26. Doctor reviews, pins note, and proposes reducing Metformin to 500mg daily. Daughter (Caregiver proxy) approves proposal on Harold's behalf.
  4. *Safety Escalation*: Day 21 Harold reports 5-lb weight gain and 3+ bilateral pedal edema. Doctor triages report, doubles Furosemide to 80mg for 3 days, and orders clinic review in 3 days. Calendar sync dispatches alerts to Harold and daughter.
  5. *Continuity Handover*: Harold is referred to outpatient Nephrology. System compiles complete Continuity Dossier with all bounding boxes; time-bound 14-day token granted to Dr. Evans.

---

## 4. Mock Fixture Datasets and Assets

### 4.1 Document Fixtures with Precise Normalized Bounding Boxes `[x_min, y_min, x_max, y_max]`

All bounding boxes are normalized to a standard coordinate grid of $[0, 1000]$ relative to document width and height.

#### Document 1: `discharge_summary_cardiac_ward.pdf` (Page 1 of 2)
```json
{
  "document_id": "doc_discharge_cardiac_001",
  "file_name": "discharge_summary_cardiac_ward.pdf",
  "page_count": 2,
  "patient_name": "Smt. Shanti Devi",
  "mrn": "MRN-984210",
  "admission_date": "2026-08-20",
  "discharge_date": "2026-08-25",
  "attending_physician": "Dr. A. Patel, MD, FACC",
  "extracted_entities": [
    {
      "text": "Apixaban (Eliquis) 5 mg oral tablet, 1 tab twice daily",
      "entity_type": "discharge_medication",
      "page": 1,
      "bounding_box": { "x_min": 85, "y_min": 420, "x_max": 620, "y_max": 445 },
      "plain_narration": "Apixaban 5mg twice daily started for stroke prevention in atrial fibrillation."
    },
    {
      "text": "Metformin 1000 mg oral tablet, 1 tab twice daily with meals",
      "entity_type": "discharge_medication",
      "page": 1,
      "bounding_box": { "x_min": 85, "y_min": 452, "x_max": 640, "y_max": 478 },
      "plain_narration": "Metformin increased from home dose of 500mg to 1000mg twice daily."
    },
    {
      "text": "Atorvastatin 40 mg oral tablet, 1 tab at bedtime",
      "entity_type": "discharge_medication",
      "page": 1,
      "bounding_box": { "x_min": 85, "y_min": 485, "x_max": 580, "y_max": 510 },
      "plain_narration": "Atorvastatin 40mg at bedtime for cholesterol management. Avoid grapefruit."
    },
    {
      "text": "Lisinopril 20 mg oral tablet - DISCONTINUED due to acute renal strain",
      "entity_type": "discontinued_medication",
      "page": 1,
      "bounding_box": { "x_min": 85, "y_min": 520, "x_max": 710, "y_max": 546 },
      "plain_narration": "Lisinopril was stopped in hospital to protect kidney function."
    },
    {
      "text": "Discharge eGFR: 32 mL/min/1.73m2 (Creatinine 1.8 mg/dL)",
      "entity_type": "discharge_lab",
      "page": 1,
      "bounding_box": { "x_min": 85, "y_min": 610, "x_max": 590, "y_max": 635 },
      "plain_narration": "Kidney function at discharge: eGFR 32 (Stage 3b kidney strain)."
    },
    {
      "text": "Repeat Serum Creatinine and Electrolytes in 2 weeks with local clinic",
      "entity_type": "prescribed_lab_cadence",
      "page": 2,
      "bounding_box": { "x_min": 90, "y_min": 180, "x_max": 740, "y_max": 208 },
      "plain_narration": "Doctor ordered follow-up kidney blood test in 2 weeks."
    }
  ]
}
```

#### Document 2: `homelab_creatinine_photo_slip.jpg` (Mobile Camera Capture)
```json
{
  "document_id": "doc_homelab_slip_002",
  "file_name": "homelab_creatinine_photo_slip.jpg",
  "capture_type": "mobile_phone_camera",
  "image_dimensions": { "width": 3024, "height": 4032 },
  "lab_facility": "Metropolis Healthcare Remote Collection",
  "collection_date": "2026-08-28T09:15:00Z",
  "extracted_entities": [
    {
      "text": "SERUM CREATININE: 1.90 mg/dL (Ref: 0.60 - 1.20) [HIGH]",
      "biomarker": "Creatinine",
      "value": 1.90,
      "unit": "mg/dL",
      "flag": "HIGH",
      "bounding_box": { "x_min": 110, "y_min": 380, "x_max": 890, "y_max": 435 },
      "confidence": 0.96
    },
    {
      "text": "eGFR (CKD-EPI 2021): 28 mL/min/1.73m2 (Ref: > 60) [CRITICAL LOW]",
      "biomarker": "eGFR",
      "value": 28,
      "unit": "mL/min/1.73m2",
      "flag": "LOW",
      "bounding_box": { "x_min": 110, "y_min": 445, "x_max": 910, "y_max": 500 },
      "confidence": 0.94
    },
    {
      "text": "SERUM POTASSIUM: 4.8 mEq/L (Ref: 3.5 - 5.1) [NORMAL]",
      "biomarker": "Potassium",
      "value": 4.8,
      "unit": "mEq/L",
      "flag": "NORMAL",
      "bounding_box": { "x_min": 110, "y_min": 510, "x_max": 880, "y_max": 560 },
      "confidence": 0.98
    }
  ]
}
```

---

### 4.2 Multi-Year Longitudinal Lab History Dataset (2022–2026)

```json
[
  {
    "date": "2022-03-15T08:30:00Z",
    "creatinine": 1.10,
    "egfr": 58,
    "hba1c": 6.8,
    "glucose_fasting": 118,
    "potassium": 4.2,
    "cholesterol_total": 215,
    "ldl": 138,
    "hdl": 44,
    "triglycerides": 165,
    "clinical_context": "Annual routine physical exam; baseline mild CKD stage 3a."
  },
  {
    "date": "2023-01-20T09:00:00Z",
    "creatinine": 1.25,
    "egfr": 50,
    "hba1c": 7.4,
    "glucose_fasting": 134,
    "potassium": 4.4,
    "cholesterol_total": 198,
    "ldl": 120,
    "hdl": 45,
    "triglycerides": 155,
    "clinical_context": "Metformin initiated 500mg daily."
  },
  {
    "date": "2023-11-10T10:15:00Z",
    "creatinine": 1.30,
    "egfr": 48,
    "hba1c": 7.9,
    "glucose_fasting": 145,
    "potassium": 4.5,
    "cholesterol_total": 205,
    "ldl": 125,
    "hdl": 43,
    "triglycerides": 170,
    "clinical_context": "Prednisone 20mg burst prescribed for severe osteoarthritis flare (Glucose spike)."
  },
  {
    "date": "2024-08-14T08:45:00Z",
    "creatinine": 1.45,
    "egfr": 42,
    "hba1c": 7.2,
    "glucose_fasting": 122,
    "potassium": 4.6,
    "cholesterol_total": 175,
    "ldl": 95,
    "hdl": 46,
    "triglycerides": 140,
    "clinical_context": "Atorvastatin titrated to 40mg; lipid improvements noted."
  },
  {
    "date": "2025-06-02T09:30:00Z",
    "creatinine": 1.60,
    "egfr": 37,
    "hba1c": 7.6,
    "glucose_fasting": 130,
    "potassium": 4.7,
    "cholesterol_total": 170,
    "ldl": 90,
    "hdl": 47,
    "triglycerides": 135,
    "clinical_context": "Routine nephrology follow-up; CKD Stage 3b confirmed."
  },
  {
    "date": "2026-08-25T11:00:00Z",
    "creatinine": 1.80,
    "egfr": 32,
    "hba1c": 7.8,
    "glucose_fasting": 142,
    "potassium": 4.9,
    "cholesterol_total": 168,
    "ldl": 88,
    "hdl": 48,
    "triglycerides": 130,
    "clinical_context": "Hospital discharge post-cardiac admission."
  },
  {
    "date": "2026-08-28T09:15:00Z",
    "creatinine": 1.90,
    "egfr": 28,
    "hba1c": 7.8,
    "glucose_fasting": 140,
    "potassium": 4.8,
    "cholesterol_total": 165,
    "ldl": 86,
    "hdl": 48,
    "triglycerides": 128,
    "clinical_context": "HomeLab remote slip upload; triggers Metformin dose reduction from 1000mg to 500mg."
  }
]
```

---

### 4.3 Medication Catalog, Brand/Generic Crosswalk & Interaction Database

#### Brand to Generic Mapping Crosswalk
```json
{
  "Eliquis": { "generic": "Apixaban", "class": "Direct Oral Anticoagulant (DOAC)", "standard_doses": ["2.5mg", "5mg"] },
  "Glucophage": { "generic": "Metformin", "class": "Biguanide", "standard_doses": ["500mg", "850mg", "1000mg"] },
  "Lipitor": { "generic": "Atorvastatin", "class": "HMG-CoA Reductase Inhibitor", "standard_doses": ["10mg", "20mg", "40mg", "80mg"] },
  "Zestril": { "generic": "Lisinopril", "class": "ACE Inhibitor", "standard_doses": ["5mg", "10mg", "20mg", "40mg"] },
  "Lasix": { "generic": "Furosemide", "class": "Loop Diuretic", "standard_doses": ["20mg", "40mg", "80mg"] },
  "Synthroid": { "generic": "Levothyroxine", "class": "Thyroid Hormone", "standard_doses": ["25mcg", "50mcg", "75mcg", "88mcg", "100mcg", "125mcg"] },
  "Plavix": { "generic": "Clopidogrel", "class": "P2Y12 Antiplatelet", "standard_doses": ["75mg"] },
  "Advil": { "generic": "Ibuprofen", "class": "NSAID", "standard_doses": ["200mg", "400mg", "600mg", "800mg"] },
  "Tylenol": { "generic": "Acetaminophen", "class": "Analgesic/Antipyretic", "standard_doses": ["325mg", "500mg", "650mg"] },
  "Cozaar": { "generic": "Losartan", "class": "Angiotensin II Receptor Blocker (ARB)", "standard_doses": ["25mg", "50mg", "100mg"] },
  "Aldactone": { "generic": "Spironolactone", "class": "Potassium-Sparing Diuretic", "standard_doses": ["25mg", "50mg", "100mg"] },
  "Cipro": { "generic": "Ciprofloxacin", "class": "Fluoroquinolone Antibiotic", "standard_doses": ["250mg", "500mg", "750mg"] }
}
```

#### Drug-Drug Interaction Database (Excerpts)
```json
[
  {
    "drug_a": "Apixaban",
    "drug_b": "Fish Oil (Omega-3)",
    "severity": "MAJOR",
    "arc_color": "#F97316",
    "mechanism": "Additive antiplatelet and anticoagulant effects increase bleeding time.",
    "clinical_guidance": "Monitor for unusual bruising, gum bleeding, or dark stools. Consider holding high-dose fish oil (>2000mg/day)."
  },
  {
    "drug_a": "Sertraline",
    "drug_b": "St. John's Wort",
    "severity": "CONTRAINDICATED",
    "arc_color": "#EF4444",
    "mechanism": "Concurrent serotonergic enhancement causes potentially fatal Serotonin Syndrome.",
    "clinical_guidance": "Immediately discontinue St. John's Wort. Watch for agitation, tremor, hyperreflexia, and diaphoresis."
  },
  {
    "drug_a": "Lisinopril",
    "drug_b": "Spironolactone",
    "severity": "MAJOR",
    "arc_color": "#F97316",
    "mechanism": "Dual blockade of aldosterone and angiotensin pathways severely limits potassium excretion.",
    "clinical_guidance": "High risk of life-threatening hyperkalemia. Frequent serum potassium monitoring mandatory."
  },
  {
    "drug_a": "Ciprofloxacin",
    "drug_b": "Calcium Carbonate",
    "severity": "MAJOR",
    "arc_color": "#F97316",
    "mechanism": "Polyvalent cations form insoluble chelates with ciprofloxacin, reducing absorption by up to 75%.",
    "clinical_guidance": "Separate administration by taking ciprofloxacin at least 2 hours before or 6 hours after calcium supplements."
  },
  {
    "drug_a": "Ibuprofen",
    "drug_b": "Lisinopril",
    "severity": "MAJOR",
    "arc_color": "#F97316",
    "mechanism": "NSAIDs inhibit renal prostaglandins, attenuating ACEi antihypertensive effect and precipitating acute kidney injury.",
    "clinical_guidance": "Avoid routine NSAID use in patients with underlying renal disease or ACE inhibitor therapy."
  }
]
```

#### Drug-Diet Interaction Database
```json
[
  {
    "drug_name": "Atorvastatin",
    "diet_item": "Grapefruit & Grapefruit Juice",
    "severity": "MAJOR",
    "badge": "🚫 Avoid Grapefruit",
    "mechanism": "Furanocoumarins in grapefruit irreversibly inhibit intestinal CYP3A4, increasing statin AUC by >200%.",
    "clinical_guidance": "Avoid consuming grapefruit products while taking atorvastatin or simvastatin to prevent muscle breakdown (rhabdomyolysis)."
  },
  {
    "drug_name": "Warfarin",
    "diet_item": "High Vitamin K Foods (Spinach, Kale, Broccoli, Collards)",
    "severity": "MODERATE",
    "badge": "🥬 Consistent Vit K",
    "mechanism": "Vitamin K directly antagonizes the anticoagulant mechanism of warfarin, lowering INR.",
    "clinical_guidance": "Maintain a consistent weekly intake of leafy green vegetables rather than sudden changes."
  },
  {
    "drug_name": "Levothyroxine",
    "diet_item": "Breakfast / Dairy / Espresso / Calcium",
    "severity": "MAJOR",
    "badge": "🍽️ Empty Stomach (30m)",
    "mechanism": "Food, dietary calcium, and coffee bind levothyroxine in the gut, decreasing absorption by up to 40%.",
    "clinical_guidance": "Take first thing in the morning with a full glass of water, at least 30 to 60 minutes before eating breakfast or drinking coffee."
  },
  {
    "drug_name": "Metronidazole",
    "diet_item": "Alcohol / Ethanol",
    "severity": "CONTRAINDICATED",
    "badge": "🚫 Zero Alcohol",
    "mechanism": "Inhibits aldehyde dehydrogenase causing toxic acetaldehyde accumulation.",
    "clinical_guidance": "Do not consume any alcoholic beverages or alcohol-containing medicines during treatment and for 48 hours after."
  }
]
```

---

### 4.4 Sample 3-List Discharge Summary Datasets

#### List 1: Pre-Admission Baseline Medications (Home Regimen)
```json
[
  { "med_name": "Metformin", "dose": "500mg", "frequency": "Once daily with dinner", "indication": "Type 2 Diabetes" },
  { "med_name": "Lisinopril", "dose": "20mg", "frequency": "Once daily in morning", "indication": "Hypertension" },
  { "med_name": "Atorvastatin", "dose": "20mg", "frequency": "Once daily at bedtime", "indication": "Hyperlipidemia" },
  { "med_name": "Levothyroxine", "dose": "75mcg", "frequency": "Once daily before breakfast", "indication": "Hypothyroidism" },
  { "med_name": "Aspirin", "dose": "81mg", "frequency": "Once daily with breakfast", "indication": "Cardioprotection" },
  { "med_name": "OTC Fish Oil", "dose": "1000mg", "frequency": "Once daily in morning", "indication": "General Wellness" },
  { "med_name": "OTC Calcium + Vit D", "dose": "600mg/400IU", "frequency": "Once daily with lunch", "indication": "Bone Health" }
]
```

#### List 2: In-Hospital Administration & Modifications
```json
[
  { "med_name": "Metformin", "dose": "Held", "reason": "Held for IV contrast cardiac catheterization; restarted at 1000mg BID on ward" },
  { "med_name": "Lisinopril", "dose": "Held / Stopped", "reason": "Held due to acute rise in serum creatinine from 1.3 to 1.8 mg/dL" },
  { "med_name": "Atorvastatin", "dose": "40mg", "reason": "Dose titrated from 20mg to 40mg post-angiography" },
  { "med_name": "Apixaban", "dose": "5mg BID", "reason": "Initiated for new-onset paroxysmal atrial fibrillation" },
  { "med_name": "Aspirin", "dose": "Discontinued", "reason": "Stopped to avoid dual antithrombotic bleeding risk with Apixaban" },
  { "med_name": "IV Heparin", "dose": "Titrated infusion", "reason": "Bridging therapy in CCU; stopped prior to discharge" }
]
```

#### List 3: Final Discharge Prescription Orders
```json
[
  { "med_name": "Apixaban", "dose": "5mg", "frequency": "Twice daily (08:00, 20:00)", "status": "NEW", "reason": "Atrial Fibrillation Stroke Prevention" },
  { "med_name": "Metformin", "dose": "1000mg", "frequency": "Twice daily with meals (08:00, 18:00)", "status": "DOSE_INCREASED", "reason": "Glycemic Control Optimization" },
  { "med_name": "Atorvastatin", "dose": "40mg", "frequency": "Once daily at bedtime (22:00)", "status": "DOSE_INCREASED", "reason": "Plaque Stabilization" },
  { "med_name": "Levothyroxine", "dose": "75mcg", "frequency": "Once daily on empty stomach (07:30)", "status": "CONTINUED", "reason": "Hypothyroidism" },
  { "med_name": "Lisinopril", "dose": "0mg", "frequency": "DISCONTINUED", "status": "STOPPED", "reason": "Renal Protection / Elevated Creatinine" },
  { "med_name": "Aspirin", "dose": "0mg", "frequency": "DISCONTINUED", "status": "STOPPED", "reason": "Replaced by Apixaban" }
]
```

---

## 5. Recommended Test Runner & Automated Verification Harness

```
+----------------------------------------------------------------------------------------------------+
|                               AUTOMATED TEST HARNESS ARCHITECTURE                                  |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ Playwright Visual E2E Suite ]                                                                 |
|    Browser Context -> 7x4 Drag-and-Drop -> SVG Arc Bounding Boxes -> Animated Diffs -> Toast     |
|         |                                                                                          |
|         v                                                                                          |
|    [ Vitest WebMCP & Vault Harness ]                                                               |
|    Mock document.modelContext Shim -> Parameter Schema Validation -> IndexedDB Memory Store        |
|         |                                                                                          |
|         v                                                                                          |
|    [ WebMCP Inspector & Audit Assertion Engine ]                                                   |
|    JSON-RPC Message Interceptor -> Gate Counter -> Human Approval Verifier -> Audit Trail Diff    |
+----------------------------------------------------------------------------------------------------+
```

### 5.1 Technology Selection & Rationale
1. **Vitest (Fast WebMCP & Unit/Integration Engine)**:
   - Ultra-fast native ESM test runner with jsdom/happy-dom simulation.
   - Ideal for executing 100+ Tier 1 tool tests and Tier 2 edge cases in $< 3\text{ seconds}$.
   - Native fake timers for verifying reminder triggers and scheduled cadences.
2. **Playwright (Visual & E2E Canvas Harness)**:
   - Cross-browser engine (Chromium, Firefox, WebKit) for Flows A through E.
   - Precise mouse drag-and-drop simulation (`page.mouse.down()`, `move()`, `up()`) to test 7x4 pillbox slotting.
   - Direct SVG path geometry assertions (`d` attribute calculations, arc curvature collision checks).
3. **Synthetic WebMCP Mock Shim**:
   - Injects a compliant `window.modelContext` / `document.modelContext` object into the DOM.
   - Records every registered tool, its input schema, invocation latency, parameters, and returned JSON payload.
   - Provides automated assertions to verify that no tool modifies persistent state without passing through the human approval gate.

---

### 5.2 Synthetic WebMCP Inspector & Test Shim Implementation

```typescript
/**
 * CareCanvas WebMCP Mock Test Harness Shim
 * File: test/harness/webmcp-test-shim.ts
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (params: any) => Promise<any>;
  requiresApproval?: boolean;
}

export interface ToolInvocationRecord {
  id: string;
  toolName: string;
  params: any;
  timestamp: string;
  durationMs: number;
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'error';
  approvalMetadata?: {
    approvedBy: string;
    role: string;
    onBehalfOf?: string;
  };
  result?: any;
  error?: any;
}

export class WebMCPTestHarness {
  private registeredTools: Map<string, ToolDefinition> = new Map();
  public invocationHistory: ToolInvocationRecord[] = [];
  public approvalGateCounter: number = 0;

  constructor() {
    this.installShim();
  }

  public installShim(): void {
    const self = this;
    const modelContext = {
      registerTool(tool: ToolDefinition) {
        self.registeredTools.set(tool.name, tool);
      },
      getTools(): ToolDefinition[] {
        return Array.from(self.registeredTools.values());
      },
      async invoke(name: string, params: any): Promise<any> {
        const tool = self.registeredTools.get(name);
        if (!tool) {
          throw new Error(`Tool ${name} is not registered in WebMCP context.`);
        }

        const start = performance.now();
        const invocationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const record: ToolInvocationRecord = {
          id: invocationId,
          toolName: name,
          params,
          timestamp: new Date().toISOString(),
          durationMs: 0,
          status: tool.requiresApproval ? 'pending_approval' : 'executed'
        };

        if (tool.requiresApproval) {
          self.approvalGateCounter++;
          self.invocationHistory.push(record);
          return {
            status: 'PENDING_HUMAN_APPROVAL',
            invocationId,
            message: 'Action staged. Awaiting explicit patient or proxy confirmation.'
          };
        }

        try {
          const result = await tool.handler(params);
          record.durationMs = performance.now() - start;
          record.result = result;
          self.invocationHistory.push(record);
          return result;
        } catch (err: any) {
          record.durationMs = performance.now() - start;
          record.status = 'error';
          record.error = err.message || err;
          self.invocationHistory.push(record);
          throw err;
        }
      }
    };

    (globalThis as any).modelContext = modelContext;
    if (typeof document !== 'undefined') {
      (document as any).modelContext = modelContext;
    }
  }

  public simulateHumanApproval(invocationId: string, approver: { name: string; role: string; onBehalfOf?: string }): Promise<any> {
    const record = this.invocationHistory.find(r => r.id === invocationId);
    if (!record) throw new Error(`Invocation ${invocationId} not found`);
    if (record.status !== 'pending_approval') throw new Error(`Invocation ${invocationId} is not awaiting approval`);

    const tool = this.registeredTools.get(record.toolName);
    if (!tool) throw new Error(`Tool ${record.toolName} not found`);

    record.status = 'approved';
    record.approvalMetadata = {
      approvedBy: approver.name,
      role: approver.role,
      onBehalfOf: approver.onBehalfOf
    };

    return tool.handler(record.params).then(res => {
      record.result = res;
      return res;
    });
  }

  public assertToolRegistered(name: string): void {
    if (!this.registeredTools.has(name)) {
      throw new Error(`Assertion Failed: Expected tool "${name}" to be registered in WebMCP context.`);
    }
  }

  public assertAllToolsRegistered(names: string[]): void {
    for (const name of names) {
      this.assertToolRegistered(name);
    }
  }
}
```

---

### 5.3 CI/CD Test Script & CLI Execution Recipes

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "vitest run --dir test/unit",
    "test:tools": "vitest run test/unit/webmcp_tools.spec.ts",
    "test:vault": "vitest run test/unit/vault_storage.spec.ts",
    "test:tier2": "vitest run test/unit/boundary_stress.spec.ts",
    "test:tier3": "vitest run test/unit/cross_feature_combinations.spec.ts",
    "test:e2e": "playwright test",
    "test:e2e:flows": "playwright test test/e2e/flows_a_to_e.spec.ts",
    "test:workloads": "vitest run test/integration/workload_scenarios.spec.ts",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### GitHub Actions Automated CI Workflow Recipe (`.github/workflows/carecanvas-ci.yml`)
```yaml
name: CareCanvas Continuous Verification Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Verify WebMCP Tool Registration & Tier 1 Coverage
        run: npm run test:tools

      - name: Run Tier 2 Boundary & Stress Test Suite
        run: npm run test:tier2

      - name: Run Tier 3 Cross-Module Integration Matrix
        run: npm run test:tier3

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Execute End-to-End Acceptance Flows (A through E)
        run: npm run test:e2e:flows

      - name: Run Real-World Workload Scenarios (Tier 4)
        run: npm run test:workloads

      - name: Upload Test Report & Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: verification-report
          path: playwright-report/
```

---

## 6. Verification Summary Checklist

- [x] **E2E Acceptance Flow A Fully Specified**: Discharge 3-list upload $\rightarrow$ 9 approvals $\rightarrow$ 2 drug & 1 diet flags $\rightarrow$ Question Bank $\rightarrow$ 1-page summary $\rightarrow$ Day 0 diet-aware PillMap.
- [x] **E2E Acceptance Flow B Fully Specified**: 7x4 Weekly PillMap $\rightarrow$ Drag OTC supplement $\rightarrow$ Dynamic red conflict arc $\rightarrow$ Ghost preview schedule shift $\rightarrow$ Adherence simulation $\rightarrow$ Pharmacist export.
- [x] **E2E Acceptance Flow C Fully Specified**: Prescribed HomeLab due card $\rightarrow$ Photo slip upload $\rightarrow$ Doctor triage note & dosage proposal $\rightarrow$ Approval $\rightarrow$ Animated PillMap diff & LabStory band $\rightarrow$ Calendar sync.
- [x] **E2E Acceptance Flow D Fully Specified**: Danger sign reporting (Edema) $\rightarrow$ Doctor remote NSAID removal & 3-day follow-up $\rightarrow$ Approval $\rightarrow$ Multi-user calendar sync $\rightarrow$ Dossier updated.
- [x] **E2E Acceptance Flow E Fully Specified**: Caregiver proxy switch $\rightarrow$ Audited action on behalf $\rightarrow$ 7-day time-bound doctor access grant $\rightarrow$ Continuity Dossier compilation with PDF bounding-box highlights.
- [x] **4-Tier Test Pyramid Specified**:
  - Tier 1: $\ge 5$ test cases per feature across all 30+ WebMCP tools.
  - Tier 2: 12 boundary, stress, and edge test specifications.
  - Tier 3: 12 pairwise cross-module integration channels.
  - Tier 4: Complex multi-morbid real-world longitudinal workload scenarios.
- [x] **Mock Fixture Assets & Datasets Provided**:
  - Sample PDFs and mobile phone photo slips with normalized bounding-box coordinates $[0-1000]$.
  - 5-year longitudinal biomarker history (Creatinine, eGFR, HbA1c, Potassium, Lipids).
  - Medication catalog with Brand/Generic crosswalk, Drug-Drug and Drug-Diet interaction database.
  - 3-List discharge summary fixtures.
- [x] **Test Runner & Verification Harness Specified**:
  - Vitest + Playwright configuration.
  - Synthetic in-browser WebMCP test shim and approval gate interceptor.
  - CI/CD workflow script.
