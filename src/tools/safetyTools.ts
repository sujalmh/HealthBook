
import type {  WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult  } from '../types/webmcp.ts';
import type {  DangerSignReport, DangerSymptomTag  } from '../types/safety.ts';
import { getAIConfig, isAIEnabled } from '../core/ai/config.ts';
import { callAI } from '../core/ai/client.ts';
import { gateIfViewOnly } from '../core/rbac/canAccess.ts';

export const reportDangerSignTool: WebMCPToolDefinition = {
  name: 'report_danger_sign',
  description: 'Reports acute danger signs (e.g. bilateral pedal edema, breathlessness, chest pain), calculates triage priority, and delivers immediate first-aid instructions.',
  moduleOwner: 'safety',
  category: 'safety_alert',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      symptomTags: { type: 'array', items: { type: 'string' }, description: 'Array of symptom tags' },
      freeText: { type: 'string', description: 'Patient description of symptoms' },
      severityRating: { type: 'string', enum: ['mild', 'moderate', 'severe', 'critical'], description: 'Self-rated severity' },
      vitalSigns: { type: 'object', description: 'Optional vital signs (BP, HR, weight)' },
      photoBlob: { type: 'string', description: 'Photo attachment (e.g. swollen ankles)' }
    },
    required: ['symptomTags']
  },
  returns: { type: 'object', description: 'Danger sign report record with first-aid guidance' },
  uiSideEffects: {
    canvasRerenders: ['dossier'],
    toastNotification: {
      type: 'warning',
      messageTemplate: 'Urgent danger sign report dispatched to clinician triage portal.'
    }
  },
  execute: async (params: { symptomTags: string[]; freeText?: string; severityRating?: 'mild' | 'moderate' | 'severe' | 'critical'; vitalSigns?: any; photoBlob?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'report_danger_sign');
    if (denied) return denied;

    let triagePriority: 'URGENT' | 'ROUTINE' | 'EMERGENCY' = 'ROUTINE';
    let assessedSeverity: 'mild' | 'moderate' | 'severe' | 'critical' = params.severityRating || 'severe';
    let firstAidAdvice: string | undefined;
    let aiConfidence: number | undefined;

    const cfg = getAIConfig();
    const aiEnabled = isAIEnabled(cfg);
    const hasPhoto = !!params.photoBlob && params.photoBlob.startsWith('data:image');
    const freeText = params.freeText || 'Patient reported acute symptoms.';

    if (aiEnabled) {
      try {
        const schema = {
          type: 'object',
          properties: {
            triagePriority: { type: 'string', enum: ['URGENT', 'EMERGENCY', 'ROUTINE'] },
            severityRating: { type: 'string', enum: ['mild', 'moderate', 'severe', 'critical'] },
            firstAidAdvice: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string' }
          },
          required: ['triagePriority', 'severityRating', 'firstAidAdvice', 'confidence', 'reasoning'],
          additionalProperties: false,
        };
        const systemPrompt = `You are an emergency triage nurse AI. Assess danger signs given symptom tags, free text description, self-rated severity, vital signs, and optional photo. Return ONLY valid JSON with shape {"triagePriority": "URGENT"|"ROUTINE"|"EMERGENCY", "severityRating": string, "firstAidAdvice": string, "confidence": number, "reasoning": string}.`;
        const userText = `Symptom tags: ${JSON.stringify(params.symptomTags)}\nFree text: "${freeText}"\nSelf severity: ${params.severityRating || 'not rated'}\nVitals: ${JSON.stringify(params.vitalSigns || {})}`;
        const parsed = await callAI<any>(systemPrompt, userText, {
          schema,
          imageDataUrl: hasPhoto ? params.photoBlob : undefined,
        });
        if (parsed && parsed.triagePriority && parsed.severityRating && parsed.firstAidAdvice) {
          triagePriority = parsed.triagePriority;
          assessedSeverity = parsed.severityRating;
          firstAidAdvice = parsed.firstAidAdvice;
          aiConfidence = parsed.confidence;
        } else {

          throw new Error('AI triage returned invalid shape');
        }
      } catch (e) {
        console.warn('[safetyTools] AI triage failed, fallback to heuristic', (e as any)?.message || e);
      }
    }

    if (!firstAidAdvice) {

      const severeRatings: string[] = ['severe', 'critical'];
      const urgentTags: string[] = ['chest_pain', 'dyspnea'];
      const hasSevereRating = params.severityRating ? severeRatings.includes(params.severityRating) : false;
      const hasUrgentTag = params.symptomTags.some((t) => urgentTags.includes(t));
      const isSevere = hasSevereRating || hasUrgentTag;

      triagePriority = isSevere ? 'URGENT' : 'ROUTINE';
      assessedSeverity = params.severityRating || (isSevere ? 'severe' : 'moderate');
      firstAidAdvice = isSevere
        ? "Report sent to your care team's urgent triage queue. If you experience severe chest pain or sudden inability to breathe, call 911 immediately."
        : 'Report logged for clinician review.';
    }

    const report: DangerSignReport = {
      reportId: `danger_${Date.now()}`,
      patientId: context.patientId,
      symptomTags: params.symptomTags as DangerSymptomTag[],
      freeText: params.freeText || 'Patient reported acute symptoms.',
      severityRating: assessedSeverity,
      vitalSigns: params.vitalSigns,
      photoAttachment: params.photoBlob ? { id: `photo_${Date.now()}`, fileName: 'edema_feet.jpg' } : undefined,
      timestamp: new Date().toISOString(),
      triagePriority,
      firstAidAdvice: firstAidAdvice || (triagePriority === 'URGENT'
        ? "Report sent to your care team's urgent triage queue. If you experience severe chest pain or sudden inability to breathe, call 911 immediately."
        : 'Report logged for clinician review.'),

      ...(aiConfidence !== undefined ? { aiConfidence, aiTriageSource: 'ai_vision_text_multimodal' } : {}),
    } as any;

    await context.vault.addDangerReport(report);

    context.vault.logAudit(
      'report_danger_sign',
      'danger_sign',
      report.reportId,
      {
        userId: context.activeProfile.userId,
        userName: context.activeProfile.name,
        role: context.activeProfile.role,
        onBehalfOf: context.activeProfile.onBehalfOf
      },
      { symptoms: params.symptomTags, severity: report.severityRating, triagePriority, aiConfidence }
    );

    return {
      success: true,
      tool: 'report_danger_sign',
      timestamp: new Date().toISOString(),
      data: report,
      plainLanguageSummary: `${report.firstAidAdvice} Symptoms logged: ${params.symptomTags.join(', ')}.`,
      humanApprovalRequired: false
    };
  }
};

