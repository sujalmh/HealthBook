# Comprehensive Mobile UI & Visual Defect Catalog (R1 Audit)

**Audit Target:** CareCanvas Mobile Application  
**Viewports Audited:** 320px (iPhone SE 1st Gen), 375px (iPhone SE 2/3, iPhone 8), 390px (iPhone 12/13/14), 414px (iPhone 11 / XR / Plus)  
**Date of Audit:** 2026-08-29  
**Auditor:** Explorer 3 (`teamwork_preview_explorer`)

---

## 1. Executive Summary

A comprehensive visual, structural, and layout discovery audit was conducted across all 8 clinical modules, authentication screens, global navigation bars, and 12+ modals/dialogs of the CareCanvas patient application across mobile phone viewports (320px–414px).

While CareCanvas provides clean typography and clinical contrast, several mobile layout anomalies and usability defects were uncovered:
1. **Header Crowding & Clipping (320px–375px):** The top navigation header packs logo, title, proxy switcher, question bank button, activity log button, and sign-out button into a single horizontal row (~315px content width), causing text clipping, wrapping, and crowding on 320px screens.
2. **Bottom Navigation Affordance:** 8 module tabs span ~560px requiring horizontal scrolling, but lack edge gradient fades or visual scroll affordance, leaving key modules (Get Help, Family, For My Doctor) hidden off-screen without obvious scroll cues.
3. **Horizontal Viewport Overflows (`overflow-x`):** Fixed sub-tab button strips in `DossierView.tsx` (~400px width) and `CareCircleView.tsx` (~320px width), as well as tables in `PharmacistExportModal.tsx` lack `overflow-x-auto`, pushing against right screen boundaries.
4. **Biomarker Chart & SVG Scaling on Mobile:** In `BiomarkerChart.tsx`, SVG text (font size 9–10px) is scaled down by ~3.2x when rendered inside a 280px mobile container, resulting in ~3px physical text that is illegible, while chart points (`r=6`) shrink to ~1.8px radius. In `MedOverlayBands.tsx`, short drug courses clamp to 2% width (6px wide on 300px mobile screens), cutting off drug labels.
5. **Modal Viewport Boundaries & Offscreen Actions:** Modals (`ShiftPreviewModal`, `AdherenceSimulatorModal`, `AddMedicationModal`, `UploadLabModal`, `DossierExportModal`, `DoctorAccessModal`) have side-by-side action buttons and lack vertical scroll containment (`max-h-[90vh] overflow-y-auto`), causing buttons to be cut off below the screen on short phone displays (320x568 / 375x667).
6. **Touch Target Standard Violations (< 44px):** 28+ interactive buttons, chips, filter tabs, and icons across all modules measure between 24px and 36px in height/width, violating the 44×44px minimum mobile tap target accessibility standard.

---

## 2. Visual Defect Matrix by Screen & Component

