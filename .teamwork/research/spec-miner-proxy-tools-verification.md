# Research — Explorer Hard-Coded Proxy/Tools — teamwork-1788021761432
Synthesized: 2026-08-29T22:31Z from spec-miner-proxy-tools-verification (read-only)

## Grep Inventory — Proxy/Patient/Tools Hard-Codes

| Pattern | Scoped src Hits | Repo-wide | Action |
|---------|----------------|-----------|--------|
| Raj Devi | 8 | 67 | REMOVE → Family member / activeProfile.name |
| Aarav Sharma | 2 | 11 | REMOVE → Child / activeProfile.onBehalfOf |
| Aarav | 2 | 18 | REMOVE → Child |
| Shanti Devi | 0 scoped src (100 repo) | 100 | KEEP 0 src (test legacyMocks allowed) |
| Harold Jenkins | 0 scoped src (67 repo) | 67 | KEEP 0 src |
| John proxy / john (case-insensitive) | 0 scoped proxy (only St. John's Wort 2) | St. John's Wort 2 | KEEP drug, REMOVE if John proxy literal found (currently none) |
| Dr. Patel family | ~20 tools | 79 | REMOVE → Your doctor / Your care team |
| St. John's Wort | 2 | 2 | KEEP drug knowledge base |
| Raj substring labels | 11 | 11 | REMOVE → Proxy / Family |

### Per-File Findings (file:line + rationale)

**src/App.tsx:189 REMOVE** name: 'Raj Devi' in handleSwitchProfile caregiver/mother branch — should be activeProfile.name or Family member
- 200 toast Switched to Raj Devi — REMOVE → generic ${next.name}
- 205 name: 'Raj Devi' child branch — REMOVE
- 209 onBehalfOf: 'Aarav Sharma' — REMOVE → Child
- 216 toast Raj Devi on behalf of Aarav Sharma — REMOVE → generic
- 343 aria-label Switch to Raj Proxy — REMOVE → Switch to proxy
- 370 aria-label Switch to Raj proxy — REMOVE → Switch to proxy
- 372 <span>Raj (Proxy)</span> — REMOVE → Proxy / Family

**src/components/carecircle/ScopedPermissionsModal.tsx:63,80,211 REMOVE**
- 63 activeProfile { userId: 'user-raj-devi', name: 'Raj Devi' } in link_patient — REMOVE → activeProfile.userId/name
- 80 duplicate in grant_caregiver_access — REMOVE
- 211 {link.caregiverName || 'Raj Devi'} fallback — REMOVE → || 'Family member'

**src/components/dossier/EmergencySnapshotCard.tsx:160,167 REMOVE**
- 160 name: 'Raj Devi', relationship Son & Healthcare Proxy — REMOVE → Family contact / Primary Caregiver vault-derived
- 167 name: 'Dr. Anita Patel, MD (Cardiology)' — REMOVE → Your doctor / Primary Care Provider

**src/components/carecircle/MultiPatientDashboard.tsx:42 REMOVE**
- nextEvent: 'Dr. Patel Clinic Follow-Up (In 3 Days)' — REMOVE → Clinic Follow-Up (doctor+proxy overlap)

**src/tools/homeLabTools.ts:241,267,297,304,311 REMOVE 5**
- 241 doctorName fallback Dr. A. Patel — REMOVE → || 'Your doctor'
- 267 plainLanguageSummary Dr. Patel pinned — REMOVE → Your doctor pinned
- 297 messageTemplate Dr. Patel submitted — REMOVE → Your doctor submitted
- 304 doctorName fallback duplicate — REMOVE
- 311 plainNarration Dr. Patel recommends changing — REMOVE → Your doctor recommends

**src/tools/safetyTools.ts:50,100,110,139,145,149,183,203,208,212,248,253,257,383,387,438,482,506 REMOVE 18**
- 50 Report sent to Dr. Patel's triage queue — REMOVE → your doctor's triage
- 100 routedToDoctor Dr. A. Patel Cardiology Triage — REMOVE → Your care team
- 110 High-priority notification to Dr. Patel — REMOVE → your doctor
- 139 doctorName Dr. A. Patel — REMOVE
- 145 narration Dr. Patel recommends adding — REMOVE
- 149 userName Dr. A. Patel — REMOVE
- 183 template Dr. Patel recommends stopping — REMOVE
- 203 doctorName — REMOVE
- 208 narration STOPPING — REMOVE
- 212 userName — REMOVE
- 248 doctorName — REMOVE
- 253 narration adjusted — REMOVE
- 257 userName — REMOVE
- 383 title fallback Dr. Patel — REMOVE → Your doctor
- 387 providerName fallback — REMOVE
- 438 prescribedBy Dr. A. Patel — REMOVE
- 482 SUMMARY Dr. Patel Clinic Follow-Up — REMOVE → Clinic Follow-Up
- 506 googleCalendarIntent Dr Patel Follow-up — REMOVE → Clinic Follow-up

**src/fixtures/drug_knowledge.ts:233,241 KEEP**
- St. John's Wort — KEEP — drug interaction CYP3A4 not hospital/doctor mock

**src/components/carecircle/CareCircleView.tsx/CaregiverSwitcher.tsx KEEP**
- Already generic Patient/Child mapping, no Raj Devi literal — KEEP

## Dependencies & Call Flow
- App.tsx handleSwitchProfile root proxy switcher hard-codes Raj Devi/Aarav Sharma but derives baseName and patientShort/patientInitial generic; restores from localStorage carecanvas_active_user generic.
- CareCircleView delegates to CaregiverSwitcher (generic mapping self/''/patient-child-003) and ScopedPermissionsModal (hard-codes user-raj-devi) reads vault localVault.getCaregiverLinks.
- EmergencySnapshotCard fallback contacts hard-code Raj Devi + Dr. Patel when snapshot null vs vaultTools generic Primary Caregiver/Provider path via compile_health_record.
- Tools fallbacks derive from params.doctorName || 'Dr. A. Patel' should be || 'Your doctor' / activeProfile.name / vault-derived.

## Affected Files
- src/App.tsx (proxy switcher)
- src/components/carecircle/ScopedPermissionsModal.tsx
- src/components/dossier/EmergencySnapshotCard.tsx
- src/components/carecircle/MultiPatientDashboard.tsx
- src/tools/homeLabTools.ts
- src/tools/safetyTools.ts
- src/fixtures/drug_knowledge.ts (keep)

## Unknowns
- Verify at 375 mobile header shows Proxy/Family not Raj
- ScopedPermissionsModal empty list fallback Family member no gaps at 768 tablet
- Dossier empty vault snapshot contacts generic at 1280/375
- Tools fallback when params.doctorName undefined shows Your doctor not Patel
- MultiPatientDashboard nextEvent generic at 1280/375
- SourceLinkViewer Attending generic when no document
- Empty vault 0 facts no gaps 320/375/768/1024/1280/1440
- Tests that assert Raj Devi/Dr. Patel must be updated to generic but still PASS

## Keep/Remove Rationale
- REMOVE proxy literals Raj Devi/Aarav Sharma/Raj labels → generic activeProfile.name / Family member / Child / Proxy
- REMOVE doctor literals in tools → Your doctor / Your care team / Clinic
- KEEP St. John's Wort, types, CareCircle generic mappings, vaultTools generic contacts, test legacyMocks allowed
