# CareCanvas WebMCP Core Engine & Tools Specification

> **Document Version:** 1.0.0-PROD-SPEC  
> **Author:** WebMCP Survey Specialist (`spec_miner_survey_1`)  
> **Date:** 2026-08-28 / 2026-08-29  
> **Target System:** CareCanvas (Agent-Native Patient-Facing Health Companion for The WebMCP Challenge)  
> **Standards Reference:** W3C WebML / WebMCP Spec (`document.modelContext.registerTool`, `navigator.modelContext`), W3C IndexedDB 3.0, JSON Schema Draft 2020-12, PDF.js Bounding Coordinates.

---

## 1. Executive Summary & Architectural Vision

CareCanvas is an agent-native, patient-facing health companion engineered for **The WebMCP Challenge** (OpenAI, Google, Microsoft, W3C WebML). It bridges the post-discharge and chronic care gap by providing an interactive, accessible client-side UI across 7 clinical modules:
1. **Approved Fact Vault & Core Foundation**
2. **LabStory (Longitudinal Biomarker Causal Engine)**
3. **PillMap (Visual Polypharmacy Negotiator)**
4. **RxBridge (Post-Discharge 3-List Reconciliation Walk)**
5. **HomeLab Loop (Remote Doctor-Prescribed Review & Dosage Adjustment)**
6. **Safety Alerts, Doctor Control & Follow-Up Calendar**
7. **Family Care Circle & Continuity Dossier (Lifetime Record & Proxy)**

### Architectural Invariant: Client-Side Privacy & Human-in-the-Loop Gate
- **Zero-Cloud PHI Invariant:** All medical parsing (OCR, PDF extraction, unit normalization), interaction checking, causal correlation, and schedule negotiation execute entirely within the client runtime (browser). No Protected Health Information (PHI) is transmitted to external servers without explicit, cryptographically signed or token-gated patient consent.
- **Append-Only Vault:** IndexedDB (`LocalVault`) is the single source of truth. All clinical data modifications are append-only with immutable audit logs recording author, proxy actor, and timestamp metadata.
- **Mandatory Approval Gate:** No extracted fact, reconciled medication, doctor-proposed dosage reduction, or danger-sign schedule shift can alter downstream canvases (PillMap, LabStory, Dossier) without passing through an explicit human approval gate (`Approve / Edit / Reject`).

```
 +---------------------------------------------------------------------------------------+
 |                                  CareCanvas Frontend Runtime                          |
 |                                                                                       |
 |  +--------------------+   +---------------------+   +-------------------------------+ |
 |  |  PillMap 7x4 Grid  |   | LabStory DuckDB Wasm|   | RxBridge 3-List Recon Walk    | |
 |  | (Drag/Drop, Arcs)  |   | (Biomarker Trends)  |   | (Explain Changes, Teach-Back) | |
 |  +---------+----------+   +----------+----------+   +---------------+---------------+ |
 |            |                         |                              |                 |
 |            +--------------------+    |    +-------------------------+                 |
 |                                 v    v    v                                           |
 |                            [ WebMCP Event Bus ]                                       |
 |                                     |                                                 |
 |  +----------------------------------v-----------------------------------------------+ |
 |  |                      WebMCP Core Engine & Dispatcher                             | |
 |  |  * document.modelContext.registerTool / Fallback Mock Adapter                    | |
 |  |  * 40 WebMCP Tools (Schema Validation, Execution Engine, JSON Responses)          | |
 |  |  * Human-in-the-Loop Interceptor & Approval Gatekeeper                           | |
 |  |  * In-App WebMCP Inspector, Invocation Logger & Manual Playground                | |
 |  +----------------------------------+-----------------------------------------------+ |
 |                                     |                                                 |
 |                                     v                                                 |
 |  +----------------------------------------------------------------------------------+ |
 |  |                  Privacy-First LocalVault (IndexedDB v1)                         | |
 |  |  [facts] [documents] [meds] [labs] [conditions] [allergies] [audit_log]          | |
 |  |  [proposals] [calendar_events] [care_circle] [doctor_grants]                      | |
 |  +----------------------------------------------------------------------------------+ |
 +---------------------------------------------------------------------------------------+
```

---

## 2. WebMCP Core Engine & Registration Protocol

### 2.1 WebMCP Standard Contract & Detection
CareCanvas implements the emergent WebMCP specification for in-browser tool registration and model context exposure.

```typescript
/**
 * Core WebMCP Context Registration Protocol
 */
export interface WebMCPToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    description: string;
    enum?: string[] | number[];
    items?: any;
    properties?: Record<string, any>;
    default?: any;
    minimum?: number;
    maximum?: number;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface WebMCPToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  moduleOwner: 'vault' | 'labstory' | 'pillmap' | 'rxbridge' | 'homelab' | 'safety' | 'family' | 'dossier';
  category: 'imperative_extraction' | 'declarative_export' | 'clinical_negotiation' | 'approval_gate' | 'audit_proxy';
  requiresHumanApproval: boolean;
  approvalGateType: 'none' | 'inline_fact' | 'modal_proposal' | 'proxy_signature' | 'reconciliation_walk';
  parameters: WebMCPToolParameterSchema;
  returns: Record<string, any>;
  execute: (params: TInput, context: WebMCPExecutionContext) => Promise<WebMCPToolResult<TOutput>>;
  uiSideEffects: {
    stateMutations: string[];
    domAnimations: string[];
    toastNotification?: {
      type: 'info' | 'success' | 'warning' | 'error';
      messageTemplate: string;
    };
    canvasRerenders: ('pillmap' | 'labstory' | 'rxbridge' | 'dossier' | 'calendar' | 'question_bank')[];
  };
}

export interface WebMCPExecutionContext {
  patientId: string;
  activeProfile: {
    userId: string;
    name: string;
    role: 'patient' | 'caregiver' | 'doctor';
    isProxy: boolean;
    onBehalfOf?: string;
  };
  vault: LocalVaultManager;
  eventBus: WebMCPEventBus;
  approvalInterceptor: ApprovalInterceptor;
}

export interface WebMCPToolResult<T = any> {
  success: boolean;
  tool: string;
  timestamp: string;
  data: T;
  plainLanguageSummary: string;
  humanApprovalRequired: boolean;
  approvalStatus?: 'auto_approved' | 'pending_approval' | 'approved' | 'rejected' | 'edited';
  pendingApprovalId?: string;
  error?: {
    code: string;
    message: string;
    field?: string;
    remediationSuggestion?: string;
  };
}
```

### 2.2 Dual-Mode Registration Protocol
When initialized, the WebMCP engine detects browser support:
1. **Native WebMCP Mode:** If `window.document.modelContext?.registerTool` or `window.navigator.modelContext?.registerTool` is defined, registers tool manifests natively with the browser runtime.
2. **Fallback Mock Adapter Mode:** If native WebMCP is absent, registers all tools into an in-memory client dispatcher (`window.__CareCanvas_WebMCP__`) that exposes the identical registration and invocation interface to client-side LLM wrappers (WebLLM, OpenAI Realtime, Claude in-browser sessions).

```typescript
export class WebMCPEngine {
  private registry: Map<string, WebMCPToolDefinition> = new Map();
  private isNative: boolean = false;

  constructor() {
    this.detectAndInitialize();
  }

  private detectAndInitialize(): void {
    const docContext = (document as any).modelContext;
    const navContext = (navigator as any).modelContext;

    if (docContext && typeof docContext.registerTool === 'function') {
      this.isNative = true;
    } else if (navContext && typeof navContext.registerTool === 'function') {
      this.isNative = true;
    } else {
      this.isNative = false;
      this.polyfillMockAdapter();
    }
  }

  private polyfillMockAdapter(): void {
    const mockContext = {
      registerTool: (toolDef: WebMCPToolDefinition) => {
        this.register(toolDef);
      },
      unregisterTool: (name: string) => {
        this.unregister(name);
      },
      getRegisteredTools: () => {
        return Array.from(this.registry.values());
      },
      executeTool: async (name: string, params: any, contextOverrides?: any) => {
        return this.execute(name, params, contextOverrides);
      }
    };

    (document as any).modelContext = mockContext;
    (window as any).__CareCanvas_WebMCP__ = mockContext;
  }

  public register(toolDef: WebMCPToolDefinition): void {
    this.registry.set(toolDef.name, toolDef);
    if (this.isNative) {
      try {
        (document as any).modelContext?.registerTool(toolDef);
      } catch (err) {
        console.warn(`[WebMCP Native Error] Falling back for ${toolDef.name}`, err);
      }
    }
    this.emitEvent('tool_registered', { tool: toolDef.name, module: toolDef.moduleOwner });
  }

  public async execute(name: string, params: any, context?: any): Promise<WebMCPToolResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new Error(`WebMCP Tool '${name}' not registered.`);
    }
    // 1. Validate Input JSON Schema
    this.validateSchema(tool.parameters, params);
    
    // 2. Telemetry execution start
    this.emitEvent('tool_execution_start', { tool: name, params });
    
    // 3. Execute
    const startTime = performance.now();
    try {
      const result = await tool.execute(params, context);
      const durationMs = performance.now() - startTime;
      
      // 4. Telemetry execution success
      this.emitEvent('tool_execution_success', {
        tool: name,
        params,
        result,
        durationMs,
        requiresApproval: tool.requiresHumanApproval
      });

      // 5. Trigger Reactive UI Side-Effects
      this.triggerUiSideEffects(tool.uiSideEffects, result);

      return result;
    } catch (error: any) {
      const durationMs = performance.now() - startTime;
      this.emitEvent('tool_execution_error', { tool: name, params, error: error.message, durationMs });
      throw error;
    }
  }
}
```

---

## 3. WebMCP In-App Inspector & Live Trigger Panel

To satisfy the transparency, verification, and live demo criteria of The WebMCP Challenge, CareCanvas includes a built-in **WebMCP Inspector Drawer**:

### 3.1 Inspector Functional Capabilities
1. **Catalog Tab:**
   - Visual grid of all 40 registered tools organized by module.
   - Filter by module, category, or approval requirement.
   - Live JSON Schema viewer showing input parameters and required fields.
