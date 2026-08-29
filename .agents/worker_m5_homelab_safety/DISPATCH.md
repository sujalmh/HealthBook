## 2026-08-28T21:15:16Z
You are worker_m5_homelab_safety for CareCanvas.
Your working directory is /Users/sujal/Projects/proj1/.agents/worker_m5_homelab_safety.
Your task is to implement Milestone 5 (HomeLab Remote Loop, Safety Escalation & Family Care Circle) for CareCanvas per the specifications in:
1. /Users/sujal/Projects/proj1/.agents/ORIGINAL_REQUEST.md
2. /Users/sujal/Projects/proj1/PROJECT.md
3. /Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Deliverables:
1. WebMCP Tools in `src/tools/homeLabTools.ts`, `src/tools/safetyTools.ts`, and `src/tools/careCircleTools.ts`:
   - HomeLab Tools: `upload_lab_image`, `doctor_review_comment`, `propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal`.
   - Safety Tools: `report_danger_sign`, `notify_doctor`, `doctor_add_medication`, `doctor_remove_medication`, `doctor_change_dose`, `approve_pillmap_change`, `schedule_followup`, `schedule_lab`, `sync_to_calendar`.
   - Family Care Circle Tools: `link_patient`, `grant_caregiver_access`, `revoke_caregiver_access`, `switch_profile`, `act_on_behalf`.
2. Interactive Visual Canvases & Components:
   - `src/components/homelab/`:
     - `HomeLabView.tsx`: Main remote loop dashboard with prescribed due cards, photo dropzone, doctor review queue, and dosage proposal cards.
     - `DueCardList.tsx`: Prescribed due cards countdowns, overdue nudges, and "Upload Lab" action.
     - `UploadLabModal.tsx`: Smartphone photo slip upload with OCR bounding-box preview and extraction approval.
     - `ProposalCard.tsx`: Doctor dosage reduction/titration proposal card with before/after comparison and patient approval gate.
     - `DoctorInbox.tsx`: Clinician review queue with lab points, pinned note creator (`📌`), and dosage proposal builder.
   - `src/components/safety/`:
     - `SafetyView.tsx`: Emergency triage dashboard, active safety alerts, and calendar view.
     - `DangerSignModal.tsx`: Structured danger sign reporter (edema, dyspnea, chest pain, rash) with photo upload, severity scoring, and immediate emergency clinic advice.
     - `TriagePanel.tsx`: Doctor triage view displaying active alerts, patient dossier, recent labs, and remote pillbox actions.
     - `FollowupScheduler.tsx`: Doctor direct follow-up order (in-person clinic / tele-review) with calendar sync.
     - `CalendarView.tsx`: In-app prescribed events calendar (labs, follow-ups, medication reminders) with iCal export (`.ics`) and 24h & 2h alert badges.
   - `src/components/carecircle/`:
     - `CareCircleView.tsx`: Caregiver management dashboard with active linked profiles and proxy switcher.
     - `CaregiverSwitcher.tsx`: Profile selector (`Self ↔ Mother (78) ↔ Child (8)`) with active proxy state banner.
     - `ScopedPermissionsModal.tsx`: Permission grant selector (View Only vs Manage vs Full) with instant revocation.
     - `AuditLogViewer.tsx`: Proxy audit trail displaying verified entries (e.g. `Approved by Raj (son) on behalf of S. Devi`).
     - `MultiPatientDashboard.tsx`: Unified caregiver overview aggregating due cards and danger alerts across all linked profiles.
3. Cross-Module Bridges & App Integration:
   - Ensure approved dosage changes and doctor pill removals trigger reactive animated diffs in PillMap and colored bands in LabStory.
   - Wire `HomeLabView`, `SafetyView`, and `CareCircleView` into `src/App.tsx` navigation tabs and proxy context.
4. Tests:
   - Write comprehensive unit & integration tests in `test/unit/homeLabSafetyCareCircle.test.ts` covering due cards, photo extraction, doctor proposals, danger sign reporting, remote pillbox changes, calendar iCal export, caregiver proxy switching, and audited actions.
   - Run `npm test`, `npm run lint`, and `npm run build` to verify clean pass.
