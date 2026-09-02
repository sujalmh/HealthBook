# CareCanvas — Agent Fix Checklist (Found Issues)

> Generated: 2026-08-31 — Based on live codebase audit via grep/read of 110+ source files.
> How to use: Pick one Issue at a time. Follow `Evidence -> Root Cause -> Checklist -> Acceptance`. All fixes must be Simple English, simple UI for common users (no jargon), and tested (`npm run lint && npm run build && npm test`).
> Global principle: Single upload path = `OCR + AI` as default (no two options), wait till final AI results before hiding loading, store every uploaded document so viewer shows it.

---

## 0) Global Fixes (apply to every module)

### Evidence
- **Jargon visible**: `src/components/vault/DocumentDropzone.tsx:191` ("OCR + AI (Preserves Tables)"), `src/components/vault/DocumentDropzone.tsx:257` ("Step 1/2: High-Precision OCR — preserving tables & hierarchy (Mistral)..."), `src/components/vault/DocumentDropzone.tsx:304` ("Mistral OCR with table_format html"), `src/components/vault/FactStreamView.tsx:94` ("Mistral OCR preserved tables"), `src/components/labstory/CausalQueryPanel.tsx:155` ("correlate_meds"), `src/components/common/PrivacyBadge.tsx:93` technical badge, `src/App.tsx:340` ("Private & Secure") vs requested "Remove unnecessary texts: Mistral OCR, Live Connected, etc."
- **Loading missing after upload before med interactions**: `src/components/vault/DocumentDropzone.tsx:84` `execute('extract_fact')` is async with only stage spinner; `src/components/pillmap/PillMapView.tsx:176` `recalculateEvaluations` awaits AI `checkDrugInteractionsAI` / `checkDietInteractionsAI` but shows no spinner; no global "generating interactions" toast barrier.
- **WebMCP not waiting**: `src/components/vault/DocumentDropzone.tsx:70` `await webMCPEngine.execute('extract_fact', ...)` but UI allows immediate nav away (no `await` lock on tab switch), `src/tools/vaultTools.ts:69` handles extraction param `extractionPath` but no `busy` bus event.
- **Complex English**: `src/components/labstory/LabStoryView.tsx:251` ("Trends over time"), `src/components/labstory/BiomarkerChart.tsx:262` ("Interactive longitudinal time series..."), etc. Need Simple English like "Your test results over time".

### Root Cause
- Two extraction paths + technical labels leaked to user UI.
- No centralized `isBusy` state blocking navigation / showing generation of med interactions after AI extraction.
- UI copy written for developers/ clinicians, not common users.

### Agent Checklist — Global
- [ ] **0.1 Remove jargon strings**: grep `Mistral|Live Connected|correlate_meds|table_format|include_blocks` → replace with Simple English. Keep technical detail only in code comments / Settings (see 0.3).
  - Files: `src/components/vault/DocumentDropzone.tsx:180-240,252-304`, `src/components/vault/FactStreamView.tsx:94,351`, `src/components/labstory/CausalQueryPanel.tsx:153-155`, `src/components/common/PrivacyBadge.tsx:115`, `src/components/pillmap/PillMapView.tsx:509` ("High contrast...")
- [ ] **0.2 Add global loading barrier after document upload**
  - Create/ reuse `eventBus` event `extraction_busy: {busy:boolean, stage:'ocr'|'ai'|'interactions', documentId}` in `src/core/events/eventBus.ts`.
  - In `src/components/vault/DocumentDropzone.tsx:32` `handleRealExtract`: set `busy=true` before OCR, switch to `ai`, then after `extract_fact` success, keep `busy=true` with message "Checking medicines that don't mix well..." until `checkDrugInteractionsAI` recomputation finishes (await PillMap recalc or listen to `medication_added`).
  - Header/Bottom nav: disable tab switches while `busy` (show overlay toast `aria-live="polite"` with spinner: "Reading your paper... Checking medicine warnings... Done").
  - Do not hide until final `eventBus` confirms facts committed + meds/labs stored. Verify `localVault.getDocuments(patientId)` has new doc before clearing busy.
- [ ] **0.3 WebMCP upload wait till final results**
  - In `src/components/vault/DocumentDropzone.tsx:84` wrap `await webMCPEngine.execute` + follow-up vault listeners in single try/finally; set `isExtracting` true throughout, disable dropzone `pointer-events:none`, show step progress `1/3 Reading, 2/3 Understanding, 3/3 Saving — please wait`.
  - In `src/App.tsx:319` `handleNav` add guard: if `isExtractingGlobal` true, `eventBus.dispatchToast` "Please wait till reading finishes" and block nav.