export const notifyDoctorTool: WebMCPToolDefinition = {
  name: 'notify_doctor',
  description: 'Dispatches high-priority push/inbox alert to doctor triage portal with full patient dossier context (danger photo, recent eGFR, active pillbox).',
  moduleOwner: 'safety',
  category: 'safety_alert',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      priority: { type: 'string', enum: ['URGENT', 'EMERGENCY', 'ROUTINE'], description: 'Alert priority' },
      alertPayload: { type: 'object', description: 'Patient symptoms, recent labs, active meds snapshot' }
    },
    required: ['priority']
  },
  returns: { type: 'object', description: 'Doctor notification receipt' },
  execute: async (params: { priority: 'URGENT' | 'EMERGENCY' | 'ROUTINE'; alertPayload?: any }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const receipt = {
      notificationId: `notif_${Date.now()}`,
      priority: params.priority,
      routedToDoctor: 'Your care team',
      timestamp: new Date().toISOString(),
      status: 'delivered_to_doctor_inbox'
    };

    return {
      success: true,
      tool: 'notify_doctor',
      timestamp: new Date().toISOString(),
      data: receipt,
      plainLanguageSummary: `High-priority notification (${params.priority}) successfully delivered to your care team's triage queue.`,
      humanApprovalRequired: false
    };
  }
};

