## 2026-08-29T02:52:46+05:30
Task: Implement Milestone 6 (Continuity Dossier & Cross-Module Integration) for Healthbook per:
1. /Users/sujal/Projects/proj1/.agents/ORIGINAL_REQUEST.md
2. /Users/sujal/Projects/proj1/PROJECT.md
3. /Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md

Scope & Deliverables:
1. WebMCP Tools & Core Logic in \`src/tools/vaultTools.ts\` and \`src/tools/careCircleTools.ts\`:
   - \`compile_health_record\`: Merges all 11 LocalVault stores into a comprehensive lifetime clinical dossier with emergency snapshot summary and FHIR R4 export formatting.
   - \`view_timeline\`: Chronological event query with filtering by category (labs, meds, visits, danger signs, doctor notes).
   - \`grant_doctor_access\`: Generates time-bound secure clinical access tokens (e.g. 7-day token for Dr. Sharma) with audit logging.
   - \`revoke_access\`: Instantly revokes clinician tokens.
2. Continuity Dossier Canvases & UI Components in \`src/components/dossier/\`:
   - \`DossierView.tsx\`: Main module container with tabbed views (Chronological Timeline, Emergency Snapshot Card, Source Highlight Inspector, Doctor Access Grants, Export Package).
   - \`EmergencySnapshotCard.tsx\`: One-page high-priority clinical card displaying active medications, verified allergies, baseline vitals, most recent critical labs (eGFR, Creatinine, Potassium, HbA1c), emergency contacts, and QR validation stamp.
   - \`DossierTimeline.tsx\`: Rich interactive chronological stream with category badges, doctor comments, dosage transitions, and direct source document citation links.
   - \`SourceLinkViewer.tsx\`: Interactive document viewer that pans and zooms directly to the normalized bounding box coordinates \`[pageIndex, x, y, width, height]\` on original discharge PDFs and lab photo slips.
   - \`DoctorAccessModal.tsx\`: Clinician handover management modal with time-bound grant generator (7 days, 30 days, 1 year), live active token list, and one-click instant revocation.
   - \`DossierExportModal.tsx\`: Export options for full clinical dossier (PDF print-optimized view, FHIR R4 Bundle JSON, CSV).
3. Cross-Module Integration Verification (INT1–INT9):
   - Wire \`DossierView\` into \`src/App.tsx\` navigation tabs.
   - Verify that all data from Vault (extractions), LabStory (trends), PillMap (schedules & shifts), RxBridge (reconciliations & teach-back), HomeLab (proposals & notes), and Safety (danger signs & follow-ups) populate seamlessly into the compiled dossier.
4. Tests:
   - Write comprehensive unit & integration tests in \`test/unit/continuityDossier.test.ts\` covering health record compilation, timeline queries, source bounding-box panning/zooming calculations, time-bound token generation and expiration, instant revocation, and FHIR export.
   - Run \`npm test\`, \`npm run lint\`, \`npm run build\`, and \`node test/test-runner.ts\` to verify 100% clean passes across the entire project.
