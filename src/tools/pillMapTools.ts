/**
 * Healthbook WebMCP Tools: PillMap Polypharmacy Negotiator (M3) — AI-native.
 * Tools: add_medication, check_interactions, check_diet_interactions, check_duplicate_ingredient, suggest_schedule, simulate_adherence, export_for_pharmacist, set_reminder
 * All clinical reasoning flows through the AI pipeline (no bundled drug tables).
 * When the pipeline is unavailable the tools return honest AI_UNAVAILABLE/AI_FAILED
 * errors instead of fabricated content.
 */

import type {  WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult  } from '../types/webmcp.ts';
import { ClinicalInteractionEngine, AIUnavailableError } from '../core/knowledge/interactionEngine.ts';
import { healthRepository, DEFAULT_DIET_FLAGS } from '../core/vault/HealthRepository.ts';
import { gateIfViewOnly } from '../core/rbac/canAccess.ts';
import type {  TimeSlot, DayOfWeek  } from '../types/pillmap.ts';

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

function repoFor(vault: WebMCPExecutionContext['vault']) {
  return healthRepository.cache === vault
    ? healthRepository
    : new (healthRepository.constructor as new (v: typeof vault) => typeof healthRepository)(vault);
}

export const addMedicationTool: WebMCPToolDefinition = {
  name: 'add_medication',
  description: 'Adds a prescription medication or OTC supplement onto the 7x4 PillMap canvas in designated time slots.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Medication or supplement name' },
      dose: { type: 'string', description: 'Dose strength (e.g. 500mg, 10mg)' },
      frequency: { type: 'string', description: 'Frequency (e.g. QD, BID, PRN)' },
      slot: { type: 'string', description: 'Primary daily time slot (morning|noon|evening|bedtime, case-insensitive; invalid values return INVALID_SLOT)' },
      days: { type: 'array', items: { type: 'string' }, description: 'Active days of the week' },
      withFood: { type: 'boolean', description: 'Take with food instruction' }
    },
    required: ['name', 'dose', 'slot']
  },
  returns: { type: 'object', description: 'Created medication node on PillMap canvas' },
  uiSideEffects: {
    canvasRerenders: ['pillmap'],
    toastNotification: {
      type: 'success',
      messageTemplate: 'Medication added to PillMap canvas.'
    }
  },
  execute: async (params: { name: string; dose: string; frequency?: string; slot: string; days?: string[]; withFood?: boolean }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'add_medication');
    if (denied) return denied;
    const slotNormalized = params.slot?.toLowerCase() as TimeSlot;
    if (!['morning', 'noon', 'evening', 'bedtime'].includes(slotNormalized)) {
      return {
        success: false,
        tool: 'add_medication',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Invalid time slot "${params.slot}". Allowed: Morning, Noon, Evening, Bedtime.`,
        humanApprovalRequired: false,
        error: { code: 'INVALID_SLOT', message: `Slot ${params.slot} is not recognized.` }
      };
    }

    // Generic-name resolution via the AI pipeline (required — no local tables)
    let genericName: string;
    try {
      genericName = await ClinicalInteractionEngine.resolveGenericName(params.name);
    } catch (err) {
      return aiErrorResult('add_medication', err, `resolve a generic name for "${params.name}"`);
    }

    const medRecord = context.vault.addMedication(
      {
        id: `med_${params.name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
        patientId: context.patientId,
        genericName,
        brandName: params.name,
        dosage: params.dose,
        frequency: params.frequency || 'Once daily',
        timingSlots: [slotNormalized],
        withFood: params.withFood || false,
        status: 'active'
      },
      { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
    );

    return {
      success: true,
      tool: 'add_medication',
      timestamp: new Date().toISOString(),
      data: medRecord,
      plainLanguageSummary: `Added ${params.name} (${params.dose}) to ${slotNormalized} slot on 7x4 PillMap canvas.`,
      humanApprovalRequired: false
    };
  }
};

