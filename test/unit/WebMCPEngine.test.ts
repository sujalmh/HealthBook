import { describe, it, expect, beforeEach } from 'vitest';
import { WebMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { allTools } from '@/tools';
import { WebMCPToolDefinition } from '@/types/webmcp';

describe('WebMCP Core Engine & Dual-Mode Dispatcher', () => {
  let engine: WebMCPEngine;

  beforeEach(() => {
    // Ensure fresh polyfill tied to this engine for jsdom fallback parity (Q2 shim jsdom only)
    // Delete prior polyfill so new engine owns document.modelContext (guarded install, never overwrites native)
    if (typeof document !== 'undefined' && (document as any).modelContext) {
      try {
        delete (document as any).modelContext;
      } catch {
        (document as any).modelContext = undefined;
      }
    }
    engine = new WebMCPEngine();
  });

  it('registers all 40 WebMCP tools across 7 modules', () => {
    allTools.forEach((t) => engine.register(t));
    const registered = engine.getRegisteredTools();
    expect(registered.length).toBe(40);

    const vaultTools = engine.getToolsByModule('vault');
    expect(vaultTools.length).toBe(3);

    const pillmapTools = engine.getToolsByModule('pillmap');
    expect(pillmapTools.length).toBe(8);

    const rxbridgeTools = engine.getToolsByModule('rxbridge');
    expect(rxbridgeTools.length).toBe(5);

    const safetyTools = engine.getToolsByModule('safety');
    expect(safetyTools.length).toBe(9);

    const careTools = engine.getToolsByModule('carecircle');
    expect(careTools.length).toBe(5);

    const dossierTools = engine.getToolsByModule('dossier');
    expect(dossierTools.length).toBe(3);
  });

  it('validates JSON Schema types, required fields, and enums', () => {
    const sampleTool: WebMCPToolDefinition = {
      name: 'test_tool',
      description: 'Test',
      moduleOwner: 'vault',
      category: 'imperative_extraction',
      requiresHumanApproval: false,
      approvalGateType: 'none',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text' },
          count: { type: 'number', description: 'Count' },
          role: { type: 'string', enum: ['patient', 'caregiver', 'doctor'], description: 'Role' },
        },
        required: ['text', 'count'],
      },
      returns: { type: 'object' },
      execute: async (p) => ({
        success: true,
        tool: 'test_tool',
        timestamp: new Date().toISOString(),
        data: p,
        plainLanguageSummary: 'OK',
        plainLanguageExplanation: 'OK',
        humanApprovalRequired: false,
      }),
    };

    engine.register(sampleTool);

    // Missing required field
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 'hello' })).toThrow(
      "Missing required parameter 'count'"
    );

    // Wrong type
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 123, count: 5 })).toThrow(
      "Parameter 'text' must be a string"
    );

    // Invalid enum
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 'ok', count: 1, role: 'alien' })).toThrow(
      "value 'alien' is not in allowed enum values"
    );

    // Valid parameters
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 'valid', count: 10, role: 'patient' })).not.toThrow();
  });

  it('executes tool, records execution telemetry, and returns structured result', async () => {
    allTools.forEach((t) => engine.register(t));

    const result = await engine.execute('check_interactions', {});
    expect(result.success).toBe(true);
    expect(result.tool).toBe('check_interactions');
    expect(result.data).toBeDefined();

    const logs = engine.getTelemetryLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].toolName).toBe('check_interactions');
    expect(logs[0].status).toBe('executed');
    expect(typeof logs[0].durationMs).toBe('number');
  });

  it('manages human approval interception and queue resolution', async () => {
    let approved = false;
    let rejected = false;

    engine.queueApproval({
      id: 'appr-1',
      toolName: 'confirm_fact',
      timestamp: new Date().toISOString(),
      type: 'fact',
      title: 'eGFR Lab Result',
      description: 'Confirm eGFR 32',
      data: { val: 32 },
      caller: { userId: 'u1', name: 'User', role: 'patient', isProxy: false },
      onApprove: async () => {
        approved = true;
      },
      onReject: async () => {
        rejected = true;
      },
    });

    expect(engine.getPendingApprovals().length).toBe(1);

    await engine.resolveApproval('appr-1', true);
    expect(approved).toBe(true);
    expect(rejected).toBe(false);
    expect(engine.getPendingApprovals().length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Native shim fallback parity — jsdom Promise path (document.modelContext) — R1
  // Ensures both legacy sync getter and new Promise getTools() return 40, with
  // JSON.parse(inputSchema) PASS, description non-empty, origin/window, toolchange
  // Coverage mirrors TEST_INFRA Native probe fallback parity; not mocked beyond engine.
  // ─────────────────────────────────────────────────────────────────────────
  it('native shim fallback parity: document.modelContext.getTools() Promise returns 40 with valid inputSchema', async () => {
    allTools.forEach((t) => engine.register(t));
    // Legacy sync path — backward compat must stay 40 per PROJECT.md
    const legacy = engine.getRegisteredTools();
    expect(legacy.length).toBe(40);

    // New Promise path via document.modelContext (jsdom polyfill, Q2 guarded)
    expect(typeof (document as any).modelContext).toBe('object');
    expect(typeof (document as any).modelContext.registerTool).toBe('function');
    expect(typeof (document as any).modelContext.getTools).toBe('function');
    expect(typeof (document as any).modelContext.executeTool).toBe('function');

    const tools = await (document as any).modelContext.getTools();
    expect(tools.length).toBe(40);

    let schemaPass = 0;
    let nonEmptyDesc = 0;
    for (const rt of tools) {
      expect(rt.name).toMatch(/^[a-zA-Z0-9_.\-]{1,128}$/);
      expect(rt.description).toBeTruthy();
      if (rt.description && rt.description.length > 0) nonEmptyDesc++;
      expect(typeof rt.inputSchema).toBe('string');
      const parsed = JSON.parse(rt.inputSchema);
      expect(parsed).toBeDefined();
      expect(parsed.type).toBe('object');
      // origin/window fields per spec RegisteredTool
      expect(rt.origin).toBeTruthy();
      // window may be null in some jsdom versions but should be defined
      expect(rt.window !== undefined).toBe(true);
      // title + annotations readOnlyHint mapped from requiresHumanApproval
      expect(rt.title).toBeTruthy();
      expect(rt.annotations).toBeDefined();
      schemaPass++;
    }
    expect(schemaPass).toBe(40);
    expect(nonEmptyDesc).toBe(40);
  });

  it('toolchange fires on register/unregister and executeTool returns DOMString via document.modelContext', async () => {
    let toolchangeCount = 0;
    let ontoolchangeFired = 0;
    const handler = () => { toolchangeCount++; };
    (document as any).modelContext.addEventListener('toolchange', handler);
    const prev = (document as any).modelContext.ontoolchange;
    (document as any).modelContext.ontoolchange = () => { ontoolchangeFired++; };

    allTools.forEach((t) => engine.register(t));
    // toolchange must have fired at least once per register batch
    expect(toolchangeCount).toBeGreaterThanOrEqual(1);

    const tools = await (document as any).modelContext.getTools();
    expect(tools.length).toBe(40);

    const extractFact = tools.find((t: any) => t.name === 'extract_fact');
    expect(extractFact).toBeDefined();

    // Execute via native shape: executeTool(RegisteredTool, inputObject) -> Promise<DOMString>
    // Mock localStorage patient bridging via probe patientId (fallback parity)
    try {
      localStorage.setItem('carecanvas_active_user', JSON.stringify({ userId: 'probe-patient-001', name: 'Probe', role: 'patient', isProxy: false }));
    } catch {}
    const domStr = await (document as any).modelContext.executeTool(extractFact, { documentId: 'probe-doc-001', rawText: 'Apixaban 5mg twice daily' });
    expect(typeof domStr).toBe('string');
    const parsed = JSON.parse(domStr);
    expect(parsed.success).toBe(true);
    // patientId bridging: must be probe-patient-001 not empty orphan '' nor patient-s-devi
    const dataStr = JSON.stringify(parsed.data);
    expect(dataStr).toContain('probe-patient-001');
    expect(parsed.data).toBeDefined();
    if (Array.isArray(parsed.data) && parsed.data.length > 0) {
      expect(parsed.data[0].patientId).toBe('probe-patient-001');
    }
    expect(parsed.plainLanguageSummary).toBeTruthy();

    // Unregister should fire toolchange and reduce count to 39
    await (document as any).modelContext.unregisterTool('extract_fact');
    expect(toolchangeCount).toBeGreaterThanOrEqual(2);
    const after = await (document as any).modelContext.getTools();
    expect(after.length).toBe(39);

    (document as any).modelContext.removeEventListener('toolchange', handler);
    (document as any).modelContext.ontoolchange = prev;
    // restore localStorage
    try { localStorage.removeItem('carecanvas_active_user'); } catch {}
  });
});
