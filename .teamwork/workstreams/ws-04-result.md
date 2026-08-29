## Workstream
ws-04 — PillMap 7x4 Canvas & Interaction — owner: worker-pillmap

## Scope Completed
- Verified PM1 7x4 grid: `src/components/pillmap/PillboxGrid.tsx:235-370` implements 7 columns (DAYS_OF_WEEK) x 4 rows (TIME_SLOTS morning/noon/evening/bedtime), HTML5 drag-drop (`onDragOver`/`onDrop`/`draggable`), drop target ring, chronotype-aware header times via `CHRONOTYPE_TIMES`, high-contrast slate-950 palette, aria-labels, QuickAdd empty slot button, ghost preview cells
- Verified PM2 red/orange SVG arcs: `src/components/pillmap/SVGArcOverlay.tsx:76-243` renders CONTRAINDICATED #EF4444 solid, MAJOR #F97316 dashed 8 4, MODERATE #EAB308 dashed 4 3 with glow filters, `calculateArcPath` beziers, click opens mechanism+guidance modal, arch height proportional to distance; `PillboxGrid.tsx:106-175` computes coordinates via DOM query `[data-med-name]` fallback slot estimation
- Verified PM2b diet badges (badge path): `src/components/pillmap/MealBadges.tsx:64-149` generates With Meal / Empty Stomach / No Grapefruit / Avoid Alcohol / Separate Dairy plus dynamic `dietBadges` from `ClinicalInteractionEngine.checkDietInteractions`; `PillCard.tsx:181-188` filters badges per pill; `interactionEngine.ts:93-195` covers grapefruit+statins, VitK+Warfarin, Levothyroxine empty stomach unconditional, Metronidazole alcohol, K+ salt+Lisinopril/Spironolactone; badges show icon+label with modal mechanism/guidance
- Verified PM3 duplicate ingredient: `src/core/knowledge/interactionEngine.ts:200-280` tracks `ingredientMap` via `mockBrandGenericCatalog.activeIngredients`, parses dose splits, handles compound doses, NSAID class grouping, alerts with cumulative vs maxSafe, plainNarration; `PillCard.tsx:108-112` + `PillMapView.tsx:198-201` surface amber duplicate banner
- Verified PM4 suggest_schedule ghost preview diet+chronotype: `interactionEngine.ts:285-345` shifts Atorvastatin/Simvastatin morning→bedtime, Furosemide bedtime/evening→morning, Calcium morning→noon away from Levo 4h, returns `ScheduleSuggestionResult` with plainExplanation; `PillboxGrid.tsx:292-345` renders ghost_preview PillCards dashed emerald, `ShiftPreviewModal.tsx` table + Approve/Reject gate, `PillMapView.tsx:288-318` `handleApproveShifts` writes `timingSlots` to vault + toast + reload
- Verified PM5 chronotype: `src/types/pillmap.ts:131-150` CHRONOTYPE_TIMES early_bird 06:30/11:30/17:30/21:00, standard 08:00/12:00/18:00/22:00, night_owl 10:00/14:00/20:00/00:30; PillMapView chronotype selector drives header times + suggestSchedule param
- Verified PM6 simulate_adherence: `interactionEngine.ts:350-403` generic resolve, Metformin glucose +25-40, Apixaban/Warfarin anticoag -50% 12h, Amlodipine/Lisinopril/Carvedilol BP +12-18 mmHg, always `doNotDoubleDoseWarning:true`, `AdherenceSimulatorModal.tsx:34-38` live compute, biomarker delta pill, recoveryProtocol, mandatory Do Not Double Dose banner + QuestionBank add
- Verified PM7 reminders surviving restart via vault: `src/tools/pillMapTools.ts:322-371` `set_reminder` writes `calendarEvent` eventType `med_reminder` per slot via `vault.addCalendarEvent`, title `${slot} Reminder (${time})`, `syncedToCalendar:true`, `notifyHoursBefore:[0]`; `ReminderConfigModal.tsx` batch UI by slot (morning/noon/evening/bedtime) not by pill, `PillMapView.tsx:401-418` `handleSaveReminders` persists same; unit test confirms `vault.getCalendarEvents` retrieval after restart
- Verified PM8 pharmacist export: `pillMapTools.ts:262-320` `export_for_pharmacist` vault active meds → crosswalk + format guard CANVAS_EMPTY, `PharmacistExportModal.tsx:69-204` one-page print-ready crosswalk table, flagged interactions, diet rules, verification signature block; `PillMapView.tsx:329-358` builds bundle with duplicateAlerts
- Verified PM9 elder view toggle: `PillMapView.tsx:469-486` viewMode canvas vs elder toggle, `SimpleElderView.tsx:20-251` 4-slot selector, large 2xl tiles, pill color shape, dosage mono, withFood/emptyStomach flags, Web Speech API `speechSynthesis` rate 0.85, Mark Taken state, switch back link
- Checked interactionEngine edge coverage: resolveGenericName brand→generic compound match, checkDrugInteractions bidirectional substring match, checkDietInteractions diet flags optional defaults, checkDuplicateIngredients NSC handling
- Fixed tool schema: relaxed `add_medication` slot enum to free string to allow INVALID_SLOT error path instead of generic INVALID_PARAMS schema rejection

