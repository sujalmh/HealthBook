# CareCanvas Mobile UI & Shell Architecture Specification Mining Report

**Agent**: Explorer 1 (`explorer_m1_shell` — teamwork_preview_spec_miner)  
**Date**: 2026-08-29  
**Target Viewports**: 320px (iPhone SE 1st gen), 375px (iPhone SE 2nd/3rd gen / iPhone 13 mini), 390px (iPhone 14/15), 414px (iPhone XR/11 Pro Max), 430px (iPhone 15/16 Pro Max).

---

## 1. Executive Summary & Scope of Audit

This report provides a comprehensive technical analysis of the application shell, layout, header, navigation, modals, drawers, CSS viewport constraints, and touch targets across CareCanvas on mobile screen sizes (320px–430px).

The investigation analyzed:
1. **Top Application Bar & Header**: Header actions, caregiver proxy switcher, question bank trigger, WebMCP inspector trigger, sign out, and responsive spacing under narrow widths down to 320px.
2. **Bottom Navigation Bar**: Mobile navigation container, 8 module tabs, active states, badge rendering, height, touch targets (ensuring $\ge 44\text{px}$ per WCAG 2.1 AA), and scroll mechanics.
3. **Global Layout & Viewport Containment**: HTML/body overflow styles, root containers, main viewport wrappers, and root causes of horizontal overflow (`overflow-x`).
4. **Modals, Drawers, Sheets & Overlays**: All 20 modal and overlay dialogs across the 8 modules and common tools, analyzing backdrop behavior, dismiss triggers, max-height / vertical scrolling constraints, and responsive grid collapsing.
5. **Auth Gate & View Routing**: Cold-start auth gate (`CreateAccountView`, `SignInView`), hydration spinner, active session restore, toast notification positioning, and module view switching.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Shell / Header | Brand Logo & Title | Header branding with icon, title, and "Private & Secure" badge | None | Rendered header brand | Hidden badge on `<sm` | `src/App.tsx:274-290` |
| 2 | Shell / Header | Caregiver Proxy Switcher | Toggle between Primary Patient and Caregiver Proxy (Raj) | Click 'patient' / 'caregiver' | Updates `activeProfile`, dispatches toast | Graceful fallback to default patient profile | `src/App.tsx:299-320` |
| 3 | Shell / Header | Question Bank Header Trigger | Button with badge showing count of active unaddressed doctor questions | Click button | Opens QuestionBank modal | Shows 0 badge / hidden badge when empty | `src/App.tsx:322-334` |
| 4 | Shell / Header | WebMCP Inspector Header Trigger | Button with live pulse badge showing pending approval count | Click button | Opens WebMCPInspector slide-over modal | None | `src/App.tsx:337-350` |
| 5 | Shell / Header | Sign Out Trigger | Clears `carecanvas_active_user` and resets session | Click button | Redirects to Auth Gate | Dispatches info toast | `src/App.tsx:353-362` |
| 6 | Navigation | Mobile Bottom Navigation Bar | Fixed bottom navigation bar with 8 module tabs and badge counters | Active module state, user tap | Switches view, smooth scrolls to top | Safe-area padded bottom | `src/App.tsx:454-489` |
| 7 | Navigation | Desktop Navigation Pill Bar | Horizontal scrolling tab list for `>=md` viewports | Active module state, click | Switches active module | Accessible pill active styles | `src/App.tsx:367-394` |
| 8 | Auth Gate | Create Account View | On-device user profile creation with optional Supabase Auth integration | Name, Email, Password | Emits `onCreated` profile | Dispatches validation error toast | `src/components/auth/CreateAccountView.tsx` |
| 9 | Auth Gate | Sign In View | LocalVault / Supabase credential verification | Email, Password | Emits `onSignedIn` profile | Dispatches "Incorrect password" / "Not found" toast | `src/components/auth/SignInView.tsx` |
| 10 | Global Common | WebMCP Inspector Modal | W3C WebML Tool Catalog, Telemetry Stream, Playground & Human Approval Gate | Active tab, param JSON | Tool execution result | Shows error badge and execution stack | `src/components/common/WebMCPInspector.tsx` |
| 11 | Global Common | Doctor Question Bank Modal | Aggregated question list from reconciliation and manual entry | Category filter, question text, priority | Appends `QuestionBankItem` | Prevents empty question submission | `src/components/common/QuestionBank.tsx` |
| 12 | Global Common | Privacy Badge Modal | Local data guarantee modal and FHIR R4 Bundle JSON export | Click export | Downloads `CareCanvas_FHIR_Export_*.json` | Safe fallback if no data | `src/components/common/PrivacyBadge.tsx` |
| 13 | Global Common | Bounding Box Document Viewer | Visual OCR grounding document viewer with zoom & pan controls | `documentId`, `boundingBox` | Scaled highlight box over document canvas | Shows "No Document Selected" placeholder | `src/components/common/BoundingBoxViewer.tsx` |
| 14 | Global Common | Floating Toast Notifications | Clinical toast stack positioned above bottom navigation bar | `eventBus.dispatchToast` | Floating auto-dismiss alert cards | Dismissible on tap (44px target) | `src/components/common/ToastContainer.tsx` |
| 15 | Module 0: Vault | Document Dropzone | File drop target (PDF, JPG, PNG) with on-device text / OCR extraction | File drag/drop / file input | Emits `extract_fact` WebMCP tool call | Validates file type, throws toast error | `src/components/vault/DocumentDropzone.tsx` |
| 16 | Module 0: Vault | Fact Stream & Approval Cards | Human-in-the-loop staging of extracted facts with Approve, Edit, Reject | User review action | Emits `confirm_fact` WebMCP tool call | Dispatches error toast on failure | `src/components/vault/FactStreamView.tsx` |
| 17 | Module 1: LabStory | Ingestion & Manual Add Modals | Multi-year cohort ingestion and manual biomarker point entry modals | Dataset select / Form input | Adds lab records to LocalVault | Validates numeric input | `src/components/labstory/LabStoryView.tsx:441,514` |
| 18 | Module 2: PillMap | Pillbox 7x4 Drag-and-Drop Grid | Mon-Sun x 4 time slots matrix with interaction arcs & diet badges | Drag OTC / Pill click | Updates medication timing slots in LocalVault | Auto-recalculates drug conflicts | `src/components/pillmap/PillboxGrid.tsx` |
| 19 | Module 2: PillMap | Add Medication Modal | Manual medication creation with dose, schedule, and dietary instructions | Name, dose, slots, food checks | Inserts medication to LocalVault | Validates required name & dose | `src/components/pillmap/AddMedicationModal.tsx` |
| 20 | Module 2: PillMap | Missed Dose Adherence Simulator | Simulation of clinical pharmacological impact of missed dose | Med, Day, Slot selector | Plain language assessment | Fallback to standard assessment | `src/components/pillmap/AdherenceSimulatorModal.tsx` |
| 21 | Module 2: PillMap | 1-Page Pharmacist Export Modal | Crosswalk table, drug-drug conflicts, and sign-off block | Print / Copy JSON triggers | Printable HTML & JSON bundle | Clipboard copy feedback | `src/components/pillmap/PharmacistExportModal.tsx` |
| 22 | Module 2: PillMap | Daily Reminder Config Modal | Batch time-window notification schedule editor | Time inputs (HH:MM) | Updates reminder preferences | Native time input validation | `src/components/pillmap/ReminderConfigModal.tsx` |
| 23 | Module 2: PillMap | Schedule Optimizer Shift Preview | Chronotype-driven circadian schedule suggestion modal | Suggestion object | Updates medication slots | Fallback if already optimal | `src/components/pillmap/ShiftPreviewModal.tsx` |
| 24 | Module 2: PillMap | Meal Dietary Instruction Dialog | Popup explaining specific food-drug interaction guidance | Badge click | Shows clinical dietary guidance | Dismiss on backdrop / button | `src/components/pillmap/MealBadges.tsx:184` |
| 25 | Module 2: PillMap | Drug-Drug Interaction Detail Sheet | Popup explaining pharmacological mechanism and contraindications | Arc click | Shows severity & clinical guidance | Dismiss on backdrop / button | `src/components/pillmap/SVGArcOverlay.tsx:248` |
| 26 | Module 3: RxBridge | Teach-Back Verification Modal | Conversational comprehension assessment dialog | Speech / text input | Generates comprehension report | Dispatches toast | `src/components/rxbridge/TeachBackModal.tsx` |
| 27 | Module 3: RxBridge | 1-Page Discharge Summary Modal | Printable multi-lingual discharge transition summary | Language switch, Print, Export | Printable view & JSON download | Localized text fallback | `src/components/rxbridge/SummaryExportModal.tsx` |
| 28 | Module 4: HomeLab | Remote Lab OCR Upload Modal | Dropzone & simulated smartphone slip OCR extraction modal | Slip photo / PDF | Emits `extract_labs` WebMCP tool call | OCR fallback values | `src/components/homelab/UploadLabModal.tsx` |
| 29 | Module 5: Safety | Red-Flag Danger Signs Modal | Urgent symptom checklist and emergency 911 dialer | Symptom checkboxes | Dispatches urgent clinical report | Auto-detects emergency symptoms | `src/components/safety/DangerSignModal.tsx` |
| 30 | Module 5: Safety | Follow-up Scheduler Modal | Prescribe in-person clinic or telehealth video appointment | Appointment mode, timing | Inserts `CalendarEventRecord` to vault | Form validation | `src/components/safety/FollowupScheduler.tsx` |
| 31 | Module 6: CareCircle | Scoped Permissions Modal | Caregiver linking and tiered proxy access management | Caregiver email, tier selection | Inserts / revokes `LinkedCareProfile` | Input validation | `src/components/carecircle/ScopedPermissionsModal.tsx` |
| 32 | Module 7: Dossier | Doctor Access Passkey Modal | Time-bound clinician access delegation passkey generator | Doctor email, duration (7d/30d/1y) | Generates `DoctorAccessGrant` token | Email format validation | `src/components/dossier/DoctorAccessModal.tsx` |
| 33 | Module 7: Dossier | Clinical Dossier Export Modal | Multi-format package export (FHIR R4 JSON, PDF summary, CSV) | Format selector, section checkboxes | Triggers browser download | Format-specific bundle generation | `src/components/dossier/DossierExportModal.tsx` |