| ID | Module / Screen | Component | Viewports | Defect Classification | Detailed Description |
|---|---|---|---|---|---|
| **DEF-01** | Global Header | `src/App.tsx` | 320px, 375px | Header Button Crowding & Clipping | Right action bar (~181px) + logo area (~134px) = 315px width. On 320px screen (available 296px with padding), header items crowd, title squishes, and buttons wrap awkwardly. |
| **DEF-02** | Global Header | `src/App.tsx` | 320px–414px | Touch Target Sizing (<44px) | Proxy switcher buttons (`min-h-[32px]`), Question Bank button (`py-1.5`, ~28px), Activity button (`py-1.5`, ~28px), and Sign Out button (`min-h-[36px]`) fail the 44px minimum tap size. |
| **DEF-03** | Bottom Navigation | `src/App.tsx` | 320px–414px | Hidden Tabs & Text Truncation | 8 tabs require ~560px width. On mobile, tabs 5–8 (Tests to Do, Get Help, Family, For My Doctor) are hidden offscreen without visual gradient fade affordance. Labels have `max-w-[64px] truncate` causing awkward truncation ("Medicine Rev...", "For My Doc..."). |
| **DEF-04** | Module 0: Vault | `src/components/vault/FactStreamView.tsx` | 320px–414px | Touch Target Sizing (<44px) | Category filter buttons have `min-h-[32px]` with tight padding. |
| **DEF-05** | Module 0: Vault | `src/components/vault/FactApprovalCard.tsx` | 320px–414px | Touch Target Sizing (<44px) | "View Source" button has `min-h-[28px]`, edit mode Save/Cancel buttons have `min-h-[40px]`. |
| **DEF-06** | Module 1: LabStory | `src/components/labstory/BiomarkerChart.tsx` | 320px, 375px | SVG Illegibility & Squeezed Controls | Fixed `viewBox="0 0 900 340"` renders 9–10px text at ~3px physical size on 280px mobile containers. Dual range toggles and 5 zoom buttons wrap into 4 stacked lines. Chart points (`r=6`) scale to ~1.8px radius. |
| **DEF-07** | Module 1: LabStory | `src/components/labstory/MedOverlayBands.tsx` | 320px, 375px | Short Band Truncation & Touch Target | Short drug courses clamp to 2% width (6px wide on 300px screen), text inside overflows and is clipped. Legend toggles have `min-h-[28px]`, dismiss button `min-h-[32px]`. |
| **DEF-08** | Module 1: LabStory | `src/components/labstory/CausalQueryPanel.tsx` | 320px–414px | Touch Target Sizing (<44px) | Suggested query chips have `min-h-[32px]`, "Add to Question Bank" button has `min-h-[40px]`. |
| **DEF-09** | Module 2: PillMap | `src/components/pillmap/PillboxGrid.tsx` | 320px, 375px | Horizontal Disorientation & SVG Conflict Hidden | 7x4 table has `min-w-[720px]`. Requires extensive horizontal panning across 8 columns. SVG conflict arcs are hidden (`hidden sm:block`) on mobile without a mobile-friendly conflict line summary. |
| **DEF-10** | Module 2: PillMap | `src/components/pillmap/PillCard.tsx` | 320px–414px | Compact Action Tap Target (<44px) | Simulation (HelpCircle) and Remove (Trash2) icon buttons have `p-1.5` (~24px tap area), causing mis-taps. |
| **DEF-11** | Module 2: PillMap | `src/components/pillmap/SimpleElderView.tsx` | 320px | Header Flex Wrap & Squished Voice Button | Header flex container has title + time badge + "Read Aloud" button in a single row without wrapping, squishing the voice button on 320px screens. |
| **DEF-12** | Module 2: PillMap | `src/components/pillmap/ShiftPreviewModal.tsx` | 320px, 375px | Footer Button Wrapping & Overflow | "Keep Current Schedule" and "Approve & Apply Schedule Shifts" are side-by-side in `flex justify-between gap-4`, overflowing or wrapping awkwardly on 320px–375px screens. |
| **DEF-13** | Module 2: PillMap | `src/components/pillmap/AdherenceSimulatorModal.tsx` | 320px–414px | Modal Height Overflow & Side-by-Side Buttons | Dialog container lacks `max-h-[90vh] overflow-y-auto`. On 320x568 screen, modal extends past 600px, cutting off action buttons off-screen. Footer buttons lack mobile column stacking. |
| **DEF-14** | Module 2: PillMap | `src/components/pillmap/AddMedicationModal.tsx` | 320px–390px | Modal Height Overflow | Modal container has fixed height without `max-h-[90vh] overflow-y-auto`. On screens < 620px height, bottom "Add to Pillbox" button is pushed below the screen. |
| **DEF-15** | Module 2: PillMap | `src/components/pillmap/PharmacistExportModal.tsx` | 320px, 375px | Header Crowding & Table Overflow | Top bar has 3 action buttons + title in single row. Regimen crosswalk table lacks `overflow-x-auto`, causing 5-column table to overflow modal on mobile. |
| **DEF-16** | Module 3: RxBridge | `src/components/rxbridge/RxBridgeView.tsx` | 320px, 375px | Touch Target Sizing (<44px) | View mode toggle buttons (Compare Lists vs Step-by-Step) have `px-3 py-1.5` (~28px height). |
| **DEF-17** | Module 3: RxBridge | `src/components/rxbridge/ThreeListTable.tsx` | 320px–414px | Action Column Tap Sizing (<44px) | Table action buttons (Review/Approve and Chevron) have `px-2.5 py-1.5` (~28px height). |
| **DEF-18** | Module 3: RxBridge | `src/components/rxbridge/SummaryExportModal.tsx` | 320px, 375px | Header Button Crowding & Tap Sizing | Language select + Print + Export JSON + Close button in a single row wrap and crowd on 320px viewports. Buttons have `py-1.5` (~28px height). |
| **DEF-19** | Module 4: HomeLab | `src/components/homelab/UploadLabModal.tsx` | 320px, 375px | 3-Column Biomarker Squishing | Extracted biomarkers and edit form inputs use `grid-cols-3 gap-3`, resulting in <75px column widths on 320px mobile screens, causing text squishing and number truncation. |
| **DEF-20** | Module 5: Safety | `src/components/safety/SafetyView.tsx` | 320px, 375px | Tab Bar Stacking & Touch Target | "I need help now" + 3 tabs ("What to do", "Doctor's Actions", "My Appointments") stack awkwardly on 320px screens. Tab buttons have `px-3.5 py-1.5` (~28px height). |
| **DEF-21** | Module 5: Safety | `src/components/safety/DangerSignModal.tsx` | 320px–414px | Close & Action Button Tap Sizing | Top close button is `w-8 h-8` (32px), footer Cancel button is `px-4 py-2` (32px). Vitals 3-column input (`Sys`, `Dia`, `HR bpm`) squishes on 320px. |
| **DEF-22** | Module 6: CareCircle | `src/components/carecircle/CareCircleView.tsx` | 320px | Sub-Tab Overflow-X Without Scroll | Sub-tab container with "Family List", "Everyone I Care For", "History" (~320px width) lacks `overflow-x-auto`, pushing right margin on 320px screens. |
| **DEF-23** | Module 6: CareCircle | `src/components/carecircle/ScopedPermissionsModal.tsx` | 320px–414px | Close Button Tap Sizing (<44px) | Top close button is `w-8 h-8` (32px, below 44px). |
| **DEF-24** | Module 7: Dossier | `src/components/dossier/DossierView.tsx` | 320px–390px | Sub-Tab Horizontal Overflow | Sub-tab bar with 4 tabs ("Timeline", "Emergency Card", "Source Pages", "Share Settings") spans ~400px width without `overflow-x-auto`, causing sideways page overflow or right tab clipping on phone screens. |
| **DEF-25** | Module 7: Dossier | `src/components/dossier/DoctorAccessModal.tsx` | 320px, 375px | 3-Column Duration Preset Squishing | Duration buttons ("7 Days (Standard)", "30 Days (Follow-up)", "1 Year (Primary Care)") in `grid-cols-3` squish into ~85px boxes on 320px screens. |
| **DEF-26** | Module 7: Dossier | `src/components/dossier/DossierExportModal.tsx` | 320px, 375px | 3-Column Format Card Squishing & Button Overflow | Format selector cards ("Doctor Consultation PDF", "FHIR R4 Bundle", "Tabular CSV Archive") in `grid-cols-3` squish into ~85px boxes. In FHIR mode, two wide action buttons side-by-side overflow modal. |
| **DEF-27** | Common | `src/components/common/QuestionBank.tsx` | 320px–414px | Filter Chips Tap Sizing (<44px) | Module filter chips have `min-h-[32px]`. |
| **DEF-28** | Common | `src/components/common/BoundingBoxViewer.tsx` | 320px–414px | Zoom Controls Tap Sizing (<44px) | Zoom In/Out and Reset buttons have `min-h-[32px] min-w-[32px]`. |

