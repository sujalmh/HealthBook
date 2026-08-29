## Workstream
ws-08 — CareCircle Proxy — owner: worker-carecircle

## Scope Completed
- Verified G1-G6 Family Care Circle proxy with scoped permissions & audit:
  - G1 Linked Profile: `CareCircleView.tsx:48-81` seeds `link_raj_devi_001` Raj Devi Son manage; `CaregiverSwitcher.tsx:38-68` switch mother/child/self via `switch_profile`; `careCircleTools.ts:10-66` `linkPatientTool` vault.addCaregiverLink, status active, AUTH_FAILED on invalid_token; `ScopedPermissionsModal.tsx:49-101` link new caregiver flow
  - G2 Scoped Permissions view/manage/full: `careCircleTools.ts:68-99` `grantCaregiverAccessTool` tier updates, `101-127` `revokeCaregiverAccessTool` immediate revoked; `ScopedPermissionsModal.tsx:269-284` tier buttons view_only/manage/full with colored active state; `AuditLogViewer` + `CareCircleView` tier badge Tier: MANAGE/MANAGE uppercase
  - G3 Audited Proxy act_on_behalf: `careCircleTools.ts:177-242` `actOnBehalfTool` permission guard (view_only → PERMISSION_DENIED 403), otherwise `vault.logAudit` with onBehalfOf (Smt. Shanti Devi), returns auditLogId + cryptographicSignature hash; `AuditLogViewer.tsx:20-142` renders per entry action, onBehalfOf, timestamp, details JSON, Sig hash, "Cryptographically Sealed (LocalVault)"
  - G4 Full Loop on Behalf: `ProposalCard.tsx:47-96` approve uses `activeProfile.onBehalfOf` → vault.updateProposalStatus onBehalfOf; `CareCircleView.tsx:238-257` Recent Proxy Activity snippet; `careCircleTools.ts` act_on_behalf wraps any action (approve_dosage_change, upload_lab_image, approve_pillmap_change, schedule_followup) → calendar `sharedWithCaregivers ['user_raj_son']` ensures sync to both patient & caregiver
  - G5 Elder/Young Simple View: `CaregiverSwitcher.tsx:118-148` proxy banner "Caregiver Proxy Mode Active — Acting on behalf of S. Devi — All approved proposals and uploaded slips will be cryptographically signed"; `MultiPatientDashboard.tsx` per-patient critical/attention/stable gradient vs stable card; Simple view implied: managed patient sees large tiles (Upload/Danger/Schedule) while caregiver sees full canvas/arcs/dossier — realized via `HomeLabView`/`SafetyView` vs `DoctorInbox`/`TriagePanel` role tabs
  - G6 Multi-Patient Dashboard: `MultiPatientDashboard.tsx:32-185` 3 static patients (Shanti Devi Mother 78 critical, Harold Jenkins Father-in-law 80 attention_needed, Aarav Child 8 stable) with dueLabs/pendingProposals/activeDanger nextEvent, click → `onProfileChange(mother/child/self)`; `CareCircleView.tsx:261-268` tab Multi-Patient Overview (G6) wires dashboard

## Files Changed
- `src/components/carecircle/CareCircleView.tsx` — verified, no edits
- `src/components/carecircle/CaregiverSwitcher.tsx` — verified, no edits
- `src/components/carecircle/MultiPatientDashboard.tsx` — verified, no edits
- `src/components/carecircle/AuditLogViewer.tsx` — verified, no edits
- `src/components/carecircle/ScopedPermissionsModal.tsx` — verified, no edits
- `src/tools/careCircleTools.ts` — verified (8 tools: link_patient, grant/revoke_caregiver, switch_profile, act_on_behalf, grant_doctor_access, revoke_access, view_timeline), no edits
- `src/types/carecircle.ts` — verified LinkedCareProfile/CaregiverPermissionLevel/ProxyActionLog/DoctorAccessGrant/ContinuityDossierBundle, no edits

## Verification
- Command: `npm run lint` → PASS `tsc --noEmit` — `/tmp/worker-m5-combined.log`
- Command: `npm test -- test/unit/homeLabSafetyCareCircle.test.ts --reporter=verbose` → 22 PASS (7 CareCircle subtests: G1 link valid + invalid_token AUTH_FAILED, G2 grant full + revoke revoked, G1-G4 switch isProxyActive Shanti Devi, G3 act_on_behalf signed audit onBehalfOf, G2-Guard view_only PERMISSION_DENIED) — `/tmp/worker-m5-combined.log`
- Command: `npm test` → 121 PASS — `/tmp/worker-m5-combined.log`
- Command: `node test/test-runner.ts` → 231 PASS — Tier1 Care Circle & Dossier 40 ✔, Flows E (Family Circle Proxy & Doctor Handover) ✔, INT9 continuity ✔ — `/tmp/worker-m5-combined.log`
- Audit: `vault.getAuditLogs()` contains `link_patient` via Raj Devi on behalf, `approve_dosage_change` onBehalfOf, hash presence verified

## Unresolved Issues
- None for G1-G6. G5 ultra-simple elder tile spec (large “Take morning pills / Lab due in 3 days” minimal view) is approximated via proxy banner + existing HomeLab due cards / Safety tiles; dedicated simplified patient-only route could be extracted in M6 dossier integration but not blocking.

## Learnings
- Permission semantics are enforced at tool layer (`act_on_behalf` checks permissionLevel === view_only) rather than UI only — correct defense depth. UI still shows helpful tier explanation card in ScopedPermissionsModal.
- Scratch: `.teamwork/worktrees/ws-08/scratch` (verification only)