---

## 3. Edge Cases & Viewport Stress Testing

| # | Feature | Viewport Width | Input / Condition | Observed Issue | Root Cause |
|---|---------|----------------|-------------------|----------------|------------|
| 1 | Top Header Bar | 320px–360px | Logo + Proxy Switcher + Question Bank + Activity + Sign Out rendered simultaneously | Right action buttons squeeze into logo, wrap awkwardly, or overflow viewport ($366\text{px} > 320\text{px}$) | `App.tsx:274-364` uses `flex items-center justify-between` with 5 distinct buttons without mobile consolidation |
| 2 | Top Header Bar | 320px | Global CSS media query `button { min-width: 44px; min-height: 44px; }` | Expands proxy switcher buttons (`patientInitial`, `caregiverInitial`) to 44px each, blowing out header width | Blanket rule in `src/index.css:92-97` forces min-width on grouped segmented buttons |
| 3 | Bottom Navigation Bar | 320px–430px | 8 navigation items in `flex items-center gap-1 min-w-max` | Total width is $556\text{px}$; user must scroll horizontally, but no visual affordance/fade mask shows scrollability | Missing left/right gradient fade masks and active tab auto-scroll into view |
| 4 | Bottom Navigation Bar | 320px–375px | Tab labels: "Medicine Review" (15 chars), "For My Doctor" (13 chars) | Text truncated to "Medici..." and "For My..." due to `max-w-[64px] truncate` | Verbose desktop labels used on mobile instead of concise 1-word mobile tokens |
| 5 | Modals (AddMedication) | 320px–414px | User opens Add Medication Modal on mobile with soft keyboard open | Bottom "Add to Pillbox" submit button and food checkboxes are cut off off-screen | `AddMedicationModal.tsx:106` lacks `max-h-[90vh] overflow-y-auto` |
| 6 | Modals (Simulator) | 320px–414px | User opens Missed Dose Simulator on small screen | Content overflows bottom of viewport without scrollbar | `AdherenceSimulatorModal.tsx:65` lacks `max-h-[90vh] overflow-y-auto` |
| 7 | Modals (ReminderConfig) | 320px–414px | User opens Reminder Modal on mobile | Save button cut off | `ReminderConfigModal.tsx:45` lacks `max-h-[90vh] overflow-y-auto` |
| 8 | Modals (ShiftPreview) | 320px–414px | User opens Schedule Optimizer Preview | Action buttons cut off | `ShiftPreviewModal.tsx:30` lacks `max-h-[90vh] overflow-y-auto` |
| 9 | Modals (Lab Ingestion & Manual) | 320px–414px | User opens multi-year lab drop or manual lab entry | Dialog exceeds screen height | `LabStoryView.tsx:442, 517` lack `max-h-[90vh] overflow-y-auto` |
| 10 | Modals (Close Buttons) | 320px–430px | Tapping close button in `ScopedPermissionsModal`, `DangerSignModal`, `FollowupScheduler` | Tiny tap area ($32\times 32\text{px}$ or $20\times 20\text{px}$) violates WCAG 44px minimum | Hardcoded classes like `w-8 h-8` or `p-1 rounded-lg` |
| 11 | Modals (Close Buttons) | 320px–430px | Tapping close button in `MealBadges` & `SVGArcOverlay` | Tiny $20\times 20\text{px}$ close icon causes missed taps | Hardcoded `p-1 rounded-lg` with `w-4 h-4` icon |
| 12 | Modals (DoctorAccess) | 320px | 3 duration preset buttons (`7 Days (Standard)`, `30 Days (Follow-up)`, `1 Year (Primary Care)`) | 3-column grid creates 75px columns; text wraps into broken multi-line blocks | `DoctorAccessModal.tsx:172` has `grid grid-cols-3 gap-2` instead of `grid-cols-1 sm:grid-cols-3` |
| 13 | Modals (DossierExport) | 320px–375px | 3 format cards (`Doctor Consultation PDF`, `FHIR R4 Bundle`, `Tabular CSV Archive`) | 3-column grid creates 85px columns; card titles and descriptions overlap and clip | `DossierExportModal.tsx:158` has `grid grid-cols-3 gap-3` instead of `grid-cols-1 sm:grid-cols-3` |
| 14 | Modals (UploadLab) | 320px | Extracted biomarkers (Creatinine, eGFR, Potassium) breakdown & edit mode | 3-column grid in ~240px creates 70px input fields that overflow | `UploadLabModal.tsx:275, 293` has `grid grid-cols-3 gap-3` instead of `grid-cols-1 sm:grid-cols-3` |
| 15 | Modals (AddMedication) | 320px | Daily Time Slots (Morning, Noon, Evening, Bedtime) | 4-column grid creates 55px buttons; "bedtime" text overflows button | `AddMedicationModal.tsx:178` has `grid grid-cols-4 gap-2` instead of `grid-cols-2 sm:grid-cols-4` |
| 16 | Modals (FollowupScheduler)| 320px | Target Timing presets (24-48 Hours, 3-5 Days, 1-2 Weeks, Routine) | 4-column grid creates 55px buttons; text clips | `FollowupScheduler.tsx:159` has `grid grid-cols-4 gap-2` instead of `grid-cols-2 sm:grid-cols-4` |
| 17 | Modals (PharmacistExport) | 320px–430px | 5-column brand/generic crosswalk table | Columns 3, 4, 5 clipped and completely invisible | `PharmacistExportModal.tsx:96` has `overflow-hidden` instead of `overflow-x-auto` |
| 18 | CareCircle Profile Switcher| 320px–375px | 3 profile switch buttons ("Self (Personal Vault)", "Mother (S. Devi, 78)", "Child (Child, 8)") | Combined width is ~360px; forces horizontal overflow on 320px-375px screens | `CaregiverSwitcher.tsx:81` has `flex items-center` without `flex-wrap` or `overflow-x-auto` |
| 19 | Dossier Sub-Tabs | 320px–375px | 4 sub-tab buttons ("Timeline", "Emergency Card", "Source Pages", "Share with doctor") | Combined width is ~380px; forces horizontal overflow on 320px-375px screens | `DossierView.tsx:258` has `flex items-center w-fit` without `overflow-x-auto` |
| 20 | DangerSign Emergency Banner | 320px | Critical emergency warning banner in modal | Warning text and "Call 911" button in a single row squishes text into a narrow column | `DangerSignModal.tsx:162` has `flex items-center justify-between` instead of `flex flex-col sm:flex-row` |

