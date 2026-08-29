/**
 * CareCanvas WebMCP Tools: HomeLab Remote Prescribed Loop (M5)
 * Tools: upload_lab_image, doctor_review_comment, propose_dosage_change, approve_dosage_change, sync_pillmap_from_proposal
 */

import type {  WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult  } from '../types/webmcp.ts';
import { mockHomeLabPhotoSlip } from '../fixtures/documents.ts';
import type {  ProposalRecord  } from '../types/vault.ts';

export const uploadLabImageTool: WebMCPToolDefinition = {
  name: 'upload_lab_image',
  description: 'Ingests smartphone photo of remote lab slip, performs optical deskew, extracts lab markers with confidence metrics and bounding boxes.',
  moduleOwner: 'homelab',
  category: 'imperative_extraction',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      imageBlob: { type: 'string', description: 'Base64 image URI or mock identifier' },
      patientId: { type: 'string', description: 'Patient ID' },
      linkedDueCardId: { type: 'string', description: 'Linked prescribed due card ID' }
    },
    required: ['imageBlob']
  },
  returns: { type: 'object', description: 'Extracted lab slip values with bounding boxes' },
  uiSideEffects: {
    canvasRerenders: ['labstory', 'dossier'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Remote lab slip processed. Serum Creatinine: 1.90 mg/dL (High).'
    }
  },
  execute: async (params: { imageBlob: string; patientId?: string; linkedDueCardId?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const fixture = mockHomeLabPhotoSlip;

    // Check due card completion if provided
    if (params.linkedDueCardId) {
      const card = context.vault.dueCards.get(params.linkedDueCardId);
      if (card) {
        card.status = 'completed';
        card.completedLabId = 'doc_homelab_slip_002';
      }
    }

    // Add facts to vault
    for (const fact of fixture.facts) {
      context.vault.addFact(
        { ...fact, patientId: params.patientId || context.patientId, status: 'unconfirmed' },
        { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
      );
    }

    const narration = 'Serum Creatinine: 1.90 mg/dL (High — increased from 1.80 mg/dL at discharge); eGFR: 28 mL/min/1.73m2 (Stage 4 Kidney Strain — decreased from 32).';

    return {
      success: true,
      tool: 'upload_lab_image',
      timestamp: new Date().toISOString(),
      data: {
        documentId: fixture.document.id,
        extractedValues: [
          { marker: 'Creatinine', value: 1.90, unit: 'mg/dL', flag: 'HIGH', confidence: 0.96 },
          { marker: 'eGFR', value: 28, unit: 'mL/min/1.73m2', flag: 'CRITICAL_LOW', confidence: 0.94 },
          { marker: 'Potassium', value: 4.8, unit: 'mEq/L', flag: 'NORMAL', confidence: 0.98 }
        ],
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
      doctorId: params.doctorId || 'dr_patel_md',
      doctorName: params.doctorName || 'Dr. A. Patel, MD',
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
      plainLanguageSummary: `Dr. Patel pinned comment: "${params.commentText}"`,
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
      messageTemplate: 'Dr. Patel submitted a medication adjustment proposal.'
    }
  },
  execute: async (params: { medName: string; currentDose?: string; proposedDose: string; reason: string; linkedLabId?: string; doctorName?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const proposal: ProposalRecord = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      patientId: context.patientId,
      doctorName: params.doctorName || 'Dr. A. Patel, MD',
      doctorId: 'dr_patel_md',
      type: 'dose_change',
      medName: params.medName,
      previousDose: params.currentDose || '1000mg',
      proposedDose: params.proposedDose,
      reason: params.reason,
      plainNarration: `Dr. Patel recommends changing ${params.medName} from ${params.currentDose || '1000mg'} to ${params.proposedDose} because ${params.reason}.`,
      linkedLabId: params.linkedLabId || 'fact_homelab_egfr_28',
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    context.vault.addProposal(proposal, {
      userId: proposal.doctorId || 'dr_patel_md',
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
    const targetMed = meds.find((m: any) => m.genericName.toLowerCase().includes(proposal.medName.toLowerCase()) || proposal.medName.toLowerCase().includes(m.genericName.toLowerCase()));

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
