/**
 * CareCanvas Core: WebMCP Engine & Registry
 */

import type { 
  WebMCPToolDefinition,
  WebMCPExecutionContext,
  WebMCPToolResult,
  ToolInvocationRecord
} from '../../types/webmcp.ts';
import { WebMCPEventBus } from '../events/eventBus.ts';
import { localVault } from '../vault/LocalVault.ts';

export class WebMCPEngine {
  private registry: Map<string, WebMCPToolDefinition> = new Map();
  public invocationHistory: ToolInvocationRecord[] = [];
  public approvalGateCounter: number = 0;
  public eventBus: WebMCPEventBus;
  public isNative: boolean = false;
  private pendingApprovalsList: any[] = [];

  constructor(eventBus?: WebMCPEventBus) {
    this.eventBus = eventBus || new WebMCPEventBus();
    this.detectAndPolyfill();
  }

  private detectAndPolyfill(): void {
    if (typeof globalThis !== 'undefined') {
      const docContext = (globalThis as any).document?.modelContext;
      const navContext = (globalThis as any).navigator?.modelContext;

      if (docContext && typeof docContext.registerTool === 'function') {
        this.isNative = true;
      } else if (navContext && typeof navContext.registerTool === 'function') {
        this.isNative = true;
      } else {
        this.isNative = false;
        this.installPolyfill();
      }
    }
  }

  private installPolyfill(): void {
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
      executeTool: async (name: string, params: any, context?: WebMCPExecutionContext) => {
        return this.execute(name, params, context);
      }
    };