---

## 4. Comprehensive File-by-File Technical Breakdown

### A. Application Shell (`src/App.tsx`)
- **Lines 274–364 (Top Header Bar)**:
  - **Issue**: Too many header actions horizontally on mobile viewports (<430px). Total minimum width of items exceeds 360px.
  - **CSS Classes**: `<div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4">`
  - **Elements present**:
    1. Logo + "CareCanvas" title (`min-w-0 flex-1 sm:flex-none`)
    2. Proxy Switcher (2 buttons with `min-h-[32px]`)
    3. Question Bank button (icon + badge + optional text)
    4. WebMCP Activity button (icon + badge + optional text)
    5. Sign Out button (icon + optional text)
  - **Fix**:
    - Hide secondary labels on `<md` (already done).
    - On `<sm` (mobile), consolidate Question Bank, Activity, and Sign Out into a clean compact action group or mobile menu dropdown / drawer.
    - Alternatively, condense the proxy switcher into an avatar indicator with single-tap switch, and use icon-only buttons with explicit 44px tap target padding.

- **Lines 454–489 (Bottom Navigation Bar)**:
  - **Issue**: 8 items spanning 556px inside `overflow-x-auto scrollbar-none`. Lacks scroll affordance and automatic center-scrolling on active tab change.
  - **CSS Classes**: `<div className="flex items-center gap-1 px-2 py-2 min-w-max mx-auto w-max">`
  - **Fix**:
    - Add a `useRef` to the active tab button and execute `activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })` on tab change.
    - Add CSS linear-gradient edge masks on the left and right sides of the navbar container to indicate scrollability.
    - Shorten labels for mobile: "Records", "Labs", "Medicines", "Review", "Tests", "Safety", "Family", "Doctor".

