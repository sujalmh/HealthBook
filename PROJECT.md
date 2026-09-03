# Project: Healthbook — Agent-Native Patient-Facing Health Companion

## Architecture
Healthbook is a privacy-first, client-side web application and WebMCP agent environment.
All clinical knowledge and patient data reside locally in an append-only LocalVault (IndexedDB).
All 40 client-side cognitive and operational tools are registered via `document.modelContext.registerTool` (with a high-fidelity WebMCP mock fallback adapter for standard browsers).
The user interface features interactive, high-contrast accessible visual canvases:
- **PillMap**: 7x4 drag-and-drop weekly pillbox with real-time SVG conflict arcs and meal badges.
- **LabStory**: Longitudinal biomarker charts with medication timeline bands and causal query engine.
- **RxBridge**: 3-list post-discharge medication reconciliation walkthrough with plain-language teach-backs.
- **HomeLab Loop**: Prescribed lab due cards, photo uploads, and doctor dosage proposal cards.
- **Safety Alerts & Care Circle**: Danger sign triage, doctor remote pillbox adjustments, calendar sync, and audited caregiver proxy actions.
- **Continuity Dossier**: Lifetime compiled record with pan/zoom links to source PDF/image bounding boxes.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       Healthbook Web App                                       │
│                                                                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────────┐  │
│  │   Approved Fact Vault   │  │        LabStory         │  │            PillMap             │  │
│  │ (IndexedDB LocalVault)  │  │ (DuckDB/Canvas Charts)  │  │   (7x4 Accessible Pillbox)     │  │
│  │ • Narrated Extractions  │  │ • Multi-year Lab Drop   │  │ • Drag & Drop Placement        │  │
│  │ • Source Bounding Boxes │  │ • Unit Normalization    │  │ • Red/Orange SVG Conflict Arcs │  │
│  │ • Approve/Edit/Reject   │  │ • Med Overlay Bands     │  │ • Meal-time Badges & Plate Arcs│  │
│  │ • Central Question Bank │  │ • Causal Query Engine   │  │ • Chronotype Shift & Sim Adhere│  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └───────────────┬────────────────┘  │
│               │                            │                               │                   │
│  ┌────────────┴────────────┐  ┌────────────┴────────────┐  ┌───────────────┴────────────────┐  │
│  │        RxBridge         │  │  HomeLab & Safety Loop  │  │ Care Circle & Continuity Dossier│  │
│  │ • 3-List Reconciliation │  │ • Doctor Due Cards      │  │ • Scoped Caregiver Proxy (G1-G6)│  │
│  │ • Med-by-Med Walk       │  │ • Photo Upload & Notes  │  │ • Audited Proxy Actions        │  │
│  │ • Change Badges & Teach │  │ • Dosage Proposals      │  │ • Lifetime Compiled Record (CD)│  │
│  │ • Day 0 PillMap Handoff │  │ • Danger Triage & Cal   │  │ • Bounding Box Panning/Zooming │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └───────────────┬────────────────┘  │
│               └────────────────────────────┼───────────────────────────────┘                   │
│                                            ▼                                                   │
│                     ┌──────────────────────────────────────────────┐                           │
│                     │       WebMCP Core Engine & Event Bus         │                           │
│                     │ • 40 Registered WebMCP Tools (document/nav)  │                           │
│                     │ • Fallback Mock Adapter Polyfill             │                           │
│                     │ • In-App WebMCP Inspector & Approval Modal   │                           │
│                     │ • Reactive State Updates & Toast Animations  │                           │
│                     └──────────────────────────────────────────────┘                           │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F0.1 Narrated Extraction | Plain-language extraction + PDF/image bounding box highlight | M1 | FEATURES_CHECKLIST §0 |
| 2 | F0.2 Per-Fact Approval | Strict Approve / Edit / Reject per fact before vault commit | M1 | FEATURES_CHECKLIST §0 |
| 3 | F0.3 Unified Vault | 11-store append-only LocalVault (IndexedDB) with audit trail | M1 | FEATURES_CHECKLIST §0 |
| 4 | F0.4 Privacy Badge | Local-only privacy indicator and FHIR R4 export | M1 | FEATURES_CHECKLIST §0 |
| 5 | F0.5 Question Bank | Central auto-aggregation of doctor questions from all modules | M1 | FEATURES_CHECKLIST §0 |
| 6 | W0.1 WebMCP Engine | Registration via `document.modelContext.registerTool` + fallback polyfill | M1 | ORIGINAL_REQUEST R1 |
| 7 | W0.2 WebMCP Inspector | In-app 4-tab tool catalog, telemetry logger, playground, approval modal | M1 | FEATURES_CHECKLIST §9 |
| 8 | LS1 Multi-Doc Timeline Drop | Multi-year lab PDF/image drop, unit normalization, 10% buffer | M2 | FEATURES_CHECKLIST §1 |
| 9 | LS2 Timeline Visualization | Interactive biomarker charts, reference range band, 30D-5Y zoom | M2 | FEATURES_CHECKLIST §1 |
| 10 | LS3 Ask Why (correlate_meds)| Causal query engine correlating biomarker trends with med timing | M2 | FEATURES_CHECKLIST §1 |
| 11 | LS4 Med Overlay on Labs | Longitudinal colored med adherence bands on lab charts | M2 | FEATURES_CHECKLIST §1 |
| 12 | LS5 Reference vs Optimal | Dual range toggles (lab reference vs evidence-based optimal) | M2 | FEATURES_CHECKLIST §1 |
| 13 | LS6 Story Sentence | Automated plain-language biomarker trajectory narrative | M2 | FEATURES_CHECKLIST §1 |
| 14 | LS7 Doctor Question Gen | Targeted lab-driven clinical questions for Question Bank | M2 | FEATURES_CHECKLIST §1 |
| 15 | LS8 Doctor Pinned Comments | Display pinned comments (📌) linked to specific lab points | M2 | FEATURES_CHECKLIST §1 |
| 16 | PM1 Pillbox Canvas | 7x4 accessible grid (Mon-Sun x Morn/Noon/Eve/Bed) with drag-and-drop | M3 | FEATURES_CHECKLIST §2 |
| 17 | PM2 Drug-Drug SVG Arcs | Dynamic colored arcs (red/orange/yellow) with plain mechanism sheets | M3 | FEATURES_CHECKLIST §2 |
| 18 | PM2b Diet Interaction Badges | Meal-time badges + plate arcs (Warfarin-VitK, Statin-Grapefruit, etc.) | M3 | FEATURES_CHECKLIST §2 |
| 19 | PM3 Duplicate Ingredients | Detection of hidden duplicate active ingredients across brands | M3 | FEATURES_CHECKLIST §2 |
| 20 | PM4 Timing Shift Suggestion | Chronotype & food-aware schedule suggestions with ghost previews | M3 | FEATURES_CHECKLIST §2 |
| 21 | PM5 Chronotype Schedule | Personalized schedule optimization based on sleep/wake cycle | M3 | FEATURES_CHECKLIST §2 |
| 22 | PM6 Missed Dose Simulation | Drag pill off canvas to simulate clinical risk delta | M3 | FEATURES_CHECKLIST §2 |
| 23 | PM7 Schedule Reminders | Time-slot reminders surviving app restart | M3 | FEATURES_CHECKLIST §2 |
| 24 | PM8 Pharmacist Export | 1-page visual map and schedule export | M3 | FEATURES_CHECKLIST §2 |
| 25 | PM9 Family View Toggle | Simplified elder view vs full interactive canvas | M3 | FEATURES_CHECKLIST §2 |
| 26 | RB1 Three-List Load | Intake of Pre-admission, In-hospital, and Discharge medication lists | M4 | FEATURES_CHECKLIST §3 |
| 27 | RB2 Walk-Through Clarification | Conversational med-by-med walkthrough with plain explanations | M4 | FEATURES_CHECKLIST §3 |
| 28 | RB3 Change Classification | 5-state badges: Continued, Dose Changed, Stopped, New, Held | M4 | FEATURES_CHECKLIST §3 |
| 29 | RB4 Per-Med Approval Gate | Patient Approve/Edit per med before PillMap handoff | M4 | FEATURES_CHECKLIST §3 |
| 30 | RB5 Drug-Drug Interactions | Discharge Rx vs Rx interaction checker with severity tagging | M4 | FEATURES_CHECKLIST §3 |
| 31 | RB5b OTC & Supplement Guard | Cross-check discharge Rx against patient OTCs/supplements | M4 | FEATURES_CHECKLIST §3 |
| 32 | RB5c Diet & Food Guard | Check discharge Rx against patient diet habits (vit K, grapefruit, etc.) | M4 | FEATURES_CHECKLIST §3 |
| 33 | RB5d PillMap Correlation | Auto-correlate reconciliation flags as SVG arcs & meal badges in PillMap | M4 | FEATURES_CHECKLIST §3 |
| 34 | RB6 Lab-Context Flags | Flag dosing risks based on recent labs (eGFR + NSAID, K+ + ACE) | M4 | FEATURES_CHECKLIST §3 |
| 35 | RB7 Doctor Question Suggest | Auto-generate doctor questions for unclear medication changes | M4 | FEATURES_CHECKLIST §3 |
| 36 | RB8 Teach-Back Check | Patient comprehension check ("tell me in your words") | M4 | FEATURES_CHECKLIST §3 |
| 37 | RB9 Day 0 PillMap Handoff | Auto-populate PillMap canvas Day 0 with diet-aware times | M4 | FEATURES_CHECKLIST §3 |
| 38 | RB10 Patient Summary Export | 1-page home discharge summary export | M4 | FEATURES_CHECKLIST §3 |
| 39 | HL1 Prescribed Due Cards | Doctor-prescribed lab cadence with countdown and overdue nudges | M5 | FEATURES_CHECKLIST §4 |
| 40 | HL2 Upload Lab Photo | Patient photo slip / PDF upload with OCR narration and approval | M5 | FEATURES_CHECKLIST §4 |
| 41 | HL3 Doctor Inbox & Pinned Note| Doctor review queue and pinned clinical comments | M5 | FEATURES_CHECKLIST §4 |
| 42 | HL4 Dosage Proposal Card | Doctor dosage change proposal card linked to specific lab points | M5 | FEATURES_CHECKLIST §4 |
| 43 | HL5 Proposal Approval & Diff | Patient approval -> animated PillMap diff & interaction re-run | M5 | FEATURES_CHECKLIST §4 |
| 44 | HL6 LabStory Ongoing Band | Approved dose changes render as colored timeline bands on LabStory | M5 | FEATURES_CHECKLIST §4 |
| 45 | HL7 Next Due Auto-Set | Doctor sets next due date at review; critical value alerts | M5 | FEATURES_CHECKLIST §4 |
| 46 | HL8 Updated Summary Export | Regenerate patient summary with new dosage regimen | M5 | FEATURES_CHECKLIST §4 |
| 47 | SF1 Report Danger Sign | Danger sign reporting (photo/text) with immediate escalation advice | M5 | FEATURES_CHECKLIST §6 |
| 48 | SF2 Doctor Triage View | Doctor clinical triage view with recent labs, meds, and alert context | M5 | FEATURES_CHECKLIST §6 |
| 49 | SF3 Doctor Remote Pillbox Ctrl| Doctor add/remove/change med proposals linked to danger sign | M5 | FEATURES_CHECKLIST §6 |
| 50 | SF4 Patient Approve Pill Change| Patient approval of doctor remote change -> PillMap animates diff | M5 | FEATURES_CHECKLIST §6 |
| 51 | SF5 Direct Follow-up Order | Doctor orders clinic or tele-review follow-up | M5 | FEATURES_CHECKLIST §6 |
| 52 | SF6 Prescribed Calendar Sync | Prescribed events sync to in-app & iCal calendar with 24h/2h alerts | M5 | FEATURES_CHECKLIST §6 |
| 53 | SF7 Calendar Overdue Nudge | Overdue alerts with quick actions (Report Danger, Upload, Reschedule) | M5 | FEATURES_CHECKLIST §6 |
| 54 | SF8 Safety Dossier Record | All danger signs, doctor actions, and calendar events logged to Dossier| M5 | FEATURES_CHECKLIST §6 |
| 55 | G1 Linked Care Profile | Link family member / caregiver account with distinct vault | M5 | FEATURES_CHECKLIST §7 |
| 56 | G2 Scoped Permissions | Scoped permissions: View Only vs Manage vs Full | M5 | FEATURES_CHECKLIST §7 |
| 57 | G3 Audited Proxy Actions | Audited proxy logging: "Approved by [Name] on behalf of [Patient]" | M5 | FEATURES_CHECKLIST §7 |
| 58 | G4 Full Loop on Behalf | Caregiver manages uploads, approvals, and calendar on behalf | M5 | FEATURES_CHECKLIST §7 |
| 59 | G5 Simple View Toggle | Ultra-simple elder mode vs full caregiver dashboard | M5 | FEATURES_CHECKLIST §7 |
| 60 | G6 Multi-Patient Dashboard | Caregiver multi-patient dashboard across linked profiles | M5 | FEATURES_CHECKLIST §7 |
| 61 | CD1 Auto-Compilation | Merge all vault entities into lifetime comprehensive health record | M6 | FEATURES_CHECKLIST §5 |
| 62 | CD2 Timeline + Snapshot Card | Chronological dossier timeline + emergency one-page snapshot | M6 | FEATURES_CHECKLIST §5 |
| 63 | CD3 Source Bounding Box Link | Direct link from dossier entries to highlighted bounding box on source | M6 | FEATURES_CHECKLIST §5 |
| 64 | CD4 Doctor Access Grant/Revoke| Time-bound secure doctor access grant and instant revocation | M6 | FEATURES_CHECKLIST §5 |
| 65 | CD5 Continuous Non-Forking | Seamless record continuation across doctor transitions | M6 | FEATURES_CHECKLIST §5 |
| 66 | CD6 Full Dossier Export | PDF and JSON export of compiled lifetime health record | M6 | FEATURES_CHECKLIST §5 |
| 67 | INT1-INT9 Cross-Module Bridge| Full reactive integration across Vault, Labs, Meds, Safety, Dossier | M6 | FEATURES_CHECKLIST §8 |
| 68 | E2E Acceptance Flows A-E | Automated verification of Flows A, B, C, D, and E | M7 | ORIGINAL_REQUEST §Acceptance |
| 69 | Tier 1-5 Test Suite Pass | 100% pass across Feature, Boundary, Pairwise, Real-World, Adversarial| M7 | E2E Testing Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Foundation, LocalVault & WebMCP Engine | F0.1-F0.5, W0.1-W0.2: IndexedDB LocalVault (11 stores), WebMCP registry & mock fallback adapter, WebMCP Inspector, approval modal, bounding box highlighter, reactive events | none | PLANNED |
| M2 | LabStory & Longitudinal Biomarker Causal Engine | LS1-LS8: Time-series canvas/charts, unit normalization, reference/optimal toggles, med overlay bands, `extract_labs`, `correlate_meds`, doctor pinned comments, question generator | M1 | PLANNED |
| M3 | PillMap & Polypharmacy Negotiator 7x4 Canvas | PM1-PM9: Accessible 7x4 grid, drag & drop, SVG drug-drug conflict arcs, meal-time badges & plate arcs, duplicate ingredients, chronotype/timing shift preview, adherence simulator, export | M1 | PLANNED |
| M4 | RxBridge 3-List Reconciliation Walkthrough | RB1-RB10: 3-list intake, conversational walk (`explain_med_change`), 5 status badges, drug/diet/lab interaction checks, teach-back, Day 0 PillMap auto-population, summary export | M1, M2, M3 | PLANNED |
| M5 | HomeLab Remote Loop, Safety Alerts & Family Care Circle | HL1-HL8, SF1-SF8, G1-G6: Prescribed due cards, photo upload/OCR, doctor pinned comments, dosage proposals, danger sign triage, doctor remote pillbox, calendar sync, caregiver proxy & audit | M1, M2, M3, M4 | PLANNED |
| M6 | Continuity Dossier & Cross-Module Integration | CD1-CD6, INT1-INT9: Lifetime compilation (`compile_health_record`), snapshot card, bounding box pan/zoom, time-bound doctor access grant/revoke, cross-module data synchronization | M1, M2, M3, M4, M5 | PLANNED |
| M7 | Final Milestone: 100% E2E Test Pass & Adversarial Hardening | E2E Acceptance Flows A-E verification, 100% pass on Tiers 1-4 test suite, Tier 5 white-box adversarial stress testing with Challengers | M1-M6, TEST_READY | PLANNED |

