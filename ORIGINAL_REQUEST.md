# Original User Request

## 2026-08-29T16:44:31Z

This is a single self-contained fix; keep it small and focused. Perform an end-to-end mobile UI overhaul of CareCanvas driven by live visual inspection. First, start the application and systematically capture live mobile viewport screenshots across every screen, module, subview, modal, drawer, and interactive state on phone viewports (320px–430px). Conduct an exhaustive visual audit of these images to discover all layout defects—including hidden/clipped buttons, menu bar crowding, horizontal overflows, weirdly sized sections, awkward navigation, squished charts, and broken typography—and fix every issue found without restricting scope.

Working directory: /Users/sujal/Projects/proj1
Integrity mode: development

## Requirements

### R1. Systematic Live Mobile Screenshot Discovery Audit
Spin up the local dev/preview server and run automated browser screenshot capture across all screens, subviews, and modals at mobile resolutions (320px, 375px, 390px, 414px). Inspect every captured image to uncover and catalog all mobile layout defects (e.g., header button clipping, navigation awkwardness, overflowing sections, distorted charts, table wrapping errors, unreadable text, cut-off buttons).

### R2. Comprehensive Fixes for All Discovered Mobile Issues
Fix every visual, structural, and UX issue identified during the mobile screenshot audit across the entire codebase. Do not restrict fixes only to initial examples; resolve all layout and styling anomalies including:
- Top header responsiveness & mobile menu / overflow actions
- Condensed bottom navigation bar with clear active states and >=44px tap targets
- Viewport containment and elimination of horizontal overflow (`overflow-x`) across all modules (Vault, LabStory, PillMap, RxBridge, HomeLab, Safety, CareCircle, Dossier, and Auth gates)
- Biomarker charts, timeline graphs, pill grids, proposal cards, and data tables adapting fluidly to narrow screens
- Modals, drawers, and popups opening cleanly with responsive boundaries, accessible close triggers, and smooth vertical scrolling

### R3. Post-Fix Visual & Automated Verification
Re-capture mobile screenshots of every screen and modal after applying fixes to visually verify that all anomalies are resolved. Ensure all TypeScript checks (`npm run lint`), test suites (`npm run test`), and production builds (`npm run build`) pass cleanly.

## Acceptance Criteria

### Visual Discovery & Verification
- [ ] Initial live mobile screenshots captured and audited across all 8 modules, auth screens, and modals.
- [ ] Post-fix live mobile screenshots verify clean layout, proper alignment, and no cut-off elements across all screens on mobile viewports (320px–430px).
- [ ] No unintended horizontal scrolling (`overflow-x`) on any screen.
- [ ] All header and navigation actions accessible with minimum 44x44px touch targets.
- [ ] All modals, popups, and dialogs fit within the mobile viewport with working scroll and dismiss controls.

### Code Quality & Build
- [ ] TypeScript check (`npm run lint` / `npx tsc --noEmit`) passes with 0 errors.
- [ ] Test suite (`npm run test`) passes with 0 regressions.
- [ ] Production build (`npm run build`) succeeds.