---

## 3. Viewport-by-Viewport Breakdown

### Viewport 320px (iPhone SE 1st Gen, Small Androids)
- **Top Header:** Severe crowding. Proxy switcher + Question button + Activity button + Sign out button exceed width of header.
- **Dossier & CareCircle Sub-Tabs:** 4 tabs (~400px) and 3 tabs (~320px) overflow horizontally.
- **Biomarker Chart:** SVG text scales down to 3px physical size. Dual range toggles wrap onto 3 lines.
- **Modals:** Side-by-side buttons in `ShiftPreviewModal`, `AdherenceSimulatorModal`, and `DossierExportModal` wrap and overflow modal padding. `AddMedicationModal` bottom buttons cut off without `max-h-[90vh] overflow-y-auto`.
- **UploadLabModal:** 3-column extracted lab values squish into <75px boxes.

### Viewport 375px (iPhone SE 2nd/3rd Gen, iPhone 6/7/8)
- **Bottom Navbar:** Tabs 6–8 (Get Help, Family, For My Doctor) are offscreen without visual scroll gradient hints.
- **Dossier Sub-Tabs:** 4 tabs (~400px) exceed 375px viewport and clip the 4th tab ("Share Settings").
- **DossierExportModal:** 3 format cards in `grid-cols-3` squish multi-line descriptions.
- **Medication Bands:** Short 14-day medication courses clamp to 2% width (7.5px), cutting off text.