export const checkInteractionsTool: WebMCPToolDefinition = {
  name: 'check_interactions',
  description: 'Evaluates drug-drug interactions across active medications and returns SVG conflict arcs with plain-language mechanisms and severity colors.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medList: { type: 'array', items: { type: 'string' }, description: 'List of medication names to evaluate (defaults to active medications in vault)' }
    }
  },
  returns: { type: 'array', description: 'Array of interaction arcs with severity and clinical guidance' },
  uiSideEffects: {
    canvasRerenders: ['pillmap']
  },
  execute: async (params: { medList?: string[] }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    // Stored-evaluation fast path: when evaluating the patient's own active
    // regimen (no explicit medList override), serve the persisted evaluation
    // instead of recomputing on every call.
    const isStoredRegimen = !params.medList;
    if (isStoredRegimen) {
      try {
        const activeMeds = context.vault.getMedications(context.patientId, 'active');
        const repo = repoFor(context.vault);
        const result = await repo.evaluateInteractions(context.patientId, activeMeds as never, DEFAULT_DIET_FLAGS);
        const arcs = result.arcs;
        const summary =
          arcs.length === 0
            ? 'No drug-drug interaction conflicts detected across active medications.'
            : `Detected ${arcs.length} drug-drug conflict(s): ${arcs.map((a: unknown) => `${(a as { drugA: string }).drugA} + ${(a as { drugB: string }).drugB} (${(a as { severity: string }).severity})`).join(', ')}.`;
        return {
          success: true,
          tool: 'check_interactions',
          timestamp: new Date().toISOString(),
          data: arcs,
          plainLanguageSummary: summary,
          humanApprovalRequired: false
        };
      } catch {
        // fall through to ad-hoc compute
      }
    }
    const list = params.medList || context.vault.getMedications(context.patientId).map((m: never) => (m as { genericName: string }).genericName);
    // Ad-hoc what-if evaluation (explicit medList): compute directly without
    // polluting the stored patient regimen cache.
    let arcs;
    try {
      arcs = await ClinicalInteractionEngine.checkDrugInteractions(list);
    } catch (err) {
      return aiErrorResult('check_interactions', err, 'evaluate drug-drug interactions');
    }

    const summary =
      arcs.length === 0
        ? 'No drug-drug interaction conflicts detected across active medications.'
        : `Detected ${arcs.length} drug-drug conflict(s): ${arcs.map((a: any) => `${a.drugA} + ${a.drugB} (${a.severity})`).join(', ')}.`;

    return {
      success: true,
      tool: 'check_interactions',
      timestamp: new Date().toISOString(),
      data: arcs,
      plainLanguageSummary: summary,
      humanApprovalRequired: false
    };
  }
};

export const checkDietInteractionsTool: WebMCPToolDefinition = {
  name: 'check_diet_interactions',
  description: 'Evaluates food and diet interactions (e.g. grapefruit, vitamin K leafy greens, dairy/calcium, alcohol) and generates meal badges.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medList: { type: 'array', items: { type: 'string' }, description: 'Medications to check' },
      patientDiet: { type: 'object', description: 'Diet profile flags (drinksGrapefruitDaily, etc.)' }
    },
    required: ['medList']
  },
  returns: { type: 'array', description: 'Array of diet interaction badges' },
  uiSideEffects: {
    canvasRerenders: ['pillmap']
  },
  execute: async (params: { medList: string[]; patientDiet?: any }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const dietProfile = params.patientDiet || {
      drinksGrapefruitDaily: true,
      frequentHighVitKGreens: true,
      dairyBreakfast: true,
      usesPotassiumSaltSubstitute: true
    };

    // Stored-evaluation fast path: if the requested medList matches the
    // patient's active regimen, serve persisted badges instead of recomputing.
    try {
      const activeMeds = context.vault.getMedications(context.patientId, 'active');
      const activeNames = new Set<string>(activeMeds.map((m: unknown) => String((m as { brandName?: string; genericName?: string }).brandName || (m as { genericName?: string }).genericName || '').toLowerCase()));
      const reqNames = new Set<string>((params.medList || []).map((n) => String(n).toLowerCase()));
      const matchesStored = activeNames.size > 0 && activeNames.size === reqNames.size && [...reqNames].every((n) => activeNames.has(n) || [...activeNames].some((a: string) => a.includes(n) || n.includes(a)));
      if (matchesStored) {
        const repo = repoFor(context.vault);
        const result = await repo.evaluateInteractions(context.patientId, activeMeds as never, dietProfile);
        const badges = result.dietBadges;
        return {
          success: true,
          tool: 'check_diet_interactions',
          timestamp: new Date().toISOString(),
          data: badges,
          plainLanguageSummary:
            badges.length === 0
              ? 'No dietary conflicts found with current medications.'
              : `Identified ${badges.length} dietary interaction(s): ${badges.map((b: unknown) => `${(b as { drugName: string }).drugName}: ${(b as { badgeText: string }).badgeText}`).join('; ')}.`,
          humanApprovalRequired: false
        };
      }
    } catch {
      // fall through to ad-hoc compute
    }

    let badges;
    try {
      badges = await ClinicalInteractionEngine.checkDietInteractions(params.medList, dietProfile);
    } catch (err) {
      return aiErrorResult('check_diet_interactions', err, 'evaluate diet interactions');
    }

    return {
      success: true,
      tool: 'check_diet_interactions',
      timestamp: new Date().toISOString(),
      data: badges,
      plainLanguageSummary:
        badges.length === 0
          ? 'No dietary conflicts found with current medications.'
          : `Identified ${badges.length} dietary interaction(s): ${badges.map((b: any) => `${b.drugName}: ${b.badgeText}`).join('; ')}.`,
      humanApprovalRequired: false
    };
  }
};

