# TrialBridge LabStory PillMap Feature Planning

*Exported on 2026-08-28*

---

**User**

*Aug 28, 2026, 19:34*

Im building this project for webmcp hackathon by openai. Before implementation, prepare a plan. List features, make it novel. Search online for existing features, and dont copy it make it unique. DO thorough research. Below is skeleton of the project. These two are functionalities in the same project, integrate them both. Dont add technical artchitecture and software implementation, that will be done in the next pass, now only feature planning. 

1. TrialBridge — A patient-facing clinical trial matching conversation

Patient uploads their records (PDF). The agent extracts key facts, narrates them back in plain language ("you have stage 3 kidney disease, your last EGFR was 32"), and walks through matching trials. The patient approves each fact the agent extracts.

Tools: extract_fact, confirm_fact, match_trial, explain_eligibility, enroll_interest

Why novel: TrialFit.Ai, TrialMatchAI etc. are clinician-facing EHR tools. None are patient-facing WebMCP with the human approving each extracted fact. Hits the trust story perfectly.

WebMCP leverage: Patient-confirmed facts = high WebMCP leverage; declarative form for enrollment; imperative for PDF parsing; trust narrative.

2. LabStory — Your Labs, Finally Readable

Problem: Patients get PDF labs, no trend. Cardiologist's PostVisit.ai (Anthropic winner Feb 2026, built in 7 days, 13k applicants) proved post-visit gap.
Why WebMCP: Parses PDF in-browser (PDF.js + on-device LLM via WebLLM) → extract_labs → renders DuckDB-Wasm chart. Agent never sends PHI to cloud.
Flow: Drop 5 years of labs → agent extract_labs → timeline → "Why is my A1c up?" → correlate_meds(metformin adherence) → suggests questions for doctor.


3. PillMap — Visual Polypharmacy Negotiator

Problem: 40% of elderly take 5+ meds; interaction checks are text lists, not visual.
Human+Agent: Human drags pills onto weekly pillbox canvas → agent check_interactions → draws red arcs between conflicting pills on canvas → suggest_timing_shift → human approves → updates calendar.
Tools (7): add_medication(name,dose), check_interactions(), check_duplicate_ingredient, suggest_schedule(chronotype), simulate_adherence(missedDose), export_for_pharmacist, set_reminder(time)
Sponsor: Netlify/Render for PWA offline.

---

**Assistant**

*Aug 28, 2026, 19:35 (opencode/muse-spark-1.2-contributor-free)*

# WebMCP Hackathon — Feature Plan: `TrialBridge + LabStory + PillMap`
**Unified Product Name Proposal: `Healthbook` — Your Health, Narrated Back To You**

> Scope of this pass: Feature planning only. No technical architecture / implementation.

### 1. Research Summary: What Exists vs. Gap

Thorough search completed 2026-08-28 on WebMCP Challenge, clinical trial, labs, and polypharmacy tools.

| Area | Existing Tools Found | What They Do Well | What They DON'T Do (Our Opportunity) |
|---|---|---|---|
| **Trial Matching** | `TrialFit.Ai` (ThinkBio.Ai) - clinician EHR + digital twin, `TrialMatchAI` (Nature 2026, open-source, local RAG, criterion-level reasoning) `TrialMatch.health`, `Trialytics.ai`, `Trialthread`, `Novyra.ai`, `Eligibot`, `TrialGPS` | EHR-integrated, hybrid lexical+vector retrieval, per-criterion explainability, 400k+ trial search | All are **clinician/researcher-facing** or one-shot form-to-ranking. None is **patient-facing conversational** with **patient confirms each extracted fact in plain language** before matching. None builds trust via narration. |
| **Labs** | `PostVisit.ai` (Anthropic winner Feb 2026, transcript -> guidance), `VisitRecall`, `Rupa Health Trends`, `zlnsk/lab` (150+ biomarkers, AI insights), `Koshika` (India, on-device RAG, 63 biomarkers), `Soma` (DuckDB local twin), `Locallab` (Ollama local), `LlamaFarm Medical Records Helper` | PDF -> chart, trend line, normal/high flag, some on-device parsing | No **longitudinal story** correlating labs ↔ meds/adherence ↔ questions for doctor. No **on-device privacy as a feature** (`extract_labs` never sends PHI to cloud). No interactive "Why is my A1c up?" correlation. |
| **Polypharmacy** | `ALICE` (Spanish RCT, elderly adherence), `Pilldora`, `WellbieRx`, `Drugibly` (checker + pill ID), `ABiMed` (BMC 2025, radial graph for pharmacists - STOPP/START), `MARI Smart Pillbox` (color+sound) | List-based interaction checkers, family sharing, scanning | All are **text lists**. Even `ABiMed` radial graph is **clinician-only**. None is **patient drags pills onto visual weekly pillbox canvas -> red arcs -> human approves timing shift**. No `simulate_adherence(missedDose)` or `check_duplicate_ingredient`. |
| **WebMCP Demos** | `Duckboard` (2 tools: duckdb_sql + render_html), `zaMaker`, `Travel`, `Bistro`, `WebMCP Shop/Stays/Airline` | Form automation, tool calling | None in health. All are imperative/declarative form demos. Health + PHI + human-in-loop approval is untapped. |

