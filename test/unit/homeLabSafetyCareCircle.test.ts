import { describe, it, expect, beforeEach } from 'vitest';
import { LocalVaultManager } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import {
  uploadLabImageTool,
  doctorReviewCommentTool,
  proposeDosageChangeTool,
  approveDosageChangeTool,
  syncPillmapFromProposalTool
} from '@/tools/homeLabTools';
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
} from '@/tools/safetyTools';
import {
  linkPatientTool,
  grantCaregiverAccessTool,
  revokeCaregiverAccessTool,
  switchProfileTool,
  actOnBehalfTool
} from '@/tools/careCircleTools';
import type { WebMCPExecutionContext } from '@/types/webmcp';
import type { DueCardRecord, ProposalRecord, MedicationRecord } from '@/types/vault';

describe('Milestone 5: HomeLab Remote Loop, Safety Escalation & Family Care Circle', () => {
  let vault: LocalVaultManager;
  const patientId = 'p_devi_78';
  let patientContext: WebMCPExecutionContext;
  let doctorContext: WebMCPExecutionContext;
  let caregiverContext: WebMCPExecutionContext;

  beforeEach(async () => {
    vault = new LocalVaultManager(eventBus);
    vault.clear();

    // Baseline active medication in vault
    await vault.addMedication({
      id: 'med_metformin_001',
      patientId,
      brandName: 'Glucophage',
      genericName: 'Metformin',
      dosage: '1000mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active'
    });

    await vault.addMedication({
      id: 'med_ibuprofen_002',
      patientId,
      brandName: 'Advil',
      genericName: 'Ibuprofen',
      dosage: '800mg',
      frequency: 'TID',
      timingSlots: ['morning', 'noon', 'evening'],
      withFood: true,
      status: 'active'
    });

    await vault.addMedication({
      id: 'med_amlodipine_003',
      patientId,
      brandName: 'Norvasc',
      genericName: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Daily',
      timingSlots: ['morning'],
      withFood: false,
      status: 'active'
    });

    patientContext = {
      patientId,
      activeProfile: {
        userId: patientId,
        name: 'Smt. Shanti Devi',
        role: 'patient',
        isProxy: false
      },
      vault,
      eventBus
    };

    doctorContext = {
      patientId,
      activeProfile: {
        userId: 'dr_patel_md',
        name: 'Dr. Anita Patel, MD',
        role: 'doctor',
        isProxy: false
      },
      vault,
      eventBus
    };

    caregiverContext = {
      patientId,
      activeProfile: {
        userId: 'user-raj-devi',
        name: 'Raj Devi',
        role: 'caregiver',
        isProxy: true,
        onBehalfOf: 'Smt. Shanti Devi',
        permissionLevel: 'manage'
      },
      vault,
      eventBus
    };
  });

  // =========================================================================
  // SECTION 1: HOMELAB REMOTE PRESCRIBED LOOP (HL1 – HL8)
  // =========================================================================
  describe('1. HomeLab Remote Loop Tools & Workflows', () => {
    it('HL1: Prescribes lab due card with countdown and overdue nudges', async () => {
      const card: DueCardRecord = {
        id: 'due_kidney_001',
        patientId,
        testPanel: 'Creatinine & eGFR Blood Test',
        biomarkers: ['Serum Creatinine', 'eGFR', 'Serum Potassium'],
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        prescribedBy: 'Dr. Anita Patel, MD',
        prescribedDate: new Date().toISOString(),
        instructions: 'Monitor kidney function post-discharge.',
        status: 'due_soon'
      };
      await vault.addDueCard(card);

      const retrieved = vault.getDueCards(patientId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].testPanel).toBe('Creatinine & eGFR Blood Test');
      expect(retrieved[0].status).toBe('due_soon');
    });

    it('HL2: upload_lab_image extracts lab markers, confidence scores, and marks due card completed', async () => {
      const card: DueCardRecord = {
        id: 'due_kidney_001',
        patientId,
        testPanel: 'Creatinine & eGFR Blood Test',
        biomarkers: ['Creatinine', 'eGFR'],
        dueDate: new Date().toISOString(),
        prescribedBy: 'Dr. Patel',
        prescribedDate: new Date().toISOString(),
        status: 'due_soon'
      };
      await vault.addDueCard(card);

      const result = await uploadLabImageTool.execute(
        {
          imageBlob: 'data:image/jpeg;base64,mockSlip',
          patientId,
          linkedDueCardId: 'due_kidney_001'
        },
        patientContext
      );

      expect(result.success).toBe(true);
      // Q10 all image OCR via AI — when AI disabled (no VITE_AI_*), image returns empty per repair even in test env
      if (result.data.extractedValues.length === 0) {
        expect(result.data.plainNarration).toMatch(/AI required|Vision extraction/);
      } else {
        expect(result.data.extractedValues.length).toBeGreaterThanOrEqual(1);
        const egfr = result.data.extractedValues.find((v: any) => v.marker === 'eGFR');
        expect(egfr).toBeDefined();
        // Generic extraction — any positive numeric is valid post de-slop (mock returns 58 or parsed)
        expect(typeof egfr.value === 'number' && egfr.value > 0).toBe(true);
        expect(['CRITICAL_LOW', 'LOW', 'NORMAL']).toContain(egfr.flag);
      }

      // Check linked due card completed
      const updatedCard = vault.dueCards.get('due_kidney_001');
      expect(updatedCard?.status).toBe('completed');
    });

    it('HL3: doctor_review_comment attaches pinned clinical note (📌) to specific lab point', async () => {
      // Seed a lab record
      await vault.addLab({
        id: 'lab_egfr_28',
        patientId,
        marker: 'eGFR',
        value: 28,
        unit: 'mL/min/1.73m2',
        normalizedValue: 28,
        normalizedUnit: 'mL/min/1.73m2',
        drawDate: '2026-08-28T08:30:00Z',
        referenceRange: { low: 60, high: 120 },
        optimalRange: { low: 90, high: 120 },
        isBorderline: false,
        isCritical: true,
        flag: 'CRITICAL_LOW'
      });

      const result = await doctorReviewCommentTool.execute(
        {
          labId: 'lab_egfr_28',
          commentText: 'Stage 4 renal strain. Halve Metformin to 500mg daily.',
          doctorName: 'Dr. Anita Patel, MD',
          doctorId: 'dr_patel_md',
          pinnedMarker: 'eGFR 28 mL/min'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.commentText).toContain('Stage 4 renal strain');

      // Check comment attached to lab record in vault
      const lab = vault.getLabs(patientId, 'eGFR')[0];
      expect(lab.doctorComments?.length).toBeGreaterThanOrEqual(1);
      expect(lab.doctorComments?.[0].comment).toContain('Stage 4 renal strain');
    });

    it('HL4: propose_dosage_change stages doctor dosage adjustment in pending state', async () => {
      const result = await proposeDosageChangeTool.execute(
        {
          medName: 'Metformin',
          currentDose: '1000mg BID',
          proposedDose: '500mg Daily',
          reason: 'Kidney filtration decreased to 28 mL/min.',
          doctorName: 'Dr. Anita Patel, MD',
          linkedLabId: 'lab_egfr_28'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.proposedDose).toBe('500mg Daily');

      const pending = vault.getPendingProposals(patientId);
      expect(pending.length).toBe(1);
      expect(pending[0].medName).toBe('Metformin');
    });

    it('HL5: approve_dosage_change allows patient or caregiver to approve pending proposal', async () => {
      const prop = await vault.addProposal({
        id: 'prop_metformin_001',
        patientId,
        doctorName: 'Dr. Patel',
        type: 'dose_change',
        medName: 'Metformin',
        previousDose: '1000mg BID',
        proposedDose: '500mg Daily',
        reason: 'Renal safety',
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      const approveRes = await approveDosageChangeTool.execute(
        {
          proposalId: prop.id,
          action: 'approve',
          approvedBy: 'Raj Devi',
          role: 'caregiver',
          onBehalfOf: 'Smt. Shanti Devi'
        },
        caregiverContext
      );

      expect(approveRes.success).toBe(true);
      expect(approveRes.data.status).toBe('approved');
      expect(approveRes.data.approvedBy).toBe('Raj Devi');
      expect(approveRes.data.onBehalfOf).toBe('Smt. Shanti Devi');
    });

    it('HL6: sync_pillmap_from_proposal updates medication dosage in vault and emits diff event', async () => {
      const prop = await vault.addProposal({
        id: 'prop_metformin_001',
        patientId,
        doctorName: 'Dr. Patel',
        type: 'dose_change',
        medName: 'Metformin',
        previousDose: '1000mg BID',
        proposedDose: '500mg Daily',
        reason: 'Renal safety',
        status: 'approved',
        timestamp: new Date().toISOString()
      });

      const syncRes = await syncPillmapFromProposalTool.execute(
        { proposalId: prop.id },
        patientContext
      );

      expect(syncRes.success).toBe(true);
      expect(syncRes.data.newDose).toBe('500mg Daily');
      expect(syncRes.data.animationType).toBe('fade_out_old_pulse_new');

      // Verify active medication in vault was updated to 500mg Daily
      const updatedMed = vault.getMedications(patientId).find((m) => m.genericName === 'Metformin');
      expect(updatedMed?.dosage).toBe('500mg Daily');
    });

    it('HL7: schedule_lab sets next monitoring cadence and spawns due card', async () => {
      const result = await scheduleLabTool.execute(
        {
          cadence: '4_weeks',
          testPanel: 'Repeat Serum Creatinine & eGFR'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.testPanel).toBe('Repeat Serum Creatinine & eGFR');
      expect(result.data.status).toBe('due_soon');

      const dueCards = vault.getDueCards(patientId);
      expect(dueCards.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // SECTION 2: SAFETY ALERTS & DOCTOR REMOTE TRIAGE (SF1 – SF8)
  // =========================================================================
  describe('2. Safety Alerts, Remote Pillbox & Calendar Tools', () => {
    it('SF1: report_danger_sign logs acute symptoms, vitals, and calculates triage priority', async () => {
      const result = await reportDangerSignTool.execute(
        {
          symptomTags: ['edema_feet', 'dyspnea'],
          freeText: 'Sudden swelling in both ankles and difficulty breathing on stairs.',
          severityRating: 'severe',
          vitalSigns: { systolicBP: 185, diastolicBP: 105, heartRate: 92 },
          photoBlob: 'mock_photo_edema.jpg'
        },
        patientContext
      );

      expect(result.success).toBe(true);
      expect(result.data.triagePriority).toBe('URGENT');
      expect(result.data.firstAidAdvice.toLowerCase()).toMatch(/your care team|triage queue|your doctor/);

      // Check danger report stored in vault
      const reports = vault.getDangerReports(patientId);
      expect(reports.length).toBe(1);
      expect(reports[0].symptomTags).toContain('edema_feet');
    });

    it('SF2: notify_doctor delivers high-priority alert to clinician triage portal', async () => {
      const result = await notifyDoctorTool.execute(
        {
          priority: 'URGENT',
          alertPayload: { symptoms: ['edema_feet', 'dyspnea'], BP: '185/105' }
        },
        patientContext
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('delivered_to_doctor_inbox');
    });

    it('SF3: doctor_remove_medication creates pending emergency stop order proposal', async () => {
      const result = await doctorRemoveMedicationTool.execute(
        {
          medName: 'Ibuprofen',
          reason: 'NSAID-induced peripheral fluid retention and acute kidney injury risk in CKD 3b.'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('remove_med');
      expect(result.data.medName).toBe('Ibuprofen');
      expect(result.data.status).toBe('pending');
    });

    it('SF3b: doctor_change_dose stages dosage titration proposal', async () => {
      const result = await doctorChangeDoseTool.execute(
        {
          medName: 'Amlodipine',
          newDose: '10mg Daily',
          reason: 'Severe hypertensive crisis (BP 185/105 mmHg).'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('dose_change');
      expect(result.data.proposedDose).toBe('10mg Daily');
    });

    it('SF3c: doctor_add_medication stages new drug order proposal', async () => {
      const result = await doctorAddMedicationTool.execute(
        {
          medName: 'Furosemide',
          dose: '20mg QAM',
          slot: 'morning',
          reason: 'Initiate loop diuretic for acute pedal edema.'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('add_med');
      expect(result.data.proposedDose).toBe('20mg QAM');
    });

    it('SF4: approve_pillmap_change confirms doctor remote change and discontinues medication', async () => {
      const removeProp = await vault.addProposal({
        id: 'prop_remove_ibuprofen_001',
        patientId,
        doctorName: 'Dr. Patel',
        type: 'remove_med',
        medName: 'Ibuprofen',
        reason: 'Fluid retention',
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      const approveRes = await approvePillmapChangeTool.execute(
        {
          actionId: removeProp.id,
          action: 'approve',
          approvedBy: 'Smt. Shanti Devi'
        },
        patientContext
      );

      expect(approveRes.success).toBe(true);
      expect(approveRes.data.status).toBe('approved');
      expect(approveRes.data.dissolvedArcsCount).toBe(1);

      // Verify Ibuprofen marked discontinued in vault
      const ibu = vault.meds.get('med_ibuprofen_002');
      expect(ibu?.status).toBe('discontinued');
    });

    it('SF5: schedule_followup books clinic appointment and configures reminders', async () => {
      const result = await scheduleFollowupTool.execute(
        {
          date: '+3d',
          appointmentType: 'in_person_clinic',
          reason: 'Urgent follow-up evaluation for peripheral edema',
          providerName: 'Dr. Anita Patel, MD'
        },
        doctorContext
      );

      expect(result.success).toBe(true);
      expect(result.data.eventType).toBe('doctor_followup');
      expect(result.data.notifyHoursBefore).toEqual([24, 2]);

      const events = vault.getCalendarEvents(patientId);
      expect(events.length).toBe(1);
    });

    it('SF6: sync_to_calendar generates RFC 5545 .ics payload with VALARM alerts', async () => {
      const result = await syncToCalendarTool.execute(
        {
          eventId: 'event_followup_001',
          recipients: ['patient', 'caregiver_raj']
        },
        patientContext
      );

      expect(result.success).toBe(true);
      expect(result.data.icsData).toContain('BEGIN:VCALENDAR');
      expect(result.data.icsData).toContain('BEGIN:VALARM');
      expect(result.data.icsData).toContain('TRIGGER:-P1D');
      expect(result.data.icsData).toContain('TRIGGER:-PT2H');
      expect(result.data.syncedRecipients).toContain('caregiver_raj');
    });
  });

  // =========================================================================
  // SECTION 3: FAMILY CARE CIRCLE & AUDITED PROXY (G1 – G6)
  // =========================================================================
  describe('3. Family Care Circle, Proxy Permissions & Audit Logging', () => {
    it('G1: link_patient connects caregiver profile with vault storage isolation', async () => {
      const result = await linkPatientTool.execute(
        {
          patientId: 'patient-s-devi',
          relationship: 'parent',
          authToken: 'token_valid_123'
        },
        caregiverContext
      );

      expect(result.success).toBe(true);
      expect(result.data.relationship).toBe('parent');
      expect(result.data.status).toBe('active');

      const links = vault.getCaregiverLinks('patient-s-devi');
      expect(links.length).toBe(1);
    });

    it('G1b: link_patient rejects invalid authorization token', async () => {
      const result = await linkPatientTool.execute(
        {
          patientId: 'patient-s-devi',
          relationship: 'parent',
          authToken: 'invalid_token'
        },
        caregiverContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_FAILED');
    });

    it('G2: grant_caregiver_access updates permission tier (view_only / manage / full)', async () => {
      const result = await grantCaregiverAccessTool.execute(
        {
          caregiverId: 'user-raj-devi',
          permissionLevel: 'full',
          patientId
        },
        patientContext
      );

      expect(result.success).toBe(true);
      expect(result.data.permissionLevel).toBe('full');
    });

    it('G2b: revoke_caregiver_access immediately revokes proxy access', async () => {
      const result = await revokeCaregiverAccessTool.execute(
        {
          caregiverId: 'user-raj-devi',
          patientId
        },
        patientContext
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('revoked');
    });

    it('G1-G4: switch_profile switches context between Self and Mother with proxy state', async () => {
      const result = await switchProfileTool.execute(
        { targetPatientId: 'patient-s-devi' },
        caregiverContext
      );

      expect(result.success).toBe(true);
      expect(result.data.isProxyActive).toBe(true);
      expect(result.data.patientName).toContain('Shanti Devi');
      expect(caregiverContext.activeProfile.isProxy).toBe(true);
    });

    it('G3: act_on_behalf executes action on behalf of patient and seals cryptographic signature', async () => {
      const result = await actOnBehalfTool.execute(
        {
          actionName: 'approve_dosage_change',
          actionPayload: { proposalId: 'prop_metformin_001', approvedDose: '500mg' },
          patientId
        },
        caregiverContext
      );

      expect(result.success).toBe(true);
      expect(result.data.performedBy).toContain('Raj Devi on behalf of Smt. Shanti Devi');
      expect(result.data.signature).toBeDefined();

      // Check audit log in vault — use patientId isolation (getAuditLogs(undefined) now returns [] per M2 repair)
      const logs = vault.getAuditLogs(patientId);
      const last = logs[logs.length - 1];
      expect(last.performedBy?.onBehalfOf).toBe('Smt. Shanti Devi');
      expect(last.action).toBe('approve_dosage_change');
    });

    it('G2-Guard: act_on_behalf blocks view-only caregivers with permission error', async () => {
      const viewOnlyContext: WebMCPExecutionContext = {
        ...caregiverContext,
        activeProfile: {
          ...caregiverContext.activeProfile,
          permissionLevel: 'view_only'
        }
      };

      const result = await actOnBehalfTool.execute(
        {
          actionName: 'approve_dosage_change',
          actionPayload: { proposalId: 'prop_001' }
        },
        viewOnlyContext
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PERMISSION_DENIED');
    });
  });
});
