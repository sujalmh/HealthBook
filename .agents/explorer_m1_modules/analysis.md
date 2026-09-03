# Technical Investigation: 8-Module Mobile Responsiveness & Layout Defect Audit (320px–430px)

**Agent**: Explorer 2 (`teamwork_preview_explorer`)  
**Workspace**: `/Users/sujal/Projects/proj1`  
**Working Directory**: `/Users/sujal/Projects/proj1/.agents/explorer_m1_modules`  
**Target Viewports**: 320px (iPhone SE 1st gen), 375px (iPhone SE 2nd/3rd gen, iPhone mini), 390px–393px (iPhone 12/13/14/15), 414px–430px (iPhone Plus/Pro Max)

---

## 1. Executive Summary

This investigation is an exhaustive, component-by-component audit across all 8 Healthbook modules (**Vault**, **LabStory**, **PillMap**, **RxBridge**, **HomeLab**, **Safety & Alerts**, **CareCircle**, **Dossier**), the application Shell/Header, and Authentication screens.

### Core Architectural Findings:
1. **The Global 44px Min-Width Blast Radius (`src/index.css`)**:
   - Rule `button, a, [role="button"] { min-height: 44px; min-width: 44px; }` at `@media (max-width: 640px)` forces **every** button to be at least 44px wide.
   - **Catastrophic Impact**: Meal badges inside compact pill cards (`MealBadges.tsx`), icon buttons, zoom controls (`BiomarkerChart.tsx`, `BoundingBoxViewer.tsx`, `SourceLinkViewer.tsx`), and inline fact approval actions (`FactApprovalCard.tsx`) balloon to 44px square minimum, causing severe horizontal overflow, distorted aspect ratios, and awkward wrapping across all modules.
2. **Desktop-First Multi-Column Grids Without Small-Screen Fallbacks**:
   - Instances of `grid-cols-2`, `grid-cols-3`, `grid-cols-4`, and `grid-cols-6` without `grid-cols-1 sm:grid-cols-X` cause inputs, cards, and modal options to shrink to under 70px–90px on 320px screens.
3. **Fixed Modal Padding Consuming 30%–40% of Viewport**:
   - Multiple modal dialogs use `p-6` or `p-8` unconditionally. On a 320px viewport, `p-8` (64px total horizontal padding) plus 32px screen margin leaves only **224px** for content.
4. **Header Action Strip & Filter Overflow**:
   - Action bars configured with `flex items-center justify-between` or fixed `flex gap-2` collide on mobile, forcing buttons off-screen or creating unscrollable overflow.
5. **Fixed SVG ViewBoxes & Micro-Typography**:
   - `BiomarkerChart.tsx` uses a fixed `viewBox="0 0 900 340"`. On a 320px screen width, 9px–10px axis labels scale down to ~2.8px physical rendering, rendering text unreadable and tooltips clipped.

---

## 2. Systemic Root Causes & Design Flaws

