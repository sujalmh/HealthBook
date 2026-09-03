/**
 * Healthbook Types: WebMCP Protocol & Tool Definitions
 * Spec: W3C WebMCP Draft 26 Aug 2026 §4.1-4.5 — ModelContext IDL
 * Canonical surface: document.modelContext only (SecureContext)
 */

export interface WebMCPToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    description: string;
    enum?: string[] | number[];
    items?: unknown;
    properties?: Record<string, unknown>;
    default?: unknown;
    minimum?: number;
    maximum?: number;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

export type WebMCPModuleOwner = 'vault' | 'labstory' | 'pillmap' | 'rxbridge' | 'homelab' | 'safety' | 'carecircle' | 'dossier';
export type WebMCPApprovalGateType = 'none' | 'inline_fact' | 'modal_proposal' | 'proxy_signature' | 'reconciliation_walk' | 'safety_action';

export interface WebMCPSideEffects {
  stateMutations?: string[];
  domAnimations?: string[];
  toastNotification?: {
    type: 'info' | 'success' | 'warning' | 'error';
    messageTemplate: string;
  };
  canvasRerenders?: ('pillmap' | 'labstory' | 'rxbridge' | 'homelab' | 'dossier' | 'calendar' | 'question_bank')[];
}

export interface WebMCPToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  moduleOwner: WebMCPModuleOwner;
  category: 'imperative_extraction' | 'declarative_export' | 'clinical_negotiation' | 'approval_gate' | 'audit_proxy' | 'safety_alert';
  requiresHumanApproval: boolean;
  approvalGateType: WebMCPApprovalGateType;
  parameters: WebMCPToolParameterSchema;
  /** Spec alias: when present, used as inputSchema object (stringified via JSON.stringify).
   *  Internal 42 tools keep `parameters` for backward compat; adapter maps parameters → inputSchema.
   *  Grep gate expects `inputSchema` in src/types/webmcp.ts or src/core/webmcp/
   */
  inputSchema?: WebMCPToolParameterSchema | string;
  returns: Record<string, unknown>;
  execute: (params: TInput, context: WebMCPExecutionContext) => Promise<WebMCPToolResult<TOutput>>;
  uiSideEffects?: WebMCPSideEffects;
}

// ─────────────────────────────────────────────────────────────────────────────
// W3C WebMCP Spec Types — §4.2 ModelContext
// ─────────────────────────────────────────────────────────────────────────────

/** Spec ModelContextTool dict (§4.2.1) — name 1-128 ^[a-zA-Z0-9_.-]+$, description non-empty, inputSchema object stringified */
export interface ModelContextTool {
  name: string;
  description: string;
  /** JSON Schema object — will be stringified internally via JSON.stringify for RegisteredTool.inputSchema */
  inputSchema: WebMCPToolParameterSchema | Record<string, unknown>;
  title?: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    untrustedContentHint?: boolean;
    [k: string]: unknown;
  };
  execute: (inputObject: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

/** Options for registerTool (§4.2.3) */
export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

/** Options for getTools (§4.2.5) */
export interface ModelContextGetToolOptions {
  fromOrigins?: string[];
}

/** Options for executeTool (§4.2.6) */
export interface ModelContextExecuteToolOptions {
  signal?: AbortSignal;
}

/** RegisteredTool returned by getTools (§4.2.6) — inputSchema is STRINGIFIED JSON */
export interface RegisteredTool {
  name: string;
  description: string;
  /** STRINGIFIED JSON via JSON.stringify(inputSchema) */
  inputSchema: string;
  title?: string;
  annotations?: {
    readOnlyHint?: boolean;
    [k: string]: unknown;
  };
  /** Origin of the registering document — location.origin */
  origin: string;
  /** Window reference of the registering document */
  window: Window | null;
}

/** ModelContext EventTarget (§4.4) — toolchange */
export interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): Promise<undefined>;
  getTools(options?: ModelContextGetToolOptions): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, inputObject?: object, options?: ModelContextExecuteToolOptions): Promise<string>;
  ontoolchange: ((event: Event) => unknown) | null;
  addEventListener(type: 'toolchange', listener: (event: Event) => unknown, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: 'toolchange', listener: (event: Event) => unknown, options?: boolean | EventListenerOptions): void;
  dispatchEvent(event: Event): boolean;
}

export interface WebMCPExecutionContext {
  patientId: string;
  activeProfile: {
    userId: string;
    name: string;
    role: 'patient' | 'caregiver' | 'doctor';
    isProxy: boolean;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
  vault: any; // LocalVault instance
  eventBus: any; // WebMCPEventBus instance
  approvalInterceptor?: any;
}

export interface WebMCPToolResult<T = any> {
  success: boolean;
  tool: string;
  timestamp: string;
  data: T;
  plainLanguageSummary: string;
  plainLanguageExplanation?: string;
  humanApprovalRequired: boolean;
  approvalStatus?: 'pending_approval' | 'approved' | 'rejected' | 'edited';
  pendingApprovalId?: string;
  uiSideEffects?: WebMCPSideEffects;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ToolInvocationRecord {
  id: string;
  toolName: string;
  params: any; // boundary: arbitrary tool payload, validated via schema before use
  timestamp: string;
  durationMs: number;
  status: 'executed' | 'pending_approval' | 'approved' | 'rejected' | 'error' | 'success' | 'awaiting_approval' | string;
  result?: any; // boundary: WebMCPToolResult, validated before display
  error?: string;
  caller?: {
    userId: string;
    name: string;
    role: string;
    isProxy: boolean;
  };
  approvalMetadata?: {
    approvedBy: string;
    role: string;
    onBehalfOf?: string;
  };
}

export type TelemetryLogEntry = ToolInvocationRecord;

export interface PendingApprovalItem {
  id?: string;
  invocationId?: string;
  tool?: string;
  toolName?: string;
  timestamp: string;
  type?: 'fact' | 'proposal' | 'safety' | 'reconciliation' | string;
  title?: string;
  description?: string;
  params?: any; // boundary: arbitrary, validated before use
  data?: any;
  gateType?: WebMCPApprovalGateType;
  approvalStatus?: 'pending_approval' | 'approved' | 'rejected';
  caller?: {
    userId: string;
    name: string;
    role: string;
    isProxy: boolean;
  };
  onApprove?: () => Promise<void>;
  onReject?: () => Promise<void>;
}