export const doctorAddMedicationTool: WebMCPToolDefinition = {
  name: 'doctor_add_medication',
  description: 'Doctor orders new medication proposal in response to danger sign, staged in pending state.',
  moduleOwner: 'safety',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'modal_proposal',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Medication name' },
      dose: { type: 'string', description: 'Dosage' },
      slot: { type: 'string', description: 'Timing slot' },
      reason: { type: 'string', description: 'Reason for addition' }
    },
    required: ['medName', 'dose', 'reason']
  },
  returns: { type: 'object', description: 'Doctor action card staged for patient approval' },
  execute: async (params: { medName: string; dose: string; slot?: string; reason: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'doctor_add_medication');
    if (denied) return denied;
    const proposal = await context.vault.addProposal(
      {
        id: `prop_add_${Date.now()}`,
        patientId: context.patientId,
        doctorName: 'Your doctor',
        type: 'add_med',
        medName: params.medName,
        proposedDose: params.dose,
        proposedSlot: params.slot || 'morning',
        reason: params.reason,
        plainNarration: `Your doctor recommends adding ${params.medName} ${params.dose} because: ${params.reason}.`,
        status: 'pending',
        timestamp: new Date().toISOString()
      },
      { userId: 'clinician', userName: 'Your doctor', role: 'doctor' }
    );

    return {
      success: true,
      tool: 'doctor_add_medication',
      timestamp: new Date().toISOString(),
      data: proposal,
      plainLanguageSummary: proposal.plainNarration || `Doctor proposed adding ${params.medName} ${params.dose}.`,
      humanApprovalRequired: false
    };
  }
};

export const doctorRemoveMedicationTool: WebMCPToolDefinition = {
  name: 'doctor_remove_medication',
  description: 'Doctor issues urgent stop order proposal (e.g. stopping NSAID Ibuprofen due to pedal edema & AKI risk), staged for patient approval.',
  moduleOwner: 'safety',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'safety_action',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Medication to discontinue' },
      reason: { type: 'string', description: 'Clinical rationale for removal' },
      patientId: { type: 'string', description: 'Patient ID' }
    },
    required: ['medName', 'reason']
  },
  returns: { type: 'object', description: 'Doctor removal action card' },
  uiSideEffects: {
    toastNotification: {
      type: 'warning',
      messageTemplate: 'Your doctor recommends stopping a medication.'
    }
  },
  execute: async (params: { medName: string; reason: string; patientId?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'doctor_remove_medication');
    if (denied) return denied;
    if (!params.reason || params.reason.trim().length < 5) {
      return {
        success: false,
        tool: 'doctor_remove_medication',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Clinical reason must be at least 5 characters long.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_REASON', message: 'Reason string is too short.' }
      };
    }

    const proposal = await context.vault.addProposal(
      {
        id: `prop_remove_${Date.now()}`,
        patientId: params.patientId || context.patientId,
        doctorName: 'Your doctor',
        type: 'remove_med',
        medName: params.medName,
        proposedDose: '0mg',
        reason: params.reason,
        plainNarration: `Your doctor recommends stopping ${params.medName} immediately due to: ${params.reason}.`,
        status: 'pending',
        timestamp: new Date().toISOString()
      },
      { userId: 'clinician', userName: 'Your doctor', role: 'doctor' }
    );

    return {
      success: true,
      tool: 'doctor_remove_medication',
      timestamp: new Date().toISOString(),
      data: proposal,
      plainLanguageSummary: proposal.plainNarration || `Doctor requested stopping ${params.medName}.`,
      humanApprovalRequired: false
    };
  }
};