- [ ] **0.4 Simple English pass** (see §9 below): rewrite all user-facing copy to Grade 6 reading level ("My Records", "Lab Results", "My Medicines", "Get Help", "Family" are ok; inner labels not).
- [ ] **0.5 Remove redundant badges/texts**: delete "Mistral OCR", "Live Connected", technical provider/model/baseURL displays in user tabs; keep only in Settings > Advanced (behind collapsible). Verify via grep `Mistral|Live Connected|modelContext` count 0 in `src/components/vault/*` + `src/components/labstory/*` + `src/components/pillmap/*`.

### Acceptance
- Grep `Mistral` in `src/components/**` == 0 (allow `src/core/ai/**` and `src/components/settings/**` advanced section only).
- After dropping PDF, spinner stays 3s+ with "Checking medicine warnings..." and viewer shows doc; navigating away is blocked with toast until done.
- `npm run lint` 0, `npm run build` ok, screenshot mobile 375 shows simple headers no jargon.

---

## 1) My Records — Document Viewer empty after upload, store all docs, remove two options, remove unnecessary tabs

### Evidence
- **Viewer empty**: `src/App.tsx:584` `<BoundingBoxViewer documentId={undefined} />` always undefined — never wired to selected doc. `src/components/common/BoundingBoxViewer.tsx:13` expects `documentId` but App never passes. `src/components/vault/DocumentDropzone.tsx:58` does `localVault.addDocument` (stores!), but viewer reads only via `eventBus.onHighlightDocument` (fact click) not document list.
- **Two options**: `src/components/vault/DocumentDropzone.tsx:14` `extractionPath` state + switcher at `:180-206` ("OCR + AI (Preserves Tables)" vs "Direct Vision").
- **Docs stored but not listed**: `src/core/vault/LocalVault.ts:425` `addDocument` + `431` `getDocuments(patientId)` works, but `src/components/vault/FactStreamView.tsx:11` loads `documents` only for OCR modal trigger at `:149`, no document gallery.
- **Tabs**: App health hub already merged but My Records still shows separate dropzone/fact stream/viewer as stacked; requirement is single flow "drop -> see paper -> review facts".

### Root Cause
- Document viewer is decoupled from upload; no document gallery state.
- Extraction path switcher was dev option leaked to production.
- UI has 3 stacked sections instead of one coherent viewer with tabs removed.

### Agent Checklist — My Records
- [ ] **1.1 Store & show all uploaded documents** (fix viewer)
  - Keep `localVault.addDocument` in `src/components/vault/DocumentDropzone.tsx:58` (already correct).
  - Add document gallery: new state `selectedDocId` in My Records container (`src/App.tsx:579` health-vault-panel). Load via `localVault.getDocuments(effectivePatientId)` after upload.
  - Pass `documentId={selectedDocId}` to `BoundingBoxViewer` (instead of `undefined`). In `src/components/common/BoundingBoxViewer.tsx:22-36` add `useEffect` to load doc `getDocument(documentId)` and render its `extractedText` / fileName / pageCount.
  - On upload success `handleRealExtract` -> set selected doc to new `documentId` and emit `document_selected`.
  - Show list: thumbnail row "Your papers (3) — tap to view" above viewer; default selects latest upload.
- [ ] **1.2 Remove two extraction options — make OCR+AI the only default**
  - Delete `extractionPath` state and switcher UI at `src/components/vault/DocumentDropzone.tsx:14,34,44,80,180-206`. Hardcode `extractionPath='ocr_then_ai'` internally (or remove param and let `src/core/ai/client.ts:220` default handle it).
  - Remove `SettingsForm` path chooser if exposed (or hide behind Advanced). Simplify dropzone text to Simple English: "Drop a paper or photo — we read it for you".
- [ ] **1.3 Remove unnecessary tabs** inside My Records
  - Current `src/App.tsx:579-587` stacks Dropzone + FactStream + Viewer. Replace with: Top Dropzone (compact), then Viewer with doc gallery, then Review list — no extra tab bar. Keep outer Health tabs (`My Records | Lab Results | Tests to Do | For Doctor`) as is.
  - Remove verbose OCR result panel at `src/components/vault/DocumentDropzone.tsx:283-379` from main view; move "See what we read" behind a single link "Show reading details" (collapsed by default).
- [ ] **1.4 Ensure persistence across reload**
  - Verify `localVault.getDocuments` survives reload via Supabase sync path `src/core/vault/supabaseSync.ts` + `seed.ts` not clearing; test by reload and viewer still shows docs.
