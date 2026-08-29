import { describe, it, expect, beforeEach } from 'vitest';
import { WebMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { allTools } from '@/tools';
describe('WebMCP Core Engine & Dual-Mode Dispatcher', () => {
    let engine;
    beforeEach(() => {
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
        const sampleTool = {
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
            execute: async (p) => ({
                success: true,
                tool: 'test_tool',
                timestamp: new Date().toISOString(),
                data: p,
                plainLanguageExplanation: 'OK',
                humanApprovalRequired: false,
            }),
        };
        engine.register(sampleTool);
        // Missing required field
        expect(() => engine.validateSchema(sampleTool.parameters, { text: 'hello' })).toThrow("Missing required parameter 'count'");
        // Wrong type
        expect(() => engine.validateSchema(sampleTool.parameters, { text: 123, count: 5 })).toThrow("Parameter 'text' must be a string");
        // Invalid enum
        expect(() => engine.validateSchema(sampleTool.parameters, { text: 'ok', count: 1, role: 'alien' })).toThrow("value 'alien' is not in allowed enum values");
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
});
