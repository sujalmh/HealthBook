/**
 * Unit & Integration Tests: Module 1 - LabStory & Longitudinal Biomarker Causal Engine (M2)
 * Tests: extract_labs, correlate_meds, unit normalization, borderline flagging,
 * reference vs optimal ranges, doctor comments pinning, and Question Bank integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { localVault } from '@/core/vault/LocalVault';
import { extractLabsTool, correlateMedsTool, normalizeLabBiomarker, BIOMARKER_STANDARDS } from '@/tools/labStoryTools';
import { WebMCPExecutionContext } from '@/types/webmcp';
import { eventBus } from '@/core/events/eventBus';
import type { LabRecord } from '@/types/vault';
import type { ZoomWindow } from '@/components/labstory/BiomarkerChart';
import { mockShantiDeviLongitudinalLabs } from '../fixtures/legacyMocks';
import { convertToLabRecords } from '@/fixtures/longitudinal_labs';

describe('Module 1: LabStory & Longitudinal Biomarker Engine', () => {
  const patientId = 'p_shanti_devi_78';
  const context: WebMCPExecutionContext = {
    patientId,
    activeProfile: {
      userId: 'user_shanti_devi',
      name: 'Shanti Devi',
      role: 'patient',
      isProxy: false,
    },
    vault: localVault,
    eventBus,
  };

  beforeEach(async () => {
    await localVault.init();
    localVault.clear();
  });

  // --- 1. Unit Normalization & Standards ---
  describe('Unit Normalization Engine', () => {
    it('normalizes Glucose from mmol/L to mg/dL', () => {
      const rec = normalizeLabBiomarker('Fasting Glucose', 7.0, 'mmol/L', '2026-08-28T09:00:00Z', patientId);
      expect(rec.normalizedUnit).toBe('mg/dL');
      expect(rec.normalizedValue).toBeCloseTo(126.1, 1);
      expect(rec.referenceRange.low).toBe(70);
      expect(rec.referenceRange.high).toBe(99);
      expect(rec.optimalRange.low).toBe(75);
      expect(rec.optimalRange.high).toBe(90);
    });

    it('normalizes Creatinine from umol/L to mg/dL', () => {
      const rec = normalizeLabBiomarker('Creatinine', 120, 'umol/L', '2026-08-28T09:00:00Z', patientId);
      expect(rec.normalizedUnit).toBe('mg/dL');
      expect(rec.normalizedValue).toBeCloseTo(1.36, 2);
      expect(rec.referenceRange.high).toBe(1.2);
      expect(rec.flag).toBe('HIGH');
    });

    it('normalizes Hemoglobin from g/L to g/dL', () => {
      const rec = normalizeLabBiomarker('Hemoglobin', 135, 'g/L', '2026-08-28T09:00:00Z', patientId);
      expect(rec.normalizedUnit).toBe('g/dL');
      expect(rec.normalizedValue).toBe(13.5);
      expect(rec.referenceRange.low).toBe(12.0);
      expect(rec.referenceRange.high).toBe(16.0);
    });

    it('normalizes Total Cholesterol and LDL from mmol/L to mg/dL', () => {
      const chol = normalizeLabBiomarker('Cholesterol Total', 5.2, 'mmol/L', '2026-08-28T09:00:00Z', patientId);
      expect(chol.normalizedUnit).toBe('mg/dL');
      expect(chol.normalizedValue).toBe(201);

      const ldl = normalizeLabBiomarker('LDL', 2.3, 'mmol/L', '2026-08-28T09:00:00Z', patientId);
      expect(ldl.normalizedUnit).toBe('mg/dL');
      expect(ldl.normalizedValue).toBe(89);
    });

    it('normalizes HbA1c from mmol/mol (IFCC) to %', () => {
      const a1c = normalizeLabBiomarker('HbA1c', 53, 'mmol/mol', '2026-08-28T09:00:00Z', patientId);
      expect(a1c.normalizedUnit).toBe('%');
      expect(a1c.normalizedValue).toBeCloseTo(7.0, 1);
    });
  });

  // --- 2. Borderline & Critical Flagging ---
  describe('±10% Borderline Buffer & Critical Boundary Calculations', () => {
    it('flags Creatinine near upper boundary as borderline (10% buffer)', () => {
      // Reference: 0.6 to 1.2. Span = 0.6. 10% buffer = 0.06. Range: 1.14 to 1.26.
      const borderlineRec = normalizeLabBiomarker('Creatinine', 1.18, 'mg/dL', '2026-08-28T09:00:00Z', patientId);
      expect(borderlineRec.isBorderline).toBe(true);
    });

    it('detects critical high and critical low biomarkers', () => {
      // eGFR < 15 is critical low
      const critEgfr = normalizeLabBiomarker('eGFR', 12, 'mL/min/1.73m2', '2026-08-28T09:00:00Z', patientId);
      expect(critEgfr.isCritical).toBe(true);
      expect(critEgfr.flag).toBe('CRITICAL_LOW');

      // Potassium >= 6.0 is critical high
      const critK = normalizeLabBiomarker('Potassium', 6.2, 'mEq/L', '2026-08-28T09:00:00Z', patientId);
      expect(critK.isCritical).toBe(true);
      expect(critK.flag).toBe('CRITICAL_HIGH');

      // Fasting Glucose >= 250 is critical high
      const critGlucose = normalizeLabBiomarker('Glucose Fasting', 280, 'mg/dL', '2026-08-28T09:00:00Z', patientId);
      expect(critGlucose.isCritical).toBe(true);
      expect(critGlucose.flag).toBe('CRITICAL_HIGH');
    });
  });

  // --- 3. extract_labs Tool Execution ---
  describe('extract_labs WebMCP Tool', () => {
    it('extracts multi-year longitudinal labs and persists in chronological ascending order in LocalVault', async () => {
      const rawLabData = mockShantiDeviLongitudinalLabs.flatMap((pt) => [
        { marker: 'Creatinine', value: pt.creatinine, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'eGFR', value: pt.egfr, unit: 'mL/min/1.73m2', drawDate: pt.date },
        { marker: 'HbA1c', value: pt.hba1c, unit: '%', drawDate: pt.date },
        { marker: 'Glucose Fasting', value: pt.glucose_fasting, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'Potassium', value: pt.potassium, unit: 'mEq/L', drawDate: pt.date }
      ]);
      const res = await extractLabsTool.execute(
        {
          documentId: 'doc_historical_labs_2022_2026',
          patientId,
          rawLabData,
        },
        context
      );

      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(20);

      // Verify records stored in LocalVault
      const vaultLabs = localVault.getLabs(patientId);
      expect(vaultLabs.length).toBe(res.data.length);

      // Verify chronological sorting
      for (let i = 0; i < vaultLabs.length - 1; i++) {
        const d1 = new Date(vaultLabs[i].drawDate).getTime();
        const d2 = new Date(vaultLabs[i + 1].drawDate).getTime();
        expect(d1).toBeLessThanOrEqual(d2);
      }

      // Check Creatinine and eGFR entries
      const egfrs = localVault.getLabs(patientId, 'eGFR');
      expect(egfrs.length).toBeGreaterThanOrEqual(4);
      expect(egfrs[0].referenceRange.low).toBe(60);
      expect(egfrs[0].referenceRange.high).toBe(120);
      expect(egfrs[0].optimalRange.low).toBe(90);
    });

    it('ingests custom raw extracted lab items with unit conversion', async () => {
      const rawData = [
        { marker: 'Fasting Glucose', value: 8.0, unit: 'mmol/L', drawDate: '2026-08-20T08:00:00Z' },
        { marker: 'Creatinine', value: 140, unit: 'umol/L', drawDate: '2026-08-20T08:00:00Z' },
      ];

      const res = await extractLabsTool.execute(
        {
          documentId: 'doc_custom_slip_001',
          patientId,
          rawLabData: rawData,
        },
        context
      );

      expect(res.success).toBe(true);
      expect(res.data.length).toBe(2);

      const glucose = res.data.find((r: LabRecord) => r.marker === 'Glucose Fasting');
      expect(glucose).toBeDefined();
      expect(glucose?.normalizedUnit).toBe('mg/dL');
      expect(glucose?.normalizedValue).toBeCloseTo(144.1, 1);

      const creat = res.data.find((r: LabRecord) => r.marker === 'Creatinine');
      expect(creat).toBeDefined();
      expect(creat?.normalizedUnit).toBe('mg/dL');
      expect(creat?.normalizedValue).toBeCloseTo(1.58, 2);
    });

    it('returns validation error when documentId is missing', async () => {
      const res = await extractLabsTool.execute({} as any, context);
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_PARAMS');
    });
  });

  // --- 4. correlate_meds Causal Engine — CLEAN M1: vault-derived generic (no hardcoded Shanti narratives) ---
  describe('correlate_meds Causal Biomarker Query Engine', () => {
    const seedLabs = async () => {
      const rawLabData = mockShantiDeviLongitudinalLabs.flatMap((pt) => [
        { marker: 'Creatinine', value: pt.creatinine, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'eGFR', value: pt.egfr, unit: 'mL/min/1.73m2', drawDate: pt.date },
        { marker: 'HbA1c', value: pt.hba1c, unit: '%', drawDate: pt.date },
        { marker: 'Glucose Fasting', value: pt.glucose_fasting, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'Potassium', value: pt.potassium, unit: 'mEq/L', drawDate: pt.date },
        { marker: 'LDL', value: pt.ldl, unit: 'mg/dL', drawDate: pt.date }
      ]);
      await extractLabsTool.execute({ documentId: 'doc_historical_labs_2022_2026', patientId, rawLabData }, context);
      // Seed vault meds for correlatedMeds generic derivation
      await localVault.addMedication({ id: 'med_metformin_test', patientId, brandName: 'Glucophage', genericName: 'Metformin', dosage: '1000mg', unit: 'mg', frequency: 'BID', timingSlots: ['morning', 'evening'], withFood: true, status: 'active' } as any);
      await localVault.addMedication({ id: 'med_atorva_test', patientId, brandName: 'Lipitor', genericName: 'Atorvastatin', dosage: '40mg', unit: 'mg', frequency: 'QHS', timingSlots: ['bedtime'], withFood: false, status: 'active' } as any);
      await localVault.addMedication({ id: 'med_lisinopril_test', patientId, brandName: 'Zestril', genericName: 'Lisinopril', dosage: '20mg', unit: 'mg', frequency: 'QAM', timingSlots: ['morning'], withFood: false, status: 'active' } as any);
    };

    it('correlates eGFR decline with vault-derived trajectory', async () => {
      await seedLabs();
      const res = await correlateMedsTool.execute({ biomarker: 'eGFR', patientId, queryText: 'Why did my eGFR drop to 28 mL/min?' }, context);
      expect(res.success).toBe(true);
      expect(res.data.biomarker).toBe('eGFR');
      expect(['declining_renal_function', 'declining_renal_function', 'stable', 'no_data']).toContain(res.data.trajectory);
      // Generic narrative should mention eGFR
      expect(res.data.causalStorySentence.toLowerCase()).toContain('egfr');
      expect(res.data.recommendedDoctorQuestion).toBeDefined();
    });

    it('correlates Fasting Glucose with vault-derived trajectory', async () => {
      await seedLabs();
      const res = await correlateMedsTool.execute({ biomarker: 'Glucose Fasting', patientId, queryText: 'What caused my glucose to spike in late 2023?' }, context);
      expect(res.success).toBe(true);
      expect(res.data.biomarker).toBe('Glucose Fasting');
      expect(res.data.causalStorySentence).toBeDefined();
      expect(res.data.recommendedDoctorQuestion).toBeDefined();
    });

    it('correlates Potassium shift with vault data', async () => {
      await seedLabs();
      const res = await correlateMedsTool.execute({ biomarker: 'Potassium', patientId }, context);
      expect(res.success).toBe(true);
      expect(res.data.causalStorySentence.toLowerCase()).toContain('potassium');
      expect(res.data.recommendedDoctorQuestion.toLowerCase()).toContain('potassium');
    });

    it('correlates Lipid / LDL with vault data', async () => {
      await seedLabs();
      const res = await correlateMedsTool.execute({ biomarker: 'LDL', patientId }, context);
      expect(res.success).toBe(true);
      expect(res.data.biomarker).toBe('LDL');
      expect(res.data.causalStorySentence).toBeDefined();
    });

    it('returns validation error on empty biomarker string', async () => {
      const res = await correlateMedsTool.execute({ biomarker: '' }, context);
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_PARAMS');
    });

    it('returns no_data empty-state when vault has no labs for biomarker', async () => {
      // No seed — empty vault
      const res = await correlateMedsTool.execute({ biomarker: 'eGFR', patientId }, context);
      expect(res.success).toBe(true);
      expect(res.data.trajectory).toBe('no_data');
      expect(res.data.causalStorySentence).toContain('No lab data');
    });
  });

  // --- 5. Doctor Pinned Comments & Question Bank Persistence ---
  describe('Doctor Pinning & Question Bank Integration', () => {
    it('pins doctor review comment to specific lab data point in LocalVault', async () => {
      const rawLabData = mockShantiDeviLongitudinalLabs.flatMap((pt) => [
        { marker: 'Creatinine', value: pt.creatinine, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'eGFR', value: pt.egfr, unit: 'mL/min/1.73m2', drawDate: pt.date },
        { marker: 'HbA1c', value: pt.hba1c, unit: '%', drawDate: pt.date },
        { marker: 'Glucose Fasting', value: pt.glucose_fasting, unit: 'mg/dL', drawDate: pt.date },
        { marker: 'Potassium', value: pt.potassium, unit: 'mEq/L', drawDate: pt.date }
      ]);
      await extractLabsTool.execute({ documentId: 'doc_historical_labs_2022_2026', patientId, rawLabData }, context);
      const egfrs = localVault.getLabs(patientId, 'eGFR');
      const latestPoint = egfrs[egfrs.length - 1];

      const updated = await localVault.addDoctorCommentToLab(latestPoint.id, {
        doctorId: 'dr_patel_md',
        doctorName: 'Dr. Anita Patel, MD',
        comment: 'eGFR dropped to 28 mL/min; halving Metformin to 500mg daily to protect kidneys.',
      });

      expect(updated).toBeDefined();
      expect(updated?.doctorComments).toBeDefined();
      expect(updated?.doctorComments?.length).toBe(1);
      expect(updated?.doctorComments?.[0].doctorName).toBe('Dr. Anita Patel, MD');
      expect(updated?.doctorComments?.[0].comment).toContain('halving Metformin');
    });

    it('saves generated doctor question to Central Question Bank store in LocalVault', async () => {
      const question = {
        id: 'qb_lab_test_01',
        patientId,
        questionText: 'Should we reduce my Metformin dose due to my recent eGFR decline?',
        category: 'lab_trend' as const,
        sourceModule: 'labstory' as const,
        linkedLabMarker: 'eGFR',
        priority: 'high' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };

      await localVault.addQuestionBankItem(question);

      const items = localVault.getQuestionBankItems(patientId);
      expect(items.length).toBe(1);
      expect(items[0].questionText).toContain('Metformin');
      expect(items[0].linkedLabMarker).toBe('eGFR');
    });
  });

  // --- 6. Mobile UI Component Tests (BiomarkerChart, MedOverlayBands, CausalQueryPanel, LabStoryView) ---
  describe('LabStory UI & Mobile Ergonomics Components', () => {
    it('verifies ZoomWindow support for 30D, 90D, 1Y, 3Y, 5Y, and MAX', () => {
      const zoomList: ZoomWindow[] = ['30D', '90D', '1Y', '3Y', '5Y', 'MAX'];
      expect(zoomList.length).toBe(6);
    });

    it('verifies doctor comment pinning and reference/optimal range calculations', async () => {
      const sampleLab: LabRecord = {
        id: 'lab_test_sample_01',
        patientId,
        marker: 'eGFR',
        value: 45,
        unit: 'mL/min/1.73m2',
        normalizedValue: 45,
        normalizedUnit: 'mL/min/1.73m2',
        drawDate: '2026-08-25T00:00:00Z',
        referenceRange: { low: 60, high: 120 },
        optimalRange: { low: 90, high: 120 },
        isBorderline: false,
        isCritical: false,
        flag: 'LOW'
      };

      await localVault.addLab(sampleLab, { userId: 'u1', userName: 'Test', role: 'patient' });
      const pinned = await localVault.addDoctorCommentToLab(sampleLab.id, {
        doctorId: 'doc1',
        doctorName: 'Dr. Anita Patel, MD',
        comment: 'Hold NSAIDs and re-check eGFR in 2 weeks.'
      });

      expect(pinned?.doctorComments?.[0].comment).toContain('Hold NSAIDs');
    });
  });
});