- [ ] **1.5 Simple English + loading**
  - Change `src/components/vault/DocumentDropzone.tsx:174` "Add Your Health Papers" -> "Add your health papers" and subtitle "Drop a PDF or photo — we do the rest".
  - Reuse global busy from §0 for spinner.

### Acceptance
- Upload PDF -> viewer immediately shows "Medical Document" + correct file name + extracted text (not "No Document Selected").
- No "OCR + AI / Direct Vision" buttons visible anywhere (grep `Direct Vision` ==0).
- All docs remain after refresh (2 uploads = 2 in gallery).
- Mobile 375 screenshot shows single dropzone + viewer + review list, no extra tabs.

---

## 2) Lab Results — improve upload, combine components, comparison table (normal vs your value), Story Sentence single, Trajectory delta removed, Move Ask Why to Question

### Evidence
- **Upload**: `src/components/labstory/LabStoryView.tsx:238-287` "Add Past Results" opens modal with two hardcoded buttons `handleIngestDataset('shanti'|'jenkins')` at `154` (mock datasets) — not real file drop. Real upload lives in HomeLab `UploadLabModal` but not in LabStory. Viewer has separate `Add Result Manually` form.
- **View combine**: `src/components/labstory/LabStoryView.tsx:346-374` renders `StorySentence` + `BiomarkerChart` + `MedOverlayBands` + `CausalQueryPanel` + history table as 5 separate cards — feels fragmented.
- **Comparison table**: `src/components/labstory/LabStoryView.tsx:378-462` table shows "Measured Value / Normalized Value / Reference Range / Status / Doctor Pinned Note" but not side-by-side "Your value vs Normal range (low-high) — good/high/low".
- **Story Sentence**: `src/components/labstory/StorySentence.tsx:11` currently renders 1 per marker but issue says "only 1 displayed" (maybe multiple rows). Code at `112` renders single sentence correctly; bug is duplicate renders if multiple labs? Need ensure exactly one sentence.
- **Trajectory delta**: `src/components/labstory/StorySentence.tsx:137-149` shows "Trajectory Delta +X (-Y%)" panel — to be removed per request.
- **Ask Why location**: `src/components/labstory/CausalQueryPanel.tsx:38` `presetQueries` + free input lives inside Lab Results; request is to move to Ask (QuestionBank page) or central Questions.

### Root Cause
- LabStory ingestion is mock-only; real photo/PDF drop should be same as My Records but lab-aware.
- Too many cards without unified card.
- Table columns are technical; no plain "Normal is X-Y, you are Z — borderline/high".
- StorySentence extra delta stats are redundant with chart.
- Ask Why is duplicative with QuestionBank.

### Agent Checklist — Lab Results
- [ ] **2.1 Improve upload — unify with dropzone**
  - Add same file drop as My Records but lab-scoped: reuse `DocumentDropzone` or create `LabDropzone` that calls `extract_labs` via `webMCPEngine.execute('extract_labs', {documentId})` at `src/components/labstory/LabStoryView.tsx:155`. Accept PDF/JPG/PNG drag + click.
  - Keep "Add manually" as secondary button. Ensure uploaded labs appear instantly via `eventBus.on('lab_added')` at `LabStoryView.tsx:95`.
  - Remove hardcoded "Longitudinal History (2022–2026)" + "Patient Renal AKI" mock buttons or hide behind "Add sample data (for demo)" collapsed section.
- [ ] **2.2 Improve view — combine components**
  - Combine `StorySentence` + `BiomarkerChart` into one card: StorySentence as chart header (one line), chart below, with toggles inside header. Remove separate `MedOverlayBands` card — render bands as overlay inside chart canvas or as small legend row under chart.
  - Ensure single scrollable card `max-w-full overflow-x-hidden` with chart responsive `containerWidth` logic already at `BiomarkerChart.tsx:60`.
- [ ] **2.3 Add comparison table: Normal vs Your value**
  - Redesign `src/components/labstory/LabStoryView.tsx:393-455` table columns to:
    - `Date | Test | Your value | Normal range | How you compare (Good / A little high / High / Low)`
  - Compute `comparison = normalizedValue vs referenceRange low/high + borderline 10% buffer` (reuse `src/core/vault/LocalVault.ts:109` logic). Show plain badge: "Good", "A little high", "High — ask doctor".
  - Keep single history table; remove duplicate "Normalized Value" column (merge with Your value + unit).