2. **Telemetry & Invocation Log Tab:**
   - Real-time stream of all tool calls (Agent-initiated, User-initiated, or Flow-triggered).
   - Shows: `Timestamp`, `Tool Name`, `Caller Role`, `Execution Latency (ms)`, `Approval State`, and expandable Request/Response JSON payloads.
3. **Interactive Trigger Playground Tab:**
   - Dropdown tool selector with pre-loaded mock payloads for Flows A through E.
   - Live JSON editor for input parameters.
   - "Execute Tool" trigger button causing immediate in-app state changes and DOM animations.
4. **Approval Gate Interceptor Panel:**
   - Prominent badge showing number of active pending approvals.
   - List of pending tool actions (e.g. `confirm_fact`, `approve_dosage_change`, `approve_pillmap_change`).
   - One-tap "Approve", "Edit & Approve", or "Reject" actions directly within the inspector.

---

## 4. Privacy-First LocalVault Data Architecture

### 4.1 LocalVault IndexedDB Schema (`CareCanvas_Vault_v1`)
The LocalVault runs on client-side IndexedDB with 11 specialized object stores:

```
Database Name: CareCanvas_Vault_v1
Version: 1
```

```
+-------------------+--------------------+-----------------------------------------------------+
| Object Store Name | Key Path           | Indexes (indexName -> keyPath, [unique/multi])      |
+-------------------+--------------------+-----------------------------------------------------+
| facts             | id (string)        | by_patient (patientId)                              |
|                   |                    | by_doc (documentId)                                 |
|                   |                    | by_category (category)                              |
|                   |                    | by_status (approvalStatus)                          |
+-------------------+--------------------+-----------------------------------------------------+
| documents         | id (string)        | by_patient (patientId)                              |
|                   |                    | by_type (type)                                      |
|                   |                    | by_uploaded_at (uploadedAt)                         |
+-------------------+--------------------+-----------------------------------------------------+
| meds              | id (string)        | by_patient (patientId)                              |
|                   |                    | by_status (status)                                  |
|                   |                    | by_category (category)                              |
|                   |                    | by_name (genericName)                               |
+-------------------+--------------------+-----------------------------------------------------+
| labs              | id (string)        | by_patient (patientId)                              |
|                   |                    | by_marker (markerCode)                              |
|                   |                    | by_date (drawDate)                                  |
|                   |                    | by_due_card (dueCardId)                             |
+-------------------+--------------------+-----------------------------------------------------+
| conditions        | id (string)        | by_patient (patientId)                              |
|                   |                    | by_code (code)                                      |
|                   |                    | by_status (status)                                  |
+-------------------+--------------------+-----------------------------------------------------+
| allergies         | id (string)        | by_patient (patientId)                              |
|                   |                    | by_substance (substance)                            |
|                   |                    | by_severity (severity)                              |
+-------------------+--------------------+-----------------------------------------------------+
| audit_log         | id (string)        | by_patient (patientId)                              |
|                   |                    | by_timestamp (timestamp)                            |
|                   |                    | by_tool (toolName)                                  |
|                   |                    | by_actor (actor.id)                                 |
+-------------------+--------------------+-----------------------------------------------------+
| proposals         | id (string)        | by_patient (patientId)                              |
|                   |                    | by_status (status)                                  |
|                   |                    | by_type (type)                                      |
|                   |                    | by_linked_lab (linkedLabId)                         |
+-------------------+--------------------+-----------------------------------------------------+
| calendar_events   | id (string)        | by_patient (patientId)                              |
|                   |                    | by_due_date (dueDate)                               |
|                   |                    | by_status (status)                                  |
|                   |                    | by_type (type)                                      |
+-------------------+--------------------+-----------------------------------------------------+
| care_circle       | id (string)        | by_primary_patient (primaryPatientId)               |
|                   |                    | by_caregiver (caregiverId)                          |
|                   |                    | by_status (verificationStatus)                      |
+-------------------+--------------------+-----------------------------------------------------+
| doctor_grants     | id (string)        | by_patient (patientId)                              |
|                   |                    | by_token (accessToken, unique)                      |
|                   |                    | by_status (status)                                  |
+-------------------+--------------------+-----------------------------------------------------+
```

### 4.2 Detailed Entity Data Contracts

#### 1. `facts` Store
```typescript
export interface FactEntity {
  id: string; // "fact-20260828-001"
  patientId: string;
  documentId: string;
  category: 'lab' | 'medication' | 'allergy' | 'condition' | 'procedure' | 'vital' | 'diet_habit';
  factKey: string; // e.g. "eGFR", "metformin", "penicillin", "ckd_stage_3b"
  factValue: string | number; // e.g. 32, "1000 mg", "severe anaphylaxis"
  unit?: string; // "mL/min/1.73m2", "mg"
  plainNarration: string; // e.g. "Your eGFR is 32, which indicates moderate to severe kidney function reduction."
  sourceBoundingBox: BoundingBox;
  confidence: number; // 0.0 to 1.0
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'edited';
  editedValue?: string | number;
  rejectionReason?: string;
  createdAt: string; // ISO 8601
  approvedAt?: string;
  approvedBy?: {
    actorId: string;
    actorName: string;
    role: 'patient' | 'caregiver';
    relationship?: string;
  };
}
```

#### 2. `documents` Store
```typescript
export interface DocumentEntity {
  id: string; // "doc-discharge-001"
  patientId: string;
  name: string; // "St_Jude_Discharge_Summary_Aug28.pdf"
  type: 'discharge_summary' | 'lab_report' | 'prescription' | 'photo_slip' | 'referral';
  fileData?: Blob | string; // Local storage reference or data URI
  pageCount: number;
  dimensions: { width: number; height: number }[];
  extractedFactIds: string[];
  uploadedAt: string;
  uploadedBy: {
    actorId: string;
    actorName: string;
    role: 'patient' | 'caregiver';
  };
}
```