| Category | Root Cause | Impact Across Modules | Recommended Architecture |
|---|---|---|---|
| **Global CSS** | Blanket `min-width: 44px` on all `<button>` elements in `@media (max-width: 640px)` (`src/index.css:92-97`) | Breaks inline badges (`MealBadges.tsx`), icon buttons, chart zoom buttons, stepper pills, and action rows. | Replace with `.touch-target-44` utility or scope `min-w-[44px]` strictly to primary CTA buttons, exempting inline text badges and compact icon groups. |
| **Modals** | Fixed `p-6 sm:p-8` and `max-h-[90vh]` without mobile-adapted padding | At 320px–375px, modal interiors lose up to 64px to padding, crushing form inputs into illegible slivers. | Standardize to `p-4 sm:p-6` or `p-3 sm:p-6`, with `max-h-[92dvh]` and `overflow-y-auto`. |
| **Grid Systems** | Direct `grid-cols-2` or `grid-cols-3` without `grid-cols-1 sm:...` | Form fields (e.g. `AddMedicationModal.tsx:129`, `DoctorInbox.tsx:253`, `UploadLabModal.tsx:293`) get squished to <100px. | Use `grid-cols-1 sm:grid-cols-2` or `grid-cols-1 sm:grid-cols-3`. |
| **Action Bars** | `flex items-center justify-between` without `flex-wrap` or `flex-col sm:flex-row` | Top bar title + actions, proposal approvals, and export modal headers collide and cause horizontal scrollbar on body. | Use `flex flex-col sm:flex-row sm:items-center justify-between gap-3`. |
| **Sub-Tabs** | Fixed `w-fit` or `flex gap-1.5` containers without horizontal scroll | CareCircle, Dossier, and Safety sub-navigation tabs clip off right edge at 320px. | Wrap all sub-tab strips in `overflow-x-auto scrollbar-none pb-1`. |
| **SVG Charts** | Fixed 900px SVG coordinate space without mobile viewBox adaptation | Text labels in `BiomarkerChart.tsx` render at ~2.8px; floating tooltip overflows right edge. | Use responsive SVG aspect ratio or dedicated compact mobile summary view. |

---

## 3. Module-by-Module Technical Audit (All 8 Modules + Shell + Auth)

---

### Module 1: Vault (`src/components/vault/` & `src/components/common/`)

#### 1. `FactApprovalCard.tsx`
- **Location**: Lines 118–138 (Edit Mode) & Lines 161–186 (Action Bar).
- **Defects at 320px–375px**:
  - In inline edit mode (Line 118), `flex items-center gap-2` puts Fact Name and Value inputs side-by-side with Save/Cancel buttons. On 320px, inputs shrink to <60px width.
  - Action button row (Lines 161–186) uses `flex items-center justify-between gap-3`. The "Approve Fact" and "Edit" / "Reject" buttons clip when labels are long or `min-width: 44px` is enforced.
- **Recommended Fix**:
  ```tsx
  // Edit mode: stack inputs and buttons on mobile
  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
    <input className="w-full sm:flex-1 ..." />
    <div className="flex items-center gap-2 justify-end">...</div>
  </div>
  ```

#### 2. `FactStreamView.tsx`
- **Location**: Lines 60–80 (Filter Tabs) & Lines 110–135 (Batch Action Bar).
- **Defects at 320px–375px**:
  - Filter chips row wraps across 3 lines awkwardly if padding is large.
  - Batch action bar ("Approve All 4 Pending Facts") takes full width; buttons need `w-full sm:w-auto`.

#### 3. `BoundingBoxViewer.tsx` (`src/components/vault/` & `src/components/common/`)
- **Location**: Lines 66–93 (Header Zoom & Page Controls) & Line 98 (Canvas Container).
- **Defects at 320px–375px**:
  - Header zoom control buttons collide with the document name and "Verified" badge.
  - `min-h-[380px]` canvas combined with modal padding creates excessive vertical scrolling on mobile viewports (<600px height).
- **Recommended Fix**:
  - Collapse zoom controls into compact pill group; reduce canvas `min-h-[380px]` to `min-h-[260px] sm:min-h-[380px]`.

#### 4. `QuestionBank.tsx` (`src/components/common/QuestionBank.tsx`)
- **Location**: Lines 70–95 (Header & Filter Tabs) & Line 180 (Add Question Input).
- **Defects at 320px–375px**:
  - Outer dialog and inner content both specify `overflow-y-auto max-h-[90vh]`, triggering double scrollbars on iOS Safari.
  - Priority filter chips ("All", "High Priority", "Medication Changes", "Lab Inquiries") wrap onto 3 jagged rows.