- **Lines 492–498 (Global Modals Wrapper)**:
  - **Issue**: `QuestionBank` modal wrapper is clean (`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ... overflow-y-auto`), but needs consistency across all other module modals.

---

### B. Global CSS & Viewport Styling (`src/index.css`)
- **Lines 6–16 (HTML & Body)**:
  - `html, body { overflow-x: hidden; }` is properly configured.
  - `img, svg, canvas { max-width: 100%; }` is properly configured.
- **Lines 90–97 (Blanket 44px Touch Targets)**:
  - **Current Rule**:
    ```css
    @media (max-width: 640px) {
      button, a, [role="button"] {
        min-height: 44px;
        min-width: 44px;
      }
    }
    ```
  - **Problem**: Forcing `min-width: 44px` unconditionally breaks segmented controls, inline tag pills, zoom control buttons (Zoom In / Out / Reset), and icon buttons inside compact table rows.
  - **Fix**:
    - Restructure touch targets to use padding or touch target pseudo-elements (`::after { content: ''; position: absolute; inset: -6px; }`) or scope `min-h-[44px] min-w-[44px]` to primary buttons, while allowing grouped segmented pills / tag chips to size naturally (`min-w-0`) with at least 44px height for easy tapping.

---

### C. Authentication Views (`src/components/auth/`)
- **`CreateAccountView.tsx` & `SignInView.tsx`**:
  - Card wrapper: `className="w-full max-w-md mx-auto bg-white border border-canvas-border rounded-2xl p-6 shadow-sm"`
  - Inputs have `min-h-[44px]` and buttons have `min-h-[44px]`.
  - **Improvement**: Change padding from static `p-6` to responsive `p-4 sm:p-6` to avoid pinching form content on 320px screens.