#### 3. `meds` Store
```typescript
export interface MedicationEntity {
  id: string; // "med-metformin-001"
  patientId: string;
  name: string; // "Metformin Hydrochloride"
  brandName?: string; // "Glucophage"
  genericName: string; // "metformin"
  dosage: string; // "500 mg"
  numericDose: number; // 500
  unit: string; // "mg"
  route: 'oral' | 'subcutaneous' | 'topical' | 'inhalation';
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'as_needed' | 'weekly';
  timeSlots: ('morning' | 'noon' | 'evening' | 'bedtime')[];
  daysOfWeek: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  withFood: boolean;
  foodInstructions?: string; // "Take 30 minutes before breakfast with full glass of water"
  category: 'rx' | 'otc' | 'supplement';
  sourceDocumentId?: string;
  sourceFactId?: string;
  status: 'active' | 'held' | 'discontinued' | 'proposed';
  changeCategory?: 'continued' | 'dose_doubled' | 'dose_halved' | 'stopped' | 'new' | 'held_resumed';
  dosageHistory: {
    date: string;
    dosage: string;
    reason: string;
    approvedBy: string;
    proposalId?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

#### 4. `labs` Store
```typescript
export interface LabEntity {
  id: string; // "lab-egfr-20260828"
  patientId: string;
  markerCode: 'eGFR' | 'Creatinine' | 'A1c' | 'Potassium' | 'Hemoglobin' | 'Platelets' | 'BUN' | 'ALT' | 'AST' | 'TSH';
  markerName: string; // "Estimated Glomerular Filtration Rate"
  category: 'renal' | 'glycemic' | 'metabolic' | 'hepatic' | 'hematology' | 'cardiac';
  value: number; // 32
  normalizedValue: number; // 32
  unit: string; // "mL/min/1.73m2"
  normalizedUnit: string; // "mL/min/1.73m2"
  drawDate: string; // "2026-08-28"
  referenceRange: {
    low: number; // 60
    high: number; // 120
    unit: string;
  };
  optimalRange: {
    low: number; // 90
    high: number; // 120
    unit: string;
  };
  flag: 'normal' | 'borderline_low' | 'borderline_high' | 'critical_low' | 'critical_high';
  sourceDocumentId: string;
  sourceFactId: string;
  dueCardId?: string;
  doctorComments: {
    id: string;
    doctorId: string;
    doctorName: string;
    comment: string;
    pinnedAt: string;
  }[];
  createdAt: string;
}
```

#### 5. `audit_log` Store (Immutable Audit Trail)
```typescript
export interface AuditLogEntity {
  id: string; // "audit-20260828-134002-092"
  patientId: string;
  timestamp: string; // "2026-08-28T13:40:02.092Z"
  actionType: 'fact_confirmed' | 'fact_rejected' | 'med_reconciled' | 'proposal_approved' | 'danger_reported' | 'proxy_action' | 'doctor_grant_created' | 'doctor_grant_revoked';
  toolName: string; // e.g. "approve_dosage_change", "act_on_behalf"
  actor: {
    type: 'patient' | 'caregiver' | 'doctor' | 'agent';
    id: string;
    name: string;
    relationship?: string; // "son", "daughter", "primary_care"
  };
  targetStore: string;
  targetId: string;
  beforeState: any;
  afterState: any;
  approvalMethod: 'ui_click' | 'proxy_signature' | 'reconciliation_confirm';
  proxyMetadata?: {
    actingOnBehalfOf: string;
    proxyConsentVerified: boolean;
    auditDisplayString: string; // "Approved by Raj (son) on behalf of S. Devi"
  };
}
```

#### 6. `proposals` Store
```typescript
export interface ProposalEntity {
  id: string; // "prop-metformin-reduction-001"
  patientId: string;
  proposer: {
    type: 'doctor' | 'agent';
    id: string;
    name: string; // "Dr. Sarah Patel, MD (Nephrology)"
  };
  type: 'dosage_change' | 'add_medication' | 'remove_medication';
  targetMedicationId: string;
  targetMedicationName: string;
  currentDosage: string; // "1000 mg twice daily"
  proposedDosage: string; // "500 mg morning only"
  proposedSchedule: {
    timeSlots: ('morning' | 'noon' | 'evening' | 'bedtime')[];
    daysOfWeek: string[];
  };
  clinicalRationale: string; // "Reduce metformin from 1000mg to 500mg due to eGFR drop to 28 on Aug 28."
  linkedLabId?: string;
  linkedDangerSignId?: string;
  status: 'pending' | 'approved' | 'edited' | 'rejected';
  reviewedBy?: {
    actorId: string;
    actorName: string;
    role: 'patient' | 'caregiver';
    timestamp: string;
  };
  createdAt: string;
}
```

#### 7. `calendar_events` Store
```typescript
export interface CalendarEventEntity {
  id: string; // "cal-creat-due-001"
  patientId: string;
  title: string; // "Creatinine & eGFR Lab Due (Dr. Patel Prescription)"
  type: 'lab_due' | 'followup_appointment' | 'medication_reminder';
  dueDate: string; // "2026-09-11"
  time?: string; // "09:00"
  status: 'upcoming' | 'completed' | 'overdue' | 'cancelled';
  location: 'clinic' | 'telehealth' | 'home_draw' | 'local_lab';
  prescribedBy: string; // "Dr. Sarah Patel"
  linkedLabId?: string;
  linkedProposalId?: string;
  reminderAlerts: ('1_day_before' | '2_hours_before')[];
  syncedToExternal: boolean;
  syncedProviders?: ('google_cal' | 'apple_ical')[];
  createdAt: string;
}
```

#### 8. `care_circle` Store
```typescript
export interface CareCircleEntity {
  id: string; // "circle-raj-devi-001"
  primaryPatientId: string; // "patient-s-devi"
  caregiverId: string; // "user-raj-devi"
  caregiverName: string; // "Raj Devi"
  relationship: 'son' | 'daughter' | 'spouse' | 'parent' | 'guardian' | 'other';
  permissionLevel: 'view_only' | 'manage' | 'full';
  verificationStatus: 'verified' | 'pending' | 'revoked';
  verificationMethod: 'otp' | 'consent_signature';
  grantedAt: string;
  revokedAt?: string;
}
```

#### 9. `doctor_grants` Store
```typescript
export interface DoctorGrantEntity {
  id: string; // "grant-dr-chen-001"
  patientId: string;
  doctorName: string; // "Dr. Kevin Chen"
  doctorEmail: string; // "kchen@metropolitanhealth.org"
  doctorClinic: string; // "Metropolitan Cardiology"
  accessToken: string; // "cc_grant_8f93e1b0c9824f11"
  permissionScope: 'snapshot_only' | 'full_dossier' | 'dossier_and_proposals';
  expiresAt: string; // ISO 8601
  status: 'active' | 'expired' | 'revoked';
  accessLog: {
    timestamp: string;
    ip: string;
    userAgent: string;
    accessedSection: string;
  }[];
  grantedBy: string; // "S. Devi via Raj Devi (son)"
  grantedAt: string;
  revokedAt?: string;
}
```

---

### 4.3 Normalized Bounding-Box Coordinate System

To power the **Source Highlight Link** feature (connecting every extracted fact, lab value, medication dose, or danger sign back to the visual bounding box on the original PDF or phone photo scan), CareCanvas uses a normalized coordinate format:

```typescript
export interface BoundingBox {
  pageIndex: number; // 0-indexed page in multi-page document
  x: number;         // Normalized horizontal offset from left [0.0 - 1.0]
  y: number;         // Normalized vertical offset from top [0.0 - 1.0]
  width: number;     // Normalized width [0.0 - 1.0]
  height: number;    // Normalized height [0.0 - 1.0]
  textSnippet: string; // Verbatim OCR text span: "eGFR: 32 mL/min/1.73m2"
  highlightColor?: string; // "rgba(239, 68, 68, 0.35)" (Red) | "rgba(245, 158, 11, 0.35)" (Amber) | "rgba(16, 185, 129, 0.35)" (Emerald)
}
```

#### Canvas Coordinate Mapping Transform:
When rendering an interactive highlight overlay on top of a rendered PDF page canvas of width `W` and height `H` at viewport zoom level `Z`:
$$\text{Top} = y \times H \times Z$$
$$\text{Left} = x \times W \times Z$$
$$\text{BoxWidth} = \text{width} \times W \times Z$$
$$\text{BoxHeight} = \text{height} \times H \times Z$$

*Interaction Contract:* Clicking any fact row in RxBridge, LabStory, or Continuity Dossier dispatches an event `HIGHLIGHT_SOURCE_DOCUMENT({ documentId, boundingBox })` which auto-switches to the document viewer, pans smoothly to the coordinates, and flashes a pulsed SVG overlay.

---

### 4.4 Question Bank Auto-Aggregation Schema

The Question Bank collects doctor questions generated across all modules into an exportable, interactive agenda for upcoming clinic visits:

```typescript
export interface QuestionBankItem {
  id: string; // "qb-item-001"
  patientId: string;
  sourceModule: 'rxbridge' | 'labstory' | 'homelab' | 'safety' | 'pillmap';
  category: 'medication_clarification' | 'lab_trend_inquiry' | 'diet_interaction_query' | 'danger_sign_followup' | 'dosage_question';
  questionText: string; // "Why was Lisinopril stopped at discharge, and should I resume it now that my swelling has resolved?"
  clinicalRationale: string; // "Lisinopril was present pre-admission but omitted from discharge list without documented reason."
  linkedEntities: {
    factIds?: string[];
    medicationIds?: string[];
    labIds?: string[];
    proposalIds?: string[];
    calendarEventIds?: string[];
  };
  priority: 'urgent' | 'high' | 'routine';
  status: 'active' | 'discussed' | 'dismissed';
  includedInExport: boolean;
  createdAt: string;
}
```

---

## 5. Complete WebMCP Tools Inventory (40 Tools across 7 Modules)

Below is the exhaustive, rigorous specification for all WebMCP tools in CareCanvas.

```
========================================================================================
MODULE 0: APPROVED FACT VAULT & CORE FOUNDATION (3 Tools)
========================================================================================
```

### Tool 0.1: `extract_fact`
- **Module Owner:** `vault`
- **Category:** `imperative_extraction`
- **Clinical Role:** Parses raw text, scanned images, or PDF medical records to extract atomic clinical facts (labs, meds, allergies, conditions, vitals, diet habits) with plain-language narration and bounding-box coordinates.
- **Human Approval Required:** `true` (Every extracted fact enters `pending` state; cannot propagate without confirmation).
- **Approval Gate Mechanism:** Inline `Approve / Edit / Reject` fact card on extraction canvas.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "documentId": { "type": "string", "description": "ID of document in LocalVault" },
    "rawText": { "type": "string", "description": "OCR or parsed text content" },
    "documentType": {
      "type": "string",
      "enum": ["discharge_summary", "lab_report", "prescription", "photo_slip", "referral"]
    },
    "extractCategories": {
      "type": "array",
      "items": { "type": "string", "enum": ["lab", "medication", "allergy", "condition", "vital", "diet_habit"] }
    }
  },
  "required": ["documentId", "documentType"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "extractedFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "category": { "type": "string" },
          "factKey": { "type": "string" },
          "factValue": { "type": ["string", "number"] },
          "unit": { "type": "string" },
          "plainNarration": { "type": "string" },
          "sourceBoundingBox": {
            "type": "object",
            "properties": {
              "pageIndex": { "type": "integer" },
              "x": { "type": "number" },
              "y": { "type": "number" },
              "width": { "type": "number" },
              "height": { "type": "number" },
              "textSnippet": { "type": "string" }
            },
            "required": ["pageIndex", "x", "y", "width", "height", "textSnippet"]
          },
          "confidence": { "type": "number" }
        },
        "required": ["id", "category", "factKey", "factValue", "plainNarration", "sourceBoundingBox"]
      }
    },
    "totalCount": { "type": "integer" },
    "summaryNarration": { "type": "string" }
  },
  "required": ["extractedFacts", "totalCount", "summaryNarration"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Emits `FACTS_EXTRACTED` event.
  - Spawns interactive extraction cards with animated pulse on source PDF canvas.
  - Shows toast: *"Extracted X clinical facts. Please review and approve."*

---

### Tool 0.2: `confirm_fact`
- **Module Owner:** `vault`
- **Category:** `approval_gate`
- **Clinical Role:** Patient or caregiver explicitly approves, edits, or rejects an extracted fact. Approved facts are committed to the active LocalVault and propagate to downstream modules.
- **Human Approval Required:** `false` (This tool is the approval execution handler itself).
- **Approval Gate Mechanism:** Direct user interaction handler.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "factId": { "type": "string", "description": "Unique ID of the extracted fact" },
    "action": { "type": "string", "enum": ["approve", "edit", "reject"] },
    "editedValue": { "type": ["string", "number"], "description": "New value if action is edit" },
    "editedUnit": { "type": "string", "description": "New unit if action is edit" },
    "rejectionReason": { "type": "string", "description": "Optional reason for rejection" },
    "proxyMetadata": {
      "type": "object",
      "properties": {
        "actorId": { "type": "string" },
        "actorName": { "type": "string" },
        "relationship": { "type": "string" }
      }
    }
  },
  "required": ["factId", "action"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "factId": { "type": "string" },
    "status": { "type": "string", "enum": ["approved", "edited", "rejected"] },
    "propagatedTo": { "type": "array", "items": { "type": "string" } },
    "auditLogId": { "type": "string" },
    "message": { "type": "string" }
  },
  "required": ["factId", "status", "auditLogId", "message"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Status chip updates to green (Approved), blue (Edited), or red strikethrough (Rejected).
  - Appends record to `audit_log` object store.
  - If approved, dispatches `FACT_COMMITTED` event triggering auto-refresh in PillMap, LabStory, or RxBridge.

---

### Tool 0.3: `compile_health_record`
- **Module Owner:** `vault` / `dossier`
- **Category:** `declarative_export`
- **Clinical Role:** Gathers all approved facts, active medications, longitudinal lab trends, reconciliation histories, and doctor notes into a unified health record structure.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "includeSections": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["demographics", "active_meds", "med_history", "lab_trends", "allergies", "conditions", "safety_alerts", "care_circle", "audit_trail"]
      }
    },
    "format": { "type": "string", "enum": ["json_dossier", "fhir_r4", "summary_card"], "default": "json_dossier" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "dossierId": { "type": "string" },
    "compiledAt": { "type": "string" },
    "patientSummary": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "activeMedicationCount": { "type": "integer" },
        "chronicConditionCount": { "type": "integer" },
        "allergyCount": { "type": "integer" },
        "lastLabRecorded": { "type": "string" }
      },
      "required": ["name", "activeMedicationCount", "chronicConditionCount"]
    },
    "sections": { "type": "object" },
    "fhirBundle": { "type": "object" }
  },
  "required": ["dossierId", "compiledAt", "patientSummary", "sections"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders Continuity Dossier view with interactive source highlight anchors.

```
========================================================================================
MODULE 1: LABSTORY — LONGITUDINAL BIOMARKER CAUSAL ENGINE (2 Tools)
========================================================================================
```

### Tool 1.1: `extract_labs`
- **Module Owner:** `labstory`
- **Category:** `imperative_extraction`
- **Clinical Role:** Multi-doc/photo lab extraction across 5-year histories. Automatically normalizes units (e.g. mg/dL vs mmol/L), detects reference ranges, computes 10% borderline flags, and organizes chronologically.
- **Human Approval Required:** `true` (Labs require patient confirmation before plotting).
- **Approval Gate Mechanism:** Inline Lab Card approval drawer.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "documentIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of lab document IDs in LocalVault"
    },
    "defaultNormalizationUnitSystem": {
      "type": "string",
      "enum": ["US_CONVENTIONAL", "SI_METRIC"],
      "default": "US_CONVENTIONAL"
    }
  },
  "required": ["documentIds"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "extractedLabs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "markerCode": { "type": "string" },
          "markerName": { "type": "string" },
          "category": { "type": "string" },
          "value": { "type": "number" },
          "unit": { "type": "string" },
          "normalizedValue": { "type": "number" },
          "normalizedUnit": { "type": "string" },
          "drawDate": { "type": "string" },
          "referenceRange": {
            "type": "object",
            "properties": { "low": { "type": "number" }, "high": { "type": "number" }, "unit": { "type": "string" } },
            "required": ["low", "high", "unit"]
          },
          "optimalRange": {
            "type": "object",
            "properties": { "low": { "type": "number" }, "high": { "type": "number" }, "unit": { "type": "string" } }
          },
          "flag": { "type": "string", "enum": ["normal", "borderline_low", "borderline_high", "critical_low", "critical_high"] },
          "sourceBoundingBox": { "type": "object" },
          "storySentence": { "type": "string" }
        },
        "required": ["id", "markerCode", "markerName", "value", "drawDate", "referenceRange", "flag", "storySentence"]
      }
    },
    "timelineSpan": {
      "type": "object",
      "properties": { "earliestDate": { "type": "string" }, "latestDate": { "type": "string" }, "totalDataPoints": { "type": "integer" } }
    }
  },
  "required": ["extractedLabs", "timelineSpan"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Instantiates or updates DuckDB-Wasm in-browser dataset.
  - Re-renders LabStory Canvas timeline with animated spline curves and reference range ribbons.

---

### Tool 1.2: `correlate_meds`
- **Module Owner:** `labstory`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Evaluates causal relationships between medication start/stop/dose changes and biomarker trajectories (e.g. Metformin initiation vs HbA1c drop; Prednisone timing vs blood glucose spikes; NSAID use vs eGFR decline). Auto-generates targeted doctor questions.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "markerCode": { "type": "string", "description": "e.g. eGFR, A1c, Creatinine, Potassium" },
    "timeRangeMonths": { "type": "integer", "default": 24 },
    "naturalLanguageQuery": { "type": "string", "description": "e.g. Why is my A1c up since March?" }
  },
  "required": ["markerCode"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "markerCode": { "type": "string" },
    "causalFindings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "medicationName": { "type": "string" },
          "eventDate": { "type": "string" },
          "eventType": { "type": "string", "enum": ["started", "stopped", "dose_increased", "dose_decreased", "missed_doses"] },
          "observedLabDelta": { "type": "string" },
          "causalConfidence": { "type": "string", "enum": ["high_probability", "moderate", "possible_confounder"] },
          "clinicalMechanism": { "type": "string" },
          "plainExplanation": { "type": "string" }
        },
        "required": ["medicationName", "eventType", "clinicalMechanism", "plainExplanation"]
      }
    },
    "suggestedDoctorQuestions": {
      "type": "array",
      "items": { "type": "string" }
    },
    "chartOverlayBands": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "medicationId": { "type": "string" },
          "medicationName": { "type": "string" },
          "startDate": { "type": "string" },
          "endDate": { "type": ["string", "null"] },
          "colorHex": { "type": "string" }
        },
        "required": ["medicationName", "startDate", "colorHex"]
      }
    }
  },
  "required": ["markerCode", "causalFindings", "suggestedDoctorQuestions", "chartOverlayBands"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders colored translucent medication bands over the LabStory chart canvas.
  - Automatically pushes generated questions to the **Question Bank**.
  - Displays interactive explanation card with causal narrative.

```
========================================================================================
MODULE 2: PILLMAP — VISUAL POLYPHARMACY NEGOTIATOR (8 Tools)
========================================================================================
```

### Tool 2.1: `add_medication`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Adds an Rx, OTC, or dietary supplement to the patient's 7x4 weekly pillbox schedule.
- **Human Approval Required:** `false` (Direct user drag-and-drop or explicit agent action).
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "dosage": { "type": "string" },
    "category": { "type": "string", "enum": ["rx", "otc", "supplement"] },
    "timeSlots": {
      "type": "array",
      "items": { "type": "string", "enum": ["morning", "noon", "evening", "bedtime"] }
    },
    "daysOfWeek": {
      "type": "array",
      "items": { "type": "string", "enum": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
      "default": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    },
    "withFood": { "type": "boolean", "default": false },
    "foodInstructions": { "type": "string" }
  },
  "required": ["name", "dosage", "timeSlots"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "medicationId": { "type": "string" },
    "placedSlots": { "type": "array", "items": { "type": "string" } },
    "triggerInteractionsCheck": { "type": "boolean" },
    "message": { "type": "string" }
  },
  "required": ["medicationId", "placedSlots", "triggerInteractionsCheck", "message"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Pill icon snaps into the corresponding 7x4 grid cell with a smooth spring animation.
  - Automatically triggers `check_interactions` and `check_diet_interactions`.

---

### Tool 2.2: `check_interactions`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Evaluates all active medications and OTCs on the 7x4 canvas for dangerous drug-drug interactions, contraindications, and QT prolongation. Computes SVG connecting arc coordinates.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "interactionCount": { "type": "integer" },
    "interactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "medicationA": { "type": "string" },
          "medicationB": { "type": "string" },
          "severity": { "type": "string", "enum": ["contraindicated", "major", "moderate", "minor"] },
          "arcColor": { "type": "string", "enum": ["#EF4444", "#F97316", "#EAB308", "#3B82F6"] },
          "plainMechanism": { "type": "string" },
          "clinicalRisk": { "type": "string" },
          "recommendedAction": { "type": "string" },
          "sourceSlotsA": { "type": "array", "items": { "type": "string" } },
          "sourceSlotsB": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["medicationA", "medicationB", "severity", "arcColor", "plainMechanism", "recommendedAction"]
      }
    }
  },
  "required": ["interactionCount", "interactions"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Draws dynamic SVG bezier curves (Red = Contraindicated, Orange = Major, Yellow = Moderate) directly between conflicting pill icons on the 7x4 grid.
  - Clicking any arc opens a slide-over interaction explanation sheet.

---

### Tool 2.3: `check_diet_interactions`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Evaluates active medications against patient dietary habits (e.g. Warfarin vs high Vitamin K leafy greens; Atorvastatin vs grapefruit; Levothyroxine vs calcium/dairy; Metronidazole vs alcohol).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "dietFlags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "medicationName": { "type": "string" },
          "foodItem": { "type": "string" },
          "badgeType": { "type": "string", "enum": ["avoid_food", "take_with_food", "take_empty_stomach", "separate_calcium", "avoid_alcohol"] },
          "severity": { "type": "string", "enum": ["warning", "caution", "instruction"] },
          "plainInstructions": { "type": "string" },
          "timingShiftRule": { "type": "string" }
        },
        "required": ["medicationName", "foodItem", "badgeType", "plainInstructions"]
      }
    }
  },
  "required": ["dietFlags"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Attaches meal-time badges (e.g. 🥬, 🍊, 🥛, 🚫🍺) to pill cards.
  - Draws amber SVG arcs connecting pill icons to canvas plate/meal markers.

---

### Tool 2.4: `check_duplicate_ingredient`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Detects identical active pharmaceutical ingredients hidden under different brand or combo names (e.g., Acetaminophen in Tylenol + Percocet + NyQuil).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "duplicatesFound": { "type": "boolean" },
    "duplicateGroups": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "activeIngredient": { "type": "string" },
          "conflictingMedications": { "type": "array", "items": { "type": "string" } },
          "cumulativeDailyDose": { "type": "string" },
          "maxSafeDailyDose": { "type": "string" },
          "isExceeded": { "type": "boolean" },
          "plainWarning": { "type": "string" }
        },
        "required": ["activeIngredient", "conflictingMedications", "cumulativeDailyDose", "plainWarning"]
      }
    }
  },
  "required": ["duplicatesFound", "duplicateGroups"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Displays a prominent amber duplication badge with pulse animation on both pill icons.

---

### Tool 2.5: `suggest_schedule`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Computes an optimized 7x4 schedule resolving drug-drug and drug-diet conflicts while adapting to patient chronotype (early bird vs night owl). Generates an interactive **ghost preview**.
- **Human Approval Required:** `true` (Timing changes must be approved before updating the live schedule).
- **Approval Gate Mechanism:** Interactive "Accept Schedule Changes" floating modal.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "chronotype": {
      "type": "string",
      "enum": ["early_bird", "intermediate", "night_owl"],
      "default": "intermediate"
    },
    "wakeUpTime": { "type": "string", "default": "07:00" },
    "bedTime": { "type": "string", "default": "22:30" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposedShifts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "medicationId": { "type": "string" },
          "medicationName": { "type": "string" },
          "fromSlot": { "type": "string" },
          "toSlot": { "type": "string" },
          "rationale": { "type": "string" }
        },
        "required": ["medicationName", "fromSlot", "toSlot", "rationale"]
      }
    },
    "conflictsResolvedCount": { "type": "integer" },
    "summaryExplanation": { "type": "string" }
  },
  "required": ["proposedShifts", "conflictsResolvedCount", "summaryExplanation"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders translucent **ghost pill previews** in destination slots with dashed borders and motion arrow trails.
  - Upon patient approval, ghost pills solidify and previous slots fade out smoothly.

---

### Tool 2.6: `simulate_adherence`
- **Module Owner:** `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Calculates clinical risk and pharmacokinetic delta when a patient drags a pill off the canvas to simulate a missed dose.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "medicationId": { "type": "string" },
    "missedSlot": { "type": "string", "enum": ["morning", "noon", "evening", "bedtime"] },
    "missedDay": { "type": "string", "enum": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] }
  },
  "required": ["medicationId", "missedSlot", "missedDay"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "medicationName": { "type": "string" },
    "missedTimeDescription": { "type": "string" },
    "clinicalRiskLevel": { "type": "string", "enum": ["low", "moderate", "high", "critical"] },
    "riskNarrative": { "type": "string" },
    "catchUpGuidance": { "type": "string" }
  },
  "required": ["medicationName", "clinicalRiskLevel", "riskNarrative", "catchUpGuidance"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Displays risk alert toast with specific catch-up guidance (e.g., *"Do not take a double dose on Wednesday morning"*).

---

### Tool 2.7: `export_for_pharmacist`
- **Module Owner:** `pillmap`
- **Category:** `declarative_export`
- **Clinical Role:** Generates a clean 1-page visual map and schedule document for clinical pharmacist review.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "includeAllergies": { "type": "boolean", "default": true },
    "includeInteractionHistory": { "type": "boolean", "default": true }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "documentTitle": { "type": "string" },
    "exportTimestamp": { "type": "string" },
    "patientInfo": { "type": "object" },
    "weeklyGrid": { "type": "object" },
    "interactionLog": { "type": "array", "items": { "type": "object" } },
    "pdfBlobUrl": { "type": "string" }
  },
  "required": ["documentTitle", "exportTimestamp", "weeklyGrid", "pdfBlobUrl"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Triggers browser print/download dialog with pre-styled 1-page PDF.

---

### Tool 2.8: `set_reminder`
- **Module Owner:** `pillmap` / `rxbridge`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Sets persistent client-side medication time-slot alarms and notification triggers surviving page reload.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "timeSlot": { "type": "string", "enum": ["morning", "noon", "evening", "bedtime"] },
    "alarmTime": { "type": "string", "description": "HH:MM format, e.g. 08:00" },
    "medicationIds": { "type": "array", "items": { "type": "string" } },
    "dietInstructions": { "type": "string" }
  },
  "required": ["timeSlot", "alarmTime", "medicationIds"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "reminderId": { "type": "string" },
    "timeSlot": { "type": "string" },
    "alarmTime": { "type": "string" },
    "active": { "type": "boolean" },
    "summary": { "type": "string" }
  },
  "required": ["reminderId", "timeSlot", "alarmTime", "active", "summary"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Updates clock badge on PillMap time column.

```
========================================================================================
MODULE 3: RXBRIDGE — POST-DISCHARGE 3-LIST RECONCILIATION WALK (5 Tools)
========================================================================================
```

### Tool 3.1: `explain_med_change`
- **Module Owner:** `rxbridge`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Analyzes discrepancies across (1) Pre-admission, (2) In-Hospital, and (3) Discharge lists. Generates plain-language comparative narratives tagged by change category.
- **Human Approval Required:** `true` (Every reconciliation item requires patient confirmation before committing).
- **Approval Gate Mechanism:** Conversational walk-through card with `Approve / Edit / Ask Doctor` buttons.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "genericName": { "type": "string" },
    "preAdmissionDose": { "type": ["string", "null"] },
    "inHospitalDose": { "type": ["string", "null"] },
    "dischargeDose": { "type": ["string", "null"] },
    "documentedReason": { "type": "string" }
  },
  "required": ["genericName"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "genericName": { "type": "string" },
    "changeCategory": {
      "type": "string",
      "enum": ["continued", "dose_doubled", "dose_halved", "stopped", "new", "held_in_hospital_resumed"]
    },
    "plainEnglishExplanation": { "type": "string" },
    "clinicalRationale": { "type": "string" },
    "actionRequired": { "type": "string" },
    "highlightTerms": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["genericName", "changeCategory", "plainEnglishExplanation", "actionRequired"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders conversational card in RxBridge step-by-step walk.
  - Highlights differential changes with animated badges.

---

### Tool 3.2: `flag_interaction`
- **Module Owner:** `rxbridge`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Evaluates newly prescribed discharge medications against carryover hospital meds, patient's home OTC supplements, and baseline LabStory values (e.g. eGFR, Potassium).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dischargeMedications": { "type": "array", "items": { "type": "string" } },
    "otcSupplements": { "type": "array", "items": { "type": "string" } },
    "recentLabValues": {
      "type": "object",
      "properties": {
        "eGFR": { "type": "number" },
        "potassium": { "type": "number" },
        "creatinine": { "type": "number" }
      }
    }
  },
  "required": ["dischargeMedications"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "flagCount": { "type": "integer" },
    "flags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "triggerDrug": { "type": "string" },
          "conflictingEntity": { "type": "string" },
          "flagCategory": { "type": "string", "enum": ["drug_drug", "drug_otc", "drug_lab_contraindication"] },
          "severity": { "type": "string", "enum": ["contraindicated", "major", "moderate"] },
          "plainExplanation": { "type": "string" },
          "labContext": { "type": "string" },
          "recommendedAction": { "type": "string" }
        },
        "required": ["triggerDrug", "conflictingEntity", "flagCategory", "severity", "plainExplanation"]
      }
    }
  },
  "required": ["flagCount", "flags"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Emits `RX_INTERACTIONS_DETECTED` which feeds directly into PillMap SVG arcs.

---

### Tool 3.3: `flag_diet_interaction`
- **Module Owner:** `rxbridge`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Cross-checks discharge medications against patient's self-reported dietary habits, alcohol intake, and food timing constraints.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dischargeMedications": { "type": "array", "items": { "type": "string" } },
    "dietHabits": {
      "type": "object",
      "properties": {
        "isVegetarian": { "type": "boolean" },
        "highPotassiumDiet": { "type": "boolean" },
        "grapefruitConsumption": { "type": "boolean" },
        "dairyCalciumIntake": { "type": "boolean" },
        "alcoholFrequency": { "type": "string", "enum": ["none", "occasional", "frequent"] }
      }
    }
  },
  "required": ["dischargeMedications", "dietHabits"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "dietFlags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "medicationName": { "type": "string" },
          "dietFactor": { "type": "string" },
          "interactionRisk": { "type": "string" },
          "mealTimingRule": { "type": "string" },
          "plainExplanation": { "type": "string" }
        },
        "required": ["medicationName", "dietFactor", "mealTimingRule", "plainExplanation"]
      }
    }
  },
  "required": ["dietFlags"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Adds meal badges and diet advice banners in the RxBridge summary.

---

### Tool 3.4: `suggest_question_for_doctor`
- **Module Owner:** `rxbridge` / `labstory`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Generates structured, patient-friendly doctor questions based on reconciliation gaps, stopped medications without stated reasons, or interaction warnings.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "contextSource": { "type": "string", "enum": ["rxbridge_discrepancy", "labstory_trend", "diet_interaction", "danger_sign"] },
    "medicationOrLab": { "type": "string" },
    "observedAnomaly": { "type": "string" }
  },
  "required": ["contextSource", "medicationOrLab", "observedAnomaly"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "questionItem": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "questionText": { "type": "string" },
        "clinicalRationale": { "type": "string" },
        "priority": { "type": "string", "enum": ["urgent", "high", "routine"] }
      },
      "required": ["id", "questionText", "clinicalRationale", "priority"]
    },
    "addedToQuestionBank": { "type": "boolean" }
  },
  "required": ["questionItem", "addedToQuestionBank"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Inserts question into `Question Bank` store and animates counter badge in header.

---

### Tool 3.5: `export_patient_summary`
- **Module Owner:** `rxbridge` / `dossier`
- **Category:** `declarative_export`
- **Clinical Role:** Compiles a 1-page plain-English discharge home sheet: what changed, daily schedule, meal/food instructions, foods to avoid, and red flags.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "includeRedFlags": { "type": "boolean", "default": true },
    "includeQuestionBank": { "type": "boolean", "default": true }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "summaryTitle": { "type": "string" },
    "dischargeDate": { "type": "string" },
    "reconciledMedications": { "type": "array", "items": { "type": "object" } },
    "foodAndDietGuidance": { "type": "array", "items": { "type": "string" } },
    "redFlagSymptoms": { "type": "array", "items": { "type": "string" } },
    "pdfDownloadUrl": { "type": "string" }
  },
  "required": ["summaryTitle", "reconciledMedications", "foodAndDietGuidance", "redFlagSymptoms", "pdfDownloadUrl"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders printable discharge sheet modal.

```
========================================================================================
MODULE 4: HOMELAB LOOP — REMOTE DOCTOR-PRESCRIBED CADENCE (5 Tools)
========================================================================================
```

### Tool 4.1: `upload_lab_image`
- **Module Owner:** `homelab`
- **Category:** `imperative_extraction`
- **Clinical Role:** Handles remote patient upload (photo/PDF) of prescribed lab slip, links it to active due card, and triggers `extract_labs`.
- **Human Approval Required:** `true` (Extracted labs require approval).
- **Approval Gate Mechanism:** Due Card upload confirmation modal.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dueCardId": { "type": "string" },
    "imageBlobOrDataUrl": { "type": "string" },
    "fileName": { "type": "string" }
  },
  "required": ["dueCardId", "imageBlobOrDataUrl"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "documentId": { "type": "string" },
    "dueCardId": { "type": "string" },
    "status": { "type": "string", "enum": ["uploaded_processing", "extracted_awaiting_approval"] },
    "narration": { "type": "string" }
  },
  "required": ["documentId", "dueCardId", "status", "narration"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Due Card transitions from `Overdue/Pending` to `Completed` with green checkmark animation.

---

### Tool 4.2: `doctor_review_comment`
- **Module Owner:** `homelab`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Pins a clinician's clinical note/comment to a specific biomarker data point on the LabStory timeline.
- **Human Approval Required:** `false` (Doctor clinical record entry).
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "labId": { "type": "string" },
    "doctorId": { "type": "string" },
    "doctorName": { "type": "string" },
    "commentText": { "type": "string" },
    "clinicalSeverity": { "type": "string", "enum": ["info", "action_required", "urgent"] }
  },
  "required": ["labId", "doctorId", "doctorName", "commentText"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "commentId": { "type": "string" },
    "labId": { "type": "string" },
    "pinnedAt": { "type": "string" },
    "displayHtml": { "type": "string" }
  },
  "required": ["commentId", "labId", "pinnedAt"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Pins an interactive doctor stethoscope icon onto the exact data point on the LabStory canvas chart.

---

### Tool 4.3: `propose_dosage_change`
- **Module Owner:** `homelab` / `safety`
- **Category:** `approval_gate`
- **Clinical Role:** Creates a pending dosage change proposal card linked to a lab result or danger sign with clinical rationale.
- **Human Approval Required:** `true` (Must be approved by patient/caregiver).
- **Approval Gate Mechanism:** High-priority Dosage Proposal Card requiring `Approve / Edit / Ask Question`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "proposerName": { "type": "string" },
    "targetMedicationName": { "type": "string" },
    "currentDosage": { "type": "string" },
    "proposedDosage": { "type": "string" },
    "proposedTimeSlots": { "type": "array", "items": { "type": "string" } },
    "clinicalRationale": { "type": "string" },
    "linkedLabId": { "type": "string" }
  },
  "required": ["patientId", "proposerName", "targetMedicationName", "currentDosage", "proposedDosage", "clinicalRationale"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "status": { "type": "string", "enum": ["pending_patient_approval"] },
    "plainCardText": { "type": "string" },
    "visualDiffPreview": {
      "type": "object",
      "properties": { "before": { "type": "string" }, "after": { "type": "string" } }
    }
  },
  "required": ["proposalId", "status", "plainCardText", "visualDiffPreview"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Mounts active Proposal Banner across all screens; rings notification bell.

---

### Tool 4.4: `approve_dosage_change`
- **Module Owner:** `homelab`
- **Category:** `approval_gate`
- **Clinical Role:** Patient or proxy caregiver executes approval/rejection of the dosage proposal.
- **Human Approval Required:** `false` (Approval handler).
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "action": { "type": "string", "enum": ["approve", "reject", "edit"] },
    "proxyMetadata": {
      "type": "object",
      "properties": {
        "actorId": { "type": "string" },
        "actorName": { "type": "string" },
        "relationship": { "type": "string" }
      }
    }
  },
  "required": ["proposalId", "action"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "status": { "type": "string", "enum": ["approved", "rejected", "edited"] },
    "auditRecord": { "type": "string" },
    "triggerPillMapSync": { "type": "boolean" }
  },
  "required": ["proposalId", "status", "auditRecord", "triggerPillMapSync"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Auto-invokes `sync_pillmap_from_proposal`.

---

### Tool 4.5: `sync_pillmap_from_proposal`
- **Module Owner:** `homelab` / `pillmap`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Executes the approved dosage change on the 7x4 PillMap canvas and appends colored med band to LabStory timeline.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" }
  },
  "required": ["proposalId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "updatedMedicationId": { "type": "string" },
    "previousDosage": { "type": "string" },
    "newDosage": { "type": "string" },
    "pillMapSlotsUpdated": { "type": "array", "items": { "type": "string" } },
    "labStoryBandCreated": { "type": "boolean" }
  },
  "required": ["updatedMedicationId", "newDosage", "pillMapSlotsUpdated", "labStoryBandCreated"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Old pill fades with strikethrough; new dose pill pulses into place.
  - Re-evaluates `check_interactions`.

```
========================================================================================
MODULE 5: SAFETY ALERTS, DOCTOR CONTROL & FOLLOW-UP CALENDAR (9 Tools)
========================================================================================
```

### Tool 5.1: `report_danger_sign`
- **Module Owner:** `safety`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Patient or caregiver reports urgent symptoms (e.g. sudden edema, dyspnea, extreme BP). Logs event and triggers doctor triage queue.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "symptoms": { "type": "array", "items": { "type": "string" } },
    "severity": { "type": "string", "enum": ["mild", "moderate", "severe", "emergency"] },
    "freeTextDescription": { "type": "string" },
    "photoAttachment": { "type": "string" }
  },
  "required": ["patientId", "symptoms", "severity"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "alertId": { "type": "string" },
    "triageStatus": { "type": "string", "enum": ["triaged_to_doctor", "emergency_call_advised"] },
    "plainImmediateGuidance": { "type": "string" },
    "escalatedAt": { "type": "string" }
  },
  "required": ["alertId", "triageStatus", "plainImmediateGuidance"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Red emergency banner on UI with one-tap clinic dialer and doctor alert confirmation.

---

### Tool 5.2: `notify_doctor`
- **Module Owner:** `safety`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Pushes high-priority alert and patient dossier summary to doctor's clinical inbox.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "alertId": { "type": "string" },
    "doctorId": { "type": "string" },
    "summaryPayload": { "type": "object" }
  },
  "required": ["alertId", "doctorId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "notificationId": { "type": "string" },
    "delivered": { "type": "boolean" },
    "deliveredAt": { "type": "string" }
  },
  "required": ["notificationId", "delivered"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Doctor Inbox updates badge count.

---

### Tool 5.3: `doctor_add_medication`
- **Module Owner:** `safety` / `pillmap`
- **Category:** `approval_gate`
- **Clinical Role:** Doctor initiates adding a new prescription in response to triage or lab trend.
- **Human Approval Required:** `true` (Enters pending state for patient approval).
- **Approval Gate Mechanism:** PillMap Doctor Prescription Proposal Card.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "medicationName": { "type": "string" },
    "dosage": { "type": "string" },
    "timeSlots": { "type": "array", "items": { "type": "string" } },
    "clinicalReason": { "type": "string" }
  },
  "required": ["patientId", "medicationName", "dosage", "timeSlots", "clinicalReason"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "status": { "type": "string", "enum": ["pending_patient_approval"] },
    "plainSummary": { "type": "string" }
  },
  "required": ["proposalId", "status", "plainSummary"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Proposal card rendered in PillMap header.

---

### Tool 5.4: `doctor_remove_medication`
- **Module Owner:** `safety` / `pillmap`
- **Category:** `approval_gate`
- **Clinical Role:** Doctor initiates medication discontinuation (e.g. stopping NSAID due to eGFR drop and edema).
- **Human Approval Required:** `true` (Enters pending state for patient approval).
- **Approval Gate Mechanism:** PillMap Discontinuation Proposal Card.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "medicationName": { "type": "string" },
    "clinicalReason": { "type": "string" },
    "linkedDangerSignId": { "type": "string" }
  },
  "required": ["patientId", "medicationName", "clinicalReason"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "status": { "type": "string", "enum": ["pending_patient_approval"] },
    "plainSummary": { "type": "string" }
  },
  "required": ["proposalId", "status", "plainSummary"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Target pill on 7x4 grid gets red pulsing outline indicating pending removal.

---

### Tool 5.5: `doctor_change_dose`
- **Module Owner:** `safety` / `pillmap`
- **Category:** `approval_gate`
- **Clinical Role:** Doctor initiates dose titration/change with clinical reason.
- **Human Approval Required:** `true`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "medicationName": { "type": "string" },
    "newDosage": { "type": "string" },
    "clinicalReason": { "type": "string" }
  },
  "required": ["patientId", "medicationName", "newDosage", "clinicalReason"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "status": { "type": "string", "enum": ["pending_patient_approval"] },
    "plainSummary": { "type": "string" }
  },
  "required": ["proposalId", "status", "plainSummary"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Proposal Card displayed.

---

### Tool 5.6: `approve_pillmap_change`
- **Module Owner:** `safety` / `pillmap`
- **Category:** `approval_gate`
- **Clinical Role:** Patient or caregiver approves doctor-initiated add/remove/change.
- **Human Approval Required:** `false` (Approval handler).
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "decision": { "type": "string", "enum": ["approve", "reject"] },
    "proxyMetadata": { "type": "object" }
  },
  "required": ["proposalId", "decision"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "proposalId": { "type": "string" },
    "applied": { "type": "boolean" },
    "auditEntry": { "type": "string" }
  },
  "required": ["proposalId", "applied", "auditEntry"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Animates change on 7x4 grid; updates audit log.

---

### Tool 5.7: `schedule_followup`
- **Module Owner:** `safety` / `calendar`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Schedules follow-up clinic or telehealth review linked to danger sign or lab review.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "targetDate": { "type": "string" },
    "modality": { "type": "string", "enum": ["in_person_clinic", "telehealth_video"] },
    "clinicalReason": { "type": "string" },
    "assignedDoctor": { "type": "string" }
  },
  "required": ["patientId", "targetDate", "modality", "clinicalReason"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "eventId": { "type": "string" },
    "formattedDate": { "type": "string" },
    "title": { "type": "string" },
    "syncRequired": { "type": "boolean" }
  },
  "required": ["eventId", "formattedDate", "title"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Follow-up card mounted on calendar widget.

---

### Tool 5.8: `schedule_lab`
- **Module Owner:** `safety` / `homelab`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Prescribes next lab draw cadence (e.g. Creatinine in 2 weeks; A1c in 3 months).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "markerCode": { "type": "string" },
    "dueDate": { "type": "string" },
    "prescribedReason": { "type": "string" }
  },
  "required": ["patientId", "markerCode", "dueDate"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "dueCardId": { "type": "string" },
    "markerCode": { "type": "string" },
    "dueDate": { "type": "string" },
    "nudgeDays": { "type": "integer" }
  },
  "required": ["dueCardId", "markerCode", "dueDate"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Creates active Due Card on HomeLab timeline.

---

### Tool 5.9: `sync_to_calendar`
- **Module Owner:** `safety` / `calendar`
- **Category:** `declarative_export`
- **Clinical Role:** Generates iCal / WebCal / Google Calendar synchronization payloads for all prescribed labs, appointments, and medication reminder times.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "includeMeds": { "type": "boolean", "default": true },
    "includeLabs": { "type": "boolean", "default": true },
    "includeAppointments": { "type": "boolean", "default": true }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "iCalData": { "type": "string" },
    "googleCalendarUrl": { "type": "string" },
    "totalEventsCount": { "type": "integer" }
  },
  "required": ["iCalData", "googleCalendarUrl", "totalEventsCount"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Toast confirmation with one-click "Add to Apple/Google Calendar".

```
========================================================================================
MODULE 6: FAMILY CARE CIRCLE & CONTINUITY DOSSIER (8 Tools)
========================================================================================
```

### Tool 6.1: `link_patient`
- **Module Owner:** `family`
- **Category:** `approval_gate`
- **Clinical Role:** Caregiver links an elderly or minor dependent profile via relationship and consent verification.
- **Human Approval Required:** `true` (Consent verification required).
- **Approval Gate Mechanism:** OTP / Consent Signature modal.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "caregiverId": { "type": "string" },
    "patientName": { "type": "string" },
    "relationship": { "type": "string", "enum": ["son", "daughter", "spouse", "parent", "guardian", "other"] },
    "consentSignature": { "type": "string" }
  },
  "required": ["caregiverId", "patientName", "relationship", "consentSignature"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "linkId": { "type": "string" },
    "primaryPatientId": { "type": "string" },
    "status": { "type": "string", "enum": ["linked_active"] }
  },
  "required": ["linkId", "primaryPatientId", "status"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Profile switcher in header adds managed dependent item.

---

### Tool 6.2: `grant_caregiver_access`
- **Module Owner:** `family`
- **Category:** `approval_gate`
- **Clinical Role:** Configures scoped access permissions (`View Only`, `Manage`, `Full`).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "linkId": { "type": "string" },
    "permissionLevel": { "type": "string", "enum": ["view_only", "manage", "full"] }
  },
  "required": ["linkId", "permissionLevel"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "linkId": { "type": "string" },
    "permissionLevel": { "type": "string" },
    "capabilities": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["linkId", "permissionLevel", "capabilities"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Updates permission badge in Family Care Circle settings.

---

### Tool 6.3: `revoke_caregiver_access`
- **Module Owner:** `family`
- **Category:** `approval_gate`
- **Clinical Role:** Revokes caregiver proxy rights immediately.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "linkId": { "type": "string" }
  },
  "required": ["linkId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "linkId": { "type": "string" },
    "revoked": { "type": "boolean" },
    "revokedAt": { "type": "string" }
  },
  "required": ["linkId", "revoked", "revokedAt"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Revocation toast; removes proxy avatar.

---

### Tool 6.4: `switch_profile`
- **Module Owner:** `family`
- **Category:** `clinical_negotiation`
- **Clinical Role:** Switches active patient context in LocalVault, swapping PillMap, LabStory, and Dossier to the target patient.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "targetPatientId": { "type": "string" }
  },
  "required": ["targetPatientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "activePatientId": { "type": "string" },
    "activePatientName": { "type": "string" },
    "permissionScope": { "type": "string" }
  },
  "required": ["activePatientId", "activePatientName", "permissionScope"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Entire application context smoothly re-animates to display target patient data.

---

### Tool 6.5: `act_on_behalf`
- **Module Owner:** `family`
- **Category:** `audit_proxy`
- **Clinical Role:** Audited wrapper executing any approved action with proxy metadata (e.g. `Approved by Raj (son) on behalf of S. Devi`).
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "caregiverId": { "type": "string" },
    "caregiverName": { "type": "string" },
    "relationship": { "type": "string" },
    "patientId": { "type": "string" },
    "wrappedToolName": { "type": "string" },
    "wrappedToolParams": { "type": "object" }
  },
  "required": ["caregiverId", "caregiverName", "relationship", "patientId", "wrappedToolName", "wrappedToolParams"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "wrappedResult": { "type": "object" },
    "auditString": { "type": "string" },
    "auditLogId": { "type": "string" }
  },
  "required": ["wrappedResult", "auditString", "auditLogId"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders proxy audit chip on the executed action.

---

### Tool 6.6: `grant_doctor_access`
- **Module Owner:** `dossier`
- **Category:** `approval_gate`
- **Clinical Role:** Issues a time-bound, revocable access token/link to a new doctor for Continuity Dossier review.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "doctorName": { "type": "string" },
    "doctorEmail": { "type": "string" },
    "doctorClinic": { "type": "string" },
    "validHours": { "type": "integer", "default": 72 },
    "scope": { "type": "string", "enum": ["snapshot_only", "full_dossier", "dossier_and_proposals"], "default": "full_dossier" }
  },
  "required": ["patientId", "doctorName", "doctorEmail"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "grantId": { "type": "string" },
    "accessToken": { "type": "string" },
    "shareableUrl": { "type": "string" },
    "expiresAt": { "type": "string" }
  },
  "required": ["grantId", "accessToken", "shareableUrl", "expiresAt"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Displays copyable handover link with QR code modal.

---

### Tool 6.7: `revoke_access`
- **Module Owner:** `dossier`
- **Category:** `approval_gate`
- **Clinical Role:** Immediately invalidates an active doctor access token.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "grantId": { "type": "string" }
  },
  "required": ["grantId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "grantId": { "type": "string" },
    "revoked": { "type": "boolean" },
    "revokedAt": { "type": "string" }
  },
  "required": ["grantId", "revoked", "revokedAt"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Grant status tag switches to red "Revoked".

---

### Tool 6.8: `view_timeline`
- **Module Owner:** `dossier`
- **Category:** `declarative_export`
- **Clinical Role:** Retrieves unified chronological timeline stream across all clinical events, labs, med changes, danger signs, and audit entries.
- **Human Approval Required:** `false`.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "patientId": { "type": "string" },
    "filterCategories": { "type": "array", "items": { "type": "string" } },
    "startDate": { "type": "string" },
    "endDate": { "type": "string" }
  },
  "required": ["patientId"]
}
```
- **Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "totalEvents": { "type": "integer" },
    "timelineEvents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "date": { "type": "string" },
          "category": { "type": "string" },
          "title": { "type": "string" },
          "summary": { "type": "string" },
          "sourceBoundingBox": { "type": "object" },
          "auditAuthor": { "type": "string" }
        },
        "required": ["id", "date", "category", "title", "summary"]
      }
    }
  },
  "required": ["totalEvents", "timelineEvents"]
}
```
- **Reactive DOM & UI Side-Effects:**
  - Renders interactive Continuity Dossier stream with source highlight links.