#### 5. `WebMCPInspector.tsx` & `PrivacyBadge.tsx` (`src/components/common/`)
- **Location**: Lines 120–160 (WebMCP tabs) & Lines 75–110 (Privacy stats).
- **Defects at 320px–375px**:
  - WebMCP Inspector tabs (Tools, Telemetry, Ingestion, Sandbox) overflow horizontally without scroll indicators.
  - JSON payload code blocks lack horizontal scroll wrapper, causing modal body blowout.

---

### Module 2: LabStory (`src/components/labstory/`)

#### 1. `BiomarkerChart.tsx`
- **Location**: Lines 224–261 (Header Controls), Lines 320–520 (SVG Chart), Lines 528–610 (Floating Tooltip).
- **Defects at 320px–430px**:
  - **SVG Micro-Typography**: `viewBox="0 0 900 340"` renders 9px date text and axis ticks at ~2.8px physical height on a 320px screen.
  - **Zoom Strip Wrapping**: Dual range buttons ("5 Years", "1 Year") + 5 zoom buttons ("1x", "1.5x", "2x", "Fit", "Reset") wrap into 3 disorganized rows.
  - **Tooltip Collision**: Floating tooltip `max-w-xs` (320px wide) positioned with `absolute top-4 right-4` covers the entire chart area on 320px–375px screens, preventing users from seeing the data point.
- **Recommended Fix**:
  - Add responsive SVG height or mobile label decimation.
  - Constrain tooltip width on mobile (`max-w-[200px] sm:max-w-xs text-xs`) and position it at bottom or top-center on small screens.
  - Make zoom buttons a scrollable strip (`overflow-x-auto`).

#### 2. `MedOverlayBands.tsx`
- **Location**: Lines 140–210 (Timeline Band Calculation & Rendering).
- **Defects at 320px–430px**:
  - On multi-year timelines, short medication episodes (e.g. 5-day antibiotic or held medication) calculate `width: ~2%`. At 320px width, 2% = 6.4px.
  - The drug name label and status tag inside the band overflow and overlap adjacent bands.
- **Recommended Fix**:
  - Set a `min-w-[48px]` for med bands with text truncation, or show an expandable drawer on touch.

#### 3. `CausalQueryPanel.tsx` & `StorySentence.tsx`
- **Location**: Lines 110–145 (Chips) & Lines 150–180 (Query Input).
- **Defects at 320px–430px**:
  - Causal query chips wrap awkwardly across multiple lines.
  - Search input with submit button inside fixed container wraps.

---

### Module 3: PillMap (`src/components/pillmap/`)

#### 1. `MealBadges.tsx`
- **Location**: Lines 85–140 (Badge Item Rendering).
- **Defects at 320px–430px**:
  - Rendered as `<button>` elements. Because of `src/index.css` forcing `min-width: 44px; min-height: 44px;` on all buttons, every single dietary badge ("🍽️ Take with Food", "🚫 Avoid Grapefruit") inside `PillCard` balloons into a massive 44px square block, breaking the card layout completely.
- **Recommended Fix**:
  - Render non-interactive badges as `<span>` or `<div>` and apply custom touch target sizing only when interactive modal trigger is active.

#### 2. `PillboxGrid.tsx` & `PillCard.tsx`
- **Location**: Lines 110–190 (Grid & Columns) & Lines 80–130 (Card Layout).
- **Defects at 320px–430px**:
  - 7x4 Weekly Grid requires horizontal scroll (`overflow-x-auto min-w-[700px]`). On 320px, users must scroll far horizontally.
  - `PillCard.tsx` action buttons (Delete, Move, Conflict Alert) collide with the medication name when 44px min-width is active.
- **Recommended Fix**:
  - Add Single-Day / All-Days toggle on mobile (already present in header, ensure default is single-day on <640px).
  - Ensure action buttons use compact flex styling with `shrink-0`.