- [ ] **2.4 Story Sentence: only 1 displayed**
  - Enforce single sentence: in `src/components/labstory/StorySentence.tsx:48` generate one string (already does), but add guard in `LabStoryView.tsx:347` to ensure only one `<StorySentence>` even if multiple markers filtered; add `key={selectedMarker}` to prevent duplicate mount.
  - Truncate story to max 1 line with ellipsis; no multi-row.
- [ ] **2.5 Trajectory delta: remove**
  - Delete `src/components/labstory/StorySentence.tsx:137-149` delta panel entirely. Keep only badge + sentence + count dots line.
  - Remove `delta/pctChange` computation if unused elsewhere (keep for internal if needed but don't render).
- [ ] **2.6 Move Ask why to Question**
  - Move `CausalQueryPanel` out of LabStoryView. Create `AskWhySection` inside `src/components/common/QuestionBank.tsx` or new `src/components/ask/AskWhyPanel.tsx` that navigates to `?marker=eGFR` deep link.
  - In LabStory, replace panel with single button: "Ask why this changed →" that navigates to Ask page with query prefilled (via `eventBus.emit('navigate_ask', {query, marker})` and `App.tsx` handler).
  - Delete preset chips from LabStory (`src/components/labstory/CausalQueryPanel.tsx:38-64,168-183`) or keep 1 collapsed "Ideas" list only in Ask page.
- [ ] **2.7 Simple English**
  - Rename `BiomarkerChart` header "Interactive longitudinal time series..." -> "Your results over time. Tap a dot to see details."
  - Rename "Longitudinal Lab History" -> "Your past results".

### Acceptance
- Lab Results has working file drop (PDF/photo) that adds labs without mock buttons.
- Single combined card: story sentence (1 line) on top, chart middle, comparison table bottom — no separate MedOverlayBands card.
- Table shows "Your value | Normal range | How you compare".
- No "Trajectory Delta" visible (grep `Trajectory Delta` ==0).
- No "Ask Why" panel inside Lab Results; button navigates to Ask page where analysis runs.

---

## 3) Pill Interactions — loading when AI is loading interactions, scroll between days

### Evidence
- **Loading**: `src/components/pillmap/PillMapView.tsx:176-226` `recalculateEvaluations` is async (`await checkDrugInteractionsAI`) but no `isCheckingInteractions` state; arcs update silently. User sees no feedback after dropping OTC.
- **Scroll between days**: `src/components/pillmap/PillboxGrid.tsx:258-396` has `overflow-x-auto min-w-[720px]` + mobile cue at `249` "Swipe horizontally" but no day pagination/scroll controls; on small screens, Mon-Sun grid is wide and swipe is only gesture. No "Jump to Today" or day scroller.
- **Current scroll hint**: `src/components/pillmap/PillboxGrid.tsx:250-256` shows "Swipe horizontally for full week" but not interactive.

### Root Cause
- Async AI interaction check is fire-and-forget from UI perspective.
- Grid is table-wide, not day-paged; mobile users want day-by-day scroll.

### Agent Checklist — Pill Interactions
- [ ] **3.1 Add loading indicator when AI is checking interactions**
  - In `src/components/pillmap/PillMapView.tsx:101` add `const [isChecking, setIsChecking]=useState(false)`.
  - In `recalculateEvaluations` set `setIsChecking(true)` before `checkDrugInteractionsAI`, `false` in finally.
  - Show top banner during check: "Checking what doesn't mix well..." with spinner (`animate-spin`) + `aria-live="polite"`. Disable "Find Best Times" button while checking.
  - Also handle `handleDropPill` -> immediately show "Checking..." before vault add completes.
- [ ] **3.2 Add scroll between days (day pagination + horizontal scroll)**
  - Keep existing `overflow-x-auto` but add day scroller row above grid:
    - Pills: `[< Mon Tue Wed Thu Fri Sat Sun >]` where active day centered, arrows scroll container via `scrollIntoView({behavior:'smooth'})`.
    - On mobile, allow swipe but also add dots pagination (7 dots, active filled).
  - Implementation: in `src/components/pillmap/PillboxGrid.tsx:259` add `const scrollRef=useRef` on overflow div, add `scrollToDay(day)` helper that queries `[data-day="${day}"]` and scrolls.
  - Ensure `PillboxGrid` exposes `data-day` on `<th>` and `<td>` for anchoring.
  - Keep desktop table layout unchanged; enhance mobile with sticky time column.
- [ ] **3.3 Simple English for banner**
  - Change `src/components/pillmap/PillMapView.tsx:619` "1 Warning — medicines that don't mix well" is good; keep it. Change inner arc labels to plain "These two don't mix well".

### Acceptance
- Dropping "Fish Oil" onto grid shows spinner banner "Checking..." for ~1-2s until red/orange arcs appear.
- Mobile 375: visible day scroller `[< Mon ... Sun >]` and dots; tapping day scrolls grid smoothly; no horizontal scrollbar overflow.
- No jargon ("contraindicated" still shown but with plain explanation beneath).

---

## 4) Ask — remove pre-filled questions

### Evidence
- **Pre-filled**: `src/components/labstory/CausalQueryPanel.tsx:38` presets are also mirrored? In `src/components/common/QuestionBank.tsx:120-151` add form has placeholder but no pre-filled list. However `src/core/vault/LocalVault.ts:455` auto-adds `QuestionBankItem` per med add (`Question about Metformin...`) and per abnormal lab at `562`, plus `src/core/knowledge/reconciliationEngine.ts` generates questions. Also `src/components/labstory/CausalQueryPanel.tsx:38-64` shows 5 preset chips — these are pre-filled questions.
- No explicit "pre-filled questions" in QuestionBank itself besides auto-generated, but issue likely means remove auto-preset chips/list so Ask page starts empty.

### Root Cause
- System auto-populates QuestionBank with AI-generated questions on med/lab add; plus CausalQueryPanel shows preset queries even before user types.

### Agent Checklist — Ask
- [ ] **4.1 Remove pre-filled preset chips** from Ask page
  - Delete `presetQueries` at `src/components/labstory/CausalQueryPanel.tsx:38-64` and its render at `168-183`. If keeping in Ask page, hide behind "Need ideas?" collapsed disclosure (default closed).
- [ ] **4.2 Keep QuestionBank empty until user or doctor adds**
  - Audit auto-add paths: `src/core/vault/LocalVault.ts:455-477` (med add auto-question), `559-583` (lab abnormal auto-question). Change to only add when `isCritical` true, or add toggle in Settings "Auto-add doctor questions" default OFF for common users.
  - Alternatively keep but do not show as pre-filled; show as "Ideas from your record (3) — tap to add" suggested list separate from user's questions, not in main list.
- [ ] **4.3 Placeholder only**
  - In `src/components/common/QuestionBank.tsx:129` placeholder is fine, but ensure input `value` starts `''` (it does at `14`). Ensure no `newQuestionText` default.
  - Clear any mock questions in `src/core/vault/seed.ts` — already no-op (seed returns 0).
- [ ] **4.4 Simple English**
  - Rename "Doctor Question Bank" -> "Questions for your doctor". Empty state: "No questions yet — add one above."

### Acceptance
- Fresh user (empty vault) sees Ask page with 0 questions, input empty, no preset chips visible without tapping "Need ideas?".
- Grep `presetQueries` ==0 in `src/components/common/QuestionBank*` and collapsed only.

---

## 5) Medicine Review — outdated / only doctor

### Evidence
- `src/components/rxbridge/RxBridgeView.tsx:82` `emptyDataset` built from `effectivePatientId` + `activeProfile.name` but `preAdmissionMeds/inHospitalMeds/dischargeMeds` are `[]` empty — no real data until hypothetical discharge. `src/components/rxbridge/ThreeListTable.tsx` thus shows placeholder stats `0`. The page appears "un updated" because it never loads from vault meds/labs.
- No doctor role gate: `src/App.tsx:280` nav shows "Medicines: Weekly Planner + Medicine Review" to all users; but Medicine Review is clinically doctor-curated (discharge list).
- `src/core/knowledge/reconciliationEngine.ts:11` `reconcileThreeLists` expects real 3 lists but none exist for new users.

### Root Cause
- RxBridge was scaffolded for mock Patient/Jenkins datasets (now removed per `seed.ts` no-op). For real users, no 3-list source exists, so page looks empty/outdated.
- Missing role indication that this list comes from doctor/hospital, not patient self-add.

### Agent Checklist — Medicine Review
- [ ] **5.1 Show doctor as source**
  - Add header badge "From your hospital stay — doctor's list" with date and doctor name (from `activeDataset.attendingPhysician` or latest `DoctorAccessGrant` at `src/core/vault/LocalVault.ts:833`).
  - In `src/components/rxbridge/RxBridgeView.tsx:338-364` add doctor info row: "Shared by Dr. ___ on ___".
- [ ] **5.2 Update data flow — real vault**
  - Instead of `emptyDataset` with `[]`, populate `preAdmissionMeds` from `localVault.getMedications(patientId)` before admission (filter by date if available) and `dischargeMeds` from same but with `status` tags. If no discharge doc, show empty state "No hospital list yet — your doctor can share one, or add medicines in Weekly Planner".
  - Add "Upload discharge paper" dropzone specific to RxBridge that calls `extract_fact` with `docType=discharge_summary` and then `reconcileThreeLists`.
- [ ] **5.3 Only doctor can edit? / Patient approves**
  - Keep patient Approve/Edit gate at `src/components/rxbridge/RxBridgeView.tsx:148` `handleToggleApproval` but add read-only banner if `activeProfile.role !== 'doctor' && !isProxy`: "This is your doctor's list — review and tap Approve for each medicine".
  - Hide "Finalize & Handoff" unless all approved (already gated at `227`).
- [ ] **5.4 Empty vs outdated**
  - Add timestamp "Last updated: ___" from vault's latest `proposal` or `auditLog` for meds. If >30 days old, show "This list may be outdated — ask your doctor for current list".
- [ ] **5.5 Simple English**
  - Rename table columns "Continue / Dose Changed / Stopped / New" -> plain badges already good; keep plain.

### Acceptance
- Medicine Review shows "From your hospital — Dr. ___ on ___ — Last updated ___" when data exists; otherwise clear empty state with upload CTA.
- No editable 3-list for patient; patient sees Approve buttons only.
- Mobile shows single column walk, not 3-column table overflow.

---

## 6) Follow-up — add range

### Evidence
- `src/components/safety/FollowupScheduler.tsx:33` `dateOffset` is single choice `+3d | +1w | +2w | custom` at `159`, but no range like "in 3-5 days" or "between Aug 30 — Sep 5".
- `src/types/vault.ts` `CalendarEventRecord` has `scheduledDate: string` single date, not range.
- `src/components/safety/CalendarView.tsx` view likely shows single dot.

### Root Cause
- Clinical follow-up often is a window (e.g., "return in 3-5 days" or "lab due in 2-4 weeks") not exact date. Model only supports point date.

### Agent Checklist — Follow-up
- [ ] **6.1 Add range to model**
  - Extend `CalendarEventRecord` in `src/types/vault.ts` with `scheduledDateEnd?: string` or `windowDays?: number` (e.g., `windowStart`/`windowEnd`). Keep backward compat: if `scheduledDateEnd` missing, treat as single date.
  - Extend `src/core/vault/LocalVault.ts:761` `addCalendarEvent` to store range.
- [ ] **6.2 Update FollowupScheduler UI**
  - In `src/components/safety/FollowupScheduler.tsx:33-36` add state `dateRange: {startOffset, endOffset}` or checkbox "Is this a range?"
  - Show when checked: two date pickers "Earliest: [date] — Latest: [date]" + helper "Your clinic can see you anytime in this window".
  - If `custom` selected, show two inputs `customStart` + `customEnd`.
  - On submit at `44`, compute `scheduledDate = startISO` and `scheduledDateEnd = endISO` (end = start + window).
- [ ] **6.3 Update CalendarView display**
  - In `src/components/safety/CalendarView.tsx` (and `src/components/safety/SafetyView.tsx:239` usage) render range as bar spanning dates, not single dot. Show "Aug 30 — Sep 5" label.
  - Generate `.ics` with `DTSTART/DTEND` for range events (see `src/core/knowledge/CalendarExporter.ts` if exists or `src/tools/safetyTools.ts:353` VALARM logic).
- [ ] **6.4 Simple English**
  - Label "Target Timing" -> "When? (pick a date or a date range)".

### Acceptance
- Scheduler allows picking single date OR range (earliest + latest).
- Calendar shows range bar; exported .ics has end date.
- Backwards compat: old single-date events still render as point.

---

## 7) Family — relationship options + name field

### Evidence
- `src/components/carecircle/ScopedPermissionsModal.tsx:37` `relationship` state is `'parent' | 'child' | 'spouse' | 'guardian' | 'advocate'` at `37` — missing "children" variants, sibling, daughter/son explicit, etc.
- `src/types/carecircle.ts:14` allows `'parent' | 'child' | 'spouse' | 'guardian' | 'advocate' | 'son'|'daughter'|string` but UI `260` select shows only 5 options (Parent, Child, Spouse, Guardian, Advocate) — not "Children etc" as requested.
- **Name field missing**: `src/components/carecircle/ScopedPermissionsModal.tsx:49-65` `handleLinkNew` collects `newPatientId`, `relationship`, `authToken`, `permissionTier` but no `caregiverName` input; it hardcodes `name: 'Family member'` at `App.tsx:198` etc.
- `src/components/carecircle/CareCircleView.tsx:182` displays `link.caregiverName?.charAt(0)` but often is "Family member" placeholder.

### Root Cause
- Relationship enum limited to 5; string type allows more but UI doesn't expose.
- No name collection in link flow — proxy name always generic.

### Agent Checklist — Family
- [ ] **7.1 Expand relationship options**
  - In `src/components/carecircle/ScopedPermissionsModal.tsx:37,259` add full list:
    - `parent` (Mother/Father), `child` (Son/Daughter), `children` (Children), `spouse` (Husband/Wife/Partner), `sibling` (Brother/Sister), `guardian`, `advocate`, `friend`, `other`
  - Update `<select>` at `260-270` to show: Mother / Father / Son / Daughter / Children / Husband / Wife / Partner / Brother / Sister / Guardian / Advocate / Friend / Other.
  - Keep `src/types/carecircle.ts:14` as `string` to allow future.
- [ ] **7.2 Add name field**
  - Add state `const [caregiverName, setCaregiverName]=useState('')` in `ScopedPermissionsModal.tsx:37`.
  - Add input above relationship: `<label>Name</label><input placeholder="e.g., Raj (son)" value={caregiverName} onChange... required minLength 2 />` with `min-h-[44px]`.
  - In `handleLinkNew` at `54` pass `caregiverName: caregiverName.trim() || relationship` to `link_patient` params and to displayed link. Validate non-empty before submit.
- [ ] **7.3 Show name everywhere**
  - Ensure `src/core/vault/LocalVault.ts:783` `addCaregiverLink` stores `caregiverName`; display in `CareCircleView.tsx:203`, `AuditLogViewer.tsx`, `SafetyView` etc. as actual name not "Family member".
  - Update `src/App.tsx:198` proxy switcher to use real name from vault, not hardcode.
- [ ] **7.4 Simple English**
  - Change "Manage Access" -> "Family helpers" ; "Family who can help" is already plain.

### Acceptance
- Link modal shows Name input + expanded relationship dropdown (≥12 options including Children, Sibling etc).
- Creating helper with name "Asha (daughter)" persists and shows as "Asha (daughter)" in Family List and audit log.
- Old generic "Family member" links still render but new ones show real name.

---

## 8) Future — Pill Interactions: use web search (Exa) + loading already covered

### Evidence
- `src/core/knowledge/interactionEngine.ts:30` `callKnowledgeAI` calls generic `callAI` which routes via `src/core/ai/client.ts` to configured provider (OpenAI/Anthropic etc). No web search.
- Current `checkDrugInteractionsAI` at `157` uses closed LLM knowledge (plus fallback `mockDrugDrugInteractions` at `14`).
- No Exa integration found: grep `exa|web.*search|search.*content` ==0 (except this doc).

### Root Cause
- Interactions are from static fixture + LLM parametric knowledge; may be stale for new drugs or dosing.

### Agent Checklist — Future (Exa web search)
- [ ] **8.1 Add Exa search helper**
  - Create `src/core/knowledge/webSearch.ts` with `searchWithExa(query:string):Promise<{results:{title,url,snippet}[]}>` using `fetch` to `https://api.exa.ai/search` with `EXA_API_KEY` from `src/core/ai/config.ts` (env `VITE_EXA_API_KEY`).
  - Follow with `getContent(url)` for top 2 results via Exa content endpoint if needed.
  - Keep behind feature flag `isWebSearchEnabled` — only when `VITE_EXA_API_KEY` present; otherwise fall back to LLM-only.
- [ ] **8.2 Integrate into interaction check**
  - In `src/core/knowledge/interactionEngine.ts:157` `checkDrugInteractionsAI`, before `callKnowledgeAI`, optionally call `searchWithExa("drug interaction Apixaban and Fish Oil clinical guidance")` and append top snippets to `userText` as `Web search context:\n...` with citations.
  - Same for `checkDietInteractionsAI` at `318` (e.g., "Warfarin Vitamin K interaction").
  - Ensure `callAI` prompt includes "Use web search context if provided; cite URLs; if no search, use your knowledge; never invent dosage".
- [ ] **8.3 Loading indicator already done in §3.1** — reuse same `isChecking` but extend text to "Searching latest guidance + checking..." when Exa is active.
- [ ] **8.4 Security & privacy**
  - Never send `patientId` or full med history to Exa; send only generic pair queries ("Apixaban + Fish Oil interaction").
  - Log Exa calls to `auditLog` as `web_search` with query only.
- [ ] **8.5 Simple English for citations**
  - Show "Based on: [FDA Drug Label] + your medicines — ask your pharmacist" with link, not raw URLs in main banner.

### Acceptance
- When `VITE_EXA_API_KEY` set, PillMap interaction check makes 1 Exa search call per unique drug pair, shows citations under mechanism sheet (e.g., "Source: exa.ai — ...").
- Without key, still works via LLM/fixture (no crash).
- No patient data leaked in search query (verify via network inspector).

---

## 9) Cross-Cutting — Simple English & Simpler UI

- [ ] **9.1 Plain language pass** (< 20 chars per button where possible)
  - Replace: "Reference vs Optimal Toggle" -> "Normal vs Best range"; "Chronotype-Aware Schedule" -> "Your sleep time"; "Correlated Medications" -> "Medicines linked to this change".
  - Audit via reading `src/components/**/*` for `correlation|longitudinal|contraindicated|titration|adherence` and add plain subtitle.
- [ ] **9.2 Simpler UI**
  - All primary actions `min-h-[44px] min-w-[44px]` (already mostly, verify via grep `min-h-\[44px\]`).
  - Collapse advanced details behind "Show details" links; main screen max 2 cards + 1 action bar.
- [ ] **9.3 Remove redundant texts**
  - Delete `src/components/vault/DocumentDropzone.tsx:191,238,304` technical bullets; keep one plain line.
  - Ensure no "Live Connected" badge anywhere (grep `Live Connected` ==0 confirmed; keep green dot "Local data" only in `PrivacyBadge.tsx:93`).
- [ ] **9.4 Accessibility**
  - All spinners have `aria-live="polite"` and `role="status"` (see §3.1, §0.2).

---

## 10) Verification Checklist (run after each Issue)

- [ ] `npm run lint` — `tsc --noEmit` 0 errors
- [ ] `npm run build` — vite build ok
- [ ] `npm test` — vitest ok (update `test/tier1-feature/*` if UI removed; mock tests use `webMCPEngine.execute('check_interactions')` still valid)
- [ ] Manual: drop PDF in My Records -> viewer shows doc, spinner waits till interactions, then PillMap arcs appear; Lab Results comparison table correct; Family name saved; Follow-up range saved; Ask empty.
- [ ] Grep gates: `grep -R "Mistral" src/components --include="*.tsx" | wc -l` ==0; `grep -R "Direct Vision" src` ==0; `grep -R "Trajectory Delta" src` ==0; `grep -R "presetQueries" src/components/common` ==0 (or collapsed only).

---

## Appendix — File Map for Agents

| Issue | Primary files to edit | Supporting |
|-------|----------------------|------------|
| 0 Global | `src/components/vault/DocumentDropzone.tsx`, `src/App.tsx`, `src/core/events/eventBus.ts`, `src/components/common/PrivacyBadge.tsx` | `src/core/ai/client.ts` |
| 1 My Records | `src/App.tsx:579`, `src/components/common/BoundingBoxViewer.tsx`, `src/components/vault/DocumentDropzone.tsx` | `src/core/vault/LocalVault.ts:425` |
| 2 Lab Results | `src/components/labstory/LabStoryView.tsx`, `src/components/labstory/StorySentence.tsx`, `src/components/labstory/BiomarkerChart.tsx`, `src/components/labstory/CausalQueryPanel.tsx` | `src/types/vault.ts` |
| 3 PillMap | `src/components/pillmap/PillMapView.tsx`, `src/components/pillmap/PillboxGrid.tsx` | `src/core/knowledge/interactionEngine.ts` |
| 4 Ask | `src/components/common/QuestionBank.tsx`, `src/components/labstory/CausalQueryPanel.tsx`, `src/core/vault/LocalVault.ts:455` | `src/core/knowledge/reconciliationEngine.ts` |
| 5 Medicine Review | `src/components/rxbridge/RxBridgeView.tsx`, `src/components/rxbridge/ThreeListTable.tsx` | `src/core/knowledge/reconciliationEngine.ts` |
| 6 Follow-up | `src/components/safety/FollowupScheduler.tsx`, `src/types/vault.ts`, `src/components/safety/CalendarView.tsx` | `src/core/vault/LocalVault.ts:761` |
| 7 Family | `src/components/carecircle/ScopedPermissionsModal.tsx`, `src/types/carecircle.ts`, `src/App.tsx:198` | `src/core/vault/LocalVault.ts:783` |
| 8 Future Exa | `src/core/knowledge/interactionEngine.ts`, `src/core/knowledge/webSearch.ts` (new) | `src/core/ai/config.ts` |

> Tip: Workstream size < 50 LOC per issue where possible; ship one Issue per PR, re-run §10 checks, capture mobile 375 screenshot into `.teamwork/snapshots/` before marking Done.

