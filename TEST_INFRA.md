# E2E Test Infra: Healthbook Patient-Facing Health Companion

## Test Philosophy
- Opaque-box, requirement-driven, and client-side verifiable.
- Strict human-in-the-loop approval gate verification across all tool executions.
- Zero-tolerance for mocking shortcuts or hardcoded responses in application logic.
- Methodology: 4-Tier Test Matrix (Feature Coverage, Boundary & Stress, Cross-Module Integration, Real-World Workloads) + Acceptance Flows A-E Automation.

## Feature Inventory & Test Mapping
| # | Feature / Tool | Category | Tier 1 Tests | Tier 2 Boundaries | Tier 3 Pairwise | Tier 4 Scenario |
|---|----------------|----------|:------------:|:-----------------:|:---------------:|:---------------:|
| 1 | `extract_fact` | Vault | 5 | Empty/malformed doc | Fact -> PillMap | Harold Jenkins |
| 2 | `confirm_fact` | Vault | 5 | Approve/Edit/Reject states | Vault -> All | Harold Jenkins |
| 3 | `compile_health_record` | Vault/Dossier | 5 | Missing sections | Vault -> Dossier | Shanti Devi |
| 4 | `extract_labs` | LabStory | 5 | Unit conversions, missing dates | Lab -> RxBridge | Harold Jenkins |
| 5 | `correlate_meds` | LabStory | 5 | No overlapping meds | Meds -> Labs | Harold Jenkins |
| 6 | `add_medication` | PillMap | 5 | Duplicate names/doses | PillMap -> Vault | Shanti Devi |
| 7 | `check_interactions` | PillMap | 5 | 10+ meds cascade | PillMap -> SVG Arcs | Harold Jenkins |
| 8 | `check_diet_interactions` | PillMap | 5 | Multiple diet flags | Diet -> Meal Badges | Shanti Devi |
| 9 | `check_duplicate_ingredient` | PillMap | 5 | Brand/generic synonyms | Meds -> Alert | Harold Jenkins |
| 10 | `suggest_schedule` | PillMap | 5 | Chronotype extremes | Schedule -> Ghost | Shanti Devi |
| 11 | `simulate_adherence` | PillMap | 5 | Multiple missed doses | Adherence -> Risk | Harold Jenkins |
| 12 | `export_for_pharmacist` | PillMap | 5 | Non-standard schedules | PillMap -> Export | Harold Jenkins |
| 13 | `set_reminder` | PillMap/RxBridge | 5 | Conflicting time slots | RxBridge -> PillMap | Shanti Devi |
| 14 | `explain_med_change` | RxBridge | 5 | Unmatched brand/generic | 3-List -> Walk | Harold Jenkins |
| 15 | `flag_interaction` | RxBridge | 5 | High severity contra | 3-List -> PillMap | Shanti Devi |
| 16 | `flag_diet_interaction` | RxBridge | 5 | Statin+grapefruit, Warfarin+K| 3-List -> PillMap | Shanti Devi |
| 17 | `suggest_question_for_doctor` | RxBridge | 5 | Generic vs targeted | RxBridge -> QBank | Harold Jenkins |
| 18 | `export_patient_summary` | RxBridge/Dossier | 5 | 1-page layout overflow | RxBridge -> Summary | Shanti Devi |
| 19 | `upload_lab_image` | HomeLab | 5 | Blur/noise handling | HomeLab -> LabStory | Harold Jenkins |
| 20 | `doctor_review_comment` | HomeLab | 5 | Pinned comment parsing | Doctor -> LabStory | Harold Jenkins |
| 21 | `propose_dosage_change` | HomeLab | 5 | Escalation vs reduction | Doctor -> Proposal | Harold Jenkins |
| 22 | `approve_dosage_change` | HomeLab | 5 | Caregiver vs Patient | Proposal -> PillMap | Harold Jenkins |
| 23 | `sync_pillmap_from_proposal`| HomeLab | 5 | Mid-week schedule sync | Proposal -> Canvas | Harold Jenkins |
| 24 | `report_danger_sign` | Safety | 5 | Free text + photo + vitals | Safety -> Triage | Shanti Devi |
| 25 | `notify_doctor` | Safety | 5 | Push/inbox payload | Safety -> Inbox | Shanti Devi |
| 26 | `doctor_add_medication` | Safety | 5 | Emergency med add | Doctor -> PillMap | Shanti Devi |
| 27 | `doctor_remove_medication` | Safety | 5 | Acute toxicity stop | Doctor -> PillMap | Shanti Devi |
| 28 | `doctor_change_dose` | Safety | 5 | Safety dose titration | Doctor -> PillMap | Shanti Devi |
| 29 | `approve_pillmap_change` | Safety | 5 | Doctor proposal approval | Approval -> Canvas | Shanti Devi |
| 30 | `schedule_followup` | Safety | 5 | Tele vs in-person | Doctor -> Calendar | Shanti Devi |
| 31 | `schedule_lab` | Safety/HomeLab | 5 | 2-week vs 3-month cadence | Doctor -> Calendar | Harold Jenkins |
| 32 | `sync_to_calendar` | Safety/Calendar | 5 | iCal format & notifications | Calendar -> Export | Harold Jenkins |
| 33 | `link_patient` | Care Circle | 5 | Relationship verification | Caregiver -> Vault | Shanti Devi |
| 34 | `grant_caregiver_access` | Care Circle | 5 | View Only vs Manage vs Full | Permissions -> Gate | Shanti Devi |
| 35 | `revoke_caregiver_access` | Care Circle | 5 | Instant permission revoking | Revoke -> Gate | Shanti Devi |
| 36 | `switch_profile` | Care Circle | 5 | Multi-patient isolation | Switcher -> Active | Shanti Devi |
| 37 | `act_on_behalf` | Care Circle | 5 | Audit trail metadata check | Proxy -> Audit Log | Shanti Devi |
| 38 | `grant_doctor_access` | Dossier | 5 | Time-bound token expiry | Grant -> Access | Shanti Devi |
| 39 | `revoke_access` | Dossier | 5 | Token immediate termination | Revoke -> Access | Shanti Devi |
| 40 | `view_timeline` | Dossier | 5 | Filter by category/date | Vault -> Dossier | Harold Jenkins |