#### 3. `ShiftPreviewModal.tsx`, `AdherenceSimulatorModal.tsx`, `PharmacistExportModal.tsx`, `AddMedicationModal.tsx`
- **Location**: Modals across `src/components/pillmap/`.
- **Defects at 320px–430px**:
  - `AddMedicationModal.tsx:129, 204`: Form fields in `grid-cols-2` squish dose and frequency inputs to <90px.
  - `PharmacistExportModal.tsx:60-100`: Header action buttons ("Copy JSON", "Print", "Close") collide with the title.
  - `PharmacistExportModal.tsx:150-200`: 5-column table lacks isolated `overflow-x-auto` wrapper, forcing entire modal to scroll horizontally.
- **Recommended Fix**:
  - Convert `grid-cols-2` in modal forms to `grid-cols-1 sm:grid-cols-2`.
  - Wrap multi-column tables in dedicated `overflow-x-auto` wrappers.

---

### Module 4: RxBridge (`src/components/rxbridge/`)

#### 1. `RxBridgeView.tsx`
- **Location**: Lines 337–365 (Metric Stats Strip) & Lines 372–405 (Toolbar).
- **Defects at 320px–430px**:
  - Metric strip uses `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`. On 320px, 2-column cards with long numbers and labels wrap onto 3 tall rows.
  - Toolbar with 4 action buttons ("Start Walkthrough", "Export Summary", "Add Question", "Filter") overflows horizontally.

#### 2. `ThreeListTable.tsx`
- **Location**: Lines 152–285 (Comparative Table).
- **Defects at 320px–430px**:
  - 6 columns with `min-w-[180px]`, `min-w-[160px]`, `min-w-[190px]`, `min-w-[220px]`, `min-w-[140px]` total ~900px width.
  - While it has `overflow-x-auto`, on mobile swipe, the table header lacks sticky first column ("Medication"), making it hard to track which row corresponds to which drug.
- **Recommended Fix**:
  - Add visual horizontal swipe indicator / affordance and consider collapsible card view for mobile.

#### 3. `ReconciliationWalk.tsx` & `TeachBackModal.tsx`
- **Location**: Lines 118–148 (Stepper Pills) & Lines 182–231 (3-List Visual Grid).
- **Defects at 320px–430px**:
  - Stepper pills strip `flex items-center gap-1.5 overflow-x-auto pb-2` functions well, but `TeachBackModal.tsx` sample chips wrap into tall vertical stacks.
  - `SummaryExportModal.tsx:58-109`: Header contains Language dropdown, Print button, Export JSON button, and Close button side-by-side; on 320px, this wraps into 3 rows and pushes the close button off-screen.

---

### Module 5: HomeLab (`src/components/homelab/`)

#### 1. `HomeLabView.tsx`
- **Location**: Lines 127–161 (View Mode Tabs).
- **Defects at 320px–430px**:
  - Tab strip ("My Tasks", "Doctor's View") with badges takes full width; on 320px, needs `flex-1` buttons for even touch targets.

#### 2. `DueCardList.tsx` & `ProposalCard.tsx`
- **Location**: `ProposalCard.tsx:236` (Before/After Comparison) & Lines 288–322 (Action Bar).
- **Defects at 320px–430px**:
  - `ProposalCard.tsx:288`: Action bar has "Ask Dr. Patel", "Reject Change", and "Approve on Behalf of Patient". On 320px, "Approve on Behalf of Patient" is very long (~240px wide alone), causing wrapping conflicts with the reject button.
- **Recommended Fix**:
  - Wrap action buttons in `flex flex-col sm:flex-row gap-2.5 w-full` with `w-full sm:w-auto` buttons.

#### 3. `UploadLabModal.tsx`
- **Location**: Lines 275–322 (Extracted Biomarkers Grid & Inline Edit Inputs).
- **Defects at 320px–430px**:
  - `grid grid-cols-3 gap-3` (Creatinine, eGFR, Potassium). In edit mode (Line 293), 3 text inputs side-by-side inside a 320px modal yield ~65px width per input, completely hiding values and unit labels.
