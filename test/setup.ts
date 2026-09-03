import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';
import { localVault } from '../src/core/vault/LocalVault';
import { webMCPEngine } from '../src/core/webmcp/WebMCPEngine';
import { routeAiMock } from './helpers/mockClinicalAI';

// Ensure test env flags
if (typeof process !== 'undefined') {
  try { (process as unknown as { env: Record<string, string> }).env.VITEST = 'true'; (process as unknown as { env: Record<string, string> }).env.NODE_ENV = 'test'; } catch {}
}
if (typeof globalThis !== 'undefined' && typeof window !== 'undefined') {
  try {
    if ((globalThis as unknown as { AbortController: unknown }).AbortController) (window as unknown as { AbortController: unknown }).AbortController = (globalThis as unknown as { AbortController: unknown }).AbortController;
    if ((globalThis as unknown as { AbortSignal: unknown }).AbortSignal) (window as unknown as { AbortSignal: unknown }).AbortSignal = (globalThis as unknown as { AbortSignal: unknown }).AbortSignal;
  } catch {}
}

// Minimal deterministic AI mock — replaces 188-line heuristic (now ~25 lines)
// Parses userText for known meds/labs to satisfy M1/M5 expectations, no exhaustive branching
function generateFactsFromText(text: string): unknown[] {
  const lower = text.toLowerCase();
  const facts: unknown[] = [];
  const medMap: Record<string, { name: string; val: string; unit: string; expl: string }> = {
    apixaban: { name: 'Apixaban', val: '5 mg twice daily', unit: 'mg', expl: 'Apixaban 5 mg twice daily for stroke prevention.' },
    metformin: { name: 'Metformin', val: '1000 mg twice daily with meals', unit: 'mg', expl: 'Metformin 1000 mg twice daily with meals.' },
    atorvastatin: { name: 'Atorvastatin', val: '40 mg at bedtime', unit: 'mg', expl: 'Atorvastatin 40 mg at bedtime.' },
    lisinopril: { name: 'Lisinopril', val: '10 mg once daily', unit: 'mg', expl: 'Lisinopril 10 mg once daily.' },
    levothyroxine: { name: 'Levothyroxine', val: '75 mcg daily', unit: 'mcg', expl: 'Levothyroxine 75 mcg daily.' },
  };
  for (const [k, v] of Object.entries(medMap)) if (lower.includes(k)) facts.push({ name: v.name, category: 'medication', value: v.val, unit: v.unit, confidence: 0.95, plainExplanation: v.expl });
  if (lower.includes('creatinine')) facts.push({ name: 'Creatinine', category: 'lab', value: '1.2 mg/dL', unit: 'mg/dL', confidence: 0.95, plainExplanation: 'Creatinine 1.2 mg/dL.' });
  if (lower.includes('egfr') || lower.includes('gfr')) {
    const m = text.match(/egfr[^0-9]*([\d.]+)/i);
    const val = m ? `${m[1]} mL/min/1.73m2` : '58 mL/min/1.73m2';
    facts.push({ name: 'eGFR', category: 'lab', value: val, unit: 'mL/min/1.73m2', confidence: 0.95, plainExplanation: `eGFR ${val}.` });
  }
  if (facts.length === 0) {
    facts.push({ name: 'Apixaban', category: 'medication', value: '5 mg twice daily', unit: 'mg', confidence: 0.95, plainExplanation: 'Apixaban 5 mg twice daily.' });
    facts.push({ name: 'Creatinine', category: 'lab', value: '1.2 mg/dL', unit: 'mg/dL', confidence: 0.95, plainExplanation: 'Creatinine 1.2 mg/dL.' });
  }
  return facts;
}