export const checkDuplicateIngredientTool: WebMCPToolDefinition = {
  name: 'check_duplicate_ingredient',
  description: 'Detects hidden duplicate active ingredients across brand and generic combinations (e.g. Acetaminophen, Ibuprofen, Statins).',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medList: { type: 'array', items: { type: 'object' }, description: 'Array of { name, dose } objects' }
    },
    required: ['medList']
  },
  returns: { type: 'array', description: 'Array of duplicate ingredient alert payloads' },
  uiSideEffects: {
    canvasRerenders: ['pillmap']
  },
  execute: async (params: { medList: { name: string; dose?: string }[] }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    // Stored-evaluation fast path for the patient's own regimen.
    try {
      const activeMeds = context.vault.getMedications(context.patientId, 'active');
      const activeNames = new Set<string>(activeMeds.map((m: unknown) => String((m as { brandName?: string; genericName?: string }).brandName || (m as { genericName?: string }).genericName || '').toLowerCase()));
      const reqNames = new Set<string>((params.medList || []).map((m) => String(m?.name || '').toLowerCase()));
      const matchesStored = activeNames.size > 0 && activeNames.size === reqNames.size && [...reqNames].every((n) => activeNames.has(n) || [...activeNames].some((a: string) => a.includes(n) || n.includes(a)));
      if (matchesStored) {
        const repo = repoFor(context.vault);
        const result = await repo.evaluateInteractions(context.patientId, activeMeds as never, DEFAULT_DIET_FLAGS);
        const alerts = result.duplicateAlerts;
        return {
          success: true,
          tool: 'check_duplicate_ingredient',
          timestamp: new Date().toISOString(),
          data: alerts,
          plainLanguageSummary:
            alerts.length === 0
              ? 'No duplicate active ingredients detected in regimen.'
              : `Found ${alerts.length} duplicate active ingredient warning(s).`,
          humanApprovalRequired: false
        };
      }
    } catch {
      // fall through to ad-hoc compute
    }
    let alerts;
    try {
      alerts = await ClinicalInteractionEngine.checkDuplicateIngredients(params.medList);
    } catch (err) {
      return aiErrorResult('check_duplicate_ingredient', err, 'detect duplicate ingredients');
    }

    return {
      success: true,
      tool: 'check_duplicate_ingredient',
      timestamp: new Date().toISOString(),
      data: alerts,
      plainLanguageSummary:
        alerts.length === 0
          ? 'No duplicate active ingredients detected in regimen.'
          : `Found ${alerts.length} duplicate active ingredient warning(s).`,
      humanApprovalRequired: false
    };
  }
};

export const suggestScheduleTool: WebMCPToolDefinition = {
  name: 'suggest_schedule',
  description: 'Computes chronotype-aware schedule timing shifts with ghost preview animations on PillMap canvas.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medList: { type: 'array', items: { type: 'object' }, description: 'Array of { id, name, currentSlot }' },
      chronotype: { type: 'string', enum: ['early_bird', 'night_owl', 'standard'], description: 'Patient chronotype' }
    },
    required: ['medList']
  },
  returns: { type: 'object', description: 'Schedule suggestion with proposed shifts and ghost previews' },
  uiSideEffects: {
    canvasRerenders: ['pillmap']
  },
  execute: async (params: { medList: any[]; chronotype?: 'early_bird' | 'night_owl' | 'standard' }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    let result;
    try {
      result = await ClinicalInteractionEngine.suggestSchedule(params.medList, params.chronotype || 'standard');
    } catch (err) {
      return aiErrorResult('suggest_schedule', err, 'compute schedule timing shifts');
    }

    return {
      success: true,
      tool: 'suggest_schedule',
      timestamp: new Date().toISOString(),
      data: result,
      plainLanguageSummary: result.plainExplanation,
      humanApprovalRequired: false
    };
  }
};