- **Recommended Fix**:
  - Use `grid grid-cols-1 sm:grid-cols-3 gap-3`.

#### 4. `DoctorInbox.tsx`
- **Location**: Line 253 (Proposal Builder Form).
- **Defects at 320px–430px**:
  - `grid grid-cols-2 gap-3` for "Target Medication" and "Current Dose" shrinks input width to <100px.
- **Recommended Fix**:
  - Use `grid grid-cols-1 sm:grid-cols-2 gap-3`.

---

### Module 6: Safety & Alerts (`src/components/safety/`)

#### 1. `SafetyView.tsx`
- **Location**: Lines 100–141 (Emergency Trigger & Mode Tabs) & Lines 145–175 (Warning Banner).
- **Defects at 320px–430px**:
  - Red pulse "I need help now" button + 3 mode tabs ("What to do", "Doctor's Actions", "My Appointments") on the right side collide and wrap unpredictably.
  - Warning banner (Line 146) uses `flex items-center justify-between gap-4`; on 320px, text and "Review Actions" button collide.
- **Recommended Fix**:
  - Stack header controls on mobile: Emergency CTA full width at top, tabs scrollable below.
  - Use `flex-col sm:flex-row` on warning banner.

#### 2. `DangerSignModal.tsx`
- **Location**: Lines 161–177 (Emergency 911 Callout) & Lines 228–251 (Vitals 3-Input Strip).
- **Defects at 320px–430px**:
  - Emergency 911 Callout `flex items-center justify-between gap-4` squishes text next to the "Call 911" button on 320px.
  - Sys/Dia/HR `grid grid-cols-3 gap-2` inputs fit but need explicit `min-w-0` to avoid overflow.

#### 3. `FollowupScheduler.tsx` & `TriagePanel.tsx`
- **Location**: `FollowupScheduler.tsx:127` (Mode Buttons) & `TriagePanel.tsx:235` (Intervention Cards).
- **Defects at 320px–430px**:
  - `FollowupScheduler.tsx:127`: `grid grid-cols-2 gap-3` for In-Person vs Telehealth squishes button labels on 320px.
  - `TriagePanel.tsx`: 4 doctor intervention cards stack nicely (`grid-cols-1 md:grid-cols-2`), but action dispatch button text ("Dispatch Stop Order (doctor_remove_medication)") overflows button containers at 320px.
- **Recommended Fix**:
  - Shorten button labels on mobile (`text-xs truncate` or responsive label text).

---

### Module 7: CareCircle (`src/components/carecircle/`)

#### 1. `CareCircleView.tsx` & `CaregiverSwitcher.tsx`
- **Location**: `CareCircleView.tsx:118` (Sub-Navigation Tabs) & `CaregiverSwitcher.tsx:81` (Profile Switcher).
- **Defects at 320px–430px**:
  - Sub-navigation tabs ("Family List", "Everyone I Care For", "History") use `w-fit` without `overflow-x-auto`, causing right-side clipping at 320px.
  - Profile switcher banner (Line 119) with "Exit proxy mode" button collides with long proxy description text.
- **Recommended Fix**:
  - Wrap tab bar in `overflow-x-auto scrollbar-none`.
  - Use `flex-col sm:flex-row` for proxy banner.

#### 2. `MultiPatientDashboard.tsx` & `ScopedPermissionsModal.tsx`
- **Location**: `MultiPatientDashboard.tsx:136` (3-Count Grid) & `ScopedPermissionsModal.tsx:274` (3-Tier Selector).
- **Defects at 320px–430px**:
  - `ScopedPermissionsModal.tsx:274`: `grid grid-cols-3 gap-2` for permission tiers ("VIEW ONLY", "MANAGE", "FULL") causes text wrapping on "VIEW ONLY" at 320px.
  - `MultiPatientDashboard.tsx:136`: 3 status count boxes inside patient cards fit tightly; labels ("Danger alerts", "Due labs", "Proposals") need `text-[10px]` to avoid truncation.

