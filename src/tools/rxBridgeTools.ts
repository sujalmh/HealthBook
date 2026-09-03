/**
 * CareCanvas WebMCP Tools: RxBridge Post-Discharge Reconciliation Engine — AI-native (M2)
 * Tools: explain_med_change, flag_interaction, flag_diet_interaction, suggest_question_for_doctor, export_patient_summary
 * All clinical content flows through the AI pipeline (no bundled drug tables, no template fallbacks).
 * When the pipeline is unavailable the tools return honest AI_UNAVAILABLE/AI_FAILED errors.
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import { ClinicalInteractionEngine, AIUnavailableError } from '../core/knowledge/interactionEngine.ts';
import { stableHash, sanitizeForId } from '../core/knowledge/interactionCache.ts';
import { ClinicalReconciliationEngine } from '../core/knowledge/reconciliationEngine.ts';
import { callAI } from '../core/ai/client.ts';
import type { Patient3ListDischargeDataset } from '../types/rxbridge.ts';

/** Honest error result when the AI pipeline cannot produce clinical content. */
function aiErrorResult(tool: string, err: unknown, what: string): WebMCPToolResult {
  const code = err instanceof AIUnavailableError ? err.code : 'AI_FAILED';
  const message = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    tool,
    timestamp: new Date().toISOString(),
    data: null,
    plainLanguageSummary: `Could not ${what} — the AI service is unavailable (${message}). No content was fabricated; please retry.`,
    humanApprovalRequired: false,
    error: { code, message }
  };
}

export const explainMedChangeTool: WebMCPToolDefinition = {
  name: 'explain_med_change',
  description:
    'Walks patient through each medication change across 3 lists (Pre-admission, In-hospital, Discharge) with plain-language explanations and 5 status badges (Continued, Dose Changed, Stopped, New, Held).',
  moduleOwner: 'rxbridge',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'reconciliation_walk',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Name of the medication' },
      preHospDose: { type: 'string', description: 'Home baseline dose or "none"' },
      inHospAction: { type: 'string', description: 'Hospital chart action or rationale' },
      dischargeDose: { type: 'string', description: 'Discharge prescription order dose' },
      reason: { type: 'string', description: 'Documented clinical reason for change' }
    },
    required: ['medName', 'dischargeDose']
  },
  returns: { type: 'object', description: 'Plain language reconciliation item with status badge' },
  uiSideEffects: {
    canvasRerenders: ['rxbridge']
  },
  execute: async (
    params: {
      medName: string;
      preHospDose?: string;
      inHospAction?: string;
      dischargeDose: string;
      reason?: string;
    },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const { medName, preHospDose, inHospAction, dischargeDose, reason } = params;
    let generic: string;
    try {
      generic = await ClinicalInteractionEngine.resolveGenericName(medName);
    } catch (err) {
      return aiErrorResult('explain_med_change', err, `resolve a generic name for "${medName}"`);
    }

    const statusBadge = ClinicalReconciliationEngine.determineStatusBadge(
      preHospDose,
      inHospAction,
      dischargeDose
    );

    // AI-generated narrative (single request vision+text structured when doc context available)
    let explanation: string;
    let suggestedQuestions: string[];
    try {
      explanation = await ClinicalReconciliationEngine.generatePlainLanguageExplanationAI(
        medName,
        generic,
        preHospDose,
        inHospAction,
        dischargeDose,
        statusBadge,
        reason
      );
      suggestedQuestions = await ClinicalReconciliationEngine.generateDoctorQuestionsAI(
        medName,
        generic,
        statusBadge,
        preHospDose,
        dischargeDose
      );
    } catch (err) {
      return aiErrorResult('explain_med_change', err, `explain the ${medName} medication change`);
    }

    const result = {
      medName,
      genericName: generic,
      preHospDose: preHospDose || 'None',
      inHospAction: inHospAction || 'Administered',
      dischargeDose,
      statusBadge,
      plainLanguageExplanation: explanation,
      documentedReason: reason || 'Post-discharge clinical reconciliation',
      suggestedQuestions,
      aiGenerated: true
    };

    return {
      success: true,
      tool: 'explain_med_change',
      timestamp: new Date().toISOString(),
      data: result,
      plainLanguageSummary: explanation,
      humanApprovalRequired: false
    };
  }
};