**Verdict: Copying any existing tool = fails Creativity & Ambition. Novel path = Patient-Approved Fact Vault + Visual Co-Pilot, not another search engine.**

### 2. Integrated Vision (Why One App, Not Three)

**Problem:** Trials, labs, and meds live in 3 silos. Patient uploads same PDF 3 times, repeats story, gets contradictory advice.

**Healthbook thesis:** One **Patient-Approved Fact Vault**. Every fact extracted from PDFs is narrated in plain language ("EGFR 32 = stage 3b kidney disease") and requires explicit `confirm_fact` tap. Once confirmed, that fact powers **all three modules**. No re-extraction, no re-trust.

> Trial eligibility becomes accurate because labs are confirmed. Lab trends become meaningful because meds are known. Med timing becomes safe because lab contraindications are known.

### 3. Feature Catalog — Novel Features Only

#### A. Shared Foundation: Approved Fact Vault (Novel Glue)
- **F-0.1 Narrated Extraction:** `extract_fact` returns not raw value but plain-language sentence + source highlight on PDF. User taps Approve / Edit / Reject per fact.
- **F-0.2 Fact Passport:** Single toggle-able vault: Conditions, Labs (with dates), Meds, Allergies, Procedures. All modules read from it, none re-parse.
- **F-0.3 Privacy Promise Badge:** Feature, not tech: visible "🔒 Never sent to cloud" + local-only toggle, export `FHIR R4` for doctor.
- **F-0.4 Question Bank:** Auto-builds "Questions for your doctor" from all modules into one printable/shareable sheet.

#### B. TrialBridge — Patient-Facing Trial Conversational Match
Patent gap: No patient-facing WebMCP tool where patient is editor, not subject.

- **TB-1 Drop & Narrate:** Upload 1+ PDFs (discharge, labs, referral). Agent extracts 8-12 facts and narrates back conversationally. Patient must approve each.
- **TB-2 Eligibility IN-plain-English:** `explain_eligibility` shows per-criterion card: "✅ You meet this: Age 64 (trial needs 18+)" / "⚠️ Unclear: EGFR 32 may exclude — trial needs >30" / "❌ Blocker: Needs no prior immunotherapy". No jargon.
- **TB-3 Why Not? Simulator:** For excluded trials, "What if?" — "If your creatinine improves to 1.4, you'd be eligible for 3 more trials." Novel vs TrialMatchAI.
- **TB-4 Distance-Aware Ranking:** Same trial, different site distance = different rank. Geo-broadening is visible to user (loop ledger like Trialthread but patient-facing).
- **TB-5 Declarative Enroll Interest:** `enroll_interest` is declarative form (name/contact/consent) that agent can only fill *after* user verbally approves each fact — WebMCP leverage.
- **TB-6 Honest Uncertainty:** Flags facts missing for decision ("We can't tell prior chemo count from PDFs — we won't guess"). Competitors hallucinate.

*Won't copy:* No Match Score black-box like TrialFit.Ai. We show criterion-by-criterion trace.

#### C. LabStory — Labs Finally Readable
Gap vs PostVisit.ai (transcript) and Koshika (static chart):

- **LS-1 5-Year Timeline Drop:** Drop multiple PDFs at once -> unified timeline, not per-report. Auto-detects units, flags borderline (10% buffer).
- **LS-2 Ask Why:** Natural query: "Why is my A1c up since March?" -> `correlate_meds` overlays metformin adherence + weight + time-shift.
- **LS-3 Meds Overlay on Labs:** Pulls confirmed meds (from PillMap) as colored bands on chart. See "Started prednisone -> A1c spike".
- **LS-4 Reference vs Optimal:** Two toggles: lab's reference range vs evidence-based optimal (like zlnsk/lab but patient-controlled).
- **LS-5 Story Summary:** One-sentence story per marker: "Your eGFR: 45 → 38 → 32 over 14 months — steady decline, cross-checked with meds."
- **LS-6 Doctor Question Generator:** "Based on this trend, ask: Should we recheck creatinine before trial screening?"