---

## 6. Comprehensive Tools Summary Matrix

| # | Tool Name | Module Owner | Category | Input Key Fields | Returns | Human Approval Gate | Reactive DOM / UI Effects |
|---|-----------|--------------|----------|------------------|---------|---------------------|---------------------------|
| 1 | `extract_fact` | `vault` | Imperative Extraction | `documentId, rawText, documentType` | Extracted facts array, plain narrations, bounding boxes | **Yes** (Per-fact Approve/Edit/Reject) | Spawns extraction cards; flashes PDF bounding boxes |
| 2 | `confirm_fact` | `vault` | Approval Gate | `factId, action, editedValue, proxy` | Status, auditLogId, propagated modules | No (Handler) | Status chip green/red; commits to LocalVault; updates PillMap/LabStory |
| 3 | `compile_health_record` | `vault` / `dossier` | Declarative Export | `patientId, includeSections, format` | Dossier summary, sections, FHIR bundle | No | Renders Continuity Dossier view |
| 4 | `extract_labs` | `labstory` | Imperative Extraction | `documentIds, unitSystem` | Normalized labs array, ranges, 10% flags, story sentences | **Yes** (Approval Drawer) | Updates DuckDB dataset; draws LabStory canvas spline |
| 5 | `correlate_meds` | `labstory` | Clinical Negotiation | `markerCode, timeRangeMonths, query` | Causal findings, mechanism, doctor questions, med bands | No | Renders translucent colored med bands; feeds Question Bank |
| 6 | `add_medication` | `pillmap` | Clinical Negotiation | `name, dosage, timeSlots, withFood` | medicationId, placedSlots, checkTrigger | No | Spring animation into 7x4 cell; triggers interaction check |
| 7 | `check_interactions` | `pillmap` | Clinical Negotiation | `patientId` | Interactions list, severity, arc colors, plain mechanisms | No | Draws red/orange/yellow SVG bezier arcs between pill icons |
| 8 | `check_diet_interactions` | `pillmap` | Clinical Negotiation | `patientId` | Diet flags, badge types, meal timing rules | No | Attaches meal badges (🥬, 🍊, 🥛); draws amber arcs to meal marker |
| 9 | `check_duplicate_ingredient` | `pillmap` | Clinical Negotiation | `patientId` | Duplicates found, active ingredient, cumulative doses | No | Pulsing amber badge on duplicate pills |
| 10 | `suggest_schedule` | `pillmap` | Clinical Negotiation | `patientId, chronotype, wakeUp, bedTime` | Proposed shifts, resolved conflicts count, summary | **Yes** (Schedule Approval Modal) | Translucent ghost pill previews; animated shifts on approve |
| 11 | `simulate_adherence` | `pillmap` | Clinical Negotiation | `medicationId, missedSlot, missedDay` | Risk level, clinical narrative, catch-up guidance | No | Adherence risk delta alert toast |
| 12 | `export_for_pharmacist` | `pillmap` | Declarative Export | `patientId, includeAllergies` | 1-page visual map, schedule text, PDF blob URL | No | Triggers browser print/download dialog |
| 13 | `set_reminder` | `pillmap` / `rxbridge` | Clinical Negotiation | `timeSlot, alarmTime, medicationIds` | reminderId, active status, summary | No | Clock badge update on 7x4 time column |
| 14 | `explain_med_change` | `rxbridge` | Clinical Negotiation | `genericName, preDose, hospDose, postDose` | Change category, plain explanation, action | **Yes** (Reconciliation Walk Card) | Interactive walk card; status badges (Dose Doubled, Stopped) |
| 15 | `flag_interaction` | `rxbridge` | Clinical Negotiation | `dischargeMeds, otcs, labValues` | Flags list, severity, lab context (eGFR/K+) | No | Feeds PillMap SVG conflict arcs |
| 16 | `flag_diet_interaction` | `rxbridge` | Clinical Negotiation | `dischargeMeds, dietHabits` | Diet flags, meal timing advice, food conflicts | No | Diet warning banners in RxBridge summary |
| 17 | `suggest_question_for_doctor` | `rxbridge` / `labstory` | Clinical Negotiation | `contextSource, medicationOrLab, anomaly` | Question item, rationale, priority | No | Pushes to Question Bank; header badge increments |
| 18 | `export_patient_summary` | `rxbridge` / `dossier` | Declarative Export | `patientId, includeRedFlags` | 1-page home sheet, food rules, red flags, PDF URL | No | Printable discharge sheet modal |
| 19 | `upload_lab_image` | `homelab` | Imperative Extraction | `dueCardId, imageBlobOrDataUrl, fileName` | documentId, dueCardId, processing status | **Yes** (Extracted labs approval) | Due Card transitions to green checkmark |
| 20 | `doctor_review_comment` | `homelab` | Clinical Negotiation | `labId, doctorId, commentText, severity` | commentId, pinnedAt, displayHtml | No | Pinned stethoscope icon on LabStory chart point |
| 21 | `propose_dosage_change` | `homelab` / `safety` | Approval Gate | `patientId, proposer, targetMed, newDose, why` | proposalId, pending status, plain card, visual diff | **Yes** (Patient/Caregiver Approval) | Proposal Banner across screens; ringing bell |
| 22 | `approve_dosage_change` | `homelab` | Approval Gate | `proposalId, action, proxyMetadata` | Status, auditRecord, triggerSync | No (Handler) | Dispatches sync to PillMap |
| 23 | `sync_pillmap_from_proposal` | `homelab` / `pillmap` | Clinical Negotiation | `proposalId` | Updated medId, new dose, slots, lab band created | No | Old dose fades; new dose pulses; LabStory med band added |
| 24 | `report_danger_sign` | `safety` | Clinical Negotiation | `patientId, symptoms, severity, text, photo` | alertId, triageStatus, immediateGuidance | No | Emergency top banner with 1-tap clinic dialer |
| 25 | `notify_doctor` | `safety` | Clinical Negotiation | `alertId, doctorId, summaryPayload` | notificationId, delivered, deliveredAt | No | Doctor Inbox counter incremented |
| 26 | `doctor_add_medication` | `safety` / `pillmap` | Approval Gate | `patientId, medName, dose, timeSlots, reason` | proposalId, pending status, summary | **Yes** (Patient Approval) | PillMap Proposal card mounted |
| 27 | `doctor_remove_medication` | `safety` / `pillmap` | Approval Gate | `patientId, medName, clinicalReason` | proposalId, pending status, summary | **Yes** (Patient Approval) | Red pulsing outline on target pill |
| 28 | `doctor_change_dose` | `safety` / `pillmap` | Approval Gate | `patientId, medName, newDose, reason` | proposalId, pending status, summary | **Yes** (Patient Approval) | Proposal Card mounted |
| 29 | `approve_pillmap_change` | `safety` / `pillmap` | Approval Gate | `proposalId, decision, proxyMetadata` | proposalId, applied, auditEntry | No (Handler) | PillMap grid re-animates; audit logged |
| 30 | `schedule_followup` | `safety` / `calendar` | Clinical Negotiation | `patientId, targetDate, modality, reason` | eventId, formattedDate, title | No | Follow-up card mounted on calendar |
| 31 | `schedule_lab` | `safety` / `homelab` | Clinical Negotiation | `patientId, markerCode, dueDate, reason` | dueCardId, markerCode, dueDate | No | Due Card mounted on HomeLab timeline |
| 32 | `sync_to_calendar` | `safety` / `calendar` | Declarative Export | `patientId, includeMeds, includeLabs` | iCalData, googleCalUrl, totalCount | No | Calendar sync toast with 1-click links |
| 33 | `link_patient` | `family` | Approval Gate | `caregiverId, patientName, relationship, consent`| linkId, primaryPatientId, status | **Yes** (Consent Verification) | Profile switcher adds managed patient |
| 34 | `grant_caregiver_access` | `family` | Approval Gate | `linkId, permissionLevel` | linkId, permissionLevel, capabilities | No | Permission badge updated in Care Circle |
| 35 | `revoke_caregiver_access` | `family` | Approval Gate | `linkId` | linkId, revoked status, timestamp | No | Revocation toast; proxy avatar removed |
| 36 | `switch_profile` | `family` | Clinical Negotiation | `targetPatientId` | activePatientId, name, permissionScope | No | Full UI context transitions to target patient |
| 37 | `act_on_behalf` | `family` | Audit Proxy | `caregiver, patientId, toolName, toolParams` | wrappedResult, auditString, auditLogId | No | Attaches proxy audit chip (e.g. Raj on behalf of S. Devi) |
| 38 | `grant_doctor_access` | `dossier` | Approval Gate | `patientId, doctorName, doctorEmail, validHours` | grantId, accessToken, shareableUrl, expiresAt | No | Copyable handover link & QR code modal |
| 39 | `revoke_access` | `dossier` | Approval Gate | `grantId` | grantId, revoked status, timestamp | No | Doctor access tag switches to Revoked |
| 40 | `view_timeline` | `dossier` | Declarative Export | `patientId, filterCategories, dates` | totalEvents, timelineEvents array | No | Renders Continuity Dossier stream with source links |