## E2E Acceptance Demonstration Flows (Flows A through E)
### Flow A: Discharge Night (RxBridge Walkthrough)
1. Upload 3 medication lists (Pre-admission, In-hospital, Discharge).
2. Agent explains each medication change with `explain_med_change` across 9 items.
3. System triggers `flag_interaction` (2 drug-drug flags) and `flag_diet_interaction` (1 diet flag: Statin + Grapefruit).
4. Auto-correlate flags to PillMap canvas (SVG arcs and meal-time badge).
5. Auto-collect generated questions into Doctor Question Bank via `suggest_question_for_doctor`.
6. Export 1-page patient discharge summary via `export_patient_summary`.
7. Auto-populate PillMap Day 0 schedule with diet-aware timing slots.

### Flow B: Weekly Pillbox & Polypharmacy Negotiator (PillMap)
1. Render 7x4 weekly pillbox canvas (Mon-Sun x Morning/Noon/Evening/Bedtime).
2. Drag OTC supplement (e.g. Magnesium / NSAID) onto canvas.
3. System evaluates `check_interactions` and draws dynamic red/orange SVG conflict arcs between conflicting pills.
4. User clicks conflict arc to view plain-language clinical mechanism and severity.
5. Invoke `suggest_schedule(chronotype)` -> renders animated ghost preview with separated timings.
6. Patient approves timing shift -> canvas animates pill shifts to safe slots.
7. Run `simulate_adherence(missedDose)` -> displays clinical risk delta.
8. Export pharmacist summary via `export_for_pharmacist`.

### Flow C: HomeLab Prescribed Cadence & Doctor Proposal Loop
1. Display doctor-prescribed due card ("Creatinine due in 2 weeks").
2. Patient uploads lab photo slip -> `upload_lab_image` & `extract_labs` extracts creatinine 1.9 mg/dL.
3. Doctor review queue displays new upload -> doctor pins comment (`doctor_review_comment`: "Creatinine rose from 1.2 to 1.9").
4. Doctor creates dosage proposal (`propose_dosage_change`: Metformin 1000mg -> 500mg mornings due to renal function).
5. Patient receives plain-language proposal card and approves.
6. PillMap executes animated diff (fades old 1000mg, pulses new 500mg) and re-evaluates interactions.
7. LabStory renders new colored dosage timeline band from change date forward.
8. Doctor sets next due date (Creatinine in 4 weeks) -> synced to calendar.

### Flow D: Danger Sign Escalation, Doctor Remote Pillbox & Calendar
1. Patient reports danger sign (`report_danger_sign`: bilateral pedal edema + dyspnea + photo).
2. Doctor triage view opens with patient dossier, current labs, and active pillbox.
3. Doctor removes offending NSAID (`doctor_remove_medication`) and schedules clinic follow-up in 3 days (`schedule_followup`).
4. Patient/caregiver approves doctor's remote pillbox modification.
5. PillMap dissolves offending pill and removes associated conflict arcs.
6. Calendar events (3-day clinic follow-up + next lab) sync to both patient and caregiver with 24h & 2h notifications (`sync_to_calendar`).
7. All emergency triage actions and follow-ups append to Continuity Dossier.

### Flow E: Caregiver Proxy Switch, Audited Approval & Doctor Access Handover
1. Caregiver switches profile (`switch_profile`: Raj acting on behalf of mother Shanti Devi).
2. Verify scoped permissions (Manage level).
3. Caregiver approves pending lab/dose proposal on behalf -> audit log records `Approved by Raj (son) on behalf of S. Devi`.
4. Grant 7-day time-bound doctor access to new specialist (`grant_doctor_access`).
5. Compile lifetime Continuity Dossier (`compile_health_record`) with emergency snapshot card.
6. Click dossier source links to pan/zoom directly to bounding-box highlights on original discharge PDF and lab photo.

## Test Architecture & Runner
- Test runner: Vitest / Playwright / Custom Standalone Automated Node runner (`npm test` / `npx vitest run` / `tsx test/test-runner.ts`).
- All tests execute against real in-memory IndexedDB and WebMCP engine instances.
- Zero network reliance, 100% deterministic fixture execution.