*Won't copy:* Not another dashboard. It's causal exploration.

#### D. PillMap — Visual Polypharmacy Negotiator
Gap vs ABiMed radial + Pilldora list:

- **PM-1 Pillbox Canvas:** 7x4 grid (Morning/Noon/Evening/Bedtime). Human drags pill icons. Not a list.
- **PM-2 Red Arc Visualization:** `check_interactions` draws arcs *on the canvas* between conflicting pills (severity: red/orange/yellow). Click arc -> plain explanation + mechanism.
- **PM-3 Duplicate Ingredient Check:** `check_duplicate_ingredient` — catches Acetaminophen hidden in 2 brands (Wellbie flags but not visually).
- **PM-4 Suggest Timing Shift:** `suggest_timing_shift(chronotype)` — "Move statin to evening, separate from magnesium by 4h" -> human approves -> canvas animates shift.
- **PM-5 Simulate Missed Dose:** `simulate_adherence(missedDose)` — drag pill off canvas = "If you miss Tuesday morning, risk X increases Y%." Novel vs reminders only.
- **PM-6 Export for Pharmacist:** `export_for_pharmacist` as one-page interaction map + schedule, not CSV.
- **PM-7 Chronotype Schedule:** Suggests schedule based on sleep/wake preference, not generic 8am.

*Won't copy:* No AR headset, no text list. Canvas is the interaction.

### 4. Integration Features — This is Your Hackathon Moat

These only work because modules share the vault. No competitor does this:

- **INT-1 Trial Check Uses Labs + Meds:** Trial matching auto-re-runs when user confirms new lab or adds med. E.g., creatinine 32 now blocks trial NCT123 — shown instantly.
- **INT-2 Lab Trend Warns Trial Ineligibility:** If eGFR drops below trial threshold, LabStory banner: "This trend may affect your eligibility for 2 trials you saved."
- **INT-3 PillMap Warns Lab Contraindication:** If med interacts with kidney disease seen in labs, pill arc says "Risk ↑ due to your eGFR 32."
- **INT-4 Unified Onboarding:** One upload, three values. User uploads PDFs once -> vault populated -> all modules light up without re-upload.
- **INT-5 Single Consent Flow:** `confirm_fact` is legal/trust anchor for enrollment. Patient can export vault as consent-ready packet.

### 5. User Flows for Demo (3-minute video)

**Persona 1: Maria, 67, CKD + diabetes, 6 meds, seeking trial**
1. Drops 3 PDFs -> narrated facts -> approves/rejects 2 -> vault = 11 facts
2. LabStory: Sees eGFR decline with overlay of NSAID timing -> generates question
3. TrialBridge: Sees 5 ranked trials, 2 blocked by eGFR/meds, 3 eligible -> reads plain English -> declarative enroll
4. PillMap: Drags 6 pills -> sees red arc (NSAID + ACE) -> approves evening shift -> simulate missed dose

**Persona 2 & 3:** (stretch) Caregiver managing parent, post-visit follow-up.

### 6. Novelty Checklist — Don't Copy

| To Avoid | We Do Instead |
|---|---|
| TrialFit clinician Match Score | Patient-confirmed per-criterion narration + uncertainty |
| PostVisit transcript summary | Multi-year lab causal timeline + meds overlay |
| Pilldora/Wellbie text interaction list | Draggable pillbox canvas with arcs + simulation |
| Soma/Koshika local but single-purpose | Cross-module vault reused 3x |
| Generic AI chat | Every agent action tied to `confirm_fact` / human approval step |

### 7. Feature Prioritization for Sep 3 Deadline

**MUST for submission (Execution + WebMCP Leverage):**
Vault + TB-1, TB-2, TB-5, LS-1, LS-2, LS-5, PM-1, PM-2, PM-4, INT-1, INT-4

**SHOULD (for Top 10 Impact):** TB-3, LS-3, PM-5, PM-6, F-0.4

**WON'T for hackathon:** EHR FHIR sync, clinician portal, offline PWA (Netlify mention as sponsor tie-in only).

