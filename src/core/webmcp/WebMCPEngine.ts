
import type {
  WebMCPToolDefinition,
  WebMCPExecutionContext,
  WebMCPToolResult,
  ToolInvocationRecord,
} from '../../types/webmcp.ts';
import { WebMCPEventBus } from '../events/eventBus.ts';
import { localVault } from '../vault/LocalVault.ts';
import {
  validateToolName,
  validateToolDescription,
  serializeInputSchema,
  toSpecTool,
  throwInvalidStateError,
} from './WebMCPAdapter.ts';

export class WebMCPEngine {
  private registry: Map<string, WebMCPToolDefinition> = new Map();

  private specRegistry: Map<string, { specTool: any; registeredTool: any; exposedTo?: string[]; signal?: AbortSignal }> = new Map();

  private abortControllers: Map<string, AbortController> = new Map();
  public invocationHistory: ToolInvocationRecord[] = [];
  public approvalGateCounter: number = 0;
  public eventBus: WebMCPEventBus;
  public isNative: boolean = false;
  private pendingApprovalsList: any[] = [];
  private toolchangeTarget: EventTarget | null = null;
  private _dispatchToolchangeBound: (() => void) | null = null;

  constructor(eventBus?: WebMCPEventBus) {
    this.eventBus = eventBus || new WebMCPEventBus();
    this.detectAndPolyfill();
  }

  private detectAndPolyfill(): void {
    if (typeof document !== 'undefined' && (document as any).modelContext?.registerTool) {
      this.isNative = true;
      return;
    }
    this.isNative = false;
    this.installPolyfill();
  }

  private installPolyfill(): void {
    if (typeof document === 'undefined') return;
    if ((document as any).modelContext?.registerTool) {
      this.isNative = true;
      return;
    }

    const engine = this;

    let eventTarget: EventTarget;
    try {
      eventTarget = new EventTarget();
    } catch {
      const listeners = new Map<string, Set<EventListener>>();
      eventTarget = {
        addEventListener: (type: string, fn: any) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        },
        removeEventListener: (type: string, fn: any) => {
          listeners.get(type)?.delete(fn);
        },
        dispatchEvent: (event: Event) => {
          const set = listeners.get(event.type);
          if (set) {
            for (const fn of Array.from(set)) {
              try {
                (fn as any)(event);
              } catch {}
            }
          }
          const mc: any = (document as any).modelContext;
          if (mc && typeof mc.ontoolchange === 'function') {
            try {
              mc.ontoolchange(event);
            } catch {}
          }
          return true;
        },
      } as any;
    }
    this.toolchangeTarget = eventTarget;

    const dispatchToolchange = () => {
      try {
        eventTarget.dispatchEvent(new Event('toolchange'));
        const mc: any = (document as any).modelContext;
        if (mc && typeof mc.ontoolchange === 'function') {
          try {
            mc.ontoolchange(new Event('toolchange'));
          } catch {}
        }
      } catch {}
    };
    (this as any)._dispatchToolchangeImpl = dispatchToolchange;
    this._dispatchToolchangeBound = dispatchToolchange;

    const polyfillContext: any = eventTarget;
    let _ontoolchange: any = null;
    Object.defineProperty(polyfillContext, 'ontoolchange', {
      get() {
        return _ontoolchange;
      },
      set(v) {
        _ontoolchange = v;
      },
      configurable: true,
      enumerable: true,
    });