---

### D. Common Tools & Dialogs (`src/components/common/`)
- **`WebMCPInspector.tsx` (Lines 200–210)**:
  - Modal container: `className="bg-white border border-canvas-border rounded-2xl w-full max-w-5xl h-[85vh] max-h-[90vh] shadow-2xl flex flex-col text-slate-900 overflow-hidden my-auto mx-0 sm:mx-4"`
  - Filter by Module: `flex items-center gap-1.5 flex-wrap` (9 buttons).
  - Tabs: `overflow-x-auto scrollbar-none flex-nowrap` with 44px height.
  - Fix: Ensure tab buttons and filter buttons stack or scroll without overflow on 320px.
- **`QuestionBank.tsx` (Lines 85–150)**:
  - Responsive padding: `p-3 sm:p-6`, `max-h-[90vh] overflow-y-auto`.
  - Form input and priority dropdown stack responsively with `flex flex-col sm:flex-row gap-2`.
- **`PrivacyBadge.tsx` (Lines 96–165)**:
  - Modal container has `p-3 sm:p-6 max-h-[90vh] overflow-y-auto`.
  - 3 metric cards in `grid grid-cols-3 gap-3`. On 320px, text is tight. Change to `grid grid-cols-3 gap-1.5 sm:gap-3`.
- **`ToastContainer.tsx` (Lines 58–84)**:
  - Position: `fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 z-50`.
  - Sits above bottom navbar on mobile.

---