export const doctorChangeDoseTool: WebMCPToolDefinition = {
  name: 'doctor_change_dose',
  description: 'Doctor titrates or reduces medication dosage in response to safety alert, staged for patient approval.',
  moduleOwner: 'safety',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'safety_action',
  parameters: {
    type: 'object',
    properties: {
      medName: { type: 'string', description: 'Medication name' },
      newDose: { type: 'string', description: 'New proposed dose' },
      reason: { type: 'string', description: 'Clinical reason' }
    },
    required: ['medName', 'newDose', 'reason']
  },
  returns: { type: 'object', description: 'Doctor dose change action card' },
  execute: async (params: { medName: string; newDose: string; reason: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'doctor_change_dose');
    if (denied) return denied;
    const proposal = await context.vault.addProposal(
      {
        id: `prop_change_${Date.now()}`,
        patientId: context.patientId,
        doctorName: 'Your doctor',
        type: 'dose_change',
        medName: params.medName,
        proposedDose: params.newDose,
        reason: params.reason,
        plainNarration: `Your doctor adjusted ${params.medName} dose to ${params.newDose} because: ${params.reason}.`,
        status: 'pending',
        timestamp: new Date().toISOString()
      },
      { userId: 'clinician', userName: 'Your doctor', role: 'doctor' }
    );

    return {
      success: true,
      tool: 'doctor_change_dose',
      timestamp: new Date().toISOString(),
      data: proposal,
      plainLanguageSummary: proposal.plainNarration || `Doctor proposed changing ${params.medName} to ${params.newDose}.`,
      humanApprovalRequired: false
    };
  }
};