---

### Module 8: Dossier (`src/components/dossier/`)

#### 1. `DossierView.tsx`
- **Location**: Lines 186–212 (Action Buttons), Lines 215–255 (Quick Metric Strip), Lines 258–305 (Sub-Tabs).
- **Defects at 320px–430px**:
  - Header has Refresh, "Share with doctor (X)", and "Download PDF" buttons. On 320px, they overflow the header card.
  - Quick metric strip `grid grid-cols-2 sm:grid-cols-4 gap-4`: on 320px, 2-column cards work, but icon + label layout gets tight.
  - Sub-navigation strip (4 tabs: Timeline, Emergency Card, Source Pages, Share Settings) clips on mobile without horizontal scroll.
- **Recommended Fix**:
  - Wrap sub-tabs in `overflow-x-auto scrollbar-none`.
  - Header actions: make Download PDF primary full-width, secondary buttons in icon strip.

#### 2. `DossierTimeline.tsx`
- **Location**: Lines 93–115 (Category Filter Pills) & Lines 131–157 (Timeline Spine & Bullet Anchors).
- **Defects at 320px–430px**:
  - Timeline spine margin `ml-4 sm:ml-6 pl-6 sm:pl-8` with bullet anchor `-left-[35px]`. On 320px screens, this indents event cards by ~48px, leaving only ~250px for event cards.
- **Recommended Fix**:
  - Tighten timeline padding on mobile: `ml-2 sm:ml-6 pl-4 sm:pl-8` and `-left-[25px] sm:-left-[43px]`.

#### 3. `EmergencySnapshotCard.tsx`
- **Location**: Lines 261–290 (Demographics Bar) & Lines 293–565 (Allergies, Labs, Meds Grid).
- **Defects at 320px–430px**:
  - Demographics bar `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4` renders 3 rows of 2 columns on 320px, which is clean.
  - Action buttons in header ("Copy", "Print 1-page card") need `w-full sm:w-auto`.

#### 4. `SourceLinkViewer.tsx`
- **Location**: Lines 147–205 (Page Switcher & Zoom Controls) & Line 211 (Viewport Container).
- **Defects at 320px–430px**:
  - Header control cluster (Page switcher, Zoom Out/In, Reset Zoom, Close) occupies ~260px, colliding with document title.
  - Viewport `min-h-[440px]` combined with modal header/footer exceeds mobile screen height (<600px).
- **Recommended Fix**:
  - Reduce viewport height to `min-h-[260px] sm:min-h-[440px] max-h-[50vh]`.
  - Wrap header controls with `flex-wrap`.

#### 5. `DoctorAccessModal.tsx` & `DossierExportModal.tsx`
- **Location**: `DoctorAccessModal.tsx:172` (Duration Presets) & `DossierExportModal.tsx:158` (Format Selector).
- **Defects at 320px–430px**:
  - `DossierExportModal.tsx:158`: `grid grid-cols-3 gap-3` for 3 format cards (PDF, FHIR, CSV) squeezes cards to ~80px width each, destroying card formatting on 320px.
  - `DossierExportModal.tsx:255`: FHIR action buttons ("Copy FHIR JSON", "Download FHIR R4 Bundle (.json)") side-by-side in `flex gap-3` overflow.
- **Recommended Fix**:
  - Use `grid grid-cols-1 sm:grid-cols-3 gap-3` for format selector.
  - Use `flex-col sm:flex-row` for FHIR action buttons.

---

### Application Shell & Header (`src/App.tsx`)

#### 1. Header Layout & Top Navigation
- **Location**: Lines 274–365.
- **Defects at 320px–375px**:
  - Top header contains: Logo/Brand, Profile Switcher (Mother / Child / Self), Question Bank button with badge, Activity Log button, and Sign Out button.
  - On a 320px screen, the profile switcher + 3 icon buttons take ~220px, colliding with the "Healthbook" logo and causing horizontal blowout.