## Interface Contracts
### WebMCP Engine & Tool Registry
- `window.__Healthbook_WebMCP__`:
  - `registerTool(toolDefinition: ToolDefinition): void`
  - `getRegisteredTools(): ToolDefinition[]`
  - `executeTool(name: string, params: any, context?: ExecutionContext): Promise<ToolResult>`
  - `on(event: string, handler: Function): () => void`
- `ToolDefinition`:
  - `name: string`, `description: string`, `parameters: JSONSchema`, `requiresApproval: boolean`, `category: string`
- `ToolResult`:
  - `success: boolean`, `data: any`, `plainLanguageExplanation: string`, `uiSideEffects?: UISideEffect[]`, `error?: string`

### LocalVault (IndexedDB) Store Contracts
- `facts`: `{ id, category, name, value, unit, status: 'unconfirmed'|'confirmed'|'rejected', sourceDocId, boundingBox, plainExplanation, author, timestamp }`
- `meds`: `{ id, patientId, brandName, genericName, dosage, unit, frequency, timingSlots: ('morning'|'noon'|'evening'|'bedtime')[], withFood: boolean, avoidGrapefruit: boolean, avoidAlcohol: boolean, status: 'active'|'stopped'|'pending_proposal'|'held', source: string }`
- `labs`: `{ id, patientId, marker, value, unit, normalizedValue, normalizedUnit, drawDate, referenceRange: { low, high }, optimalRange: { low, high }, isBorderline: boolean, doctorComment?: { doctorName, comment, timestamp } }`
- `proposals`: `{ id, patientId, doctorName, type: 'dose_change'|'add_med'|'remove_med', medId, previousDose, proposedDose, reason, linkedLabId?, linkedDangerId?, status: 'pending'|'approved'|'rejected', timestamp }`
- `audit_log`: `{ id, timestamp, action, entityId, entityType, performedBy: { userId, userName, role, onBehalfOf?: string }, details: any }`
- `calendar_events`: `{ id, patientId, title, eventType: 'lab_due'|'doctor_followup'|'med_reminder', scheduledDate, reason, notifyDaysBefore, isCompleted, syncedToCalendar: boolean }`