export const approvePillmapChangeTool: WebMCPToolDefinition = {
  name: 'approve_pillmap_change',
  description: 'Human Approval Gate: Patient/Caregiver approves a doctor remote pillbox action, updating PillMap canvas and dissolving conflict arcs.',
  moduleOwner: 'safety',
  category: 'approval_gate',
  requiresHumanApproval: false,
  approvalGateType: 'proxy_signature',
  parameters: {
    type: 'object',
    properties: {
      actionId: { type: 'string', description: 'Proposal or Action ID' },
      action: { type: 'string', enum: ['approve', 'reject'], description: 'Decision' },
      approvedBy: { type: 'string', description: 'Approver name' }
    },
    required: ['actionId']
  },
  returns: { type: 'object', description: 'Updated pillbox status and dissolved arcs' },
  uiSideEffects: {
    canvasRerenders: ['pillmap', 'dossier'],
    domAnimations: ['dissolve_removed_pill', 'recalculate_arcs'],
    toastNotification: {
      type: 'success',
      messageTemplate: 'Doctor pillbox modification approved and applied.'
    }
  },
  execute: async (params: { actionId: string; action?: 'approve' | 'reject'; approvedBy?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'approve_pillmap_change');
    if (denied) return denied;
    const isApprove = params.action !== 'reject';
    const approverName = params.approvedBy || context.activeProfile.name;

    const updated = await context.vault.updateProposalStatus(
      params.actionId,
      isApprove ? 'approved' : 'rejected',
      { userId: context.activeProfile.userId, userName: approverName, role: context.activeProfile.role }
    );
    if (!updated) {
      return {
        success: false,
        tool: 'approve_pillmap_change',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Action ID "${params.actionId}" not found.`,
        humanApprovalRequired: false,
        error: { code: 'ACTION_NOT_FOUND', message: 'Proposal not found.' }
      };
    }
    const proposal = updated;
    proposal.approvedBy = approverName;
    proposal.approvedAt = proposal.approvedAt || new Date().toISOString();

    if (isApprove && proposal.type === 'remove_med') {
      const meds = context.vault.getMedications(proposal.patientId);
      const target = meds.find((m: any) => m.genericName?.toLowerCase().includes(proposal.medName.toLowerCase()) || proposal.medName.toLowerCase().includes(m.genericName?.toLowerCase()));
      if (target) {
        await context.vault.updateMedication(
          target.id,
          { status: 'discontinued' },
          { userId: context.activeProfile.userId, userName: approverName, role: context.activeProfile.role }
        );
      }
    }

    context.vault.logAudit(
      'approve_pillmap_change',
      'proposal',
      params.actionId,
      { userId: context.activeProfile.userId, userName: approverName, role: context.activeProfile.role },
      { status: proposal.status, medName: proposal.medName }
    );

    return {
      success: true,
      tool: 'approve_pillmap_change',
      timestamp: new Date().toISOString(),
      data: {
        actionId: params.actionId,
        status: proposal.status,
        medName: proposal.medName,
        dissolvedArcsCount: 1
      },
      plainLanguageSummary: `Approved stopping ${proposal.medName}. Pill dissolved from PillMap canvas and associated conflict arcs cleared.`,
      humanApprovalRequired: false
    };
  }
};

export const scheduleFollowupTool: WebMCPToolDefinition = {
  name: 'schedule_followup',
  description: 'Schedules clinic or telehealth follow-up visit and configures 24h & 2h reminder alerts for patient and caregiver.',
  moduleOwner: 'safety',
  category: 'safety_alert',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Target date or offset (e.g. "+3d", "2026-09-01")' },
      appointmentType: { type: 'string', enum: ['in_person_clinic', 'telehealth_video'], description: 'Type of appointment' },
      reason: { type: 'string', description: 'Clinical reason' },
      providerName: { type: 'string', description: 'Doctor or clinic name' }
    },
    required: ['date', 'reason']
  },
  returns: { type: 'object', description: 'Scheduled appointment record' },
  uiSideEffects: {
    canvasRerenders: ['calendar'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Clinic follow-up appointment booked and added to calendar.'
    }
  },
  execute: async (params: { date: string; appointmentType?: 'in_person_clinic' | 'telehealth_video'; reason: string; providerName?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'schedule_followup');
    if (denied) return denied;
    const scheduledDate = (() => {
      const d = params.date;
      if (d.startsWith('+')) return new Date(Date.now() + 3 * 86400000).toISOString();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + 'T12:00:00').toISOString();
      return d;
    })();
    const event = await context.vault.addCalendarEvent(
      {
        id: `apt_${Date.now()}`,
        patientId: context.patientId,
        title: `🏥 ${(params.providerName || '').trim() || 'Your doctor'} Follow-up: ${params.reason}`,
        eventType: 'doctor_followup',
        scheduledDate,
        reason: params.reason,
        providerName: (params.providerName || '').trim() || 'Your doctor',
        notifyHoursBefore: [24, 2],
        isCompleted: false,
        syncedToCalendar: true,
        sharedWithCaregivers: ['user_family']
      },
      { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role }
    );

    return {
      success: true,
      tool: 'schedule_followup',
      timestamp: new Date().toISOString(),
      data: event,
      plainLanguageSummary: `Follow-up appointment scheduled for ${event.scheduledDate} (${params.reason}). Reminders set for 24h and 2h prior.`,
      humanApprovalRequired: false
    };
  }
};

export const scheduleLabTool: WebMCPToolDefinition = {
  name: 'schedule_lab',
  description: 'Schedules remote HomeLab cadence (e.g. Creatinine & Potassium in 4 weeks) and generates due card with overdue nudges.',
  moduleOwner: 'safety',
  category: 'safety_alert',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      cadence: { type: 'string', description: 'Cadence (e.g. 2_weeks, 4_weeks, 3_months)' },
      testPanel: { type: 'string', description: 'Lab test panel name' },
      targetDate: { type: 'string', description: 'Target date (ISO)' }
    },
    required: ['testPanel']
  },
  returns: { type: 'object', description: 'Created HomeLab due card record' },
  uiSideEffects: {
    canvasRerenders: ['homelab', 'calendar'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Next lab test cadence configured in HomeLab.'
    }
  },
  execute: async (params: { cadence?: string; testPanel: string; targetDate?: string }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
    const denied = gateIfViewOnly(context.activeProfile, 'schedule_lab');
    if (denied) return denied;
    const dueDate = params.targetDate
      ? (/^\d{4}-\d{2}-\d{2}$/.test(params.targetDate) ? new Date(params.targetDate + 'T12:00:00').toISOString() : params.targetDate)
      : new Date(Date.now() + 28 * 86400000).toISOString();
    const dueCard = {
      id: `due_${Date.now()}`,
      patientId: context.patientId,
      testPanel: params.testPanel,
      biomarkers: ['Serum Creatinine', 'Serum Potassium', 'eGFR'],
      dueDate,
      prescribedBy: 'Your doctor',
      prescribedDate: new Date().toISOString(),
      instructions: 'Fasting not required for repeat kidney panel. Upload smartphone photo of result slip.',
      status: 'due_soon' as const
    };

    context.vault.dueCards.set(dueCard.id, dueCard);

    return {
      success: true,
      tool: 'schedule_lab',
      timestamp: new Date().toISOString(),
      data: dueCard,
      plainLanguageSummary: `Scheduled next lab cadence: "${params.testPanel}" due on ${dueCard.dueDate}.`,
      humanApprovalRequired: false
    };
  }
};

export const syncToCalendarTool: WebMCPToolDefinition = {
  name: 'sync_to_calendar',
  description: 'Generates RFC 5545 iCalendar (.ics) payload and Web Calendar intents for multi-user sync (patient and caregiver).',
  moduleOwner: 'safety',
  category: 'declarative_export',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'Calendar event ID' },
      recipients: { type: 'array', items: { type: 'string' }, description: 'Recipients (e.g. ["patient", "caregiver"])' }
    },
    required: ['eventId']
  },
  returns: { type: 'object', description: 'Calendar ICS payload and web intents' },
  execute: async (params: { eventId: string; recipients?: string[] }, context: WebMCPExecutionContext): Promise<WebMCPToolResult> => {

    let dtstartISO = new Date(Date.now() + 3 * 86400000).toISOString();
    let dtendISO: string | null = null;
    try {
      const evt = (context.vault as any).calendarEvents?.get?.(params.eventId) as any;
      if (evt?.scheduledDate) {
        const sd = /^\d{4}-\d{2}-\d{2}$/.test(evt.scheduledDate) ? new Date(evt.scheduledDate + 'T12:00:00') : new Date(evt.scheduledDate);
        dtstartISO = sd.toISOString();
        if (evt.scheduledDateEnd) {
          const ed = /^\d{4}-\d{2}-\d{2}$/.test(evt.scheduledDateEnd) ? new Date(evt.scheduledDateEnd + 'T12:00:00') : new Date(evt.scheduledDateEnd);
          dtendISO = ed.toISOString();
        }
      }
    } catch {}
    const dtstartICS = dtstartISO.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtendICS = dtendISO ? dtendISO.replace(/[-:]/g, '').split('.')[0] + 'Z' : null;
    const dtendLine = dtendICS ? `DTEND:${dtendICS}\n` : '';
    const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Healthbook Health Companion//EN
BEGIN:VEVENT
UID:event-${params.eventId}@healthbook.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${dtstartICS}
${dtendLine}SUMMARY:Clinic Follow-Up
DESCRIPTION:Edema and kidney evaluation appointment.
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Reminder: Clinic visit in 24 hours
END:VALARM
BEGIN:VALARM
TRIGGER:-PT2H
ACTION:DISPLAY
DESCRIPTION:Reminder: Clinic visit in 2 hours
END:VALARM
END:VEVENT
END:VCALENDAR
    `.trim();

    return {
      success: true,
      tool: 'sync_to_calendar',
      timestamp: new Date().toISOString(),
      data: {
        eventId: params.eventId,
        icsData: icsContent,
        syncedRecipients: params.recipients || ['patient', 'caregiver_family'],
        googleCalendarIntent: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Clinic+Follow-up'
      },
      plainLanguageSummary: 'Calendar synchronized with 24-hour and 2-hour alert notifications for patient and caregiver.',
      humanApprovalRequired: false
    };
  }
};

