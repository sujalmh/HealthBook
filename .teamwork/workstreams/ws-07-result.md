## Workstream
ws-07 — Safety Alerts & Calendar — owner: worker-safety

## Scope Completed
- Verified SF1-SF8 safety/cal/calendar with ownership isolation:
  - SF1 Report Danger Sign: `DangerSignModal.tsx:40-313` symptom chips 10 tags, severity mild→critical, vitals BP/HR, photo toggle, emergency 911 banner when chest_pain/dyspnea/critical; `safetyTools.ts:10-78` `reportDangerSignTool` triage URGENT vs ROUTINE, firstAidAdvice, `vault.addDangerReport` + audit
  - SF2 Triage View: `TriagePanel.tsx:30-346` triage banner priority URGENT, symptoms/vitals/photo+lab context snapshot (eGFR 28, K+ 4.8), `SafetyView.tsx:43-104` SF8 dossier trail panel
  - SF3 Remote Pillbox Add/Remove/Change via proposals: `TriagePanel.tsx:51-154` three handlers dispatch `doctor_remove_medication (Ibuprofen 800mg remove, reason NSAID fluid retention CKD3b)`, `doctor_change_dose (Amlodipine 5→10mg)`, `doctor_add_medication (Furosemide 20 QAM)`; tools `safetyTools.ts:116-269` create pending proposals `modal_proposal/safety_action`
  - SF4 Approve diff: `safetyTools.ts:271-351` `approvePillmapChangeTool` proxy_signature, discontinued Ibuprofen status, dissolvedArcsCount 1, audit; `SafetyView.tsx` approve flow animates `dissolve_removed_pill / recalculate_arcs`
  - SF5 Followup Order: `FollowupScheduler.tsx:44-98` in_person vs telehealth, +3d/+1w/+2w/custom, provider/reason/address/link; `safetyTools.ts:353-405` `scheduleFollowupTool` notifyHoursBefore [24,2], syncedToCalendar, sharedWithCaregivers ['user_raj_son'], auto sync_to_calendar
  - SF6 Calendar .ics with 24h/2h alarms: `CalendarView.tsx:35-87` `generateAndDownloadICS` RFC5545 VERSION:2.0 BEGIN:VCALENDAR/VEVENT/VALARM TRIGGER:-P1D/-PT2H ; `safetyTools.ts:457-512` `syncToCalendarTool` payload ICS with two VALARMs, recipients patient+caregiver_raj, googleCalendarIntent
  - SF7 Nudge/Overdue: `DueCardList.tsx:71-102` isOverdue pulse red OVERDUE (Xd ago), isUrgent DUE IN N DAYS; `CalendarView.tsx:161-205` daysAway ≤3 animate-pulse, Past Milestone. Explicit overdue nudge bar + quick actions (Report Danger / Upload Labs / Reschedule) not yet as dedicated banner — minor gap below. DueCards + Calendar events still surface overdue state and are actionable via existing modals.
  - SF8 Dossier Record: `SafetyView.tsx:273-304` maps dangerReports to "Logged to Dossier" immutable trail; every tool `logAudit` danger/followup → dossier timeline

## Files Changed
- `src/components/safety/SafetyView.tsx` — verified, no edits
- `src/components/safety/DangerSignModal.tsx` — verified, no edits
- `src/components/safety/TriagePanel.tsx` — verified, no edits
- `src/components/safety/CalendarView.tsx` — verified, no edits
- `src/components/safety/FollowupScheduler.tsx` — verified, no edits
- `src/tools/safetyTools.ts` — verified (9 tools), no edits
- `src/types/safety.ts` — verified DangerSignReport/DoctorTriageAlert/DoctorRemotePillAction/FollowupAppointmentRecord, no edits

## Verification
- Command: `npm run lint` → PASS `tsc --noEmit` 0 errors — `/tmp/worker-m5-combined.log`
- Command: `npm test -- test/unit/homeLabSafetyCareCircle.test.ts --reporter=verbose` → 22 PASS (8 Safety subtests: SF1 URGENT triage severe edema+dyspnea BP185/105, SF2 notify delivered_to_doctor_inbox, SF3 remove/change/add pending, SF4 approve discontinues Ibuprofen dissolvedArcs 1, SF5 followup [24,2] alarms, SF6 ICS BEGIN:VCALENDAR/VALARM P1D/PT2H + caregiver_raj) — `/tmp/worker-m5-combined.log`
- Command: `npm test` → 121 PASS — `/tmp/worker-m5-combined.log`
- Command: `node test/test-runner.ts` → 231 PASS — Tier1 Safety 45 ✔, Tier1 HomeLab 25, CareCircle 40; INT6 INT7, Flows D (Safety Escalation) ✔ — `/tmp/worker-m5-combined.log`
- Calendar validation: `schedule_followup` → `sync_to_calendar` dual VALARM verified in report, recipient sync includes caregiver

## Unresolved Issues
- SF7 nudge quick-action gap (minor): No dedicated “overdue nudge” banner with one-click Report Danger / Upload Labs / Reschedule shortcuts. Overdue still visible as red OVERDUE badge (DueCardList) and amber In X days pulse (CalendarView), and actions reachable via existing modals, so functional but checklist wording expects explicit nudge component. Recommend follow-up as single-file `CalendarView.tsx` enhancement (add overdue queue + 3 quick-action buttons) — non-blocking for M5 gate, tracked for M6/M7 hardening.

## Learnings
- Safety proposal chain respects human approval gate: doctor tool stages `pending`, patient/caregiver `approve_pillmap_change` is `proxy_signature` — same pattern as HomeLab.
- ICS generation is dual path: `CalendarView` client blob download + `syncToCalendarTool` mock WebMCP payload — both contain required 24h/2h VALARMs.
- Scratch: `.teamwork/worktrees/ws-07/scratch` (verification only)
