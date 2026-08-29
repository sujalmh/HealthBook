## Workstream
ws-06 — HomeLab Loop — owner: worker-homelab

## Scope Completed
- Verified HL1-HL8 prescribed remote HomeLab loop:
  - HL1 Due Cards: `DueCardList.tsx:21-198` countdown (`calculateDaysRemaining`), overdue (`isOverdue` pulse), due_soon, completed states; `HomeLabView.tsx:54-68` seeds `due_card_kidney_001` (Creatinine & eGFR due in 3d)
  - HL2 Photo Upload OCR: `UploadLabModal.tsx:50-80` calls `upload_lab_image` + mock slip, confidence 0.96/0.94, blurryWarning, edit triad; `homeLabTools.ts:10-73` `uploadLabImageTool` extracts 3 markers, marks dueCard completed, vault addFact
  - HL3 Inbox + Pinned: `DoctorInbox.tsx:56-93` `doctor_review_comment` pinned to lab point; `homeLabTools.ts:75-148` validates non-empty comment, `logAudit` doctor_review_comment
  - HL4 Proposal Card: `ProposalCard.tsx:167-339` before/after banner, linkedLab eGFR 28, `homeLabTools.ts:150-209` `proposeDosageChangeTool` pending Metformin 1000→500 reason eGFR 28
  - HL5 Approve diff animate+re-run: `ProposalCard.tsx:47-104` approves via `approve_dosage_change` then `sync_pillmap_from_proposal` with fade_out_old_pulse_new; `homeLabTools.ts:211-280` proxy signature (patient/caregiver/onBehalfOf), `homeLabTools.ts:282-353` sync updates vault medication dosage, emits `labstory_band_draw`
  - HL6 Band: `syncPillmapFromProposalTool` payload `labStoryInterventionBand {startDate, medName, color:#10B981}` consumed by LabStory bands
  - HL7 Next Due Auto-Set: `DoctorInbox.tsx:135-167` cadence select 2w/4w/3m/6m calls `schedule_lab` → `safetyTools.ts:407-455` creates dueCard `due_soon` + vault.dueCards.set
  - HL8 Summary regenerate: `export_patient_summary` (RxBridge) picks up updated regimen; HomeLab proposal approval triggers dossier/calendar rerenders `['pillmap','labstory','dossier']`

## Files Changed
- `src/components/homelab/HomeLabView.tsx` — verified existing, no edits (verification only)
- `src/components/homelab/DueCardList.tsx` — verified, no edits
- `src/components/homelab/ProposalCard.tsx` — verified, no edits
- `src/components/homelab/UploadLabModal.tsx` — verified, no edits
- `src/components/homelab/DoctorInbox.tsx` — verified, no edits
- `src/tools/homeLabTools.ts` — verified (5 tools), no edits
- `src/types/homelab.ts` — verified interfaces PrescribedDueCard/LabPhotoUploadResult/DosageProposalCard/PillMapDiffEvent, no edits

## Verification
- Command: `npm run lint` → `tsc --noEmit` PASS (0 errors) — log `/tmp/worker-m5-combined.log:1-6`
- Command: `npm test -- test/unit/homeLabSafetyCareCircle.test.ts --reporter=verbose` → 22 PASS (7 HomeLab subtests: HL1-HL7 pass including HL2 extracted eGFR 28 CRITICAL_LOW, HL3 pinned comment, HL4 pending, HL5 caregiver approve onBehalfOf, HL6 sync dosage 500mg Daily animation fade_out_old_pulse_new, HL7 cadence 4w due_soon) — log `/tmp/worker-m5-combined.log`
- Command: `npm test` full → 121 PASS (10 suites) — log `/tmp/worker-m5-combined.log`
- Command: `node test/test-runner.ts` → 231 PASS — Tier1 HomeLab 25 ✔, tier 2-4/E2E all pass incl Flow C HomeLab AKI Detection — log `/tmp/worker-m5-combined.log`
- EventBus: `due_card_added/updated`, `proposal_submitted/status_changed`, `lab_added` wired in HomeLabView useEffect
- Inspector: 40 tools registered (HomeLab 5 intact)

## Unresolved Issues
- None for HL. SF7 nudge gap tracked in ws-07, does not block HomeLab flow.

## Learnings
- HomeLab loop is closed: DueCard → photo OCR → doctor inbox pinned → proposal → approve → sync pillmap diff → band → next due. Re-run of `flag_interaction` after sync happens via PillMap watcher, not inside HomeLab tool — correct separation.
- Scratch: `.teamwork/worktrees/ws-06/scratch` (verification only, no temp artifacts)