---

## 7. Adversarial & Edge-Case Behavior Matrix

| # | Edge Case Scenario | Test Condition / Input | Specified System Behavior | Error Code / Handling |
|---|--------------------|------------------------|---------------------------|-----------------------|
| 1 | Unapproved Fact Propagation | Agent attempts to populate PillMap using facts with status `pending` | Operation is intercepted and rejected. PillMap remains unmodified until `confirm_fact` returns `approved`. | `ERR_UNCONFIRMED_FACT_BLOCKED` |
| 2 | Malformed OCR Coordinates | Ingested PDF returns missing or out-of-bounds bounding box (`x > 1.0` or `y < 0`) | Coordinates normalized to `[0, 0, 1, 1]` with warning flag `SOURCE_BOUNDS_UNRELIABLE`. UI displays document page with full-page fallback highlight. | `WARN_BOUNDING_BOX_NORMALIZED` |
| 3 | Conflicting Concurrent Dosage Proposals | Doctor proposes 500mg morning while Agent proposes 500mg evening before first proposal is reviewed | LocalVault locks target medication entity; second proposal flagged as `CONCURRENT_PROPOSAL_MERGE_REQUIRED`. Patient sees comparative split diff. | `ERR_CONCURRENT_PROPOSAL_CONFLICT` |
| 4 | Expired Doctor Access Token | Doctor attempts to load Continuity Dossier after `expiresAt` timestamp | Access denied with plain-language page: *"This medical summary link expired on [Date]. Please request a new link from the patient."* | `HTTP 403 / ERR_TOKEN_EXPIRED` |
| 5 | Unauthorized Caregiver Action | Caregiver with `view_only` permission invokes `approve_dosage_change` or `doctor_remove_medication` | Action blocked by WebMCP Interceptor. Audit log records `UNAUTHORIZED_PROXY_ATTEMPT`. Toast: *"Your access level is View Only. Please contact the primary patient."* | `ERR_PROXY_PERMISSION_DENIED` |
| 6 | Unit Normalization Ambiguity | Lab report uses custom or non-standard unit (e.g. `g/L` instead of `mg/dL` for creatinine) | System computes SI-to-Conventional conversion, flags confidence `< 0.9`, and requires patient confirmation with explicit unit check: *"Is this in mg/dL?"* | `WARN_UNIT_NORMALIZATION_CHECK` |
| 7 | Duplicate Ingredient Overdose | Patient adds two distinct brand medications both containing Acetaminophen exceeding 4000mg/day | System draws pulsing red badge; triggers high-priority warning modal: *"Dangerous Acetaminophen Overdose Risk (Total: 4500mg/day. Max safe: 4000mg)"*. | `ALERT_TOXIC_DOSE_EXCEEDED` |
| 8 | Null Medication Route / Frequency | Extracted medication has missing frequency string | Fallbacks to default `once_daily` morning with amber tag *"Frequency unspecified in discharge note — please confirm with doctor"*. Auto-adds question to Question Bank. | `WARN_MED_PARAM_DEFAULTED` |

---

## 8. Architectural Sign-Off & Verification Plan

- **IndexedDB Conformance:** All 11 object stores validated with unique/multi-entry indexes matching `CareCanvas_Vault_v1`.
- **WebMCP Tool Registration:** All 40 tools verified to register under both native `document.modelContext` and fallback mock adapter `window.__CareCanvas_WebMCP__`.
- **Reactive UI Flow:** State transitions trigger event-driven DOM updates and CSS animations without requiring page reload.
- **End-to-End Flow Alignment:** Fully specifies capabilities required for Flows A, B, C, D, and E in `ORIGINAL_REQUEST.md`.