### Module Cross-Talk Contracts
- `RxBridge -> PillMap`: On reconciliation approval, `set_reminder` transmits reconciled meds array with `timingSlots` and `foodInstructions` directly to PillMap Day 0 state.
- `HomeLab / Safety -> PillMap`: On proposal approval, `sync_pillmap_from_proposal` applies animated DOM diff and recalculates conflict arcs.
- `PillMap -> LabStory`: Active meds list with start/end/dose timestamps provides time ranges for LabStory colored overlay bands.
- `Vault -> Continuity Dossier`: `compile_health_record` queries all 11 object stores for active patient ID and generates unified timeline + snapshot JSON.

## Code Layout
```
/Users/sujal/Projects/proj1/
├── index.html                      # App HTML entry point with WebMCP scripts
├── package.json                    # Project configuration, scripts, dependencies
├── vite.config.ts                  # Vite build and test configuration
├── tsconfig.json                   # TypeScript configuration
├── tailwind.config.js              # Tailwind styling configuration
├── src/
│   ├── main.tsx                    # React application mount
│   ├── App.tsx                     # Main layout shell, module switcher, header with privacy badge
│   ├── types/                      # Central TypeScript models & tool schemas
│   │   ├── vault.ts                # Fact, Med, Lab, Condition, Proposal, Audit models
│   │   ├── webmcp.ts               # WebMCP ToolDefinition, ExecutionContext, Inspector models
│   │   ├── pillmap.ts              # Pillbox, Arc, MealBadge, Chronotype models
│   │   └── rxbridge.ts             # 3-List reconciliation models & diff types
│   ├── core/                       # Foundation engines
│   │   ├── webmcp/                 # WebMCP engine, tool registry, mock adapter polyfill, inspector
│   │   ├── vault/                  # IndexedDB LocalVault client, query helpers, audit logger
│   │   ├── events/                 # Reactive event bus, toast notifications, animation triggers
│   │   └── knowledge/              # Drug-Drug, Drug-Diet, and Ingredient crosswalk databases
│   ├── tools/                      # Implementation of all 40 WebMCP tools across 7 modules
│   │   ├── vaultTools.ts           # extract_fact, confirm_fact, compile_health_record
│   │   ├── labStoryTools.ts        # extract_labs, correlate_meds
│   │   ├── pillMapTools.ts         # add_medication, check_interactions, check_diet_interactions, etc.
│   │   ├── rxBridgeTools.ts        # explain_med_change, flag_interaction, flag_diet_interaction, etc.
│   │   ├── homeLabTools.ts         # upload_lab_image, doctor_review_comment, propose_dosage_change, etc.
│   │   ├── safetyTools.ts          # report_danger_sign, notify_doctor, doctor_change_dose, schedule_followup, etc.
│   │   └── careCircleTools.ts      # link_patient, grant_caregiver_access, act_on_behalf, grant_doctor_access, etc.
│   ├── components/                 # UI Canvases and Interactive Components
│   │   ├── common/                 # PrivacyBadge, QuestionBank, BoundingBoxViewer, ToastContainer, InspectorModal
│   │   ├── vault/                  # FactApprovalCard, DocumentDropzone, FactStreamView
│   │   ├── labstory/               # BiomarkerChart (Canvas), RangeToggle, MedOverlayBands, CausalQueryPanel
│   │   ├── pillmap/                # PillboxGrid (7x4), PillCard, SVGArcOverlay, MealBadges, ShiftPreviewModal
│   │   ├── rxbridge/               # ThreeListTable, ReconciliationWalk, ChangeBadge, TeachBackModal, SummaryExport
│   │   ├── homelab/                # DueCardList, UploadLabModal, ProposalCard, DoctorInbox
│   │   ├── safety/                 # DangerSignModal, TriagePanel, FollowupScheduler, CalendarView
│   │   ├── carecircle/             # CaregiverSwitcher, ScopedPermissionsModal, AuditLogViewer
│   │   └── dossier/                # DossierTimeline, EmergencySnapshotCard, SourceLinkViewer, DoctorAccessModal
│   └── fixtures/                   # Rich sample datasets, PDFs/images, discharge lists, lab histories
└── test/                           # Automated Test Suites (Vitest & E2E)
    ├── tier1-feature/              # >=5 unit tests per feature/tool
    ├── tier2-boundary/             # Boundary and corner case stress tests
    ├── tier3-integration/          # Pairwise cross-module integration tests
    ├── tier4-workloads/            # Real-world complex patient scenarios
    ├── e2e-flows/                  # End-to-End verification of Acceptance Flows A through E
    └── test-runner.ts              # Standalone test runner and verification reporter
```