function wrapFetch(origFetch: unknown) {
  const orig = origFetch as (url: unknown, opts: unknown) => Promise<Response>;
  if (!orig || (orig as unknown as { __wrapped: boolean }).__wrapped) return orig;
  const wrapped = async (url: unknown, opts: unknown) => {
    const urlStr = typeof url === 'string' ? url : (url as { url?: string })?.url || String(url || '');
    const isAIUrl = urlStr.includes('opencode.ai') || urlStr.includes('chat/completions') || urlStr.includes('/responses') || urlStr.includes('/api/ai');
    let bodyText = '';
    try { const b = (opts as { body?: unknown })?.body; bodyText = typeof b === 'string' ? b : JSON.stringify(b ?? ''); } catch {}
    const isAIRequest = isAIUrl || (bodyText && (bodyText.includes('"model"') || bodyText.includes('messages')));
    if (isAIRequest && process.env.VITEST === 'true') {
      // Clinical pipeline prompts route to the shared deterministic mock;
      // anything else keeps the extraction-facts behavior below.
      try {
        const parsed = JSON.parse(bodyText);
        let systemPrompt = '';
        let userText = '';
        if (parsed.messages && Array.isArray(parsed.messages)) {
          for (const m of parsed.messages) {
            if (m.role === 'system') systemPrompt = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            if (m.role === 'user') {
              if (typeof m.content === 'string') userText = m.content;
              else if (Array.isArray(m.content)) userText = m.content.map((p: any) => p.text || p.content || '').join(' ');
              else userText = JSON.stringify(m.content);
            }
          }
        } else if (parsed.input && Array.isArray(parsed.input)) {
          for (const it of parsed.input) {
            if (it.role === 'system' && it.content) systemPrompt = Array.isArray(it.content) ? it.content.map((c: any) => c.text || '').join(' ') : String(it.content);
            if (it.role === 'user' && it.content) userText = Array.isArray(it.content) ? it.content.map((c: any) => c.text || '').join(' ') : String(it.content);
          }
        }
        const routed = routeAiMock(systemPrompt, userText);
        if (routed !== null) {
          const text = JSON.stringify(routed);
          const routedIsResponses = urlStr.includes('/responses') || bodyText.includes('"input"');
          if (routedIsResponses) {
            return new Response(JSON.stringify({ id: 'resp_test', object: 'response', status: 'completed', output: [{ id: 'msg_test', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
          } else {
            return new Response(JSON.stringify({ id: 'chatcmpl-test', object: 'chat.completion', created: Date.now(), model: 'mock', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
        }
      } catch {}
      const facts = generateFactsFromText(bodyText + ' ' + urlStr);
      const isResponses = urlStr.includes('/responses') || bodyText.includes('"input"');
      if (isResponses) {
        return new Response(JSON.stringify({ id: 'resp_test', object: 'response', status: 'completed', output: [{ id: 'msg_test', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ facts }) }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ id: 'chatcmpl-test', object: 'chat.completion', created: Date.now(), model: 'mock', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ facts }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
    return orig(url, opts);
  };
  (wrapped as unknown as { __wrapped: boolean }).__wrapped = true;
  return wrapped;
}

try {
  if ((globalThis as unknown as { fetch: unknown }).fetch) (globalThis as unknown as { fetch: unknown }).fetch = wrapFetch((globalThis as unknown as { fetch: unknown }).fetch);
  if ((window as unknown as { fetch: unknown }).fetch) (window as unknown as { fetch: unknown }).fetch = wrapFetch((window as unknown as { fetch: unknown }).fetch);
} catch {}

beforeEach(async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      const mockAIConfig = JSON.stringify({
        VITE_AI_ENABLED: 'true',
        VITE_AI_PROVIDER: 'chat',
        VITE_AI_BASE_URL: 'https://opencode.ai/zen/go/v1',
        VITE_AI_API_KEY: 'test_mock_key_do_not_use_in_prod',
        VITE_AI_MODEL: 'mock-model',
        VITE_AI_STRUCTURED_OUTPUTS: 'true'
      });
      localStorage.setItem('carecanvas_settings', mockAIConfig);
      localStorage.setItem('carecanvas_ai_settings', mockAIConfig);
    }
  } catch {}

  if (typeof document !== 'undefined' && !(document as unknown as { modelContext?: { registerTool?: unknown } }).modelContext?.registerTool) {
    void webMCPEngine;
    if (!(document as unknown as { modelContext?: { registerTool?: unknown } }).modelContext?.registerTool) {
      const { WebMCPEngine } = await import('../src/core/webmcp/WebMCPEngine');
      void new WebMCPEngine();
    }
  }
  await localVault.clearAll();
});

afterEach(async () => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  } catch {}
});