    polyfillContext.registerTool = async (tool: any, options: any = {}): Promise<undefined> => {
      if (options?.signal?.aborted) {
        const reason = options.signal.reason ?? (typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        throw reason;
      }

      const name = tool?.name;
      validateToolName(name);
      validateToolDescription(tool?.description, name);

      if (engine.specRegistry.has(name) || engine.registry.has(name)) {
        throwInvalidStateError(`Tool "${name}" is already registered`);
      }

      let inputSchemaString: string;
      const inputSchema = tool?.inputSchema;
      try {
        inputSchemaString = serializeInputSchema(inputSchema);
      } catch (e) {
        throw e;
      }

      const origin = typeof location !== 'undefined' && location.origin ? location.origin : 'http://localhost:5173';
      const win = typeof window !== 'undefined' ? window : null;

      const registeredTool: any = {
        name,
        description: tool.description,
        inputSchema: inputSchemaString,
        title: tool.title ?? name,
        annotations: tool.annotations ?? { readOnlyHint: false },
        origin,
        window: win,
      };

      if (options?.signal) {
        const signal: AbortSignal = options.signal;
        const onAbort = () => {
          engine.specRegistry.delete(name);
          engine.registry.delete(name);
          engine.abortControllers.delete(name);
          dispatchToolchange();
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      engine.specRegistry.set(name, { specTool: tool, registeredTool, exposedTo: options?.exposedTo, signal: options?.signal });

      dispatchToolchange();

      return undefined as any;
    };

    polyfillContext.getTools = async (options: any = {}): Promise<any[]> => {
      let entries = Array.from(engine.specRegistry.values()).map((e) => e.registeredTool);
      if (options?.fromOrigins && Array.isArray(options.fromOrigins) && options.fromOrigins.length > 0) {
        entries = entries.filter((rt: any) => {
          const entry = engine.specRegistry.get(rt.name);
          if (!entry) return false;
          if (entry.exposedTo && (entry.exposedTo as string[]).length > 0) {
            return options.fromOrigins.some((o: string) => (entry.exposedTo as string[]).includes(o));
          }
          return options.fromOrigins.includes(rt.origin);
        });
      }
      return entries;
    };

    polyfillContext.executeTool = async (tool: any, inputObject: any = {}, options: any = {}): Promise<string> => {
      if (typeof tool === 'string') {
        throw new TypeError('executeTool first argument must be RegisteredTool object, not string');
      }
      if (tool == null || typeof tool !== 'object' || typeof tool.name !== 'string') {
        throw new TypeError('executeTool first argument must be RegisteredTool object with name');
      }
      const name = tool.name;

      if (options?.signal?.aborted) {
        const reason = options.signal.reason ?? (typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        throw reason;
      }

      const entry = engine.specRegistry.get(name);

      return new Promise(async (resolve, reject) => {
        let abortHandler: any = null;
        let aborted = false;
        if (options?.signal) {
          abortHandler = () => {
            aborted = true;
            const reason = options.signal.reason ?? (typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            reject(reason);
          };
          options.signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
          if (inputObject !== null && inputObject !== undefined && typeof inputObject !== 'object') {
            throw new TypeError('inputObject must be an object');
          }
          if (Array.isArray(inputObject)) {
            throw new TypeError('inputObject must be an object');
          }

          let execFn: any = entry?.specTool?.execute;
          if (!execFn) {
            const internal = engine.registry.get(name);
            if (internal) {
              const fallbackResult = await engine.execute(name, inputObject || {}, {} as any);
              if (aborted) return;
              const domStr = JSON.stringify(fallbackResult);
              if (options?.signal && abortHandler) {
                try {
                  options.signal.removeEventListener('abort', abortHandler);
                } catch {}
              }
              resolve(domStr);
              return;
            }
            throw new Error(`Tool "${name}" not found`);
          }

          const result = await execFn(inputObject || {}, { signal: options?.signal });

          if (aborted) return;

          let domString: string;
          try {
            domString = JSON.stringify(result);
          } catch (e) {
            if (options?.signal && abortHandler) {
              try {
                options.signal.removeEventListener('abort', abortHandler);
              } catch {}
            }
            reject(e);
            return;
          }

          if (options?.signal && abortHandler) {
            try {
              options.signal.removeEventListener('abort', abortHandler);
            } catch {}
          }
          resolve(domString);
        } catch (e) {
          if (options?.signal && abortHandler) {
            try {
              options.signal.removeEventListener('abort', abortHandler);
            } catch {}
          }
          reject(e);
        }
      });
    };

    polyfillContext.unregisterTool = async (name: string) => {
      engine.specRegistry.delete(name);
      engine.registry.delete(name);
      engine.abortControllers.delete(name);
      dispatchToolchange();
    };

    (document as any).modelContext = polyfillContext;
  }

  private _dispatchToolchange(): void {
    try {
      if (this._dispatchToolchangeBound) {
        this._dispatchToolchangeBound();
        return;
      }
      if (typeof document !== 'undefined' && (document as any).modelContext?.dispatchEvent) {
        (document as any).modelContext.dispatchEvent(new Event('toolchange'));
      } else if (this.toolchangeTarget) {
        this.toolchangeTarget.dispatchEvent(new Event('toolchange'));
      } else {

      }
    } catch {}

    void 'toolchange';
  }

  public dispatchToolchange(): void {
    this._dispatchToolchange();
  }

  private toSpecTool(def: WebMCPToolDefinition): any {
    return toSpecTool(def, this);
  }

  public register(toolDef: WebMCPToolDefinition): void {
    const name = toolDef.name;

    validateToolName(name);
    validateToolDescription(toolDef.description, name);
    const schemaToSerialize = (toolDef as any).inputSchema ?? toolDef.parameters;
    try {
      if (schemaToSerialize !== undefined) {
        JSON.stringify(schemaToSerialize);
      }
    } catch (e) {
      throw e;
    }

    if (this.abortControllers.has(name)) {
      try {
        this.abortControllers.get(name)!.abort();
      } catch {}
      this.abortControllers.delete(name);
      this.registry.delete(name);
      this.specRegistry.delete(name);
      this._dispatchToolchange();
    } else if (this.registry.has(name) || this.specRegistry.has(name)) {
      this.registry.delete(name);
      this.specRegistry.delete(name);
      this._dispatchToolchange();
    }

    const controller = new AbortController();
    this.abortControllers.set(name, controller);

    const specTool = this.toSpecTool(toolDef);

    let inputSchemaString: string;
    try {
      const schema = (toolDef as any).inputSchema ?? toolDef.parameters;
      if (schema === undefined) inputSchemaString = JSON.stringify({});
      else if (typeof schema === 'string') {
        try {
          JSON.parse(schema);
          inputSchemaString = schema;
        } catch {
          inputSchemaString = JSON.stringify(schema);
        }
      } else {
        inputSchemaString = JSON.stringify(schema);
      }
    } catch (e) {
      this.abortControllers.delete(name);
      throw e;
    }

    const origin = typeof location !== 'undefined' && location.origin ? location.origin : 'http://localhost:5173';
    const win = typeof window !== 'undefined' ? window : null;
    const registeredTool: any = {
      name,
      description: toolDef.description,
      inputSchema: inputSchemaString,
      title: toolDef.name,
      annotations: { readOnlyHint: !toolDef.requiresHumanApproval },
      origin,
      window: win,
    };

    if (this.isNative && typeof document !== 'undefined' && (document as any).modelContext?.registerTool) {

      this.registry.set(name, toolDef);
      this.specRegistry.set(name, { specTool, registeredTool, exposedTo: undefined, signal: controller.signal });
      const onAbort = () => {
        this.specRegistry.delete(name);
        this.registry.delete(name);
        this.abortControllers.delete(name);
        this._dispatchToolchange();
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const maybePromise = (document as any).modelContext.registerTool(specTool, { signal: controller.signal });
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch((e: any) => {
            if (e?.name === 'InvalidStateError' && String(e.message).includes('already registered')) {
              return;
            }
            if (e instanceof TypeError) {

            }
          });
        }
      } catch (e: any) {
        if (e?.name === 'InvalidStateError' && String(e.message || '').includes('already registered')) {

        } else {

        }
      }

      this.eventBus.emit('tool_registered', {
        tool: toolDef.name,
        module: toolDef.moduleOwner,
        requiresApproval: toolDef.requiresHumanApproval,
      });
      this._dispatchToolchange();
    } else {

      this.registry.set(name, toolDef);
      this.specRegistry.set(name, { specTool, registeredTool, exposedTo: undefined, signal: controller.signal });
      const onAbort = () => {
        this.specRegistry.delete(name);
        this.registry.delete(name);
        this.abortControllers.delete(name);
        this._dispatchToolchange();
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });

      this.eventBus.emit('tool_registered', {
        tool: toolDef.name,
        module: toolDef.moduleOwner,
        requiresApproval: toolDef.requiresHumanApproval,
      });
      this._dispatchToolchange();
    }
  }

  public unregister(name: string): boolean {
    const hadSpec = this.specRegistry.has(name);
    const hadReg = this.registry.has(name);
    const removed = hadSpec || hadReg;
    if (this.abortControllers.has(name)) {
      try {
        this.abortControllers.get(name)!.abort();
      } catch {}
      this.abortControllers.delete(name);
    }
    this.specRegistry.delete(name);
    const deleted = this.registry.delete(name);
    if (removed || deleted) {
      this.eventBus.emit('tool_unregistered', { tool: name });
      this._dispatchToolchange();
      return true;
    }
    return false;
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
      const propSchema = (schema.properties as any)[key];
      if (!propSchema) continue;

      if (val !== undefined && val !== null) {
        if (propSchema.type === 'string' && typeof val !== 'string') {
          throw new Error(`Parameter '${key}' must be a string.`);
        }
        if ((propSchema.type === 'number' || propSchema.type === 'integer') && typeof val !== 'number') {
          throw new Error(`Parameter '${key}' must be a number.`);
        }
        if (propSchema.enum && !propSchema.enum.includes(val as any)) {
          throw new Error(`value '${val}' is not in allowed enum values`);
        }
      }
    }
  }

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

    if (tool.parameters.required) {
      for (const req of tool.parameters.required) {
        if (params[req] === undefined || params[req] === null || params[req] === '') {
          return { isValid: false, error: `Missing required parameter: "${req}"` };
        }
      }
    }

    return { isValid: true };
  }

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
          message: `Tool "${name}" is not registered.`,
        },
      };
      return errorResult;
    }

    const storedProfile = (() => {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('healthbook_active_user');
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
          message: e.message || 'Invalid parameters supplied.',
        },
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
          message: val.error || 'Invalid parameters supplied.',
        },
      };
      return errorResult;
    }

    const start = performance.now();
    const invocationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record: ToolInvocationRecord = {
      id: invocationId,
      toolName: name,
      params,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      status: tool.requiresHumanApproval ? 'pending_approval' : 'executed',
    };

    const isTrustedAutoApproved =
      (defaultContext as any).approvalInterceptor?.isAutoApproved === true && (defaultContext as any).approvalInterceptor?.trusted === true;
    if (tool.requiresHumanApproval && !isTrustedAutoApproved) {
      this.approvalGateCounter++;
      this.invocationHistory.push(record);

      const pendingResult: WebMCPToolResult = {
        success: true,
        tool: name,
        timestamp: new Date().toISOString(),
        data: {
          stagedParams: params,
          gateType: tool.approvalGateType,
        },
        plainLanguageSummary: `Action staged for "${tool.name}". Awaiting patient/caregiver confirmation.`,
        plainLanguageExplanation: `Action staged for "${tool.name}". Awaiting patient/caregiver confirmation.`,
        humanApprovalRequired: true,
        approvalStatus: 'pending_approval',
        pendingApprovalId: invocationId,
        uiSideEffects: tool.uiSideEffects,
      };

      this.eventBus.emit('approval_required', {
        invocationId,
        tool: name,
        params,
        gateType: tool.approvalGateType,
      });

      return pendingResult;
    }

    try {
      const result = await tool.execute(params, defaultContext);
      if (context) {
        (context as any).patientId = defaultContext.patientId;
        if ((context as any).activeProfile && defaultContext.activeProfile) {
          Object.assign((context as any).activeProfile, defaultContext.activeProfile);
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

      if (tool.uiSideEffects) {
        if (tool.uiSideEffects.toastNotification) {
          this.eventBus.emit('toast_notification', tool.uiSideEffects.toastNotification);
        }
        if (tool.uiSideEffects.canvasRerenders) {
          tool.uiSideEffects.canvasRerenders.forEach((canvas) => {
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
          message: err.message || 'Internal tool execution failed.',
        },
      };
    }
  }

  public getTelemetryLogs(): ToolInvocationRecord[] {
    return [...this.invocationHistory];
  }

  public clearTelemetryLogs(): void {
    this.invocationHistory = [];
  }

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

  public async confirmStagedInvocation(
    invocationId: string,
    approver: { name: string; role: 'patient' | 'caregiver' | 'doctor'; onBehalfOf?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> {
    const record = this.invocationHistory.find((r) => r.id === invocationId);
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
      onBehalfOf: approver.onBehalfOf,
    };

    const start = performance.now();
    const result = await tool.execute(record.params, {
      ...context,
      activeProfile: {
        ...context.activeProfile,
        name: approver.name,
        role: approver.role,
        isProxy: !!approver.onBehalfOf,
        onBehalfOf: approver.onBehalfOf,
      },
    } as any);

    record.durationMs = performance.now() - start;
    record.result = result.data;
    result.approvalStatus = 'approved';

    this.eventBus.emit('approval_confirmed', {
      invocationId,
      tool: tool.name,
      approver,
    });

    return result;
  }

  public getSpecRegistrySize(): number {
    return this.specRegistry.size;
  }
}

export const webMCPEngine = new WebMCPEngine();

