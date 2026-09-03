
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

  inputSchema?: WebMCPToolParameterSchema | string;
  returns: Record<string, unknown>;
  execute: (params: TInput, context: WebMCPExecutionContext) => Promise<WebMCPToolResult<TOutput>>;
  uiSideEffects?: WebMCPSideEffects;
}

export interface ModelContextTool {
  name: string;
  description: string;

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

export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface ModelContextGetToolOptions {
  fromOrigins?: string[];
}

export interface ModelContextExecuteToolOptions {
  signal?: AbortSignal;
}

export interface RegisteredTool {
  name: string;
  description: string;

  inputSchema: string;
  title?: string;
  annotations?: {
    readOnlyHint?: boolean;
    [k: string]: unknown;
  };

  origin: string;

  window: Window | null;
}

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
  vault: any;
  eventBus: any;
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
  params: any;
  timestamp: string;
  durationMs: number;
  status: 'executed' | 'pending_approval' | 'approved' | 'rejected' | 'error' | 'success' | 'awaiting_approval' | string;
  result?: any;
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
  params?: any;
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