### E. Module 0: Vault (`src/components/vault/`)
- **`DocumentDropzone.tsx` (Lines 125–170)**:
  - Responsive dropzone with `role="button"` and 44px browse button.
  - Text labels wrap cleanly on 320px.
- **`FactStreamView.tsx` (Lines 133–147)**:
  - Category filter: `overflow-x-auto scrollbar-none`.
- **`FactApprovalCard.tsx` (Lines 160–186)**:
  - Action buttons (`Approve`, `Edit`, `Reject`) in `flex items-center gap-2 pt-1`.
  - On 320px screen: tight. Use `flex-wrap sm:flex-nowrap gap-1.5` so buttons remain clickable and do not clip.

---

### F. Module 1: LabStory (`src/components/labstory/`)
- **`LabStoryView.tsx`**:
  - Modal on line 441 (Ingestion dropzone) lacks `max-h-[90vh] overflow-y-auto`.
  - Modal on line 514 (Manual lab entry) lacks `max-h-[90vh] overflow-y-auto`.
  - Close buttons on lines 450 and 527 use `p-1 rounded-lg` (~20px). Need `min-h-[44px] min-w-[44px] flex items-center justify-center`.
  - Longitudinal history table on line 368 has `overflow-x-auto -mx-1`.
- **`BiomarkerChart.tsx`**:
  - SVG uses responsive `viewBox="0 0 900 340"` with `w-full h-auto`.
  - Dual range toggles & zoom buttons in header: on 320px, wrap onto multiple lines cleanly with `flex flex-wrap gap-2`.

---

### G. Module 2: PillMap (`src/components/pillmap/`)
- **`PillboxGrid.tsx`**:
  - 7x4 table is wrapped in `overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none` with `min-w-[720px]`.
  - Arc overlay is hidden on `<sm` (`hidden sm:block`) to avoid visual clipping/clutter on small screens.
- **`AddMedicationModal.tsx`**:
  - Container on line 106 lacks `max-h-[90vh] overflow-y-auto`.
  - Name & Dose inputs on line 129: `grid grid-cols-2 gap-3` -> Change to `grid grid-cols-1 sm:grid-cols-2 gap-3`.
  - Daily Time Slots on line 178: `grid grid-cols-4 gap-2` -> Change to `grid grid-cols-2 sm:grid-cols-4 gap-2`.
  - Food instructions on line 204: `grid grid-cols-2 gap-2` -> Change to `grid grid-cols-1 sm:grid-cols-2 gap-2`.
- **`AdherenceSimulatorModal.tsx`**:
  - Container on line 65 lacks `max-h-[90vh] overflow-y-auto`.
- **`PharmacistExportModal.tsx`**:
  - Header controls on line 36 crowd on mobile (`flex items-center justify-between` with title + Copy + Print + Close). Use `flex-col sm:flex-row gap-3`.
  - Crosswalk table on line 96 has `overflow-hidden` -> Change to `overflow-x-auto`.
- **`ReminderConfigModal.tsx`**:
  - Container on line 45 lacks `max-h-[90vh] overflow-y-auto`.
  - Time input rows on lines 76–120: `flex items-center justify-between` -> Change to `flex flex-col sm:flex-row sm:items-center justify-between gap-2`.
- **`ShiftPreviewModal.tsx`**:
  - Container on line 30 lacks `max-h-[90vh] overflow-y-auto`.
- **`MealBadges.tsx`**:
  - Modal on line 187 lacks `max-h-[90vh] overflow-y-auto`.
  - Close button on line 195 is `p-1 rounded-lg` -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
- **`SVGArcOverlay.tsx`**:
  - Modal on line 249 lacks `max-h-[90vh] overflow-y-auto`.
  - Close button on line 281 is `p-1 rounded-lg` -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
- **`SimpleElderView.tsx`**:
  - Header on line 130 has title + time + note and "Read Aloud" button in a row -> Change to `flex flex-col sm:flex-row sm:items-start justify-between gap-4`.

---

### H. Module 3: RxBridge (`src/components/rxbridge/`)
- **`ThreeListTable.tsx`**:
  - Comparative 6-column table is enclosed in `overflow-x-auto rounded-xl border`.
  - Filter tabs on line 115 use `flex flex-wrap items-center gap-1.5`.
- **`SummaryExportModal.tsx`**:
  - Header action bar on line 58 has Language select + Print + Export JSON + Close in a single row. Change to responsive wrapping.
  - Close button on line 104 is `p-1.5 rounded-xl` (~24px) -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
  - Schedule cards on line 185 use `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`.