### Viewport 390px (iPhone 12 / 13 / 14 / 15 Standard)
- **Header:** Fits comfortably, but proxy switcher and action buttons have touch targets under 44px.
- **Bottom Navbar:** First 5 tabs visible, last 3 tabs require horizontal scrolling.
- **Dossier Sub-Tabs:** Tight fit (~400px on 390px screen with padding).
- **Modals:** Modal content fits within width, but vertical height on keyboard open or small modal needs `max-h-[90vh] overflow-y-auto`.

### Viewport 414px (iPhone 11 / XR / Plus / Max)
- **Layout containment:** Main layout grids fit well, but touch targets across all modules still measure 24px–36px.
- **Biomarker Chart:** SVG points and text remain small compared to desktop view.

---

## 4. Blueprint for Implementation Fixes

### 1. Top Header (`src/App.tsx`)
- On `< 640px` (mobile), make header clean and compact:
  - Collapse text labels on mobile: keep icon + compact badge for Question Bank and Activity log.
  - Ensure all header buttons have minimum `min-h-[44px] min-w-[44px]` (or accessible padding) with rounded corners.
  - Simplify proxy switcher on mobile: show clear initial token with >=44px tap target.

### 2. Bottom Navigation (`src/App.tsx`)
- Add subtle left and right fade masks (`mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)`) or responsive condensed icon+label presentation.
- Ensure all 8 nav items have minimum 44×44px tap target with active ring/token.
- Adjust labels to avoid truncation (e.g. "Review", "Doctor", "Meds").

### 3. Sub-Tab Containers (`DossierView.tsx`, `CareCircleView.tsx`)
- Add `overflow-x-auto scrollbar-none max-w-full` to sub-tab wrappers so they scroll smoothly without pushing page boundaries.

### 4. Biomarker Chart & SVG Overlays (`BiomarkerChart.tsx`, `MedOverlayBands.tsx`)
- On mobile, adjust SVG viewBox or responsive chart height, increase font sizes for mobile view, and enlarge tap hit areas for data points (`r=12` transparent hit target over `r=5` visual circle).
- In `MedOverlayBands.tsx`, provide minimum visual width (`min-w-[48px]`) or mobile list-expanded view for short-duration medications.
- Make chart range toggles and zoom buttons flex-wrap cleanly with >=44px touch targets.

### 5. Modals & Dialogs
- In all modals (`ShiftPreviewModal`, `AdherenceSimulatorModal`, `AddMedicationModal`, `UploadLabModal`, `DossierExportModal`, `DoctorAccessModal`, `SummaryExportModal`, `DangerSignModal`):
  - Add `max-h-[90vh] overflow-y-auto` to the modal container.
  - Make footer action buttons `flex-col-reverse sm:flex-row sm:justify-end gap-2` with `w-full sm:w-auto` and `min-h-[44px]`.
  - In `UploadLabModal.tsx` and `DoctorAccessModal.tsx`, change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` on mobile.
  - In `DossierExportModal.tsx`, change format cards from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`.
  - Ensure all close buttons (`X`) have `min-h-[44px] min-w-[44px]`.

### 6. 7x4 Pillbox Grid (`PillboxGrid.tsx`, `PillCard.tsx`)
- In `PillboxGrid.tsx`, add a clear mobile day-switcher or smooth horizontal swipe container with visible scroll indicator.
- In `PillCard.tsx`, ensure action buttons (Simulate, Remove) have minimum 44px touch hit area or dedicated dropdown menu on mobile.

---

## 5. Conclusion & Verification

This defect catalog covers 28 specific visual, structural, and interaction defects across 18 source files. Applying the blueprint will ensure CareCanvas meets the highest standards for mobile ergonomics, WCAG 2.2 touch target criteria (>=44×44px), zero horizontal overflow, and crystal-clear clinical readability on all mobile phones.