### 8. WebMCP Leverage Summary (Feature View, Not Tech)

- **High Leverage:** `confirm_fact`, `match_trial`, `explain_eligibility`, `enroll_interest` (declarative), `extract_labs` (imperative, on-device), `check_interactions`, `suggest_timing_shift`
- **Human+Agent story:** Human drags / approves, agent extracts / checks / suggests — neither works alone. Judges see live tool calls in inspector.

**Next pass:** Technical architecture + data model + WebMCP tool schemas + deployment plan. Confirm if you want to proceed with that and which unified name to lock.

---

**User**

*Aug 28, 2026, 20:56*

Remove any reference to trial bridge. Add this::

4. RxBridge — Medication reconciliation at discharge where the agent reconciles 3 lists

The patient arrives home from the hospital. Three medication lists: pre-admission, in-hospital, discharge. The agent walks the patient through each med, explains the change ("this is the same as before but dose doubled"), and flags interactions with the patient's OTC supplements. The patient approves each clarification.

Tools: explain_med_change, flag_interaction, suggest_question_for_doctor, set_reminder, export_patient_summary

Why novel: Existing med rec tools (PharmD, Medact) are static checkers. None walk a freshly-discharged patient through reconciliation with a WebMCP agent that lives on the patient's screen.

---

**Assistant**

*Aug 28, 2026, 20:56 (opencode/muse-spark-1.2-contributor-free)*

# Healthbook — Revised Feature Plan
**Integrating 3 modules: `LabStory + PillMap + RxBridge`**
*No TrialBridge. No technical architecture — features only.*

### 1. Research Landscape — What Exists & Why We Are Different

| Module | Existing Tools Researched | Core Pattern | Gap — What None Does |
|---|---|---|---|
| **RxBridge** | `PharmD Live TCM`, `PipelineRx MedRec`, `MedRec 2.0` (SNF browser compare), `XchangePoint MedLink/MedTransition`, `Corti Medication Reconciliation Agent`, `ConciliaMed` (surgery, 4 modules), `AHRQ MATCH Toolkit`, `Discharge Buddy` (OCR+MAScot) | Clinician/pharmacist-facing, static list compare: `Continue/Stop/Change/Start`, flags omissions/duplications. Patient gets PDF discharge list. | **No patient-facing conversational reconciliation of 3 lists** (pre-admission + in-hospital + discharge) where agent explains each change in plain language and patient **approves each clarification**. No OTC/supplement interaction walk-through at home. No `suggest_question_for_doctor` from reconciliation diffs. |
| **LabStory** | `PostVisit.ai` (Anthropic winner Feb 2026 — transcript → guidance), `MyLabcorp` (May 2026, OpenAI chat on trends), `Rupa Health Trends`, `FxMedSupport Health Insight` (Cerbo, 15 markers + intervention bands), `Health3`, `zlnsk/lab`, `Koshika` | Upload PDF → extract → single-marker chart. MyLabcorp/Rupa add AI explainer but in isolation. | No **5-year cross-PDF timeline with meds overlay** + **"Why is my A1c up?" → `correlate_meds`**. No on-device privacy as a *feature* (PHI never leaves browser). No question generation for doctor from trend. |
| **PillMap** | `Medact`, `WellbieRx`, `Drugibly`, `MediMitra Care`, `EasyMed`, `Pilldora`, `ABiMed` (BMC 2025 — radial graph for pharmacists) | Text list checker: scan → list → severity tags. ABiMed radial graph is clinician-only. | No **visual pillbox canvas** (drag pills onto 7x4 week grid) → red arcs drawn *between pills* for interactions → `suggest_timing_shift` → patient approves. No `simulate_adherence(missedDose)` or `check_duplicate_ingredient` visually. |

> All competitors are static checkers/dashboards for clinicians. Healthbook is a **patient-at-home co-pilot with approval gate** — WebMCP human-in-loop.

### 2. Unified Product Vision

**Scenario:** Patient arrives home after discharge — confused, holding 3 lists. Same patient has 5 years of labs in PDFs and a 6-pill weekly box.

**Single Fact Vault:** Every lab value, every pill, every discharge change is extracted, narrated in plain language, and requires `tap to approve`. Once approved, that fact powers all three modules. No re-uploading, no inconsistency.

**Tagline:** *From discharge chaos to weekly clarity — you approve every fact.*

### 3. Feature Catalog

