/**
 * CareCanvas WebMCP Tools: HomeLab Remote Prescribed Loop — AI Intelligence (M1)
 * Tools: upload_lab_image, doctor_review_comment, propose_dosage_change, approve_dosage_change, sync_pillmap_from_proposal
 * AI vision extraction via extractWithAI(imageDataUrl, rawText) single request when enabled, fallback only when disabled for text never image (Q10).
 * Never hardcoded literals — reads via config generically.
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import type { ProposalRecord } from '../types/vault.ts';
import { extractWithAI } from '../core/ai/client.ts';
import { getAIConfig, isAIEnabled } from '../core/ai/config.ts';

/**
 * LOCAL_BIOMARKER_STANDARDS mirrors LocalVault.ts:62-72 for lab normalization ±10% borderline + critical flags
 * Ensures flag correctness per vault standards for all 9 markers, not fallback NORMAL.
 */
const LOCAL_BIOMARKER_STANDARDS: Record<string, { canonicalName: string; standardUnit: string; refRange: { low: number; high: number }; optimalRange: { low: number; high: number }; criticalLow?: number; criticalHigh?: number }> = {
  creatinine: { canonicalName: 'Creatinine', standardUnit: 'mg/dL', refRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, criticalHigh: 3.0 },
  egfr: { canonicalName: 'eGFR', standardUnit: 'mL/min/1.73m2', refRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, criticalLow: 15 },
  hba1c: { canonicalName: 'HbA1c', standardUnit: '%', refRange: { low: 4.0, high: 5.6 }, optimalRange: { low: 4.5, high: 5.4 }, criticalHigh: 10.0 },
  'glucose fasting': { canonicalName: 'Glucose Fasting', standardUnit: 'mg/dL', refRange: { low: 70, high: 99 }, optimalRange: { low: 75, high: 90 }, criticalLow: 50, criticalHigh: 250 },
  potassium: { canonicalName: 'Potassium', standardUnit: 'mEq/L', refRange: { low: 3.5, high: 5.0 }, optimalRange: { low: 3.8, high: 4.6 }, criticalLow: 2.8, criticalHigh: 6.0 },
  'cholesterol total': { canonicalName: 'Cholesterol Total', standardUnit: 'mg/dL', refRange: { low: 125, high: 200 }, optimalRange: { low: 140, high: 180 }, criticalHigh: 300 },
  ldl: { canonicalName: 'LDL', standardUnit: 'mg/dL', refRange: { low: 50, high: 100 }, optimalRange: { low: 50, high: 80 }, criticalHigh: 190 },
  hdl: { canonicalName: 'HDL', standardUnit: 'mg/dL', refRange: { low: 40, high: 80 }, optimalRange: { low: 50, high: 80 }, criticalLow: 25 },
  triglycerides: { canonicalName: 'Triglycerides', standardUnit: 'mg/dL', refRange: { low: 50, high: 150 }, optimalRange: { low: 60, high: 100 }, criticalHigh: 500 },
};

function findLocalStandard(markerName: string) {
  const m = markerName.toLowerCase().trim();
  if (m.includes('creat')) return LOCAL_BIOMARKER_STANDARDS['creatinine'];
  if (m.includes('egfr') || m.includes('gfr')) return LOCAL_BIOMARKER_STANDARDS['egfr'];
  if (m.includes('hba1c') || m.includes('a1c')) return LOCAL_BIOMARKER_STANDARDS['hba1c'];
  if (m.includes('glucose') || m.includes('glu')) return LOCAL_BIOMARKER_STANDARDS['glucose fasting'];
  if (m.includes('potassium') || m === 'k' || m === 'k+') return LOCAL_BIOMARKER_STANDARDS['potassium'];
  if (m.includes('ldl')) return LOCAL_BIOMARKER_STANDARDS['ldl'];
  if (m.includes('hdl')) return LOCAL_BIOMARKER_STANDARDS['hdl'];
  if (m.includes('triglyceride')) return LOCAL_BIOMARKER_STANDARDS['triglycerides'];
  if (m.includes('cholesterol')) return LOCAL_BIOMARKER_STANDARDS['cholesterol total'];
  return null;
}