- **Recommended Fix**:
  - Collapse secondary header actions into an overflow menu (`...`) or compact icon strip on `<640px`.

#### 2. Bottom Navigation Bar
- **Location**: Lines 455–489.
- **Defects at 320px–375px**:
  - 8 module tabs in bottom bar or module switcher strip. Ensure labels are truncated or icons-only on 320px screens with `min-w-0` to avoid horizontal scrollbar on the viewport.

---

### Auth Screens (`src/components/auth/`)

#### 1. `CreateAccountView.tsx` & `SignInView.tsx`
- **Location**: Entire components.
- **Status at 320px–430px**:
  - Well-structured with `max-w-md w-full mx-auto p-6`.
  - Recommendation: On 320px, reduce container padding from `p-6` to `p-4 sm:p-6` to provide more breathing room for inputs.

---

## 4. Comprehensive Defect & Fix Matrix

| Module | Component | Defect Description | Exact Code Location | Recommended Fix |
|---|---|---|---|---|
| **Global** | `src/index.css` | Blanket 44px min-width forces meal badges & icon buttons to square distortion | `src/index.css:92-97` | Replace blanket rule with `.touch-target-44` class or target only primary button selectors |
| **Shell** | `src/App.tsx` | Header actions (Profile, Question Bank, Activity, Sign Out) collide with logo | `src/App.tsx:280-360` | Stack or collapse into compact icon group on mobile |
| **Vault** | `FactApprovalCard.tsx` | Inline edit inputs & action buttons squished under 260px | `FactApprovalCard.tsx:118, 161` | Convert to `flex-col sm:flex-row` |
| **Vault** | `BoundingBoxViewer.tsx` | Zoom controls crowd header; canvas too tall for mobile viewport | `BoundingBoxViewer.tsx:66, 98` | Reduce canvas `min-h-[260px]`; wrap controls |
| **Vault** | `QuestionBank.tsx` | Double-scroll conflict; priority filter wraps jaggedly | `QuestionBank.tsx:75, 110` | Remove inner `max-h-[90vh]`; scrollable chip strip |
| **LabStory** | `BiomarkerChart.tsx` | Fixed 900px SVG coordinate space renders ~2.8px labels; tooltip covers chart | `BiomarkerChart.tsx:320, 528` | Decimate mobile labels; responsive tooltip positioning |
| **LabStory** | `MedOverlayBands.tsx` | Short episodes render at ~2% width (<7px), overlapping labels | `MedOverlayBands.tsx:140-210` | Add `min-w-[48px]` and text truncation |
| **PillMap** | `MealBadges.tsx` | Badge `<button>` elements balloon to 44px blocks inside `PillCard` | `MealBadges.tsx:85-140` | Render as `<span>` / `<div>` or exempt from 44px min-width |
| **PillMap** | `AddMedicationModal.tsx` | Form inputs in `grid-cols-2` squish text to <90px | `AddMedicationModal.tsx:129, 204` | Change to `grid-cols-1 sm:grid-cols-2` |
| **PillMap** | `PharmacistExportModal.tsx` | Header actions collide with title; 5-column table lacks scroll wrapper | `PharmacistExportModal.tsx:60, 150` | Wrap table in `overflow-x-auto`; wrap header actions |
| **RxBridge** | `RxBridgeView.tsx` | 6-stat metric cards and action toolbar wrap awkwardly | `RxBridgeView.tsx:337, 372` | Standardize `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` |
| **RxBridge** | `SummaryExportModal.tsx` | Language switcher + Print + JSON + Close cluster overflows header | `SummaryExportModal.tsx:58-109` | Wrap header controls; stack action buttons on mobile |
| **HomeLab** | `ProposalCard.tsx` | Action buttons ("Approve on Behalf...", "Ask", "Reject") wrap awkwardly | `ProposalCard.tsx:288-322` | Convert to `flex-col sm:flex-row gap-2.5` |
| **HomeLab** | `UploadLabModal.tsx` | 3-column extracted markers and inline edit inputs squished to ~65px | `UploadLabModal.tsx:275, 293` | Change to `grid-cols-1 sm:grid-cols-3` |
| **HomeLab** | `DoctorInbox.tsx` | Proposal builder inputs in `grid-cols-2` squish text | `DoctorInbox.tsx:253` | Change to `grid-cols-1 sm:grid-cols-2` |
| **Safety** | `SafetyView.tsx` | Emergency "I need help now" CTA + 3 tabs collide | `SafetyView.tsx:100-141` | Stack emergency CTA above scrollable tabs |
| **Safety** | `FollowupScheduler.tsx` | In-Person vs Telehealth buttons squished in `grid-cols-2` | `FollowupScheduler.tsx:127` | Change to `grid-cols-1 sm:grid-cols-2` |
| **Safety** | `TriagePanel.tsx` | Doctor action button labels overflow button boundaries | `TriagePanel.tsx:255, 279, 304` | Shorten mobile button text; add `truncate` |
| **CareCircle**| `CareCircleView.tsx` | Sub-navigation tabs clip off right edge at 320px | `CareCircleView.tsx:118` | Wrap in `overflow-x-auto scrollbar-none` |
| **CareCircle**| `ScopedPermissionsModal.tsx` | 3 permission tiers squished in `grid-cols-3` | `ScopedPermissionsModal.tsx:274` | Change to `grid-cols-1 sm:grid-cols-3` |
| **Dossier** | `DossierView.tsx` | Header actions (3 buttons) and sub-tabs (4 tabs) overflow | `DossierView.tsx:186, 258` | Make PDF primary CTA; wrap sub-tabs in scroll wrapper |
| **Dossier** | `DossierTimeline.tsx` | Timeline spine margin + bullet indents cards by 48px | `DossierTimeline.tsx:131, 154` | Tighten mobile margin to `ml-2 pl-4` |
| **Dossier** | `SourceLinkViewer.tsx` | Zoom/Page controls cluster crowds header; viewport too tall | `SourceLinkViewer.tsx:147, 211` | Wrap header controls; set `min-h-[260px]` |
| **Dossier** | `DossierExportModal.tsx` | Format selector (3 cards) squished in `grid-cols-3` | `DossierExportModal.tsx:158` | Change to `grid-cols-1 sm:grid-cols-3` |
| **Auth** | `CreateAccountView.tsx` | Modal padding `p-6` consumes excess space on 320px | `CreateAccountView.tsx:147` | Change to `p-4 sm:p-6` |

---

## 5. Architectural Recommendations for Implementation

1. **Global CSS Refactoring (`src/index.css`)**:
   - Change:
     ```css
     @media (max-width: 640px) {
       button:not(.badge-btn):not(.icon-btn):not(.inline-btn),
       a:not(.badge-link):not(.icon-btn),
       [role="button"]:not(.badge-btn) {
         min-height: 44px;
         min-width: 44px;
       }
     }
     ```
     Or target primary interactive action elements specifically to avoid breaking compact inline badges.
2. **Modal Standard**:
   - Container: `p-3 sm:p-6` or `p-4 sm:p-6`.
   - Max height: `max-h-[92dvh] overflow-y-auto`.
   - Action footers: `flex flex-col-reverse sm:flex-row sm:justify-end gap-2`.
3. **Multi-Column Forms**:
   - Replace all `grid-cols-2` or `grid-cols-3` in forms with `grid-cols-1 sm:grid-cols-2` or `grid-cols-1 sm:grid-cols-3`.
4. **Horizontal Tabs & Filter Strips**:
   - Standardize all sub-tab bars to: `<div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 w-full max-w-full">`.