## Files Changed
- `src/tools/pillMapTools.ts:23` — relaxed `slot` parameter from strict enum `['morning','noon','evening','bedtime',...]` to free string with description, preserving execute-side `INVALID_SLOT` validation (line 39-49). Required to satisfy TC-PM01-04 distinct error code; otherwise `WebMCPEngine.validateSchema` rejected before execute with INVALID_PARAMS. Non-overlapping ownership per ws-04 globs.
- No other file writes (all other PM features already implemented and verified; geometry change for PM2b plate arcs intentionally deferred per task guidance)

## Verification
- Command: `npm run lint` (tsc --noEmit)
  Result: PASS — 0 errors (lint clean)
  Log: `/tmp/worker-ws-04.log` lines 1-6

- Command: `npm test -- test/unit/pillMap.test.ts --reporter=verbose` (25 tests)
  Result: 25 passed, 0 failed (497ms)
  Coverage: 7x4 grid vault persistence (2), SVG beziers (3), drug-drug 5 cases (CONTRA/MAJOR/MODERATE + clean), drug-diet 4 cases (grapefruit, VitK, Levo, Flagyl alcohol), duplicate 4 cases (APAP cumulative, dual NSAID, brand/generic overlap, clean), chronotype shifts 4 cases (statin bedtime, furosemide morning, calcium noon, times mapping), missed dose 3 cases (metformin glucose, apixaban anticoag, amlodipine BP)
  Log: `/tmp/worker-ws-04.log` lines 7-40 excerpt: `Test Files 1 passed (1) Tests 25 passed (25)`

- Command: `npx tsx test/test-runner.ts --tier1` (200 tests, PillMap 40)
  Result: 200 passed, 0 failed; PillMap module 40/40 PASS after fix (was 39/40 pre-fix TC-PM01-04 INVALID_SLOT vs INVALID_PARAMS)
  Log: `/tmp/worker-ws-04.log` lines 41-68 excerpt: `Module 2: PillMap & Negotiator ✔ PASS (40 tests, 2ms)` `ALL 200 TESTS PASSED CLEANLY`
  Full log persisted: `/tmp/worker-ws-04.log` (70 lines, 7.9K)

- Command: `npx tsc --noEmit` standalone
  Result: PASS

- Manual PM mapping audit: PM1-PM9 evidence listed above, INT2-5 feed: vault meds share timingSlots with RxBridge, OTC palette feeds checkDietInteractions, schedule shifts feed calendar

## Unresolved Issues
- None blocking M3 PASS. Known limitation intentionally retained:
  - **PM2b Plate-Arc Gap (badge-only, not geometric):** Diet interactions correctly emit amber `DietBadge` chips with `plateArcColor` (#F97316/#EAB308/#EF4444) and modal mechanisms via `MealBadges.tsx`, and `PillboxGrid` slot headers show meal icons 🍳🥗🍲🌙, but no SVG bezier `plate arc` is drawn from pill tile to the meal icon/plate glyph (cf. drug-drug `SVGArcOverlay` arcs between pills). Spec says `amber arcs from pill to meal icon + badge`. Current implementation satisfies badge+plateArcColor metadata but geometric line is absent. Impact low — clinical guidance is fully conveyed via badge → modal, and INT4 correlator uses badgeText. Recommend M7 polish: trivial extension add `DietArcOverlay` reusing `calculateArcPath` with endpoints pill→header meal icon center; estimated <50 LOC, non-overlapping, no regression risk. Documented for ws-11 hardening-e2e.

## Learnings
- `WebMCPEngine.validateSchema` string enum rejection pre-empts execute-side domain validation, collapsing distinct error codes (INVALID_SLOT vs INVALID_PARAMS). Lesson: keep tool param schemas permissive (type string only) and enforce domain enums inside `execute` when error-code granularity matters; strict schema is for type safety, not business rules.
- `interactionEngine.checkDrugInteractions` bidirectional `includes` match handles compound names (e.g., "Apixaban (Eliquis)") but risks false positives on substring overlap; acceptable for hackathon scope, challenger should fuzz with e.g., "Aspirin Protect".
- Adherence simulation and chronotype shifts are deterministic rules (3 statin/furosemide/calcium) — does not yet consider diet+chronotype joint optimization (e.g., grapefruit+statin evening), but plainExplanation covers it textually; future extend `suggestSchedule` to inspect `patientDiet`.
- Reminder persistence grouping by slot (not pill) correctly de-duplicates notifications and survives restart via `calendar_events` store; verified vault round-trip.