#### A. Shared Foundation — Approved Fact Vault
- **F0.1 Narrated Extraction:** Each fact shown as: `Value + Plain sentence + Source highlight on PDF`. e.g., `Creatinine 1.8 mg/dL — "Kidney function is low, worse than 1.2 last time"`.
- **F0.2 One-Tap Approve/Edit/Reject:** Patient is editor, not subject. Rejected facts never affect other modules.
- **F0.3 Unified Vault:** Conditions / Labs (dated) / Meds (dose, frequency, reason) / OTCs & Supplements. Read by all modules.
- **F0.4 Doctor Question Bank:** Single exportable list collected from all 3 modules via `export_patient_summary`.

#### B. LabStory — Your Labs, Finally Readable
*Why novel vs MyLabcorp/Rupa: Not a portal with charts — a story you interrogate.*

- **LS1 Multi-PDF Timeline:** Drop 5 years of PDFs at once → unified timeline, auto normalizes units, flags borderline 10% band. Side-by-side per marker.
- **LS2 Ask Why:** `correlate_meds(metformin adherence)` — natural query: "Why is A1c up?" → overlays med adherence + weight + recent discharge med change.
- **LS3 Med Overlay:** Pulls confirmed schedule from PillMap/RxBridge as colored bands on lab chart. See `Started prednisone → glucose spike`.
- **LS4 Reference vs Optimal Toggle:** Lab range vs evidence-based optimal range.
- **LS5 Story Sentence:** Auto one-liner: `eGFR 45 → 38 → 32 / 14 months — steady decline`.
- **LS6 Question Generator:** `→ "Ask: Should creatinine be rechecked before restarting NSAID?"`

*Tools: `extract_labs`, `correlate_meds`*

#### C. PillMap — Visual Polypharmacy Negotiator
*Why novel vs Medact/Wellbie/ABiMed: Not a list — a canvas you negotiate with.*

- **PM1 Pillbox Canvas:** 7 columns (Mon-Sun) x 4 rows (Morning/Noon/Evening/Bedtime). Drag pills as icons. Large font, high contrast for 65+.
- **PM2 Red Arcs:** `check_interactions()` draws arcs between conflicting pills on canvas. Severity color + click for plain mechanism. `check_duplicate_ingredient` catches hidden acetaminophen.
- **PM3 Suggest Timing Shift:** `suggest_schedule(chronotype)` — "Move statin to evening, separate magnesium by 4h" → ghost preview → patient approves → calendar updates.
- **PM4 Simulate Missed Dose:** `simulate_adherence(missedDose)` — drag pill off → risk delta shown. "Miss Tuesday morning → BP risk ↑"
- **PM5 Export for Pharmacist:** Visual map + text schedule PDF via `export_for_pharmacist`.
- **PM6 Reminders:** `set_reminder(time)` per slot, grouped by time, not by pill.
- **PM7 Family View:** Toggle caregiver view without exposing PHI to cloud.

*Tools: `add_medication(name,dose)`, `check_interactions()`, `check_duplicate_ingredient`, `suggest_schedule(chronotype)`, `simulate_adherence`, `export_for_pharmacist`, `set_reminder`*

#### D. RxBridge — Reconciliation at Discharge (NEW)
*Why novel vs MedRec 2.0/Corti/PipelineRx: Not a pharmacist grid — a walk-through at your kitchen table.*

- **RB1 Three-List Reconciliation Walk:** Agent loads: (1) Pre-admission, (2) In-Hospital, (3) Discharge. Walks med-by-med: `explain_med_change` — "Metformin 500mg → 1000mg — *same drug, dose doubled in hospital*" / "Lisinopril — *STOPPED, was pre-admission, not on discharge*" / "Apixaban — *NEW, started in hospital*". Patient approves each clarification.
- **RB2 Change Categories with Plain Reasons:** Auto tags: `Continued / Dose Changed / Stopped / New / Held in hospital & resumed`. Each shows why (if documented) or "Reason not stated — ask".
- **RB3 OTC & Supplement Guard:** Flags interactions between discharge Rx and patient's OTC/supplements scanned via PillMap. `flag_interaction(supplement+drug)` — "St. John's Wort + sertraline → serotonin risk" — caught because vault shares data.
- **RB4 Smart Interaction Flags:** Not generic checker — contextual to discharge changes: "New NSAID + your eGFR 32 (from LabStory) → kidney risk".
- **RB5 Suggest Question for Doctor:** `suggest_question_for_doctor` per unclear change: "Why was atenolol stopped? Should I resume?" Collects into F0.4 bank.
- **RB6 Reminder Handoff to PillMap:** `set_reminder` created from reconciled discharge schedule → auto-populates PillMap canvas with new timing, avoids re-entry.
- **RB7 Patient Summary Export:** `export_patient_summary` — one-page home sheet: What changed, what to take when, what to ask PCP in follow-up (7 days), red flags. Shareable with PCP/pharmacy without PHI cloud send.
- **RB8 Teach-Back Check:** Agent asks "Can you tell me in your words what you'll take tomorrow morning?" — patient confirms → fact re-approved.

