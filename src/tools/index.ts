/**
 * CareCanvas WebMCP Tools Catalog & Registration
 */

import { WebMCPEngine, webMCPEngine } from '../core/webmcp/WebMCPEngine.ts';
import type { WebMCPToolDefinition } from '../types/webmcp.ts';

// Vault
import { extractFactTool, confirmFactTool, compileHealthRecordTool } from './vaultTools.ts';

// LabStory
import { extractLabsTool, correlateMedsTool } from './labStoryTools.ts';

// PillMap
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

// RxBridge
import {
  explainMedChangeTool,
  flagInteractionTool,
  flagDietInteractionTool,
  suggestQuestionForDoctorTool,
  exportPatientSummaryTool
} from './rxBridgeTools.ts';

// HomeLab
import {
  uploadLabImageTool,
  doctorReviewCommentTool,
  proposeDosageChangeTool,
  approveDosageChangeTool,
  syncPillmapFromProposalTool
} from './homeLabTools.ts';

// Safety
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

// Care Circle & Dossier
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

export const allWebMCPTools: WebMCPToolDefinition[] = [
  // Vault (3)
  extractFactTool,
  confirmFactTool,
  compileHealthRecordTool,

  // LabStory (2)
  extractLabsTool,
  correlateMedsTool,

  // PillMap (8)
  addMedicationTool,
  checkInteractionsTool,
  checkDietInteractionsTool,
  checkDuplicateIngredientTool,
  suggestScheduleTool,
  simulateAdherenceTool,
  exportForPharmacistTool,
  setReminderTool,

  // RxBridge (5)
  explainMedChangeTool,
  flagInteractionTool,
  flagDietInteractionTool,
  suggestQuestionForDoctorTool,
  exportPatientSummaryTool,

  // HomeLab (5)
  uploadLabImageTool,
  doctorReviewCommentTool,
  proposeDosageChangeTool,
  approveDosageChangeTool,
  syncPillmapFromProposalTool,

  // Safety (9)
  reportDangerSignTool,
  notifyDoctorTool,
  doctorAddMedicationTool,
  doctorRemoveMedicationTool,
  doctorChangeDoseTool,
  approvePillmapChangeTool,
  scheduleFollowupTool,
  scheduleLabTool,
  syncToCalendarTool,

  // Care Circle & Dossier (8)
  linkPatientTool,
  grantCaregiverAccessTool,
  revokeCaregiverAccessTool,
  switchProfileTool,
  actOnBehalfTool,
  grantDoctorAccessTool,
  revokeAccessTool,
  viewTimelineTool
];

export const allTools = allWebMCPTools;

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

export * from './vaultTools.ts';
export * from './labStoryTools.ts';
export * from './pillMapTools.ts';
export * from './rxBridgeTools.ts';
export * from './homeLabTools.ts';
export * from './safetyTools.ts';
export * from './careCircleTools.ts';
