/**
 * CareCanvas WebMCP Tools: RxBridge Post-Discharge Reconciliation Engine (M4)
 * Tools: explain_med_change, flag_interaction, flag_diet_interaction, suggest_question_for_doctor, export_patient_summary
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import { ClinicalInteractionEngine } from '../core/knowledge/interactionEngine.ts';
import { ClinicalReconciliationEngine } from '../core/knowledge/reconciliationEngine.ts';
import type { ChangeStatusBadge, Patient3ListDischargeDataset } from '../types/rxbridge.ts';
import { mockShantiDevi3ListDataset } from '../fixtures/discharge_lists.ts';

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
    const generic = ClinicalInteractionEngine.resolveGenericName(medName);

    const statusBadge = ClinicalReconciliationEngine.determineStatusBadge(
      preHospDose,
      inHospAction,
      dischargeDose
    );

    const explanation = ClinicalReconciliationEngine.generatePlainLanguageExplanation(
      medName,
      generic,
      preHospDose,
      inHospAction,
      dischargeDose,
      statusBadge,
      reason
    );

    const suggestedQuestions = ClinicalReconciliationEngine.generateDoctorQuestions(
      medName,
      generic,
      statusBadge,
      preHospDose,
      dischargeDose
    );

    const result = {
      medName,
      genericName: generic,
      preHospDose: preHospDose || 'None',
      inHospAction: inHospAction || 'Administered',
      dischargeDose,
      statusBadge,
      plainLanguageExplanation: explanation,
      documentedReason: reason || 'Post-discharge clinical reconciliation',
      suggestedQuestions
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
    const rawArcs = ClinicalInteractionEngine.checkDrugInteractions(allMeds);

    const preOTCs = params.preAdmitOTCs || [];
    const enrichedArcs = rawArcs.map((arc) => {
      const isOTC = preOTCs.some(
        (otc) =>
          arc.drugA.toLowerCase().includes(otc.toLowerCase()) ||
          arc.drugB.toLowerCase().includes(otc.toLowerCase())
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

    // Check lab contextual safety if labs provided or available in vault
    const labs = params.patientLabs || (context.vault ? context.vault.getLabs(context.patientId) : []);
    const egfrLab = labs.find((l: any) => l.marker?.toLowerCase().includes('egfr'));
    const kLab = labs.find((l: any) => l.marker?.toLowerCase() === 'k' || l.marker?.toLowerCase().includes('potassium'));

    if (egfrLab && egfrLab.value < 30) {
      for (const med of params.dischargeMeds) {
        const gen = ClinicalInteractionEngine.resolveGenericName(med);
        if (gen === 'Metformin' || gen === 'Ibuprofen' || gen === 'Naproxen') {
          enrichedArcs.push({
            id: `lab_contra_${gen}_egfr_${Date.now()}`,
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
        const gen = ClinicalInteractionEngine.resolveGenericName(med);
        if (gen === 'Spironolactone' || gen === 'Lisinopril') {
          enrichedArcs.push({
            id: `lab_contra_${gen}_k_${Date.now()}`,
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
    const badges = ClinicalInteractionEngine.checkDietInteractions(params.dischargeMeds, diet);

    return {
      success: true,
      tool: 'flag_diet_interaction',
      timestamp: new Date().toISOString(),
      data: badges,
      plainLanguageSummary:
        badges.length === 0
          ? 'No dietary conflicts found with discharge medications.'
          : `Identified ${badges.length} dietary interaction(s): ${badges.map((b) => `${b.drugName}: ${b.badgeText}`).join('; ')}.`,
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
      autoAddToBank: { type: 'boolean', description: 'Auto add question to central Question Bank' }
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
    params: { context: string; medName?: string; autoAddToBank?: boolean },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const ctx = params.context.toLowerCase();
    let qText = '';

    if (ctx.includes('lisinopril') || ctx.includes('stopped') || ctx.includes('kidney')) {
      qText =
        'Why was my Lisinopril stopped in the hospital, and should my primary care doctor recheck my kidney labs before restarting it?';
    } else if (ctx.includes('fish oil') || ctx.includes('apixaban') || ctx.includes('bleeding')) {
      qText =
        'Can I safely continue taking my Omega-3 Fish Oil supplement while on my new Apixaban blood thinner, or should I stop it?';
    } else if (ctx.includes('metformin') || ctx.includes('dose') || ctx.includes('sugar')) {
      qText =
        'My Metformin dose was increased to 1000mg twice daily. What symptoms should I watch for, and when should we recheck my A1c?';
    } else if (ctx.includes('atorvastatin') || ctx.includes('statin') || ctx.includes('grapefruit')) {
      qText =
        'Since my Atorvastatin was increased to 40mg at bedtime, when should we recheck my cholesterol levels, and is it safe to eat grapefruit occasionally?';
    } else {
      qText = `Could you please clarify the plan for ${params.medName || 'my medication'} and what follow-up tests are needed?`;
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
    const dataset = params.dataset || mockShantiDevi3ListDataset;
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
