## 2026-08-28T20:44:06Z

You are spec_miner_survey_2 for CareCanvas.
Your working directory is /Users/sujal/Projects/proj1/.agents/spec_miner_survey_2.
Your task is to conduct an exhaustive specification analysis of the 7 Clinical Modules and their Interactive Visual Canvases for CareCanvas.

Authoritative source documents to read:
1. /Users/sujal/Projects/proj1/.agents/ORIGINAL_REQUEST.md
2. /Users/sujal/Projects/proj1/FEATURES_CHECKLIST.md
3. /Users/sujal/Projects/proj1/trialbridge-labstory-pillmap-feature-planning-2026-08-28.md

Your deliverable is a comprehensive specification report written to:
/Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md
and a standard handoff report at:
/Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/handoff.md

Your report MUST specify:
1. Shared Foundation: Approved Fact Vault (F0.1-F0.5) — plain-language extraction, Approve/Edit/Reject per fact, PDF/image bounding box highlighter, Question Bank, Privacy Badge.
2. LabStory (LS1-LS8) — DuckDB/Canvas time-series charts, reference vs optimal range toggles, 30D/90D/1Y/5Y zoom, med overlay bands, causal trend exploration (`correlate_meds`), doctor pinned comment display, doctor question generation.
3. PillMap (PM1-PM9) — Accessible 7x4 weekly pillbox canvas (Mon-Sun x Morning/Noon/Evening/Bedtime), drag-and-drop, drug-drug interaction SVG arcs (red/orange/yellow), diet interaction meal-time badges & plate arcs, duplicate ingredient detection, chronotype & food-aware schedule suggestions with ghost previews, missed dose simulation (`simulate_adherence`), export for pharmacist.
4. RxBridge (RB1-RB10) — 3-list reconciliation comparison (Pre-admission, In-hospital, Discharge), conversational med-by-med walk, change classification badges (Continued, Dose Changed, Stopped, New, Held), drug/diet/lab interaction checks (`flag_interaction`, `flag_diet_interaction`), teach-back comprehension prompt, auto-populate PillMap Day 0, 1-page patient discharge summary export.
5. HomeLab Remote Loop (HL1-HL8) — Prescribed lab due cards, photo upload & OCR simulation/extraction, doctor inbox & pinned comments, dosage change proposal cards (`propose_dosage_change`), patient approval with animated diff on PillMap and colored band on LabStory, next due date auto-set.
6. Safety Alerts & Doctor Triage (SF1-SF8) — Report danger sign (photo/text), doctor triage view, doctor remote PillMap adjustments (`doctor_change_dose`, `doctor_remove_medication`), approval gate, direct follow-up order (`schedule_followup`), calendar sync (`sync_to_calendar`) with reminder alerts, overdue nudges.
7. Family Care Circle (G1-G6) — Caregiver profile linking (`link_patient`), scoped permissions (View Only, Manage, Full), audited proxy actions ("Approved by Raj on behalf of S. Devi"), elder/young simple mode vs full caregiver mode, multi-patient dashboard.
8. Continuity Dossier (CD1-CD6) — Lifetime health record compilation, timeline + snapshot card, pan/zoom to source bounding boxes, time-bound doctor access grant (`grant_doctor_access`, `revoke_access`), continuous append-only history.