export const simulateAdherenceTool: WebMCPToolDefinition = {
  name: 'simulate_adherence',
  description: 'Simulates clinical risk deltas and recovery protocols when a patient misses a scheduled medication dose.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Name of the missed medication' },
      slot: { type: 'object', description: '{ day: string, slot: string }' }
    },
    required: ['medName']
  },
  returns: { type: 'object', description: 'Adherence simulation clinical risk delta' },
  uiSideEffects: {
    toastNotification: {
      type: 'warning',
      messageTemplate: 'Adherence simulation: Review missed dose recovery advice.'
    }
  },
  execute: async (params: { medName: string; slot?: { day: DayOfWeek; slot: TimeSlot } }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const slot = params.slot || { day: 'tuesday', slot: 'morning' };
    let simulation;
    try {
      simulation = await ClinicalInteractionEngine.simulateAdherence(params.medName, slot);
    } catch (err) {
      return aiErrorResult('simulate_adherence', err, 'simulate the missed-dose impact');
    }

    return {
      success: true,
      tool: 'simulate_adherence',
      timestamp: new Date().toISOString(),
      data: simulation,
      plainLanguageSummary: `${simulation.clinicalImpactSummary} Action: ${simulation.recoveryProtocol}`,
      humanApprovalRequired: false
    };
  }
};

export const exportForPharmacistTool: WebMCPToolDefinition = {
  name: 'export_for_pharmacist',
  description: 'Generates a 1-page visual medication map, brand/generic crosswalk, and drug-drug separation rules for pharmacist review.',
  moduleOwner: 'pillmap',
  category: 'declarative_export',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      patientId: { type: 'string', description: 'Patient ID' },
      format: { type: 'string', enum: ['pdf_map', 'json'], description: 'Export format' }
    },
    required: ['patientId']
  },
  returns: { type: 'object', description: 'Pharmacist export data package' },
  execute: async (params: { patientId: string; format?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const meds = context.vault.getMedications(params.patientId, 'active');

    if (meds.length === 0) {
      return {
        success: false,
        tool: 'export_for_pharmacist',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Cannot export empty schedule. No active medications in PillMap.',
        humanApprovalRequired: false,
        error: { code: 'CANVAS_EMPTY', message: 'No medications to export.' }
      };
    }

    const bundle = {
      patientName: context.activeProfile.onBehalfOf || context.activeProfile.name || 'Patient',
      generatedDate: new Date().toISOString(),
      activeMedicationsCount: meds.length,
      brandGenericCrosswalk: meds.map((m: any) => ({
        brand: m.brandName || m.genericName,
        generic: m.genericName,
        dosage: m.dosage,
        frequency: m.frequency,
        timingSlots: m.timingSlots
      })),
      format: params.format || 'pdf_map',
      pharmacistSignatureBlock: {
        requiresVerification: true,
        verificationStatus: 'ready_for_review'
      }
    };

    return {
      success: true,
      tool: 'export_for_pharmacist',
      timestamp: new Date().toISOString(),
      data: bundle,
      plainLanguageSummary: `Exported 1-page pharmacist summary containing ${meds.length} active medications and timing crosswalks.`,
      humanApprovalRequired: false
    };
  }
};

export const setReminderTool: WebMCPToolDefinition = {
  name: 'set_reminder',
  description: 'Registers time-slot batch notifications for scheduled daily medications.',
  moduleOwner: 'pillmap',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      slotTimes: { type: 'object', description: 'Mapping of slots to times (e.g. { morning: "08:00", bedtime: "22:00" })' },
      patientId: { type: 'string', description: 'Patient ID' }
    },
    required: ['slotTimes']
  },
  returns: { type: 'object', description: 'Configured reminder schedule' },
  uiSideEffects: {
    toastNotification: {
      type: 'info',
      messageTemplate: 'Medication reminders updated and saved locally.'
    }
  },
  execute: async (params: { slotTimes: Record<string, string>; patientId?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'set_reminder',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    const slots = params.slotTimes;
    for (const [slot, time] of Object.entries(slots)) {
      context.vault.addCalendarEvent(
        {
          id: `reminder_${slot}_${Date.now()}`,
          patientId: params.patientId || context.patientId,
          title: `${slot.toUpperCase()} Meds Reminder (${time})`,
          eventType: 'med_reminder',
          scheduledDate: new Date().toISOString(),
          reason: `Take scheduled ${slot} medications at ${time}`,
          notifyHoursBefore: [0],
          isCompleted: false,
          syncedToCalendar: true
        },
        { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
      );
    }

    return {
      success: true,
      tool: 'set_reminder',
      timestamp: new Date().toISOString(),
      data: { registeredSlots: Object.keys(slots), slotTimes: slots },
      plainLanguageSummary: `Reminders successfully registered for ${Object.keys(slots).join(', ')} slots.`,
      humanApprovalRequired: false
    };
  }
};
