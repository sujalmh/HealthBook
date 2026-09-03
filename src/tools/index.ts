
import { WebMCPEngine, webMCPEngine } from '../core/webmcp/WebMCPEngine.ts';
import type { WebMCPToolDefinition } from '../types/webmcp.ts';

import { extractFactTool, confirmFactTool, compileHealthRecordTool } from './vaultTools.ts';

import { extractLabsTool, correlateMedsTool } from './labStoryTools.ts';

import {
  addMedicationTool,
  checkInteractionsTool,
  checkDietInteractionsTool,
  checkDuplicateIngredientTool,
  suggestScheduleTool,
  simulateAdherenceTool,
  exportForPharmacistTool,
  setReminderTool
} from './pillMapTools.ts';

import {
  explainMedChangeTool,
  flagInteractionTool,
  flagDietInteractionTool,
  suggestQuestionForDoctorTool,
  exportPatientSummaryTool
} from './rxBridgeTools.ts';

import {
  uploadLabImageTool,
  doctorReviewCommentTool,
  proposeDosageChangeTool,
  approveDosageChangeTool,
  syncPillmapFromProposalTool
} from './homeLabTools.ts';

import {
  reportDangerSignTool,
  notifyDoctorTool,
  doctorAddMedicationTool,
  doctorRemoveMedicationTool,
  doctorChangeDoseTool,
  approvePillmapChangeTool,
  scheduleFollowupTool,
  scheduleLabTool,
  syncToCalendarTool
} from './safetyTools.ts';

import {
  linkPatientTool,
  grantCaregiverAccessTool,
  revokeCaregiverAccessTool,
  switchProfileTool,
  actOnBehalfTool,
  grantDoctorAccessTool,
  revokeAccessTool,
  viewTimelineTool
} from './careCircleTools.ts';

import { createAccountTool, signInTool } from './authTools.ts';

import {
  linkDoctorTool,
  revokeDoctorLinkTool,
  listDoctorPatientsTool,
  listPatientDoctorsTool,
  viewPatientAsDoctorTool
} from './doctorTools.ts';

export const allWebMCPTools: WebMCPToolDefinition[] = [

  extractFactTool,
  confirmFactTool,
  compileHealthRecordTool,

  extractLabsTool,
  correlateMedsTool,

  addMedicationTool,
  checkInteractionsTool,
  checkDietInteractionsTool,
  checkDuplicateIngredientTool,
  suggestScheduleTool,
  simulateAdherenceTool,
  exportForPharmacistTool,
  setReminderTool,

  explainMedChangeTool,
  flagInteractionTool,
  flagDietInteractionTool,
  suggestQuestionForDoctorTool,
  exportPatientSummaryTool,

  uploadLabImageTool,
  doctorReviewCommentTool,
  proposeDosageChangeTool,
  approveDosageChangeTool,
  syncPillmapFromProposalTool,

  reportDangerSignTool,
  notifyDoctorTool,
  doctorAddMedicationTool,
  doctorRemoveMedicationTool,
  doctorChangeDoseTool,
  approvePillmapChangeTool,
  scheduleFollowupTool,
  scheduleLabTool,
  syncToCalendarTool,

  linkPatientTool,
  grantCaregiverAccessTool,
  revokeCaregiverAccessTool,
  switchProfileTool,
  actOnBehalfTool,
  grantDoctorAccessTool,
  revokeAccessTool,
  viewTimelineTool,

  createAccountTool,
  signInTool,

  linkDoctorTool,
  revokeDoctorLinkTool,
  listDoctorPatientsTool,
  listPatientDoctorsTool,
  viewPatientAsDoctorTool
];

export const allTools = allWebMCPTools;

for (const tool of allWebMCPTools) {
  const anyTool = tool as any;
  if (anyTool.inputSchema === undefined) {
    Object.defineProperty(anyTool, 'inputSchema', {
      get() {
        return this.parameters;
      },
      set(v: any) {
        this.parameters = v;
      },
      enumerable: true,
      configurable: true,
    });
  }

}

export function registerAllWebMCPTools(engine: WebMCPEngine = webMCPEngine): void {
  if (!engine) {
    throw new Error(
      '[WebMCP] registerAllWebMCPTools requires a WebMCPEngine instance. No engine provided and singleton webMCPEngine unavailable.'
    );
  }
  for (const tool of allWebMCPTools) {
    engine.register(tool);
  }
}

export async function registerAllWebMCPToolsAsync(
  engine: WebMCPEngine = webMCPEngine
): Promise<PromiseSettledResult<void>[]> {
  if (!engine) {
    throw new Error(
      '[WebMCP] registerAllWebMCPToolsAsync requires a WebMCPEngine instance. No engine provided and singleton webMCPEngine unavailable.'
    );
  }
  const promises = allWebMCPTools.map((tool) => {
    try {
      const result = engine.register(tool);
      return Promise.resolve(result);
    } catch (e) {
      return Promise.reject(e);
    }
  });
  return Promise.allSettled(promises);
}

export * from './vaultTools.ts';
export * from './labStoryTools.ts';
export * from './pillMapTools.ts';
export * from './rxBridgeTools.ts';
export * from './homeLabTools.ts';
export * from './safetyTools.ts';
export * from './careCircleTools.ts';
export * from './authTools.ts';

