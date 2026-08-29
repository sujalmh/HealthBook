# Research — Explorer Hard-Coded Doctor Display — teamwork-1788021761432
Synthesized: 2026-08-29T22:30Z from spec-miner-doctor-display-components (read-only)

## Grep Inventory — Doctor Names in Display Code

Full hard-coded hospital/doctor/proxy mock names inventory file:line + keep/remove rationale:

### Global Grep Counts (repo-wide, scoped 14 files)
- Dr. Anita Patel: scoped 12 hits / repo 46 — REMOVE → Your doctor / activeProfile.name
- Dr. A. Patel: scoped 1 / repo 31 — REMOVE → Your doctor
- Dr. Patel (bare): scoped 11 / repo 79 — REMOVE → Your doctor / Your care team
- Attending: scoped 3 (2 literals+1 label) / repo 11 — REMOVE literals → generic —
- Nephrology: scoped 5 / repo 39 — REMOVE hard-coded clinic → generic
- Cardiology: scoped 5 / repo 13 — KEEP generic clinic specialty if non-person, but remove if person literal
- Dr. S. Kumar: scoped 1 / repo 1 — REMOVE → Your doctor
- Dr. Chen / Dr. Kevin Chen: scoped 2 / repo 14 — REMOVE → Your doctor / Specialist
- prescribedBy: scoped 8 / repo 29 — fallback hard-codes at 155 etc REMOVE
- doctorName: scoped 6 / repo 80 — fallback hard-codes REMOVE
- Your doctor: scoped 0 / repo 10 — confirms generic NOT yet used (gap to fix)

### Per-File Findings (file:line + rationale)

1. **src/components/labstory/LabStoryView.tsx:164** REMOVE
   - `doctorName: activeProfile.role === 'doctor' ? activeProfile.name : 'Dr. Anita Patel, MD',` in handleAddDoctorComment
   - Pattern: Dr. Anita Patel — fallback hard-code violates proposal.doctorName || 'Your doctor' / activeProfile.name
   - Rationale: activeProfile prop available at 32-45, should fallback generic
   - Keep: LabStoryView.tsx:420 vault-derived display KEEP

2. **src/components/labstory/MedOverlayBands.tsx:54 REMOVE, 70 REMOVE, 87/103/120/136 KEEP**
   - 54 prescribedBy: 'Dr. Anita Patel, MD' in defaultTimelineMeds lisinopril — REMOVE → '' or Your doctor via fallback at 287
   - 70 prescribedBy: 'Dr. S. Kumar, MD' metformin — REMOVE → Your doctor (still hard-coded person)
   - 87 Rheumatology Clinic, 103 Cardiology Clinic, 120 Self-administered OTC, 136 Inpatient Cardiology — KEEP generic specialty/OTC
   - 287 <span>Prescriber: {selectedMed.prescribedBy}</span> — KEEP vault-derived

3. **src/components/labstory/BiomarkerChart.tsx:575 KEEP**
   - Dr. Review Note ({commentObj?.doctorName || 'Clinician'}) — fallback Clinician generic KEEP but consider Your doctor for consistency

4. **src/components/homelab/ProposalCard.tsx:212 REMOVE, 300 REMOVE, 145 KEEP**
   - 212 <h4>{proposal.doctorName || 'Dr. Anita Patel, MD'}</h4> — REMOVE → proposal.doctorName || 'Your doctor'
   - 300 Ask Dr. Patel button — REMOVE → Ask your doctor
   - 145 qText = `Dr. ${proposal.doctorName}: Why...` — KEEP but fix prefix duplication

5. **src/components/homelab/DoctorInbox.tsx:67,73,108,113,148,183 REMOVE 6**
   - 67 doctorName: 'Dr. Anita Patel, MD (Nephrology)' in doctor_review_comment — REMOVE → activeProfile.name
   - 73 activeProfile: { name: 'Dr. Anita Patel, MD' } — REMOVE
   - 108 doctorName: 'Dr. Anita Patel, MD' propose_dosage_change — REMOVE
   - 113 name duplicate — REMOVE
   - 148 name schedule_lab — REMOVE
   - 183 Dr. Anita Patel, MD (Active) header — REMOVE → Doctor Inbox generic

6. **src/components/homelab/DueCardList.tsx:155 REMOVE**
   - Prescribed by {card.prescribedBy || 'Dr. Anita Patel, MD'} — REMOVE → || 'Your doctor'

7. **src/components/safety/FollowupScheduler.tsx:36 REMOVE + ancillary 38,39**
   - 36 useState('Dr. Anita Patel, MD (Nephrology / Cardiology)') — REMOVE → useState('') or 'Your doctor'
   - 38 clinicAddress City Health Nephrology Clinic — REMOVE → generic
   - 39 telehealthLink dr-patel slug — REMOVE → generic

