/**
 * CareCanvas Types: WebMCP Protocol & Tool Definitions
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
  returns: Record<string, any>;
  execute: (params: TInput, context: WebMCPExecutionContext) => Promise<WebMCPToolResult<TOutput>>;
  uiSideEffects?: WebMCPSideEffects;
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
    details?: any;
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
