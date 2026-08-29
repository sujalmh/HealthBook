/**
 * CareCanvas WebMCP Tools: PillMap Polypharmacy Negotiator (M3)
 * Tools: add_medication, check_interactions, check_diet_interactions, check_duplicate_ingredient, suggest_schedule, simulate_adherence, export_for_pharmacist, set_reminder
 */

import type {  WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult  } from '../types/webmcp.ts';
import { ClinicalInteractionEngine } from '../core/knowledge/interactionEngine.ts';
import type {  TimeSlot, DayOfWeek  } from '../types/pillmap.ts';

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
    const slotNormalized = params.slot.toLowerCase() as TimeSlot;
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

    const medRecord = context.vault.addMedication(
      {
        id: `med_${params.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
        patientId: context.patientId,
        genericName: ClinicalInteractionEngine.resolveGenericName(params.name),
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
    const list = params.medList || context.vault.getMedications(context.patientId).map((m: any) => m.genericName);
    const arcs = ClinicalInteractionEngine.checkDrugInteractions(list);

    const summary =
      arcs.length === 0
        ? 'No drug-drug interaction conflicts detected across active medications.'
        : `Detected ${arcs.length} drug-drug conflict(s): ${arcs.map(a => `${a.drugA} + ${a.drugB} (${a.severity})`).join(', ')}.`;

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

    const badges = ClinicalInteractionEngine.checkDietInteractions(params.medList, dietProfile);

    return {
      success: true,
      tool: 'check_diet_interactions',
      timestamp: new Date().toISOString(),
      data: badges,
      plainLanguageSummary:
        badges.length === 0
          ? 'No dietary conflicts found with current medications.'
          : `Identified ${badges.length} dietary interaction(s): ${badges.map(b => `${b.drugName}: ${b.badgeText}`).join('; ')}.`,
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
    const alerts = ClinicalInteractionEngine.checkDuplicateIngredients(params.medList);

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
    const result = ClinicalInteractionEngine.suggestSchedule(params.medList, params.chronotype || 'standard');

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
    const simulation = ClinicalInteractionEngine.simulateAdherence(params.medName, slot);

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
      patientName: context.activeProfile.onBehalfOf ? 'Smt. Shanti Devi' : context.activeProfile.name,
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