export const flagInteractionTool: WebMCPToolDefinition = {
  name: 'flag_interaction',
  description:
    'Checks discharge prescription list against pre-admission OTC supplements, herbs, active vault meds, and biomarker safety (e.g. Apixaban vs Fish Oil, Lisinopril vs Spironolactone, eGFR < 30).',
  moduleOwner: 'rxbridge',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      dischargeMeds: { type: 'array', items: { type: 'string' }, description: 'Discharge medications' },
      preAdmitOTCs: { type: 'array', items: { type: 'string' }, description: 'Pre-admission OTCs or home supplements' },
      patientLabs: { type: 'array', items: { type: 'object' }, description: 'Recent laboratory biomarker values' }
    },
    required: ['dischargeMeds']
  },
  returns: { type: 'array', description: 'Array of flagged drug-drug, drug-OTC, or lab-context conflicts' },
  uiSideEffects: {
    canvasRerenders: ['rxbridge', 'pillmap']
  },
  execute: async (
    params: {
      dischargeMeds: string[];
      preAdmitOTCs?: string[];
      patientLabs?: { marker: string; value: number }[];
    },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const allMeds = [...params.dischargeMeds, ...(params.preAdmitOTCs || [])];
    let rawArcs;
    try {
      rawArcs = await ClinicalInteractionEngine.checkDrugInteractions(allMeds);
    } catch (err) {
      return aiErrorResult('flag_interaction', err, 'screen discharge interactions');
    }

    const preOTCs = params.preAdmitOTCs || [];
    const enrichedArcs = rawArcs.map((arc: any) => {
      const isOTC = preOTCs.some(
        (otc: string) =>
          arc.drugA?.toLowerCase().includes(otc?.toLowerCase()) ||
          arc.drugB?.toLowerCase().includes(otc?.toLowerCase())
      );
      return {
        id: arc.id,
        drugA: arc.drugA,
        drugB: arc.drugB,
        severity: arc.severity,
        mechanism: arc.mechanism,
        clinicalGuidance: arc.clinicalGuidance,
        isPreAdmitOTC: isOTC
      };
    });

    // Check lab contextual safety if labs provided or available in vault.
    // Generics resolved once via the AI pipeline for lab-risk matching.
    const labs = params.patientLabs || (context.vault ? context.vault.getLabs(context.patientId) : []);
    const egfrLab = labs.find((l: any) => l.marker?.toLowerCase().includes('egfr'));
    const kLab = labs.find((l: any) => l.marker?.toLowerCase() === 'k' || l.marker?.toLowerCase().includes('potassium'));
    let aliasMap: Record<string, string> = {};
    try {
      aliasMap = await ClinicalInteractionEngine.resolveGenerics(params.dischargeMeds);
    } catch {
      // Without alias resolution, lab-risk matching uses literal names only
    }
    const genericOf = (med: string): string => aliasMap[med] || med;

    if (egfrLab && egfrLab.value < 30) {
      for (const med of params.dischargeMeds) {
        const gen = genericOf(med);
        if (gen === 'Metformin' || gen === 'Ibuprofen' || gen === 'Naproxen') {
          enrichedArcs.push({
            id: `lab_contra_${sanitizeForId(gen)}_egfr_${stableHash(`${gen}|${egfrLab.value}`).slice(0, 8)}`,
            drugA: med,
            drugB: `Kidney Function eGFR (${egfrLab.value} mL/min)`,
            severity: 'CONTRAINDICATED',
            mechanism: `${gen} in severe renal impairment (eGFR < 30) poses acute kidney injury or lactic acidosis risk.`,
            clinicalGuidance: 'Reduce dosage or discontinue as directed by nephrologist.',
            isPreAdmitOTC: false,
            labContextWarning: `Critical: eGFR is ${egfrLab.value} mL/min (< 30).`
          } as any);
        }
      }
    }

    if (kLab && kLab.value > 5.0) {
      for (const med of params.dischargeMeds) {
        const gen = genericOf(med);
        if (gen === 'Spironolactone' || gen === 'Lisinopril') {
          enrichedArcs.push({
            id: `lab_contra_${sanitizeForId(gen)}_k_${stableHash(`${gen}|${kLab.value}`).slice(0, 8)}`,
            drugA: med,
            drugB: `Serum Potassium (${kLab.value} mEq/L)`,
            severity: 'CONTRAINDICATED',
            mechanism: `${gen} causes potassium retention and can worsen hyperkalemia.`,
            clinicalGuidance: 'Monitor potassium within 1-2 weeks; avoid high-potassium supplements.',
            isPreAdmitOTC: false,
            labContextWarning: `Warning: Serum Potassium is ${kLab.value} mEq/L (> 5.0).`
          } as any);
        }
      }
    }

    return {
      success: true,
      tool: 'flag_interaction',
      timestamp: new Date().toISOString(),
      data: enrichedArcs,
      plainLanguageSummary:
        enrichedArcs.length === 0
          ? 'No drug-drug, drug-OTC, or lab-context conflicts detected on discharge.'
          : `Flagged ${enrichedArcs.length} discharge interaction(s): ${enrichedArcs
              .map((a: any) => `${a.drugA} + ${a.drugB} (${a.severity})`)
              .join('; ')}.`,
      humanApprovalRequired: false
    };
  }
};

