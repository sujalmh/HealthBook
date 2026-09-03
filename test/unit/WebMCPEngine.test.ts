import { describe, it, expect, beforeEach } from 'vitest';
import { WebMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { allTools } from '@/tools';
import { WebMCPToolDefinition } from '@/types/webmcp';

describe('WebMCP Core Engine & Dual-Mode Dispatcher', () => {
  let engine: WebMCPEngine;

  beforeEach(() => {
    if (typeof document !== 'undefined' && (document as unknown as { modelContext?: unknown }).modelContext) {
      try {
        delete (document as unknown as { modelContext?: unknown }).modelContext;
      } catch {
        (document as unknown as { modelContext?: unknown }).modelContext = undefined;
      }
    }
    engine = new WebMCPEngine();
  });

  it('registers all 47 WebMCP tools across 9 modules (incl auth 2 + doctor 5)', () => {
    allTools.forEach((t) => engine.register(t));
    const registered = engine.getRegisteredTools();
    expect(registered.length).toBe(47);

    const vaultTools = engine.getToolsByModule('vault');
    expect(vaultTools.length).toBe(3);

    const pillmapTools = engine.getToolsByModule('pillmap');
    expect(pillmapTools.length).toBe(8);

    const rxbridgeTools = engine.getToolsByModule('rxbridge');
    expect(rxbridgeTools.length).toBe(5);

    const safetyTools = engine.getToolsByModule('safety');
    expect(safetyTools.length).toBe(9);

    const careTools = engine.getToolsByModule('carecircle');
    expect(careTools.length).toBe(11); // 7 carecircle + 4 doctor tools (view_patient_as_doctor is dossier)

    const dossierTools = engine.getToolsByModule('dossier');
    expect(dossierTools.length).toBe(4); // + view_patient_as_doctor
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

    expect(() => engine.validateSchema(sampleTool.parameters, { text: 'hello' })).toThrow(
      "Missing required parameter 'count'"
    );
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 123 as unknown as string, count: 5 })).toThrow(
      "Parameter 'text' must be a string"
    );
    expect(() => engine.validateSchema(sampleTool.parameters, { text: 'ok', count: 1, role: 'alien' })).toThrow(
      "value 'alien' is not in allowed enum values"
    );
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

  // Native shim fallback parity — jsdom Promise path (document.modelContext)
  it('native shim fallback parity: document.modelContext.getTools() Promise returns 47 with valid inputSchema', async () => {
    allTools.forEach((t) => engine.register(t));
    const legacy = engine.getRegisteredTools();
    expect(legacy.length).toBe(47);

    expect(typeof (document as unknown as { modelContext: unknown }).modelContext).toBe('object');
    expect(typeof (document as unknown as { modelContext: { registerTool: unknown } }).modelContext.registerTool).toBe('function');
    expect(typeof (document as unknown as { modelContext: { getTools: unknown } }).modelContext.getTools).toBe('function');
    expect(typeof (document as unknown as { modelContext: { executeTool: unknown } }).modelContext.executeTool).toBe('function');

    const tools = await (document as unknown as { modelContext: { getTools: () => Promise<unknown[]> } }).modelContext.getTools();
    expect(tools.length).toBe(47);

    let schemaPass = 0;
    let nonEmptyDesc = 0;
    for (const rt of tools as Array<{ name: string; description: string; inputSchema: string; origin: string; window: unknown; title: string; annotations: unknown }>) {
      expect(rt.name).toMatch(/^[a-zA-Z0-9_.\-]{1,128}$/);
      expect(rt.description).toBeTruthy();
      if (rt.description && rt.description.length > 0) nonEmptyDesc++;
      expect(typeof rt.inputSchema).toBe('string');
      const parsed = JSON.parse(rt.inputSchema) as { type: string };
      expect(parsed).toBeDefined();
      expect(parsed.type).toBe('object');
      expect(rt.origin).toBeTruthy();
      expect(rt.window !== undefined).toBe(true);
      expect(rt.title).toBeTruthy();
      expect(rt.annotations).toBeDefined();
      schemaPass++;
    }
    expect(schemaPass).toBe(47);
    expect(nonEmptyDesc).toBe(47);
  });

  it('toolchange fires on register/unregister and executeTool returns DOMString via document.modelContext', async () => {
    let toolchangeCount = 0;
    const handler = () => { toolchangeCount++; };
    (document as unknown as { modelContext: { addEventListener: (t: string, h: () => void) => void } }).modelContext.addEventListener('toolchange', handler);
    const prev = (document as unknown as { modelContext: { ontoolchange: unknown } }).modelContext.ontoolchange;
    (document as unknown as { modelContext: { ontoolchange: unknown } }).modelContext.ontoolchange = () => {};

    allTools.forEach((t) => engine.register(t));
    expect(toolchangeCount).toBeGreaterThanOrEqual(1);

    const tools = await (document as unknown as { modelContext: { getTools: () => Promise<Array<{ name: string }>> } }).modelContext.getTools();
    expect(tools.length).toBe(47);

    const extractFact = (tools as Array<{ name: string }>).find((t) => t.name === 'extract_fact');
    expect(extractFact).toBeDefined();

    try {
      localStorage.setItem('healthbook_active_user', JSON.stringify({ userId: 'probe-patient-001', name: 'Probe', role: 'patient', isProxy: false }));
    } catch {}
    const domStr = await (document as unknown as { modelContext: { executeTool: (tool: unknown, input: unknown) => Promise<string> } }).modelContext.executeTool(extractFact as unknown as object, { documentId: 'probe-doc-001', rawText: 'Apixaban 5mg twice daily' });
    expect(typeof domStr).toBe('string');
    const parsed = JSON.parse(domStr) as { success: boolean; data: unknown; plainLanguageSummary: string };
    expect(parsed.success).toBe(true);
    const dataStr = JSON.stringify(parsed.data);
    expect(dataStr).toContain('probe-patient-001');
    expect(parsed.data).toBeDefined();
    if (Array.isArray(parsed.data) && parsed.data.length > 0) {
      expect((parsed.data[0] as { patientId: string }).patientId).toBe('probe-patient-001');
    }
    expect(parsed.plainLanguageSummary).toBeTruthy();

    await (document as unknown as { modelContext: { unregisterTool: (name: string) => Promise<void> } }).modelContext.unregisterTool('extract_fact');
    expect(toolchangeCount).toBeGreaterThanOrEqual(2);
    const after = await (document as unknown as { modelContext: { getTools: () => Promise<unknown[]> } }).modelContext.getTools();
    expect(after.length).toBe(46);

    (document as unknown as { modelContext: { removeEventListener: (t: string, h: () => void) => void } }).modelContext.removeEventListener('toolchange', handler);
    (document as unknown as { modelContext: { ontoolchange: unknown } }).modelContext.ontoolchange = prev;
    try { localStorage.removeItem('healthbook_active_user'); } catch {}
  });
});