8. **src/components/safety/TriagePanel.tsx:47,63,73,98,108,134,144,168 REMOVE 7**
   - 47 firstAidAdvice Alert dispatched to Dr. Patel's triage queue — REMOVE → your care team
   - 63 activeProfile name Dr. Anita Patel — REMOVE
   - 73 toast Dr. Patel ordered discontinuation — REMOVE
   - 98 name titrate — REMOVE
   - 108 toast Dr. Patel proposed titrating — REMOVE
   - 134 name addFurosemide — REMOVE
   - 144 toast Dr. Patel proposed adding — REMOVE
   - 168 Doctor triage dashboard — Dr. Anita Patel, MD — REMOVE

9. **src/components/safety/DangerSignModal.tsx:124,307 REMOVE 2**
   - 124 toast Urgent alert dispatched to Dr. Patel — REMOVE → your doctor
   - 307 Dispatch Alert to Doctor Patel button — REMOVE → Dispatch Alert to Your Doctor

10. **src/components/safety/SafetyView.tsx:161,205 REMOVE 2**
    - 161 banner sent to Dr. Anita Patel — REMOVE → your care team
    - 205 When to report danger sign (Dr. Patel review) — REMOVE → Clinician review

11. **src/components/dossier/SourceLinkViewer.tsx:228,335 REMOVE 2**
    - 228 Attending: Dr. Chen, MD — REMOVE → Attending: — generic
    - 335 Attending: Dr. A. Patel, MD, FACC — REMOVE → Attending: —

12. **src/components/common/WebMCPInspector.tsx:149,159-160 REMOVE 1+1**
    - 149 title: 'Dr. Patel Nephrology Clinic Review' — REMOVE → Clinic Review generic
    - 159 doctorName: 'Dr. Kevin Chen, MD' — REMOVE → Dr. Specialist / Your doctor

13. **src/components/rxbridge/ReconciliationWalk.tsx:349 REMOVE 1**
    - placeholder Remember to ask Dr. Patel... — REMOVE → your doctor

14. **src/components/carecircle/MultiPatientDashboard.tsx:42 REMOVE 1**
    - nextEvent: 'Dr. Patel Clinic Follow-Up (In 3 Days)' — REMOVE → Clinic Follow-Up

Total removable hard-coded doctor literals in scoped 14 files: ~30 hits across 12 of 14 files. Clean file: BiomarkerChart.tsx already generic.

## Dependencies & Call Flow
- LabStory: activeProfile prop → handleAddDoctorComment fallback → localVault.addDoctorCommentToLab → BiomarkerChart display vault-derived.
- HomeLab: DueCardList receives dueCards from localVault.getDueCards → fallback hard-code; ProposalCard header fallback; DoctorInbox hard-codes activeProfile for 3 tools vs derived session.
- Safety: DangerSignModal patient activeProfile → report_danger_sign → notify_doctor → TriagePanel fallbackReport hard-coded; FollowupScheduler local state providerName initialized to Patel vs '' + activeProfile.name fallback.
- Dossier/Rx/Care: SourceLinkViewer static mock discharge doc hard-coded Attending; WebMCPInspector samplePayloads playground hard-code; MultiPatientDashboard PATIENTS constant mock.

## Affected Files (ownership)
- src/components/labstory/LabStoryView.tsx
- src/components/labstory/MedOverlayBands.tsx
- src/components/labstory/BiomarkerChart.tsx (already clean, 575 generic)
- src/components/homelab/ProposalCard.tsx
- src/components/homelab/DoctorInbox.tsx
- src/components/homelab/DueCardList.tsx
- src/components/safety/FollowupScheduler.tsx
- src/components/safety/TriagePanel.tsx
- src/components/safety/DangerSignModal.tsx
- src/components/safety/SafetyView.tsx
- src/components/dossier/SourceLinkViewer.tsx
- src/components/common/WebMCPInspector.tsx
- src/components/rxbridge/ReconciliationWalk.tsx
- src/components/carecircle/MultiPatientDashboard.tsx

Out-of-scope noted: seed.ts 55,66,103, core 16, tools/homeLabTools 241,304, safetyTools 100-506, EmergencySnapshotCard 167, App proxy, etc — tracked in peer miner.

## Unknowns
- Screenshot verify at 1280/375/768 no Dr. Anita/Dr. Patel literals rendered, fallbacks show Your doctor without gaps
- Dynamic vs empty fallback preference when patient view
- Sample payloads genericization expected
- Clinic specialty KEEP vs REMOVE nuance
- DoctorInbox triage doctor identity derivation

## Keep/Remove Summary
- REMOVE ~30 doctor literals → generic Your doctor / activeProfile.name / — / Clinician
- KEEP: BiomarkerChart 575 Clinician (generic), MedOverlayBands clinic generics, vault-derived displays
- Keep drug_knowledge St. John's Wort (out of scope for this miner)