    if (typeof globalThis !== 'undefined') {
      (globalThis as any).modelContext = mockContext;
      (globalThis as any).__CareCanvas_WebMCP__ = mockContext;
      if (typeof document !== 'undefined') {
        (document as any).modelContext = mockContext;
      }
    }
  }

  public register(toolDef: WebMCPToolDefinition): void {
    this.registry.set(toolDef.name, toolDef);
    this.eventBus.emit('tool_registered', {
      tool: toolDef.name,
      module: toolDef.moduleOwner,
      requiresApproval: toolDef.requiresHumanApproval
    });
  }

  public unregister(name: string): boolean {
    const removed = this.registry.delete(name);
    if (removed) {
      this.eventBus.emit('tool_unregistered', { tool: name });
    }
    return removed;
  }

  public getRegisteredTools(): WebMCPToolDefinition[] {
    return Array.from(this.registry.values());
  }

  public getToolsByModule(moduleOwner: string): WebMCPToolDefinition[] {
    return Array.from(this.registry.values()).filter((t) => t.moduleOwner === moduleOwner);
  }

  public getTool(name: string): WebMCPToolDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * Validates parameters against parameter schema (throws on invalid schema)
   */
  public validateSchema(schema: any, params: any): void {
    if (!schema || !schema.properties) return;

    if (!params || typeof params !== 'object') {
      if (schema.required && schema.required.length > 0) {
        throw new Error(`Missing required parameter '${schema.required[0]}'.`);
      }
      return;
    }

    if (schema.required) {
      for (const req of schema.required) {
        if (params[req] === undefined || params[req] === null || params[req] === '') {
          throw new Error(`Missing required parameter '${req}'.`);
        }
      }
    }

    for (const [key, val] of Object.entries(params)) {
      const propSchema = schema.properties[key];
      if (!propSchema) continue;

      if (val !== undefined && val !== null) {
        if (propSchema.type === 'string' && typeof val !== 'string') {
          throw new Error(`Parameter '${key}' must be a string.`);
        }
        if ((propSchema.type === 'number' || propSchema.type === 'integer') && typeof val !== 'number') {
          throw new Error(`Parameter '${key}' must be a number.`);
        }
        if (propSchema.enum && !propSchema.enum.includes(val)) {
          throw new Error(`value '${val}' is not in allowed enum values`);
        }
      }
    }
  }

  /**
   * Validates parameters against parameter schema (non-throwing validator)
   */
  private validateParams(tool: WebMCPToolDefinition, params: any): { isValid: boolean; error?: string } {
    if (!tool.parameters || !tool.parameters.properties) {
      return { isValid: true };
    }

    if (!params || typeof params !== 'object') {
      if (tool.parameters.required && tool.parameters.required.length > 0) {
        return { isValid: false, error: `Missing required parameters: ${tool.parameters.required.join(', ')}` };
      }
      return { isValid: true };
    }

    // Check required fields
    if (tool.parameters.required) {
      for (const req of tool.parameters.required) {
        if (params[req] === undefined || params[req] === null || params[req] === '') {
          return { isValid: false, error: `Missing required parameter: "${req}"` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Executes tool with schema validation, timing telemetry, approval gate checks, and side effects.
   */
  public async execute(name: string, params: any, context?: Partial<WebMCPExecutionContext>): Promise<WebMCPToolResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      const errorResult: WebMCPToolResult = {
        success: false,
        tool: name,
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Tool "${name}" is not registered in WebMCP context.`,
        plainLanguageExplanation: `Tool "${name}" is not registered in WebMCP context.`,
        humanApprovalRequired: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${name}" is not registered.`
        }
      };
      return errorResult;
    }

    // Derive patientId/activeProfile from explicit context or stored session — no hardcoded Shanti fallback.
    // Priority: explicit context.patientId/activeProfile > localStorage carecanvas_active_user > empty
    const storedProfile = (() => {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('carecanvas_active_user');
          if (raw) {
            const p = JSON.parse(raw);
            if (p?.userId) return p;
          }
        }
      } catch {}
      return null;
    })();
    const resolvedPatientId = (context as any)?.patientId || storedProfile?.userId || '';
    const resolvedProfile = (context as any)?.activeProfile || storedProfile || { userId: resolvedPatientId || '', name: '', role: 'patient', isProxy: false };

    const defaultContext: WebMCPExecutionContext = {
      vault: localVault,
      eventBus: this.eventBus,
      ...(context as any),
      patientId: resolvedPatientId,
      activeProfile: resolvedProfile as any,
    } as WebMCPExecutionContext;

    // Validate parameters — use strict JSON-Schema validation (type/enum) not just required checks
    try {
      this.validateSchema(tool.parameters, params);
    } catch (e: any) {
      const errorResult: WebMCPToolResult = {
        success: false,
        tool: name,
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Validation error: ${e.message}`,
        plainLanguageExplanation: `Validation error: ${e.message}`,
        humanApprovalRequired: false,
        error: {
          code: 'INVALID_PARAMS',
          message: e.message || 'Invalid parameters supplied.'
        }
      };
      return errorResult;
    }
    const val = this.validateParams(tool, params);
    if (!val.isValid) {
      const errorResult: WebMCPToolResult = {
        success: false,
        tool: name,
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Validation error: ${val.error}`,
        plainLanguageExplanation: `Validation error: ${val.error}`,
        humanApprovalRequired: false,
        error: {
          code: 'INVALID_PARAMS',
          message: val.error || 'Invalid parameters supplied.'
        }
      };
      return errorResult;
    }

    const start = performance.now();
    const invocationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create telemetry record
    const record: ToolInvocationRecord = {
      id: invocationId,
      toolName: name,
      params,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      status: tool.requiresHumanApproval ? 'pending_approval' : 'executed'
    };

    // Approval gate — require trusted approval; client-supplied isAutoApproved alone is insufficient (trust-boundary fix)
    // Only engine-privileged callers may set approvalInterceptor.trusted === true to bypass human approval.
    const isTrustedAutoApproved =
      defaultContext.approvalInterceptor?.isAutoApproved === true &&
      defaultContext.approvalInterceptor?.trusted === true;
    if (tool.requiresHumanApproval && !isTrustedAutoApproved) {
      this.approvalGateCounter++;
      this.invocationHistory.push(record);

      const pendingResult: WebMCPToolResult = {
        success: true,
        tool: name,
        timestamp: new Date().toISOString(),
        data: {
          stagedParams: params,
          gateType: tool.approvalGateType
        },
        plainLanguageSummary: `Action staged for "${tool.name}". Awaiting patient/caregiver confirmation.`,
        plainLanguageExplanation: `Action staged for "${tool.name}". Awaiting patient/caregiver confirmation.`,
        humanApprovalRequired: true,
        approvalStatus: 'pending_approval',
        pendingApprovalId: invocationId,
        uiSideEffects: tool.uiSideEffects
      };

      this.eventBus.emit('approval_required', {
        invocationId,
        tool: name,
        params,
        gateType: tool.approvalGateType
      });

      return pendingResult;
    }

    try {
      const result = await tool.execute(params, defaultContext);
      if (context) {
        context.patientId = defaultContext.patientId;
        if (context.activeProfile && defaultContext.activeProfile) {
          Object.assign(context.activeProfile, defaultContext.activeProfile);
        }
      }
      record.durationMs = Math.round(performance.now() - start);
      record.result = result.data;
      record.status = 'executed';
      this.invocationHistory.push(record);

      if (!result.plainLanguageExplanation && result.plainLanguageSummary) {
        result.plainLanguageExplanation = result.plainLanguageSummary;
      }
      if (!result.plainLanguageSummary && result.plainLanguageExplanation) {
        result.plainLanguageSummary = result.plainLanguageExplanation;
      }

      // Emit side effects
      if (tool.uiSideEffects) {
        if (tool.uiSideEffects.toastNotification) {
          this.eventBus.emit('toast_notification', tool.uiSideEffects.toastNotification);
        }
        if (tool.uiSideEffects.canvasRerenders) {
          tool.uiSideEffects.canvasRerenders.forEach(canvas => {
            this.eventBus.emit('canvas_rerender', { canvas });
          });
        }
      }

      return result;
    } catch (err: any) {
      record.durationMs = Math.round(performance.now() - start);
      record.status = 'error';
      record.error = err.message || err;
      this.invocationHistory.push(record);

      return {
        success: false,
        tool: name,
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Execution of "${name}" failed: ${err.message || err}`,
        plainLanguageExplanation: `Execution of "${name}" failed: ${err.message || err}`,
        humanApprovalRequired: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: err.message || 'Internal tool execution failed.'
        }
      };
    }
  }

  // Telemetry Log APIs
  public getTelemetryLogs(): ToolInvocationRecord[] {
    return [...this.invocationHistory];
  }

  public clearTelemetryLogs(): void {
    this.invocationHistory = [];
  }

  // Approval Interceptor APIs
  public queueApproval(item: any): void {
    this.pendingApprovalsList.push(item);
  }

  public getPendingApprovals(): any[] {
    return [...this.pendingApprovalsList];
  }

  public async resolveApproval(id: string, isApproved: boolean): Promise<void> {
    const idx = this.pendingApprovalsList.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const item = this.pendingApprovalsList[idx];
      if (isApproved && item.onApprove) {
        await item.onApprove();
      } else if (!isApproved && item.onReject) {
        await item.onReject();
      }
      this.pendingApprovalsList.splice(idx, 1);
    }
  }

  /**
   * Simulates explicit human approval for a staged invocation.
   */
  public async confirmStagedInvocation(
    invocationId: string,
    approver: { name: string; role: 'patient' | 'caregiver' | 'doctor'; onBehalfOf?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> {
    const record = this.invocationHistory.find(r => r.id === invocationId);
    if (!record) {
      throw new Error(`Invocation ${invocationId} not found.`);
    }

    const tool = this.registry.get(record.toolName);
    if (!tool) {
      throw new Error(`Tool ${record.toolName} not found.`);
    }

    record.status = 'approved';
    record.approvalMetadata = {
      approvedBy: approver.name,
      role: approver.role,
      onBehalfOf: approver.onBehalfOf
    };

    // Execute the underlying handler directly
    const start = performance.now();
    const result = await tool.execute(record.params, {
      ...context,
      activeProfile: {
        ...context.activeProfile,
        name: approver.name,
        role: approver.role,
        isProxy: !!approver.onBehalfOf,
        onBehalfOf: approver.onBehalfOf
      }
    });

    record.durationMs = performance.now() - start;
    record.result = result.data;
    result.approvalStatus = 'approved';

    this.eventBus.emit('approval_confirmed', {
      invocationId,
      tool: tool.name,
      approver
    });

    return result;
  }
}

export const webMCPEngine = new WebMCPEngine();