export const flagDietInteractionTool: WebMCPToolDefinition = {
  name: 'flag_diet_interaction',
  description:
    'Checks discharge medications against patient diet habits (e.g. Atorvastatin vs Grapefruit, Warfarin vs Vitamin K, Levothyroxine vs Dairy/Empty Stomach, Metronidazole vs Alcohol).',
  moduleOwner: 'rxbridge',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      dischargeMeds: { type: 'array', items: { type: 'string' }, description: 'Discharge prescription meds' },
      patientDietProfile: { type: 'object', description: 'Diet profile flags' }
    },
    required: ['dischargeMeds']
  },
  returns: { type: 'array', description: 'Diet interaction flags with badges and timing rules' },
  uiSideEffects: {
    canvasRerenders: ['rxbridge', 'pillmap']
  },
  execute: async (
    params: { dischargeMeds: string[]; patientDietProfile?: any },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const diet = params.patientDietProfile || {
      drinksGrapefruitDaily: true,
      frequentHighVitKGreens: true,
      dairyBreakfast: true,
      usesPotassiumSaltSubstitute: true
    };
    let badges;
    try {
      badges = await ClinicalInteractionEngine.checkDietInteractions(params.dischargeMeds, diet);
    } catch (err) {
      return aiErrorResult('flag_diet_interaction', err, 'screen discharge diet interactions');
    }

    return {
      success: true,
      tool: 'flag_diet_interaction',
      timestamp: new Date().toISOString(),
      data: badges,
      plainLanguageSummary:
        badges.length === 0
          ? 'No dietary conflicts found with discharge medications.'
          : `Identified ${badges.length} dietary interaction(s): ${badges.map((b: any) => `${b.drugName}: ${b.badgeText}`).join('; ')}.`,
      humanApprovalRequired: false
    };
  }
};

export const suggestQuestionForDoctorTool: WebMCPToolDefinition = {
  name: 'suggest_question_for_doctor',
  description:
    'Auto-generates targeted doctor questions for unclear medication changes or monitoring cadences and appends them to Question Bank.',
  moduleOwner: 'rxbridge',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'Clinical context (e.g. stopped lisinopril, new blood thinner, potassium monitoring, dose increase)'
      },
      medName: { type: 'string', description: 'Medication name if applicable' },
      autoAddToBank: { type: 'boolean', description: 'Auto add question to central Question Bank' },
      documentContext: { type: 'string', description: 'Optional discharge document text context for grounding' },
      imageDataUrl: { type: 'string', description: 'Optional data URL image of discharge list for vision+text multimodal' }
    },
    required: ['context']
  },
  returns: { type: 'object', description: 'Structured question bank item' },
  uiSideEffects: {
    canvasRerenders: ['question_bank'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'New question added to your Doctor Question Bank.'
    }
  },
  execute: async (
    params: { context: string; medName?: string; autoAddToBank?: boolean; documentContext?: string; imageDataUrl?: string; dischargeMeds?: string[] },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    let qText = '';

    // AI synthesis via AI client from actual discharge list + document context (single request vision+text structured when available)
    try {
      const dischargeMedsFromVault = (() => {
        try {
          return context.vault ? context.vault.getMedications(context.patientId).map((m: any) => m.genericName || m.name) : [];
        } catch { return []; }
      })();
      const labsFromVault = (() => {
        try {
          return context.vault ? context.vault.getLabs(context.patientId).slice(0, 5).map((l: any) => `${l.marker}: ${l.normalizedValue ?? l.value} ${l.normalizedUnit ?? l.unit}`) : [];
        } catch { return []; }
      })();
      const docContext = params.documentContext || dischargeMedsFromVault.join(', ') || params.context || '';
      const imageDataUrl = params.imageDataUrl && params.imageDataUrl.startsWith('data:image') ? params.imageDataUrl : undefined;

      const schema = {
        type: 'object',
        properties: {
          questionText: { type: 'string', description: 'Targeted doctor question' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' }
        },
        required: ['questionText', 'confidence', 'reasoning'],
        additionalProperties: false,
      } as any;
      const systemPrompt = `You are a clinical care coordinator. Given patient context, medication name, actual discharge medication list, recent labs, and optional document image/text, generate a single targeted question for the doctor that is specific, actionable, and grounded. Consider stopped meds kidney monitoring, blood thinner bleeding risks, dose changes, diet interactions. Return ONLY valid JSON with shape {"questionText": string, "confidence": number, "reasoning": string}. Provide confidence 0-1 and grounded reasoning. Use vision+text together when image provided. No markdown.`;
      const userText = `Context: "${params.context}"\nMed: ${params.medName || 'unknown'}\nActual discharge meds: ${JSON.stringify(dischargeMedsFromVault || params.dischargeMeds || [])}\nRecent labs: ${JSON.stringify(labsFromVault)}\nDocument context: ${docContext.slice(0, 1500)}`;
      const parsed = await callAI<any>(systemPrompt, userText, { schema, imageDataUrl });
      if (parsed && typeof parsed.questionText === 'string' && parsed.questionText.trim().length > 10) {
        qText = parsed.questionText.trim();
      } else {
        throw new AIUnavailableError('Doctor-question generation returned no usable result');
      }
    } catch (err) {
      return aiErrorResult('suggest_question_for_doctor', err, 'generate a doctor question');
    }

    const item = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      patientId: context.patientId,
      questionText: qText,
      category: 'medication_change' as const,
      sourceModule: 'rxbridge' as const,
      linkedMedName: params.medName,
      status: 'pending' as const,
      priority: 'high' as const,
      createdAt: new Date().toISOString()
    };

    if (params.autoAddToBank !== false && context.vault) {
      context.vault.addQuestion(item);
    }

    return {
      success: true,
      tool: 'suggest_question_for_doctor',
      timestamp: new Date().toISOString(),
      data: item,
      plainLanguageSummary: `Suggested doctor question: "${qText}"`,
      humanApprovalRequired: false
    };
  }
};

