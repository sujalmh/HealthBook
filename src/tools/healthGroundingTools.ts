/**
 * CareCanvas WebMCP Tools: Health Grounding — Web Intelligence AFTER Extraction
 * Optional tools that use Exa search to ground vault facts with citations.
 * These are NOT auto-registered in allWebMCPTools (keeps 40-tool count for M7).
 * Register explicitly via registerGroundingTools(engine) if you want them as WebMCP tools.
 *
 * Each tool uses Exa best practices:
 * - contents.highlights: true for token efficiency
 * - type auto by default; deep-lite/deep for synthesis
 * - No deprecated params
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import { groundLabTrend, groundMedicationContext, groundHealthQuestion } from '../core/search/healthGrounding.ts';
import { isExaEnabled, getExaConfig } from '../core/search/exaConfig.ts';

export const searchHealthKnowledgeTool: WebMCPToolDefinition = {
  name: 'search_health_knowledge',
  description: 'Web-grounded health search via Exa — after extraction, get what a fact MEANS with citations (highlights, token-efficient). Use for labs, meds, conditions. Supports instant/fast/auto search types with official sources (CDC, NIH, PubMed, Mayo, WHO, FDA).',
  moduleOwner: 'vault',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language health question, semantically rich' },
      contextFacts: { type: 'string', description: 'Optional vault context (e.g. "eGFR 32, creatinine 1.8 on Lisinopril")' },
      patientId: { type: 'string', description: 'Patient ID for audit' },
      fresh: { type: 'boolean', description: 'If true, forces livecrawl maxAgeHours:0 for real-time guidelines' },
      numResults: { type: 'number', description: '1-10 results, default 5' },
      searchType: { type: 'string', enum: ['auto','fast','instant','deep-lite','deep'], description: 'Exa search type: instant (~250ms), fast (~450ms), auto (~1s) — auto balanced' },
    },
    required: ['query'],
  },
  returns: { type: 'object', description: 'Grounded results with highlights, citations, requestId, cost' },
  execute: async (params: { query: string; contextFacts?: string; patientId?: string; fresh?: boolean; numResults?: number; searchType?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (!params.query || typeof params.query !== 'string' || !params.query.trim()) {
      return { success: false, tool: 'search_health_knowledge', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'query is required', error: { code: 'INVALID_PARAMS', message: 'query required' }, humanApprovalRequired: false };
    }
    if (!isExaEnabled(getExaConfig())) {
      return { success: false, tool: 'search_health_knowledge', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'Exa grounding not configured — set EXA_API_KEY in .env or VITE_EXA_API_KEY in Settings. Extraction remains local.', error: { code: 'EXA_NOT_CONFIGURED', message: 'EXA_API_KEY missing' }, humanApprovalRequired: false };
    }
    try {
      const insight = await groundHealthQuestion(params.query, { contextFacts: params.contextFacts, numResults: params.numResults ?? 5, forceLivecrawl: params.fresh ?? false, type: (params.searchType as any) ?? 'auto' });
      return { success: true, tool: 'search_health_knowledge', timestamp: new Date().toISOString(), data: insight, plainLanguageSummary: `Grounded insights for "${params.query}" [${(params.searchType as any) ?? 'auto'}] — ${insight.results.length} sources, ${insight.citations.length} citations. Highlights for efficiency. Official sources.`, humanApprovalRequired: false };
    } catch (err: any) {
      return { success: false, tool: 'search_health_knowledge', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: `Grounding failed: ${err?.message || String(err)}`, error: { code: 'GROUNDING_FAILED', message: err?.message || String(err) }, humanApprovalRequired: false };
    }
  },
};

export const groundLabInsightTool: WebMCPToolDefinition = {
  name: 'ground_lab_insight',
  description: 'Ground a lab marker (eGFR, creatinine, HbA1c, etc.) with latest guidelines via Exa. Intelligence AFTER extraction — vault lab value + web evidence + citations. Official sources, instant/fast/auto.',
  moduleOwner: 'labstory',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      marker: { type: 'string', description: 'Biomarker name, e.g. eGFR, Creatinine, HbA1c, Potassium, LDL' },
      value: { type: 'number', description: 'Numeric value' },
      unit: { type: 'string', description: 'Unit, e.g. mg/dL, mEq/L' },
      trend: { type: 'string', description: 'Optional trajectory, e.g. declining_renal_function' },
      medications: { type: 'array', items: { type: 'string' }, description: 'Correlated meds for context' },
      patientContext: { type: 'string', description: 'Optional patient context' },
      patientId: { type: 'string', description: 'Patient ID' },
      searchType: { type: 'string', enum: ['auto','fast','instant'], description: 'Exa search type: instant (~250ms), fast (~450ms), auto (~1s)' },
    },
    required: ['marker'],
  },
  returns: { type: 'object', description: 'Grounded lab insight with citations' },
  execute: async (params: { marker: string; value?: number; unit?: string; trend?: string; medications?: string[]; patientContext?: string; patientId?: string; searchType?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (!params.marker || typeof params.marker !== 'string' || !params.marker.trim()) {
      return { success: false, tool: 'ground_lab_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'marker required', error: { code: 'INVALID_PARAMS', message: 'marker required' }, humanApprovalRequired: false };
    }
    if (!isExaEnabled(getExaConfig())) {
      return { success: false, tool: 'ground_lab_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'Exa not configured', error: { code: 'EXA_NOT_CONFIGURED', message: 'EXA_API_KEY missing' }, humanApprovalRequired: false };
    }
    try {
      const insight = await groundLabTrend({ marker: params.marker, value: params.value, unit: params.unit, trend: params.trend, medications: params.medications, patientContext: params.patientContext, type: (params.searchType as any) ?? 'auto' });
      return { success: true, tool: 'ground_lab_insight', timestamp: new Date().toISOString(), data: insight, plainLanguageSummary: `Grounded ${params.marker} [${(params.searchType as any) ?? 'auto'}] — ${insight.results.length} official sources with citations.`, humanApprovalRequired: false };
    } catch (err: any) {
      return { success: false, tool: 'ground_lab_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: `Grounding failed: ${err?.message}`, error: { code: 'GROUNDING_FAILED', message: err?.message || String(err) }, humanApprovalRequired: false };
    }
  },
};

export const groundMedicationInsightTool: WebMCPToolDefinition = {
  name: 'ground_medication_insight',
  description: 'Ground medication interaction / dosing with latest evidence via Exa. After RxBridge/PillMap extraction, returns mechanism, severity, guidance with citations. Official sources, instant/fast/auto.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medNames: { type: 'array', items: { type: 'string' }, description: 'Medication names, 1-5' },
      patientId: { type: 'string', description: 'Patient ID' },
      includeLabs: { type: 'array', items: { type: 'object' }, description: 'Optional labs for lab-context flags' },
      searchType: { type: 'string', enum: ['auto','fast','instant'], description: 'Exa search type: instant (~250ms), fast (~450ms), auto (~1s)' },
    },
    required: ['medNames'],
  },
  returns: { type: 'object', description: 'Grounded medication insight with citations' },
  execute: async (params: { medNames: string[]; patientId?: string; includeLabs?: any[]; searchType?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (!Array.isArray(params.medNames) || params.medNames.length === 0) {
      return { success: false, tool: 'ground_medication_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'medNames array required', error: { code: 'INVALID_PARAMS', message: 'medNames required' }, humanApprovalRequired: false };
    }
    if (!isExaEnabled(getExaConfig())) {
      return { success: false, tool: 'ground_medication_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: 'Exa not configured', error: { code: 'EXA_NOT_CONFIGURED', message: 'EXA_API_KEY missing' }, humanApprovalRequired: false };
    }
    try {
      const insight = await groundMedicationContext({ medNames: params.medNames, patientLabs: params.includeLabs, type: (params.searchType as any) ?? 'auto' });
      return { success: true, tool: 'ground_medication_insight', timestamp: new Date().toISOString(), data: insight, plainLanguageSummary: `Grounded medication [${(params.searchType as any) ?? 'auto'}] for ${params.medNames.join(', ')} — ${insight.results.length} official sources.`, humanApprovalRequired: false };
    } catch (err: any) {
      return { success: false, tool: 'ground_medication_insight', timestamp: new Date().toISOString(), data: null, plainLanguageSummary: `Grounding failed: ${err?.message}`, error: { code: 'GROUNDING_FAILED', message: err?.message || String(err) }, humanApprovalRequired: false };
    }
  },
};

export const healthGroundingTools: WebMCPToolDefinition[] = [
  searchHealthKnowledgeTool,
  groundLabInsightTool,
  groundMedicationInsightTool,
];

export function registerGroundingTools(engine: { register: (t: WebMCPToolDefinition) => void }): void {
  for (const tool of healthGroundingTools) {
    try { engine.register(tool); } catch {}
  }
}
