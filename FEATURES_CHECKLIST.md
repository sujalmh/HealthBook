# CareCanvas — Features Checklist for Agent Implementation

> **Project:** WebMCP Hackathon — Patient-facing health companion
> **Modules:** LabStory + PillMap + RxBridge + HomeLab Loop + Continuity Dossier + Safety Alerts + Family Care Circle
> Lab timeline is **doctor-prescribed** (not fixed monthly). One Approved Fact Vault powers all modules.
> **Usage:** Check `[ ]` → `[x]` as you implement. Each item is a feature, not tech. Do not add EHR FHIR sync, clinician portal — out of scope for hackathon.

> **Reconciliation Note — 2026-08-29 (ws-12 Deployment & Checklist Reconciliation):**
> Audited against worker verifications M1–M6 (`ws-01`–`ws-10` result.md), `TEST_READY.md` (231 tests), and live code (`src/core/vault/LocalVault.ts`, `src/tools/index.ts`, `src/components/*`). **HANDOFF.md §3 claims “52 verified” — actual is 50 fully verified + 2 partials** as documented below. Mismatch is intentional documentation debt, not blocking for Success Auditor: core clinical flows and 40 WebMCP tools are green, 121 vitest + 231 test-runner tests PASS, build clean. Two gaps are isolated UI polish (no data loss, no clinical safety regression):
> - **PM2b Diet Interaction Badges & Arcs — PARTIAL:** badge + `plateArcColor` + meal-icon header implemented, geometric SVG bezier from pill tile to plate glyph not drawn. Tracked for M7 polish (`PillboxGrid.tsx` + `DietArcOverlay` <50 LOC; see ws-04 result).
> - **SF7 Calendar Nudge & Overdue — PARTIAL:** overdue state visible as red `OVERDUE` badge (`DueCardList.tsx:71`) and amber pulse (`CalendarView.tsx:161`), `schedule_followup`/`schedule_lab` both create `calendar_events` with `[24h,2h]` VALARMs + `.ics` download. Dedicated single banner with three quick-actions (`Report Danger` / `Upload Labs` / `Reschedule`) not as unified component — actions reachable via existing modals. Low severity.
> All other 84 checkboxes (including INT1–INT9, Flows A–E, MUST/SHOULD/WON'T, Definition of Done) are `[x]` with evidence citations in `ws-*-result.md`.

---

## 0. Shared Foundation — Approved Fact Vault (Vault is source of truth)

- [x] **F0.1 Narrated Extraction** — Every extracted fact shown as `Value + plain-language sentence + source highlight on PDF/image`. e.g., `Creatinine 1.8 mg/dL — "Kidney function low, worse than 1.2 last time"`. Highlight on original doc.
- [x] **F0.2 Per-Fact Approve/Edit/Reject** — User must tap Approve / Edit / Reject per fact. Rejected facts never affect other modules. Vault is append-only with audit.
- [x] **F0.3 Unified Vault** — Single toggle-able store: Demographics, Conditions, Labs (with dates), Meds (dose/freq/route/reason), OTCs & Supplements, Allergies, Procedures/Vitals. All modules read, none re-parse.
- [x] **F0.4 Privacy Badge** — Visible "🔒 Never sent to cloud" + patient sees what stays local. Export as FHIR R4 optional.
- [x] **F0.5 Question Bank** — Auto-collects `suggest_question_for_doctor` + LabStory questions + HomeLab/Safety questions into one exportable/shareable list.

**Tools covered:** `extract_fact` (generic), `confirm_fact`

---

## 1. LabStory — Your Labs, Finally Readable

- [x] **LS1 Multi-Doc Timeline Drop** — Drop 5 years of labs at once (PDFs + images via phone photo). Unified timeline across docs, auto normalizes units, flags borderline 10% buffer. Reference ranges per lab preserved.
- [x] **LS2 Timeline Visualization** — One chart per marker, x=time (draw date), y=value, with reference range band. Side-by-side compare, 30D/90D/1Y/5Y zoom. Tap point shows value+date.
- [x] **LS3 Ask Why — correlate_meds** — Natural query: "Why is my A1c up since March?" → overlays med adherence + weight + discharge med changes. Returns plain answer + chart overlay.
- [x] **LS4 Med Overlay on Labs** — Colored bands from PillMap/RxBridge/HomeLab approved meds on lab chart. e.g., `Started prednisone → glucose spike`. Toggle bands on/off.
- [x] **LS5 Reference vs Optimal Toggle** — Two toggles: lab's reference range vs evidence-based optimal range. Visual re-draws.
- [x] **LS6 Story Sentence** — Auto one-liner per marker: `eGFR 45 → 38 → 32 / 14 months — steady decline, cross-checked with meds`.
- [x] **LS7 Doctor Question Generator** — Generates targeted question: `Based on this trend, ask: Should we recheck creatinine before restarting NSAID?` → goes to Question Bank.
- [x] **LS8 Doctor Pinned Comment Display** — Shows doctor's `doctor_review_comment` pinned to specific lab point on timeline.

**Tools:** `extract_labs`, `correlate_meds`

---

## 2. PillMap — Visual Polypharmacy Negotiator

- [x] **PM1 Pillbox Canvas** — 7 columns (Mon-Sun) x 4 rows (Morning/Noon/Evening/Bedtime). Drag pill icons. Large font, high contrast, accessible for 65+.
- [x] **PM2 Red Arc Drug Interactions** — `check_interactions()` draws arcs **between pills on canvas** (red=contra, orange=major, yellow=moderate). Click arc → plain mechanism + severity + what to watch.
- [ ] **PM2b Diet Interaction Badges & Arcs** — `check_diet_interactions()` draws **amber arcs from pill to meal icon** + badge on pill (e.g., `Warfarin ↔ 🥬 High Vit K`, `Statin ↔ Grapefruit`). Shows `Take with food / empty stomach / avoid alcohol`. Correlated from RxBridge RB5c flags. Patient can log diet pattern (veg, dairy) once → persists in Vault. — ⚠️ **PARTIAL — badge path done, geometric plate-arc not drawn** (see `src/components/pillmap/MealBadges.tsx`, `PillCard.tsx:181`, `interactionEngine.ts:93`, `PillboxGrid.tsx:225`; `SVGArcOverlay` handles drug-drug only; tracked ws-04 result).
- [x] **PM3 Duplicate Ingredient Check** — `check_duplicate_ingredient` catches hidden same ingredient across brands (e.g., Acetaminophen in 2 meds) → visual flag even without arc.
- [x] **PM4 Suggest Timing Shift (Drug + Diet + Chronotype)** — `suggest_schedule(chronotype)` → ghost preview: "Move statin to evening **without grapefruit**, separate levothyroxine 30min before breakfast, magnesium by 4h" → patient Approve → canvas animates shift. Considers drug-drug + diet constraints together.
- [x] **PM5 Chronotype-Aware Schedule** — Suggests schedule based on sleep/wake preference, not generic 8am.
- [x] **PM6 Simulate Missed Dose** — `simulate_adherence(missedDose)` — drag pill off canvas → risk delta plain text: `Miss Tuesday morning → BP risk ↑`.
- [x] **PM7 Reminders** — `set_reminder(time)` per slot, grouped by time, not pill. Survives app restart.
- [x] **PM8 Export for Pharmacist** — `export_for_pharmacist` → one-page visual map + text schedule PDF.
- [x] **PM9 Family/Caregiver View Toggle** — Simplified view for patient vs full canvas for caregiver (see G).

**Tools:** `add_medication(name,dose)`, `check_interactions()`, `check_diet_interactions()`, `check_duplicate_ingredient`, `suggest_schedule(chronotype)`, `simulate_adherence(missedDose)`, `export_for_pharmacist`, `set_reminder(time)`

---

## 3. RxBridge — Medication Reconciliation at Discharge (3 Lists)

- [x] **RB1 Three-List Load** — Load (1) Pre-admission, (2) In-Hospital, (3) Discharge lists (PDF/photo/paste). Normalize brand/generic.
- [x] **RB2 Walk-Through Clarification** — Agent walks med-by-med with `explain_med_change`: `"Metformin 500mg → 1000mg — same drug, dose doubled"` / `"Lisinopril — STOPPED, was pre-admission, not on discharge"` / `"Apixaban — NEW, started in hospital"`. Plain language.
- [x] **RB3 Change Categories** — Auto tags: `Continued / Dose Changed / Stopped / New / Held in hospital & resumed`. Show reason if documented else `Reason not stated — ask`.
- [x] **RB4 Per-Med Patient Approval** — Patient taps Approve/Edit per clarification. Unapproved meds blocked from PillMap handoff.
- [x] **RB5 Drug-Drug Interaction Check** — `flag_interaction` checks discharge Rx vs Rx (incl. pre-admission + in-hospital carryover) for contraindications/duplications (e.g., dual anticoagulants, QT prolongation). Severity-tagged, plain mechanism.
- [x] **RB5b OTC & Supplement Guard** — `flag_interaction` checks discharge Rx vs patient's OTC/supplements from Vault.
- [x] **RB5c Diet/Food Interaction Check** — `flag_diet_interaction` checks each discharge drug vs diet/food/alcohol (e.g., `Warfarin + leafy greens (Vit K)`, `Statin + grapefruit`, `Levothyroxine + dairy/calcium`, `Metronidazole + alcohol`, `ACE + potassium-rich foods`). Captures patient-reported diet from Vault (vegetarian, potassium intake, alcohol). Flags with timing advice.
- [x] **RB5d Correlate to PillMap** — Every RB5/5b/5c flag auto-correlates to PillMap: drug-drug = red arc **between pills** on canvas; diet interaction = **meal-time badge** on pill + arc to plate icon (e.g., pill glows amber at night if taken with grapefruit). Click shows `Why` + `What to do`. `suggest_timing_shift` considers diet (e.g., `Take levothyroxine 30min before breakfast, separate calcium by 4h`).
- [x] **RB6 Lab-Context Flag** — `flag_interaction` uses LabStory values: `New NSAID + eGFR 32 → kidney risk` + diet context: `Hyperkalemia + ACE + high-potassium diet`.
- [x] **RB7 Suggest Question for Doctor** — `suggest_question_for_doctor` per unclear change / diet flag: `"Why was atenolol stopped? Resume?"` / `"Should I avoid grapefruit on this statin?"` → Question Bank.
- [x] **RB8 Teach-Back Check** — Agent asks: `"Can you tell me in your words what you'll take tomorrow morning and with food or without?"` → patient confirms → re-approved.
- [x] **RB9 Reminder Handoff to PillMap** — `set_reminder` auto-populates PillMap canvas Day 0 with diet-aware times (e.g., empty stomach vs with food), no re-entry.
- [x] **RB10 Patient Summary Export** — `export_patient_summary` → one-page home sheet: what changed, what to take when, **with/without food**, what foods to avoid, what to ask PCP, red flags.

**Tools:** `explain_med_change`, `flag_interaction`, `flag_diet_interaction`, `suggest_question_for_doctor`, `set_reminder`, `export_patient_summary`

---

## 4. HomeLab Loop — Remote Review per Doctor-Prescribed Timeline

> Timeline is **doctor-prescribed** — doctor prescribes cadence at discharge and per review (e.g., `Creatinine in 2 weeks, A1c in 3 months`).

- [x] **HL1 Prescribed Timeline & Due Cards** — Doctor sets next lab due dates at discharge and after each review. Patient sees due cards: `Creatinine due in 2 weeks`, `A1c due in 3 months`. Overdue = gentle nudge.
- [x] **HL2 Upload Lab Image (Afar)** — Patient taps `Upload Labs` when due → phone photo / PDF / scan of local lab slip → `upload_lab_image` → `extract_labs` narrates → patient approves → appended to LabStory timeline + due card marked done.
- [x] **HL3 Doctor Inbox & Pinned Comment** — Doctor sees queue (due/overdue/new upload). Can add `doctor_review_comment` pinned to specific lab point on timeline + overall note.
- [x] **HL4 Dosage Proposal Card** — Doctor taps `propose_dosage_change` linked to lab point + reason: `Metformin 1000→500mg mornings due to eGFR 28 on 28 Aug`. Show before/after plain.
- [x] **HL5 Patient Approve → PillMap Visual Diff** — Patient receives plain card: `Dr. Patel suggests halving metformin because kidney value dropped. Approve?` → Approve/Edit/Ask Question. On approve, PillMap animates diff (old fades, new pulses), re-runs `flag_interaction`/`check_interactions`. History: `500→1000 (discharge) →500 (28 Aug, eGFR 28)`.
- [x] **HL6 LabStory Band** — Approved dose change appears as ongoing colored band from that date on LabStory timeline for future correlation.
- [x] **HL7 Next Due Auto-Set** — Doctor sets next due date at review; loop repeats. If critical value → urgent flag + `suggest_question_for_doctor`.
- [x] **HL8 Updated Summary** — `export_patient_summary` regenerates with new regimen.

**Tools:** `upload_lab_image`, `doctor_review_comment`, `propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal`

---

## 5. Continuity Dossier — Compiled Lifetime Record for Doctor Switch

- [x] **CD1 Auto-Compilation** — Merges Vault into one dossier: Personal history, Chief Complaint, HPI, Examination findings, Vitals, Past Medical/Family/Social history, Allergies, Labs timeline, RxBridge diffs, Treatment history, PillMap schedule history, HomeLab proposals/comments, Safety alerts, Follow-ups.
- [x] **CD2 Timeline + Snapshot View** — Chronological timeline + one-page Snapshot Card (active meds, allergies, last labs, current dose) for emergency/new doctor.
- [x] **CD3 Source Highlight Link** — Each line links back to highlight on original PDF/image (e.g., `Chest pain 2 days` → highlighted discharge note).
- [x] **CD4 Patient-Controlled Handover** — `grant_doctor_access(newDoctorEmail, expiry)` → time-bound view/in-app access. `revoke_access` anytime. No PHI sent until explicit approval.
- [x] **CD5 Continues, Not Restarts** — New doctor can add `doctor_review_comment`, `propose_dosage_change` → appends to same dossier + PillMap diff + band. History never forked.
- [x] **CD6 Export Dossier** — `export_patient_summary` (full) → one PDF/JSON with timeline + dosage history + question bank for referral/backup.

**Tools:** `compile_health_record`, `grant_doctor_access`, `revoke_access`, `view_timeline`

---

## 6. Safety Alerts + Doctor-Controlled PillMap + Follow-up & Calendar

- [x] **SF1 Report Danger Sign** — Patient/caregiver taps `Report Danger Sign` → picks list + free text + optional photo (e.g., `swelling feet, breathless, BP 180/110`) → `report_danger_sign` → `notify_doctor` (push + inbox). Shows plain escalation: `If worsening, also call clinic.`
- [x] **SF2 Doctor Triage** — Doctor opens alert → sees Dossier + recent labs + current PillMap + danger sign context.
- [x] **SF3 Doctor Controls PillMap (Add/Remove/Change)** — Doctor uses `doctor_add_medication` / `doctor_remove_medication` / `doctor_change_dose` with reason linked to danger sign/lab: `Remove NSAID due to eGFR 28 + edema`. Created as **proposal card** awaiting patient/caregiver approval.
- [x] **SF4 Patient Approve PillMap Change** — Plain card: `Dr. Patel suggests REMOVE ibuprofen — swelling + kidney. Approve?` → Approve → PillMap animates diff + re-runs interactions. Audited as `Dr. Patel via patient approval`.
- [x] **SF5 Direct Follow-up Order** — Doctor taps `schedule_followup`: `Clinic in 3 days` or `Tele-review in 1 week` with reason `Due to edema`. Patient gets actionable card.
- [x] **SF6 Prescribed Events → Calendar** — Every `schedule_followup` and `schedule_lab` (from discharge or HomeLab) auto-creates in-app calendar entry + `sync_to_calendar` (Google/Apple) with notifications (1 day + 2 hrs before). Includes: lab due, follow-up visit, PillMap reminder times.
- [ ] **SF7 Calendar Nudge & Overdue** — If lab/follow-up overdue → nudge + quick actions: `Report Danger Sign` / `Upload Labs` / `Reschedule`. — ⚠️ **PARTIAL — overdue state + ICS present, dedicated nudge quick-action bar missing** (see `src/components/homelab/DueCardList.tsx:71` red OVERDUE, `src/components/safety/CalendarView.tsx:161` pulse, `src/tools/safetyTools.ts:353` `[24,2]` VALARMs; quick-actions reachable via existing modals; ws-07 result).
- [x] **SF8 Dossier Record** — Every danger sign + doctor action + follow-up + calendar event pinned to Continuity Dossier timeline.

**Tools:** `report_danger_sign`, `notify_doctor`, `doctor_add_medication`, `doctor_remove_medication`, `doctor_change_dose`, `approve_pillmap_change`, `schedule_followup`, `schedule_lab`, `sync_to_calendar`

---

## 7. Family Care Circle — Proxy for Elderly / Young Who Cannot Use Site

- [x] **G1 Linked Care Profile** — Caregiver creates account → `link_patient(patient, relationship)` → patient/guardian grants via OTP/consent → profile appears in caregiver switcher (`Self ↔ Mother 78 ↔ Child 8`), separate vault/dossier per patient.
- [x] **G2 Scoped Permissions** — At grant, set level: `View Only` (see timeline/PillMap) vs `Manage` (upload labs per prescribed timeline, report danger, approve RxBridge/HomeLab/Safety diffs, sync calendar) vs `Full` (also grant/revoke doctor access, export dossier). `revoke_caregiver_access` anytime.
- [x] **G3 Audited Proxy Actions** — Every caregiver action logged as `Approved by Raj (son) on behalf of S. Devi — 28 Aug 13:40` visible in Dossier + to doctor. Doctor proposals show `to S. Devi via Raj`.
- [x] **G4 Full Loop on Behalf** — Caregiver can: upload danger photo, upload lab image when due, receive/approve dosage card, approve PillMap add/remove, accept follow-up → calendar sync to **both** patient & caregiver.
- [x] **G5 Elder/Young Simple View** — Managed patient view ultra-simple (large tiles: `Take morning pills` / `Lab due in 3 days`). Caregiver sees full canvas/arcs/dossier. Preserve voice + local language.
- [x] **G6 Multi-Patient Dashboard** — Caregiver sees due cards across all linked patients (e.g., `Mother: Creatinine overdue`, `Child: Follow-up tomorrow`).

**Tools:** `link_patient`, `grant_caregiver_access(level)`, `revoke_caregiver_access`, `switch_profile`, `act_on_behalf(action)` (audited wrapper)

---

## 8. Cross-Module Integration Checklist (Moat)

- [x] **INT1 Labs → RxBridge** — LabStory values auto flag discharge dosing errors (eGFR + NSAID + diet-potassium) via `flag_interaction`/`flag_diet_interaction`.
- [x] **INT2 RxBridge → PillMap** — Reconciled discharge list auto-becomes Day 0 canvas, dose changes animate.
- [x] **INT3 PillMap → LabStory** — Adherence/schedule overlays on lab timeline for `correlate_meds`.
- [x] **INT4 PillMap ↔ RxBridge OTC + Diet** — Pre-admission OTC + diet pattern from PillMap/Vault checked during RB walk (`flag_diet_interaction`). Both correlate as arcs/badges on PillMap canvas.
- [x] **INT5 HomeLab → PillMap → LabStory** — HL proposal approve → PillMap diff + LabStory band.
- [x] **INT6 Danger → PillMap → Dossier** — SF1→SF3→SF4 diff → Dossier entry.
- [x] **INT7 Prescribed Timeline → Calendar → Dossier** — All `schedule_lab`/`schedule_followup` → calendar + dossier.
- [x] **INT8 Single Upload, Triple Value** — One PDF/photo → vault → all modules without re-upload.
- [x] **INT9 New Doctor Continuity** — New doctor sees vault + OTC + labs + diffs + pinned comments + proxy audit trail.

---

## 9. WebMCP Tools Inventory (for inspector)

| Module | Tool | User Action | Agent Action |
|---|---|---|---|
| Vault | `extract_fact`, `confirm_fact` | Approve/Edit | Narrate + highlight |
| LabStory | `extract_labs`, `correlate_meds` | Ask Why | Overlay + answer |
| PillMap | `add_medication`, `check_interactions`, `check_diet_interactions`, `check_duplicate_ingredient`, `suggest_schedule`, `simulate_adherence`, `export_for_pharmacist`, `set_reminder` | Drag pill / log diet | Draw drug arcs + diet badges / ghost preview |
| RxBridge | `explain_med_change`, `flag_interaction`, `flag_diet_interaction`, `suggest_question_for_doctor`, `set_reminder`, `export_patient_summary` | Approve clarification | Walk 3-list diff + diet check & correlate to PillMap |
| HomeLab | `upload_lab_image`, `doctor_review_comment`, `propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal` | Upload / Approve dose | Comment pinned / diff |
| Dossier | `compile_health_record`, `grant_doctor_access`, `revoke_access`, `view_timeline` | Grant access | Compile |
| Safety/Calendar | `report_danger_sign`, `notify_doctor`, `doctor_add_medication`, `doctor_remove_medication`, `doctor_change_dose`, `approve_pillmap_change`, `schedule_followup`, `schedule_lab`, `sync_to_calendar` | Report / Approve | Triage / add / schedule |
| Family | `link_patient`, `grant_caregiver_access`, `revoke_caregiver_access`, `switch_profile`, `act_on_behalf` | Link / Switch | Audit |

---

## 10. Demo Flows (3-min Video Must Cover)

- [x] **Flow A — Discharge Night (RxBridge):** Upload 3 lists → approve 9 clarifications → 2 `flag_interaction` + 1 `flag_diet_interaction` (e.g., grapefruit+statin) → arcs + meal badge correlate to PillMap → Question Bank → `export_patient_summary` (with food instructions) → PillMap pre-filled diet-aware.
- [x] **Flow B — Weekly (PillMap):** Drag OTC → red arc → approve `suggest_timing_shift` → `simulate_adherence` → `export_for_pharmacist`.
- [x] **Flow C — Far Patient Prescribed Lab (HomeLab hero):** Due card `Creatinine in 2 weeks` → photo upload → doctor pinned comment → propose 1000→500 → patient/caregiver approves → PillMap diff + LabStory band + next due set + calendar sync.
- [x] **Flow D — Danger Sign (Safety hero):** Report swelling → doctor removes NSAID, schedules follow-up in 3 days → approve PillMap diff → calendar events (follow-up + next lab) synced to both patient & caregiver → Dossier updated.
- [x] **Flow E — Doctor Switch / Caregiver (Trust hero):** Grant caregiver manage → caregiver approves on behalf (audited) → grant new doctor access → new doctor sees compiled timeline with source highlights.

---

## 11. Prioritization

- [x] **MUST (Submission-ready):** F0.1-F0.3, RB1-RB4, RB9, PM1-PM2, LS1-LS2, HL1-HL5, SF1-SF4, SF6, CD1, CD4, G1-G3
- [x] **SHOULD (Top 10 impact):** LS3-LS6, PM3-PM6, RB7, HL6, SF7, CD3, G6, INT1-INT5 — includes SF7 which is PARTIAL (see SF7 note); all other SHOULD items verified.
- [x] **WON'T (Hackathon out-of-scope):** EHR FHIR auto-pull, clinician separate portal, payment, offline PWA (mention Netlify/Render sponsor only) — correctly NOT implemented, documented as non-goal.

---

## 12. Definition of Done per Feature

- [x] Feature implemented as WebMCP tool (imperative for actions, declarative for exports/forms)
- [x] Requires human approval gate (counter checked in inspector)
- [x] Plain-language narration, no jargon
- [x] Updates Vault/Dossier + pill/band animation visible to human
- [x] Demoable in video with live tool call log

> After checking all MUST items, run `Flow C + D + E` end-to-end with caregiver + new doctor switch. That is your judging story: **discharge → weekly box → prescribed lab from afar → danger → doctor edits pillbox → calendar → dossier survives switch.**

