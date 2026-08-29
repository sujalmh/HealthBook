/**
 * CareCanvas Unit & Integration Tests: Milestone 6 — Continuity Dossier & Cross-Module Integration
 * Tests: compile_health_record, view_timeline, grant_doctor_access, revoke_access, FHIR export,
 *        source bounding-box deep links, and cross-module lifetime record compilation (INT1-INT9).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { localVault } from '../../src/core/vault/LocalVault';
import { compileHealthRecordTool } from '../../src/tools/vaultTools';
import { grantDoctorAccessTool, revokeAccessTool, viewTimelineTool } from '../../src/tools/careCircleTools';
import { buildFHIRR4Bundle } from '../../src/core/vault/fhirExporter';
import { eventBus } from '../../src/core/events/eventBus';
import type { WebMCPExecutionContext } from '../../src/types/webmcp';
import type { Fact, MedicationRecord, LabRecord, AllergyRecord, ConditionRecord, ProposalRecord } from '../../src/types/vault';

describe('Milestone 6: Continuity Dossier & Cross-Module Integration', () => {
  const patientId = 'patient-s-devi';
  let context: WebMCPExecutionContext;

  beforeEach(() => {
    localVault.clear();

    context = {
      patientId,
      activeProfile: {
        userId: 'patient-s-devi',
        name: 'Smt. Shanti Devi',
        role: 'patient',
        isProxy: false,
        permissionLevel: 'full'
      },
      vault: localVault,
      eventBus
    };
  });

  describe('CD1: compile_health_record — 11-Store Lifetime Compilation', () => {
    it('compiles comprehensive health record from all 11 LocalVault stores', async () => {
      // 1. Facts
      localVault.addFact({
        id: 'fact_ckd_diag',
        patientId,
        category: 'condition',
        name: 'Chronic Kidney Disease Stage 3b',
        value: { icd10: 'N18.32' },
        status: 'confirmed',
        sourceDocId: 'doc_consult_note_nephrology_006',
        boundingBox: { pageIndex: 1, x: 120, y: 340, width: 220, height: 45 },
        plainExplanation: 'Chronic Kidney Disease Stage 3b diagnosed on 2024-04-12.',
        author: 'dr_chen_md',
        timestamp: '2024-04-12T11:00:00Z'
      });

      // 2. Meds
      localVault.addMedication({
        id: 'med_apixaban',
        patientId,
        genericName: 'Apixaban',
        brandName: 'Eliquis',
        dosage: '5mg',
        frequency: 'BID',
        timingSlots: ['morning', 'evening'],
        withFood: false,
        status: 'active'
      });

      // 3. Labs
      localVault.addLab({
        id: 'lab_egfr_28',
        patientId,
        marker: 'eGFR',
        value: 28,
        unit: 'mL/min/1.73m2',
        normalizedValue: 28,
        normalizedUnit: 'mL/min/1.73m2',
        drawDate: '2026-08-28T09:15:00Z',
        referenceRange: { low: 60, high: 120 },
        optimalRange: { low: 90, high: 120 },
        isBorderline: false,
        isCritical: true,
        flag: 'CRITICAL_LOW'
      });

      // 4. Allergies
      localVault.addAllergy({
        id: 'allergy_pcn',
        patientId,
        allergen: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'severe',
        recordedDate: '2018-05-10'
      });

      // 5. Conditions
      localVault.addCondition({
        id: 'cond_t2d',
        patientId,
        conditionName: 'Type 2 Diabetes Mellitus',
        icd10: 'E11.9',
        status: 'chronic'
      });

      // 6. Proposals
      localVault.addProposal({
        id: 'prop_metformin_500',
        patientId,
        doctorName: 'Dr. Patel',
        type: 'dose_change',
        medName: 'Metformin',
        previousDose: '1000mg BID',
        proposedDose: '500mg Daily',
        reason: 'Renal protection due to eGFR 28',
        status: 'approved',
        timestamp: '2026-08-28T14:00:00Z'
      });

      // 7. Calendar Events
      localVault.addCalendarEvent({
        id: 'cal_cardio_followup',
        patientId,
        title: 'Cardiology Clinic Follow-up',
        eventType: 'doctor_followup',
        scheduledDate: '2026-09-22T10:00:00Z',
        reason: 'Post-discharge AFib review',
        isCompleted: false,
        syncedToCalendar: true
      });

      // 8. Care Circle
      localVault.addCaregiverLink({
        linkId: 'link_raj_son',
        patientId,
        patientName: 'Smt. Shanti Devi',
        caregiverUserId: 'user_raj_son',
        caregiverName: 'Raj Devi',
        relationship: 'Son',
        permissionLevel: 'manage',
        status: 'active'
      });

      // 9. Doctor Grants
      localVault.addDoctorGrant({
        grantId: 'grant_dr_chen',
        patientId,
        doctorEmail: 'dr.chen@nephrology.org',
        doctorName: 'Dr. Chen, MD',
        durationDays: 7,
        scope: 'full_dossier',
        issuedAt: '2026-08-29T00:00:00Z',
        expiresAt: '2026-09-05T00:00:00Z',
        token: 'cc_tok_test_123',
        status: 'active'
      });

      // 10. Audit Log (Proxy action)
      localVault.logAudit(
        'approve_dosage_change',
        'proposal',
        'prop_metformin_500',
        { userId: 'user_raj_son', userName: 'Raj Devi', role: 'caregiver', onBehalfOf: 'Smt. Shanti Devi' },
        { action: 'Approved dose halving from 1000mg to 500mg' }
      );

      // 11. Danger Reports & Due Cards
      localVault.addDangerReport({
        reportId: 'danger_edema_001',
        patientId,
        symptomTags: ['edema_feet', 'dyspnea'],
        freeText: 'Sudden ankle swelling after starting medication.',
        severityRating: 'severe',
        timestamp: '2026-08-28T12:00:00Z',
        triagePriority: 'URGENT',
        firstAidAdvice: 'Elevate legs and contact cardiologist.'
      });

      localVault.addDueCard({
        id: 'due_renal_2w',
        patientId,
        testPanel: 'Renal Function Panel',
        biomarkers: ['eGFR', 'Creatinine', 'Potassium'],
        dueDate: '2026-09-08',
        prescribedBy: 'Dr. A. Patel',
        prescribedDate: '2026-08-25',
        status: 'due_soon'
      });

      // Execute compile_health_record
      const result = await compileHealthRecordTool.execute(
        { patientId, sections: ['all'] },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data.recordType).toBe('ContinuityDossierCompilation');
      expect(result.data.patientId).toBe(patientId);

      // Check all 11 stores represented
      expect(result.data.facts.length).toBeGreaterThanOrEqual(1);
      expect(result.data.activeMedications.length).toBeGreaterThanOrEqual(1);
      expect(result.data.longitudinalLabs.length).toBeGreaterThanOrEqual(1);
      expect(result.data.allergies.length).toBeGreaterThanOrEqual(1);
      expect(result.data.chronicConditions.length).toBeGreaterThanOrEqual(1);
      expect(result.data.proposals.length).toBeGreaterThanOrEqual(1);
      expect(result.data.calendarEvents.length).toBeGreaterThanOrEqual(1);
      expect(result.data.caregiverProxyAuditTrail.length).toBeGreaterThanOrEqual(1);
      expect(result.data.doctorAccessGrants.length).toBeGreaterThanOrEqual(1);
      expect(result.data.safetyAlertsHistory.length).toBeGreaterThanOrEqual(1);
      expect(result.data.dueCards.length).toBeGreaterThanOrEqual(1);
    });

    it('strictly excludes unconfirmed and rejected facts from citations and compiled records', async () => {
      localVault.addFact({
        id: 'fact_unconfirmed',
        patientId,
        category: 'medication',
        name: 'Unconfirmed Med',
        value: '10mg',
        status: 'unconfirmed',
        sourceDocId: 'doc_1',
        boundingBox: { pageIndex: 1, x: 10, y: 10, width: 50, height: 20 },
        plainExplanation: 'Staged fact awaiting approval',
        author: 'system_ocr',
        timestamp: new Date().toISOString()
      });

      localVault.addFact({
        id: 'fact_rejected',
        patientId,
        category: 'medication',
        name: 'Rejected Med',
        value: '20mg',
        status: 'rejected',
        sourceDocId: 'doc_1',
        boundingBox: { pageIndex: 1, x: 10, y: 30, width: 50, height: 20 },
        plainExplanation: 'Rejected by patient',
        author: 'system_ocr',
        timestamp: new Date().toISOString()
      });

      localVault.addFact({
        id: 'fact_approved',
        patientId,
        category: 'medication',
        name: 'Approved Apixaban',
        value: '5mg',
        status: 'confirmed',
        sourceDocId: 'doc_1',
        boundingBox: { pageIndex: 1, x: 10, y: 50, width: 50, height: 20 },
        plainExplanation: 'Approved blood thinner',
        author: 'system_ocr',
        timestamp: new Date().toISOString()
      });

      const res = await compileHealthRecordTool.execute({ patientId }, context);
      expect(res.success).toBe(true);

      const citations = res.data.sourceDocumentCitations;
      expect(citations.some((c: any) => c.citationId === 'cite_fact_approved')).toBe(true);
      expect(citations.some((c: any) => c.citationId === 'cite_fact_unconfirmed')).toBe(false);
      expect(citations.some((c: any) => c.citationId === 'cite_fact_rejected')).toBe(false);
    });

    it('generates a complete EmergencySnapshot with vitals, critical labs, and QR seal', async () => {
      localVault.addLab({
        id: 'lab_egfr',
        patientId,
        marker: 'eGFR',
        value: 28,
        unit: 'mL/min/1.73m2',
        normalizedValue: 28,
        normalizedUnit: 'mL/min/1.73m2',
        drawDate: '2026-08-28',
        referenceRange: { low: 60, high: 120 },
        optimalRange: { low: 90, high: 120 },
        isBorderline: false,
        isCritical: true,
        flag: 'CRITICAL_LOW'
      });

      const res = await compileHealthRecordTool.execute({ patientId }, context);
      expect(res.success).toBe(true);

      const snapshot = res.data.emergencySnapshot;
      expect(snapshot).toBeDefined();
      expect(snapshot.patientName).toBe('Smt. Shanti Devi');
      expect(snapshot.mrn).toBe('MRN-984210');
      expect(snapshot.bloodType).toBe('O+');
      expect(snapshot.codeStatus).toBe('Full Code');
      expect(snapshot.baselineVitals.systolicBP).toBe(128);
      expect(snapshot.baselineVitals.heartRate).toBe(72);
      expect(snapshot.qrValidationStamp.verificationCode).toContain('CC-EMRG-');
      expect(snapshot.qrValidationStamp.signature).toBe('ECDSA_SHA256_LOCALVAULT_VERIFIED');
      expect(snapshot.emergencyContacts.length).toBeGreaterThanOrEqual(1);
    });

    it('compiles valid FHIR R4 Bundle JSON with Patient, Condition, Observation, and MedicationStatement', async () => {
      localVault.addMedication({
        id: 'med_atorva',
        patientId,
        genericName: 'Atorvastatin',
        brandName: 'Lipitor',
        dosage: '40mg',
        frequency: 'QHS',
        timingSlots: ['bedtime'],
        withFood: false,
        avoidGrapefruit: true,
        status: 'active'
      });

      localVault.addLab({
        id: 'lab_creat',
        patientId,
        marker: 'Creatinine',
        value: 1.9,
        unit: 'mg/dL',
        normalizedValue: 1.9,
        normalizedUnit: 'mg/dL',
        drawDate: '2026-08-28',
        referenceRange: { low: 0.6, high: 1.2 },
        optimalRange: { low: 0.7, high: 1.0 },
        isBorderline: false,
        isCritical: false,
        flag: 'HIGH'
      });

      localVault.addAllergy({
        id: 'allergy_pcn',
        patientId,
        allergen: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'severe',
        recordedDate: '2018-05-10'
      });

      const res = await compileHealthRecordTool.execute(
        { patientId, format: 'fhir_r4' },
        context
      );

      expect(res.success).toBe(true);
      const fhir = res.data;
      expect(fhir.resourceType).toBe('Bundle');
      expect(fhir.type).toBe('document');
      expect(Array.isArray(fhir.entry)).toBe(true);

      const resourceTypes = fhir.entry.map((e: any) => e.resource.resourceType);
      expect(resourceTypes).toContain('Patient');
      expect(resourceTypes).toContain('MedicationStatement');
      expect(resourceTypes).toContain('Observation');
      expect(resourceTypes).toContain('AllergyIntolerance');
      expect(resourceTypes).toContain('Provenance');
    });

    it('returns valid empty schema without crash for unknown patient ID', async () => {
      const res = await compileHealthRecordTool.execute(
        { patientId: 'p_empty_patient_999' },
        context
      );

      expect(res.success).toBe(true);
      expect(res.data.recordType).toBe('ContinuityDossierCompilation');
      expect(res.data.patientId).toBe('p_empty_patient_999');
      expect(res.data.activeMedications.length).toBe(0);
    });
  });

  describe('CD2 & CD3: view_timeline & Bounding Box Source Deep Linking', () => {
    it('returns exact bounding box coordinates for CKD 3b diagnosis in nephrology consult note', async () => {
      const res = await viewTimelineTool.execute(
        { itemId: 'fact_ckd_stage_3b_diagnosis' },
        context
      );

      expect(res.success).toBe(true);
      expect(res.data.documentId).toBe('doc_consult_note_nephrology_006');
      expect(res.data.fileName).toBe('nephrology_consult_2024.pdf');
      expect(res.data.boundingBox).toEqual({
        pageIndex: 1,
        x: 120,
        y: 340,
        width: 220,
        height: 45
      });
      expect(res.data.snippetText).toContain('Chronic Kidney Disease Stage 3b');
    });

    it('retrieves source bounding box for confirmed vault facts', async () => {
      localVault.addFact({
        id: 'fact_apixaban_source',
        patientId,
        category: 'medication',
        name: 'Apixaban',
        value: { dose: '5mg' },
        status: 'confirmed',
        sourceDocId: 'doc_discharge_cardiac_001',
        boundingBox: { pageIndex: 1, x: 85, y: 420, width: 535, height: 25 },
        plainExplanation: 'Apixaban 5mg twice daily started at discharge.',
        author: 'system_ocr',
        timestamp: '2026-08-25T14:30:00Z'
      });

      const res = await viewTimelineTool.execute(
        { itemId: 'fact_apixaban_source' },
        context
      );

      expect(res.success).toBe(true);
      expect(res.data.boundingBox.pageIndex).toBe(1);
      expect(res.data.boundingBox.x).toBe(85);
      expect(res.data.boundingBox.y).toBe(420);
    });
  });

  describe('CD4: grant_doctor_access & revoke_access — Time-Bound Delegation', () => {
    it('generates secure 7-day, 30-day, and 365-day access tokens with audit log', async () => {
      // 7 days
      const res7 = await grantDoctorAccessTool.execute(
        {
          doctorEmail: 'dr.sharma@cityclinic.org',
          durationDays: 7,
          scope: 'full_dossier',
          patientId
        },
        context
      );

      expect(res7.success).toBe(true);
      expect(res7.data.token).toContain('cc_tok_');
      expect(res7.data.durationDays).toBe(7);
      expect(res7.data.status).toBe('active');

      const exp7 = new Date(res7.data.expiresAt).getTime();
      const now = Date.now();
      expect(exp7).toBeGreaterThan(now + 6 * 86400000);

      // Verify audit log entry
      const auditLog = localVault.getAuditLogs(patientId);
      expect(auditLog.some(a => a.action === 'grant_doctor_access')).toBe(true);

      // 30 days
      const res30 = await grantDoctorAccessTool.execute(
        {
          doctorEmail: 'dr.patel@cardiac.org',
          durationDays: 30,
          scope: 'labs_and_meds',
          patientId
        },
        context
      );
      expect(res30.success).toBe(true);
      expect(res30.data.durationDays).toBe(30);

      // 365 days (1 year)
      const res365 = await grantDoctorAccessTool.execute(
        {
          doctorEmail: 'dr.chen@nephrology.org',
          durationDays: 365,
          scope: 'full_dossier',
          patientId
        },
        context
      );
      expect(res365.success).toBe(true);
      expect(res365.data.durationDays).toBe(365);
    });

    it('instantly revokes clinician access tokens with immutable audit trail', async () => {
      const grantRes = await grantDoctorAccessTool.execute(
        {
          doctorEmail: 'dr.temp@emergency.org',
          durationDays: 1,
          scope: 'snapshot_only',
          patientId
        },
        context
      );

      const grantId = grantRes.data.grantId;
      expect(localVault.getDoctorGrant(grantId)?.status).toBe('active');

      // Revoke
      const revokeRes = await revokeAccessTool.execute(
        { grantId },
        context
      );

      expect(revokeRes.success).toBe(true);
      expect(revokeRes.data.status).toBe('revoked');

      const stored = localVault.getDoctorGrant(grantId);
      expect(stored?.status).toBe('revoked');
      expect(stored?.revokedAt).toBeDefined();

      const auditLog = localVault.getAuditLogs(patientId);
      expect(auditLog.some(a => a.action === 'revoke_doctor_access')).toBe(true);
    });
  });

  describe('INT1–INT9 Cross-Module Integration in Compiled Dossier', () => {
    it('seamlessly aggregates data from Labs, PillMap, RxBridge, HomeLab, and Safety into Dossier', async () => {
      // 1. Ingest baseline lab from LabStory
      localVault.addLab({
        id: 'lab_creat_baseline',
        patientId,
        marker: 'Creatinine',
        value: 1.80,
        unit: 'mg/dL',
        normalizedValue: 1.80,
        normalizedUnit: 'mg/dL',
        drawDate: '2026-08-25T11:00:00Z',
        referenceRange: { low: 0.6, high: 1.2 },
        optimalRange: { low: 0.7, high: 1.0 },
        isBorderline: false,
        isCritical: false,
        flag: 'HIGH',
        doctorComment: {
          doctorId: 'dr_patel',
          doctorName: 'Dr. Patel, MD',
          comment: 'Post-discharge renal strain; stop Lisinopril.',
          timestamp: '2026-08-25T14:00:00Z'
        }
      });

      // 2. Reconcile meds from RxBridge
      localVault.addMedication({
        id: 'med_apixaban_reconciled',
        patientId,
        genericName: 'Apixaban',
        brandName: 'Eliquis',
        dosage: '5mg',
        frequency: 'BID',
        timingSlots: ['morning', 'evening'],
        withFood: false,
        status: 'active'
      });

      // 3. HomeLab dosage proposal & approval
      localVault.addProposal({
        id: 'prop_metformin_halved',
        patientId,
        doctorName: 'Dr. Patel',
        type: 'dose_change',
        medName: 'Metformin',
        previousDose: '1000mg BID',
        proposedDose: '500mg Daily',
        reason: 'eGFR decreased to 28 mL/min on home lab slip',
        status: 'approved',
        timestamp: '2026-08-28T14:30:00Z',
        approvedAt: '2026-08-28T14:35:00Z',
        approvedBy: 'Raj Devi (Son)'
      });

      // 4. Safety Alert danger sign
      localVault.addDangerReport({
        reportId: 'danger_001',
        patientId,
        symptomTags: ['edema_feet'],
        freeText: 'Ankle swelling noticed this morning',
        severityRating: 'moderate',
        timestamp: '2026-08-28T08:00:00Z',
        triagePriority: 'URGENT',
        firstAidAdvice: 'Avoid NSAIDs, elevate legs.'
      });

      // Compile
      const res = await compileHealthRecordTool.execute({ patientId }, context);
      expect(res.success).toBe(true);

      const dossier = res.data;
      expect(dossier.longitudinalLabs.length).toBeGreaterThanOrEqual(1);
      expect(dossier.activeMedications.length).toBeGreaterThanOrEqual(1);
      expect(dossier.proposals.length).toBeGreaterThanOrEqual(1);
      expect(dossier.safetyAlertsHistory.length).toBeGreaterThanOrEqual(1);
      expect(dossier.timelineItems.length).toBeGreaterThanOrEqual(4);
    });
  });
});