- **`TeachBackModal.tsx`**:
  - Close button on line 90 lacks `min-h-[44px] min-w-[44px] flex items-center justify-center`.

---

### I. Module 4: HomeLab (`src/components/homelab/`)
- **`UploadLabModal.tsx`**:
  - Extracted biomarker grid on lines 275 and 293 uses `grid grid-cols-3 gap-3` -> Change to `grid grid-cols-1 sm:grid-cols-3 gap-3`.
- **`DueCardList.tsx`**:
  - Due cards use responsive `grid grid-cols-1 md:grid-cols-2 gap-4`.
- **`ProposalCard.tsx`**:
  - Dosage comparison cards stack cleanly. Action buttons (Approve / Reject) meet 44px target.

---

### J. Module 5: Safety (`src/components/safety/`)
- **`DangerSignModal.tsx`**:
  - Close button on line 154 is `w-8 h-8` (32px) -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
  - Emergency callout banner on line 162: `flex items-center justify-between gap-4` -> Change to `flex flex-col sm:flex-row sm:items-center justify-between gap-3`.
- **`FollowupScheduler.tsx`**:
  - Close button on line 116 is `w-8 h-8` (32px) -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
  - Appointment mode buttons on line 127: `grid grid-cols-2 gap-3` -> Change to `grid grid-cols-1 sm:grid-cols-2 gap-3`.
  - Timing options on line 159: `grid grid-cols-4 gap-2` -> Change to `grid grid-cols-2 sm:grid-cols-4 gap-2`.

---

### K. Module 6: CareCircle (`src/components/carecircle/`)
- **`CareCircleView.tsx`**:
  - Sub-navigation tabs on line 118: add `overflow-x-auto scrollbar-none` wrapper to prevent overflow.
- **`ScopedPermissionsModal.tsx`**:
  - Close button on line 150 is `w-8 h-8` (32px) -> Change to `min-h-[44px] min-w-[44px] flex items-center justify-center`.
- **`CaregiverSwitcher.tsx`**:
  - Profile switcher button row on line 81 has 3 buttons with long text in a non-wrapping row -> Change to `flex flex-wrap gap-1.5` or `overflow-x-auto scrollbar-none`.

---

### L. Module 7: Dossier (`src/components/dossier/`)
- **`DossierView.tsx`**:
  - Sub-tabs on line 258: `flex items-center bg-canvas-card p-1 rounded-xl border text-body-sm w-fit` has 4 buttons (~380px) -> Add `overflow-x-auto scrollbar-none max-w-full`.
- **`DoctorAccessModal.tsx`**:
  - Duration window on line 172 uses `grid grid-cols-3 gap-2` with long text -> Change to `grid grid-cols-1 sm:grid-cols-3 gap-2`.
- **`DossierExportModal.tsx`**:
  - Format selector cards on line 158 use `grid grid-cols-3 gap-3` -> Change to `grid grid-cols-1 sm:grid-cols-3 gap-3`.
- **`SourceLinkViewer.tsx`**:
  - Document sheet on line 215 uses `p-8` -> Change to `p-4 sm:p-8`.

---

## 5. Summary of Recommended Fix Strategy

1. **Header & Navigation Refinement**:
   - Condense header action bar for mobile widths (<640px).
   - Add active-tab auto-centering and scroll gradient masks to the mobile bottom navigation bar.
   - Use concise mobile navigation labels to avoid text clipping.

2. **Modal Architecture Uniformity**:
   - Ensure every modal dialog container has `max-h-[90vh] overflow-y-auto` and responsive padding `p-4 sm:p-6`.
   - Upgrade every modal close button to `min-h-[44px] min-w-[44px] flex items-center justify-center` with accessible aria-label.

3. **Responsive Grid Normalization**:
   - Replace fixed `grid-cols-3` and `grid-cols-4` layouts in narrow cards and modals with responsive breakpoints (`grid-cols-1 sm:grid-cols-3`, `grid-cols-2 sm:grid-cols-4`).
   - Wrap all tables and wide segmented pill rows in `overflow-x-auto scrollbar-none`.

4. **Global CSS Tuning**:
   - Ensure touch target sizing rules in `src/index.css` enforce $\ge 44\text{px}$ tap height without breaking inline buttons or distorting segmented controls and zoom strips.