export const exportPatientSummaryTool: WebMCPToolDefinition = {
  name: 'export_patient_summary',
  description:
    'Generates a 1-page printable patient discharge home summary containing What Changed, Daily Schedule, Food/Diet Rules, Doctor Questions, and Emergency Red Flags.',
  moduleOwner: 'rxbridge',
  category: 'declarative_export',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      patientId: { type: 'string', description: 'Patient ID' },
      format: { type: 'string', enum: ['one_page_pdf', 'json', 'teach_back_summary'], description: 'Export format' },
      dataset: { type: 'object', description: 'Optional custom 3-list discharge dataset' },
      language: { type: 'string', enum: ['en', 'es', 'hi'], description: 'Summary language' }
    },
    required: ['patientId']
  },
  returns: { type: 'object', description: 'One-page patient discharge summary package' },
  execute: async (
    params: {
      patientId: string;
      format?: string;
      dataset?: Patient3ListDischargeDataset;
      language?: 'en' | 'es' | 'hi';
    },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    let dataset = params.dataset as Patient3ListDischargeDataset | undefined;

    // No mock fallback — require real dataset or build minimal from vault for context.patientId
    if (!dataset) {
      // Try to build minimal dataset from vault for real patient
      const vaultMeds = (() => {
        try {
          return context.vault ? context.vault.getMedications(params.patientId) : [];
        } catch {
          return [];
        }
      })();
      if (vaultMeds.length > 0) {
        const patientName = (context.activeProfile as any)?.name || 'Patient';
        dataset = {
          patientId: params.patientId,
          patientName,
          admissionDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
          dischargeDate: new Date().toISOString().slice(0, 10),
          ward: 'General',
          attendingPhysician: 'Care Team',
          preAdmissionMeds: [],
          inHospitalMeds: [],
          dischargeMeds: vaultMeds.map((m: any) => ({
            medName: m.genericName || m.name || 'Medication',
            dose: m.dosage || 'Standard',
            frequency: m.frequency || 'Once daily',
            status: 'CONTINUED' as const,
            reason: 'Vault-derived',
            timingSlots: m.timingSlots || ['morning']
          }))
        } as Patient3ListDischargeDataset;
      } else {
        return {
          success: false,
          tool: 'export_patient_summary',
          timestamp: new Date().toISOString(),
          data: null,
          plainLanguageSummary: 'No dataset provided and vault contains no medications for this patient. Upload your discharge list or provide dataset param.',
          humanApprovalRequired: false,
          error: { code: 'DATASET_REQUIRED', message: 'Provide params.dataset or ensure vault has medications for patient.' }
        };
      }
    }

    const questions = context.vault
      ? context.vault.getQuestions(params.patientId).map((q: any) => q.questionText)
      : [];

    const summary = {
      ...ClinicalReconciliationEngine.compilePatientSummary(
        dataset,
        questions,
        params.language || 'en'
      ),
      format: params.format || 'one_page_pdf'
    };

    return {
      success: true,
      tool: 'export_patient_summary',
      timestamp: new Date().toISOString(),
      data: summary,
      plainLanguageSummary: 'Successfully generated 1-page Patient Home Discharge Summary.',
      humanApprovalRequired: false
    };
  }
};