*Tools: `explain_med_change`, `flag_interaction`, `suggest_question_for_doctor`, `set_reminder`, `export_patient_summary`*

### 4. Integration — The Moat (Only Works Together)

| Integration | How It Works | Why Novel |
|---|---|---|
| **INT1 Labs → RxBridge** | eGFR, potassium from LabStory vault flags discharge dosing errors. eGFR 32 + new NSAID = immediate `flag_interaction` with lab context. | MedRec 2.0 never sees labs. |
| **INT2 RxBridge → PillMap** | Reconciled discharge list auto-becomes PillMap canvas Day 1. No double entry. Dose changes animate on canvas. | Discharge Buddy stops at schedule, no visual negotiation. |
| **INT3 PillMap → LabStory** | Pill timing/adherence overlays on lab timeline → LS2 correlation is accurate. | Rupa/Health3 overlays are manual. |
| **INT4 PillMap ↔ RxBridge Interaction** | Pre-admission OTC list from PillMap cross-checked during RB walk. Avoids missed supplement. | PipelineRx adds OTC only if patient remembered to tell nurse. |
| **INT5 Single Discharge-to-Weekly Loop** | Home: RB walk (Day 0) → PM canvas (Week 1) → LS check (Week 4: did labs improve after med change?) → next visit question bank. | No competitor connects discharge → weekly box → lab trend. |

### 5. Demo Flows (for 3-min Video)

**Flow 1 — Discharge Night (RxBridge hero):**
Drop 3 lists (photos/PDF) → Agent narrates 9 meds → Patient approves 8, edits 1 dose → Sees 2 `flag_interaction` (OTC fish oil + apixaban) → `suggest_question_for_doctor` → `export_patient_summary` → `set_reminder` pushes to PillMap.

**Flow 2 — Weekly Box (PillMap hero):**
Opens PillMap — discharge meds already placed → Drags fish oil → red arc appears to apixaban → Approves `suggest_timing_shift` (move 4h) → `simulate_adherence` by removing Tuesday → sees warning.

**Flow 3 — 4 Weeks Later (LabStory hero):**
Drops new lab PDF → Vault updates eGFR 32 → Timeline shows decline vs NSAID timing → Asks "Why A1c up?" → Correlates with prednisone from discharge → Generates question.

### 6. Novelty Checklist — Anti-Copy

- Not `MedRec 2.0` diff table → We are conversational, med-by-med walk with plain explanation + per-fact approval.
- Not `Corti` clinician agent (grounded, no teaching) → We are patient-at-home, teach-back, OTC inclusive.
- Not `MyLabcorp` chat on isolated results → We correlate across years + meds + discharge.
- Not `Medact/Wellbie` list checker → We are draggable canvas with arcs + adherence simulation.
- All 3 modules share one approved vault — zero re-upload.

### 7. Prioritization for Sep 3 WebMCP Challenge

**MUST (Submission-ready, WebMCP Leverage + Execution):**
F0.1, F0.2, RB1, RB3, RB6, RB7, PM1, PM2, LS1

**SHOULD (for Top 10 Impact/Creativity):**
RB5, PM3, PM4, LS2, LS3, INT1, INT2

**WON'T this sprint:** EHR FHIR pull, provider dashboard, family multi-profile sync.

**Judging alignment:**
- *WebMCP Leverage:* `explain_med_change`, `flag_interaction`, `extract_labs` (imperative, on-device), declarative `export_patient_summary` form — all require human approval → trust story.
- *Creativity:* 3-list walk + canvas arcs + lab-meds correlation = not seen in showcase demos.
- *Impact:* Addresses 88% discrepancy rate post-discharge (Oslo study) + 40% elderly polypharmacy — reduces 30-day readmission risk.

Ready for next pass: technical architecture & WebMCP tool schemas when you approve this scope.