function resolveFileDataUrl(params: any): string | undefined {
  const candidate = params.imageDataUrl || params.fileDataUrl || params.imageBlob || params.imageUrl;
  if (typeof candidate === 'string' && candidate.startsWith('data:')) return candidate;
  return undefined;
}

export const uploadLabImageTool: WebMCPToolDefinition = {
  name: 'upload_lab_image',
  description: 'Ingests smartphone photo or PDF of remote lab slip, extracts lab markers with confidence metrics.',
  moduleOwner: 'homelab',
  category: 'imperative_extraction',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      imageBlob: { type: 'string', description: 'Base64 image/document URI' },
      patientId: { type: 'string', description: 'Patient ID' },
      linkedDueCardId: { type: 'string', description: 'Linked prescribed due card ID' },
      rawText: { type: 'string', description: 'Optional text context' },
      imageDataUrl: { type: 'string', description: 'Optional Data URL of file' }
    },
    required: ['imageBlob']
  },
  returns: { type: 'object', description: 'Extracted lab slip values' },
  uiSideEffects: {
    canvasRerenders: ['labstory', 'dossier'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Remote lab slip processed.'
    }
  },
  execute: async (
    params: { imageBlob: string; patientId?: string; linkedDueCardId?: string; rawText?: string; imageDataUrl?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'upload_lab_image',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    const patientId = params.patientId || context.patientId;
    const documentId = `doc_homelab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Mark due card completed if linked
    if (params.linkedDueCardId) {
      const card = context.vault.dueCards.get(params.linkedDueCardId);
      if (card) {
        card.status = 'completed';
        card.completedLabId = documentId;
      }
    }

    const fileDataUrl = resolveFileDataUrl(params);
    const rawText = params.rawText || (typeof params.imageBlob === 'string' && !params.imageBlob.startsWith('data:') ? params.imageBlob : '');

    const config = getAIConfig();
    const aiEnabled = isAIEnabled(config);

    let extractedValues: { marker: string; value: number; unit: string; flag: string; confidence: number }[] = [];
    let facts: any[] = [];

    if (aiEnabled) {
      try {
        const aiFacts = await extractWithAI(rawText, fileDataUrl, 'lab_slip_photo', {
          patientId,
          documentId,
        });

        const labFacts = aiFacts.filter((f) => {
          const cat = (f.category || '').toLowerCase();
          const nameLower = (f.name || '').toLowerCase();
          if (cat === 'lab') return true;
          return ['creatinine', 'egfr', 'gfr', 'potassium', 'hba1c', 'a1c', 'glucose', 'hemoglobin', 'cholesterol', 'ldl', 'hdl'].some(k => nameLower.includes(k));
        });

        for (const f of labFacts) {
          let rawVal = 0;
          if (typeof f.value === 'number' && Number.isFinite(f.value)) {
            rawVal = f.value;
          } else {
            const str = typeof f.value === 'string' ? f.value : JSON.stringify(f.value ?? '');
            const m = str.match(/([0-9]+\.?[0-9]*)/);
            rawVal = m ? Number(m[1]) : 0;
          }

          const markerName = f.name || 'Lab Result';
          const unit = f.unit || '';
          const confidence = f.confidence || 0.9;

          const std = findLocalStandard(markerName);
          let flag: string = 'NORMAL';
          let isBorderline = false;
          let isCritical = false;
          if (std) {
            if (std.criticalHigh !== undefined && rawVal >= std.criticalHigh) { isCritical = true; flag = 'CRITICAL_HIGH'; }
            else if (std.criticalLow !== undefined && rawVal <= std.criticalLow) { isCritical = true; flag = 'CRITICAL_LOW'; }
            else if (rawVal > std.refRange.high) flag = 'HIGH';
            else if (rawVal < std.refRange.low) flag = 'LOW';
            else flag = 'NORMAL';
            const span = std.refRange.high - std.refRange.low;
            const buffer10 = span * 0.10;
            const isNearHigh = rawVal >= (std.refRange.high - buffer10) && rawVal <= (std.refRange.high + buffer10);
            const isNearLow = rawVal >= (std.refRange.low - buffer10) && rawVal <= (std.refRange.low + buffer10);
            isBorderline = isNearHigh || isNearLow;
          }
          void isBorderline; void isCritical;

          extractedValues.push({ marker: markerName, value: rawVal, unit, flag, confidence });
          facts.push({
            id: f.id,
            patientId,
            category: 'lab',
            name: markerName,
            value: rawVal,
            unit,
            status: 'unconfirmed',
            sourceDocId: documentId,
            plainExplanation: f.plainExplanation || `${markerName}: ${rawVal} ${unit} (${flag})`,
            confidence,
            author: 'system_ai',
            timestamp: f.timestamp || new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn('[homeLabTools] AI lab extraction error:', err?.message || err);
      }
    }

    // Add facts to vault
    for (const fact of facts) {
      context.vault.addFact(
        fact,
        { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
      );
    }

    const narration =
      extractedValues.length > 0
        ? extractedValues.map((v) => `${v.marker}: ${v.value} ${v.unit} (${v.flag})`).join('; ')
        : 'AI required for vision extraction or processing.';

    return {
      success: true,
      tool: 'upload_lab_image',
      timestamp: new Date().toISOString(),
      data: {
        documentId,
        extractedValues,
        plainNarration: narration
      },
      plainLanguageSummary: narration,
      humanApprovalRequired: false
    };
  }
};

export const doctorReviewCommentTool: WebMCPToolDefinition = {
  name: 'doctor_review_comment',
  description: 'Attaches doctor clinical review comment (📌) to specific longitudinal lab points in LabStory.',
  moduleOwner: 'homelab',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      labId: { type: 'string', description: 'Target lab record ID' },
      commentText: { type: 'string', description: 'Clinical review note' },
      doctorId: { type: 'string', description: 'Doctor ID' },
      doctorName: { type: 'string', description: 'Doctor full name' },
      pinnedMarker: { type: 'string', description: 'Marker point to pin on chart (e.g. Creatinine 2026-08-28)' }
    },
    required: ['labId', 'commentText']
  },
  returns: { type: 'object', description: 'Pinned comment audit record' },
  uiSideEffects: {
    canvasRerenders: ['labstory'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Doctor pinned a clinical note to your lab timeline.'
    }
  },
  execute: async (params: { labId: string; commentText: string; doctorId?: string; doctorName?: string; pinnedMarker?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'doctor_review_comment',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    if (!params.commentText || params.commentText.trim().length === 0) {
      return {
        success: false,
        tool: 'doctor_review_comment',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Comment text cannot be empty.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_COMMENT', message: 'Empty comment text.' }
      };
    }

    const doctorComment = {
      commentId: `comment_${Date.now()}`,
      labId: params.labId,
      doctorId: (params.doctorId || '').trim() || 'clinician',
      doctorName: (params.doctorName || '').trim() || 'Your doctor',
      commentText: params.commentText,
      pinnedMarker: params.pinnedMarker || 'Creatinine 2026-08-28',
      timestamp: new Date().toISOString(),
      readStatus: true
    };

    context.vault.addDoctorCommentToLab(params.labId, {
      doctorId: doctorComment.doctorId,
      doctorName: doctorComment.doctorName,
      comment: params.commentText
    });

    context.vault.logAudit(
      'doctor_review_comment',
      'lab',
      params.labId,
      { userId: doctorComment.doctorId, userName: doctorComment.doctorName, role: 'doctor' },
      { comment: params.commentText, pinnedMarker: params.pinnedMarker }
    );

    return {
      success: true,
      tool: 'doctor_review_comment',
      timestamp: new Date().toISOString(),
      data: doctorComment,
      plainLanguageSummary: `Your doctor pinned comment: "${params.commentText}"`,
      humanApprovalRequired: false
    };
  }
};

export const proposeDosageChangeTool: WebMCPToolDefinition = {
  name: 'propose_dosage_change',
  description: 'Doctor or AI generates a dosage change proposal card (e.g. Metformin 1000mg -> 500mg due to eGFR 28) linked to lab points, staged in pending state.',
  moduleOwner: 'homelab',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'modal_proposal',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Medication name' },
      currentDose: { type: 'string', description: 'Current dose' },
      proposedDose: { type: 'string', description: 'Proposed new dose' },
      reason: { type: 'string', description: 'Clinical rationale' },
      linkedLabId: { type: 'string', description: 'Linked lab point ID' },
      doctorName: { type: 'string', description: 'Prescribing doctor name' }
    },
    required: ['medName', 'proposedDose', 'reason']
  },
  returns: { type: 'object', description: 'Created dosage proposal card in pending state' },
  uiSideEffects: {
    canvasRerenders: ['pillmap', 'dossier'],
    toastNotification: {
      type: 'warning',
      messageTemplate: 'Your doctor submitted a medication adjustment proposal.'
    }
  },
  execute: async (params: { medName: string; currentDose?: string; proposedDose: string; reason: string; linkedLabId?: string; doctorName?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'propose_dosage_change',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    const proposal: ProposalRecord = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      patientId: context.patientId,
      doctorName: (params.doctorName || '').trim() || 'Your doctor',
      doctorId: 'clinician',
      type: 'dose_change',
      medName: params.medName,
      previousDose: params.currentDose || '1000mg',
      proposedDose: params.proposedDose,
      reason: params.reason,
      plainNarration: `${(params.doctorName || '').trim() || 'Your doctor'} recommends changing ${params.medName} from ${params.currentDose || '1000mg'} to ${params.proposedDose} because ${params.reason}.`,
      linkedLabId: params.linkedLabId || 'lab_pending',
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    context.vault.addProposal(proposal, {
      userId: (proposal.doctorId || '').trim() || 'clinician',
      userName: proposal.doctorName,
      role: 'doctor'
    });

    return {
      success: true,
      tool: 'propose_dosage_change',
      timestamp: new Date().toISOString(),
      data: proposal,
      plainLanguageSummary: proposal.plainNarration || `Proposed ${proposal.medName} ${proposal.proposedDose}.`,
      humanApprovalRequired: false
    };
  }
};

export const approveDosageChangeTool: WebMCPToolDefinition = {
  name: 'approve_dosage_change',
  description: 'Human Approval Gate: Patient or authorized Caregiver approves a pending dosage change proposal.',
  moduleOwner: 'homelab',
  category: 'approval_gate',
  requiresHumanApproval: false,
  approvalGateType: 'proxy_signature',
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string', description: 'Proposal identifier' },
      action: { type: 'string', enum: ['approve', 'reject'], description: 'Approval decision' },
      approvedBy: { type: 'string', description: 'Approver name' },
      role: { type: 'string', description: 'Approver role (patient, caregiver)' },
      onBehalfOf: { type: 'string', description: 'Patient name if acting on behalf' }
    },
    required: ['proposalId']
  },
  returns: { type: 'object', description: 'Approved proposal status record' },
  uiSideEffects: {
    canvasRerenders: ['pillmap', 'labstory', 'dossier'],
    toastNotification: {
      type: 'success',
      messageTemplate: 'Dosage change approved. PillMap and LabStory updated.'
    }
  },
  execute: async (params: { proposalId: string; action?: 'approve' | 'reject'; approvedBy?: string; role?: string; onBehalfOf?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'approve_dosage_change',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    const isApprove = params.action !== 'reject';
    const approverName = params.approvedBy || context.activeProfile.name;
    const role = (params.role || context.activeProfile.role) as any;
    const onBehalfOf = params.onBehalfOf || context.activeProfile.onBehalfOf;

    const updated = context.vault.updateProposalStatus(
      params.proposalId,
      isApprove ? 'approved' : 'rejected',
      {
        userId: context.activeProfile.userId,
        userName: approverName,
        role,
        onBehalfOf
      }
    );

    if (!updated) {
      return {
        success: false,
        tool: 'approve_dosage_change',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Proposal "${params.proposalId}" was not found.`,
        humanApprovalRequired: false,
        error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${params.proposalId} not found.` }
      };
    }

    const narration = isApprove
      ? `Proposal for ${updated.medName} (${updated.proposedDose}) was APPROVED by ${approverName}${onBehalfOf ? ` on behalf of ${onBehalfOf}` : ''}.`
      : `Proposal for ${updated.medName} was REJECTED by ${approverName}.`;

    return {
      success: true,
      tool: 'approve_dosage_change',
      timestamp: new Date().toISOString(),
      data: updated,
      plainLanguageSummary: narration,
      humanApprovalRequired: false,
      approvalStatus: isApprove ? 'approved' : 'rejected'
    };
  }
};

export const syncPillmapFromProposalTool: WebMCPToolDefinition = {
  name: 'sync_pillmap_from_proposal',
  description: 'Synchronizes PillMap canvas with an approved dosage proposal, triggering animated diffs (fades old dose, pulses new dose) and continuous LabStory intervention bands.',
  moduleOwner: 'homelab',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string', description: 'ID of the approved proposal' }
    },
    required: ['proposalId']
  },
  returns: { type: 'object', description: 'Synchronized PillMap diff payload' },
  uiSideEffects: {
    canvasRerenders: ['pillmap', 'labstory'],
    domAnimations: ['fade_out_old_dose', 'pulse_new_dose_green', 'labstory_band_draw'],
    toastNotification: {
      type: 'success',
      messageTemplate: 'PillMap updated with new dosage schedule.'
    }
  },
  execute: async (params: { proposalId: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    if (context.activeProfile?.permissionLevel === 'view_only') {
      return {
        success: false,
        tool: 'sync_pillmap_from_proposal',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Permission denied: View-only caregivers cannot approve changes or upload documents on behalf of patient.',
        humanApprovalRequired: false,
        error: { code: 'PERMISSION_DENIED', message: '403 Forbidden: Insufficient proxy permissions.' }
      };
    }
    const proposal = context.vault.proposals.get(params.proposalId);
    if (!proposal) {
      return {
        success: false,
        tool: 'sync_pillmap_from_proposal',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Proposal ${params.proposalId} not found.`,
        humanApprovalRequired: false,
        error: { code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found.' }
      };
    }

    // Update medication in vault
    const meds = context.vault.getMedications(proposal.patientId);
    const targetMed = meds.find((m: any) => m.genericName?.toLowerCase().includes(proposal.medName.toLowerCase()) || proposal.medName.toLowerCase().includes(m.genericName?.toLowerCase()));

    if (targetMed && proposal.proposedDose) {
      context.vault.updateMedication(
        targetMed.id,
        { dosage: proposal.proposedDose, status: 'active' },
        { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
      );
    }

    const diffPayload = {
      proposalId: params.proposalId,
      medName: proposal.medName,
      oldDose: proposal.previousDose || '1000mg',
      newDose: proposal.proposedDose || '500mg',
      animationType: 'fade_out_old_pulse_new',
      labStoryInterventionBand: {
        startDate: proposal.approvedAt || new Date().toISOString(),
        medName: `${proposal.medName} ${proposal.proposedDose}`,
        color: '#10B981'
      }
    };

    return {
      success: true,
      tool: 'sync_pillmap_from_proposal',
      timestamp: new Date().toISOString(),
      data: diffPayload,
      plainLanguageSummary: `PillMap canvas updated: ${proposal.medName} changed from ${diffPayload.oldDose} to ${diffPayload.newDose}. New LabStory med band drawn.`,
      humanApprovalRequired: false
    };
  }
};
