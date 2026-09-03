import { describe, it, expect, beforeEach } from 'vitest';
import { WebMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { createAccountTool, signInTool } from '@/tools/authTools';
import { allWebMCPTools } from '@/tools';

describe('Auth MCP Tools — human-only password onboarding', () => {
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
    // mock localStorage clean
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('catalog contains 47 tools including create_account and sign_in', () => {
    expect(allWebMCPTools.length).toBe(47);
    expect(allWebMCPTools.some(t => t.name === 'create_account')).toBe(true);
    expect(allWebMCPTools.some(t => t.name === 'sign_in')).toBe(true);
  });

  it('create_account and sign_in have NO password in schema', () => {
    const caProps = Object.keys(createAccountTool.parameters.properties);
    const siProps = Object.keys(signInTool.parameters.properties);
    expect(caProps).not.toContain('password');
    expect(siProps).not.toContain('password');
    // also check case-insensitive
    expect(caProps.map(k=>k.toLowerCase())).not.toContain('password');
    expect(siProps.map(k=>k.toLowerCase())).not.toContain('password');
    // ensure description mentions human-only password
    expect(createAccountTool.description.toLowerCase()).toContain('password');
    expect(createAccountTool.description.toLowerCase()).toContain('human');
    expect(signInTool.description.toLowerCase()).toContain('password');
  });

  it('create_account rejects password smuggled via params', async () => {
    engine.register(createAccountTool);
    const res = await engine.execute('create_account', { name: 'Bob', email: 'bob@example.com', password: 'secret123' } as unknown as { name:string; email:string; password:string });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PASSWORD_NOT_ALLOWED_VIA_AI');
  });

  it('sign_in rejects password smuggled via params', async () => {
    engine.register(signInTool);
    const res = await engine.execute('sign_in', { email: 'a@example.com', password: 'hack' } as unknown as { email:string; password:string });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PASSWORD_NOT_ALLOWED_VIA_AI');
  });

  it('create_account stages pending and asks human to type password', async () => {
    engine.register(createAccountTool);
    const res = await engine.execute('create_account', { name: 'Alice', email: 'alice@example.com', role: 'patient' });
    expect(res.success).toBe(true);
    expect(res.humanApprovalRequired).toBe(true);
    expect(res.pendingApprovalId).toBeTruthy();
    expect(res.data.status).toBe('awaiting_human_password');
    expect(res.data.pendingStorageKey).toBe('healthbook_mcp_auth_pending');
    expect(res.plainLanguageSummary.toLowerCase()).toContain('password');
    expect(res.plainLanguageSummary.toLowerCase()).toContain('human');
    // no password in data
    expect(JSON.stringify(res.data).toLowerCase()).not.toContain('"password"');
    // pending stored
    const pendingRaw = localStorage.getItem('healthbook_mcp_auth_pending');
    expect(pendingRaw).toBeTruthy();
    const pending = JSON.parse(pendingRaw!);
    expect(pending.email).toBe('alice@example.com');
    expect(pending.mode).toBe('create');
    expect(pending).not.toHaveProperty('password');
  });

  it('sign_in stages pending without local lookup (server validates at completion)', async () => {
    engine.register(signInTool);
    const res = await engine.execute('sign_in', { email: 'existing@example.com' });
    expect(res.success).toBe(true);
    expect(res.humanApprovalRequired).toBe(true);
    expect(res.data.mode).toBe('signin');
    expect(res.data.email).toBe('existing@example.com');
    expect(res.data.status).toBe('awaiting_human_password');
    const pendingRaw = localStorage.getItem('healthbook_mcp_auth_pending');
    expect(pendingRaw).toBeTruthy();
  });

  it('sign_in stages pending even for unknown email (server validates at completion)', async () => {
    engine.register(signInTool);
    const res = await engine.execute('sign_in', { email: 'unknown@example.com' });
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('awaiting_human_password');
  });

  it('create_account stages pending without local duplicate check (server validates)', async () => {
    engine.register(createAccountTool);
    const res = await engine.execute('create_account', { email: 'dup@example.com', name: 'Dup2' });
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('awaiting_human_password');
  });

  it('native getTools exposes 42 with auth tools and inputSchema parseable', async () => {
    for (const t of allWebMCPTools) engine.register(t);
    const tools = await (document as unknown as { modelContext: { getTools: () => Promise<Array<{ name:string; inputSchema:string; description:string }>> } }).modelContext.getTools();
    expect(tools.length).toBe(47);
    const ca = tools.find(t=>t.name==='create_account');
    const si = tools.find(t=>t.name==='sign_in');
    expect(ca).toBeDefined();
    expect(si).toBeDefined();
    const caSchema = JSON.parse(ca!.inputSchema);
    const siSchema = JSON.parse(si!.inputSchema);
    expect(Object.keys(caSchema.properties)).not.toContain('password');
    expect(Object.keys(siSchema.properties)).not.toContain('password');
    expect(ca!.description.toLowerCase()).toContain('password');
  });
});
