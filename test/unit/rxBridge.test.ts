import { describe, it, expect, beforeEach } from 'vitest';
import { ClinicalReconciliationEngine } from '@/core/knowledge/reconciliationEngine';
import { ClinicalInteractionEngine } from '@/core/knowledge/interactionEngine';
import { LocalVaultManager } from '@/core/vault/LocalVault';
import {
  explainMedChangeTool,
  flagInteractionTool,
  flagDietInteractionTool,
  suggestQuestionForDoctorTool,
  exportPatientSummaryTool
} from '@/tools/rxBridgeTools';
import {
  mockShantiDevi3ListDataset,
  mockHaroldJenkins3ListDataset
} from '@/fixtures/discharge_lists';
import { eventBus } from '@/core/events/eventBus';
import type { WebMCPExecutionContext } from '@/types/webmcp';

describe('Milestone 4: RxBridge Post-Discharge 3-List Reconciliation Engine', () => {
  let vault: LocalVaultManager;
  const testPatientId = 'p_devi_78';
  let mockContext: WebMCPExecutionContext;

  beforeEach(() => {
    vault = new LocalVaultManager();
    vault.clear();
    mockContext = {
      patientId: testPatientId,
      activeProfile: {
        userId: testPatientId,
        name: 'Smt. Shanti Devi',
        role: 'patient',
        isProxy: false
      },
      vault,
      eventBus
    };
  });

  // =========================================================================
  // 1. 3-List Reconciliation Matching & Classification
  // =========================================================================
  describe('1. 3-List Matching & 5-State Change Classification', () => {
    it('reconciles Shanti Devi 3-list dataset into structured items with accurate status badges', () => {
      const items = ClinicalReconciliationEngine.reconcileThreeLists(mockShantiDevi3ListDataset);
      expect(items.length).toBeGreaterThanOrEqual(6);

      // 1. Apixaban -> NEW
      const apixaban = items.find((i) => i.genericName === 'Apixaban');
      expect(apixaban).toBeDefined();
      expect(apixaban?.statusBadge).toBe('NEW');
      expect(apixaban?.dischargeDose).toBe('5mg');
      expect(apixaban?.preHospDose).toBe('None');

      // 2. Metformin -> DOSE_CHANGED (500mg -> 1000mg)
      const metformin = items.find((i) => i.genericName === 'Metformin');
      expect(metformin).toBeDefined();
      expect(metformin?.statusBadge).toBe('DOSE_CHANGED');
      expect(metformin?.preHospDose).toBe('500mg');
      expect(metformin?.dischargeDose).toBe('1000mg');

      // 3. Atorvastatin -> DOSE_CHANGED (20mg -> 40mg)
      const atorva = items.find((i) => i.genericName === 'Atorvastatin');
      expect(atorva).toBeDefined();
      expect(atorva?.statusBadge).toBe('DOSE_CHANGED');
      expect(atorva?.preHospDose).toBe('20mg');
      expect(atorva?.dischargeDose).toBe('40mg');

      // 4. Levothyroxine -> CONTINUED
      const levo = items.find((i) => i.genericName === 'Levothyroxine');
      expect(levo).toBeDefined();
      expect(levo?.statusBadge).toBe('CONTINUED');
      expect(levo?.dischargeDose).toBe('75mcg');

      // 5. Lisinopril -> STOPPED
      const lisinopril = items.find((i) => i.genericName === 'Lisinopril');
      expect(lisinopril).toBeDefined();
      expect(lisinopril?.statusBadge).toBe('STOPPED');
      expect(lisinopril?.dischargeDose).toBe('0mg');

      // 6. Aspirin -> STOPPED
      const aspirin = items.find((i) => i.genericName === 'Aspirin');
      expect(aspirin).toBeDefined();
      expect(aspirin?.statusBadge).toBe('STOPPED');
    });

    it('reconciles Harold Jenkins heart failure dataset with Entresto switch and Furosemide titration', () => {
      const items = ClinicalReconciliationEngine.reconcileThreeLists(mockHaroldJenkins3ListDataset);

      // Entresto -> NEW
      const entresto = items.find((i) => i.medName.includes('Entresto') || i.genericName.includes('Sacubitril'));
      expect(entresto).toBeDefined();
      expect(entresto?.statusBadge).toBe('NEW');

      // Furosemide -> DOSE_CHANGED (20mg -> 40mg)
      const furosemide = items.find((i) => i.genericName === 'Furosemide');
      expect(furosemide).toBeDefined();
      expect(furosemide?.statusBadge).toBe('DOSE_CHANGED');
      expect(furosemide?.dischargeDose).toBe('40mg');

      // Lisinopril -> STOPPED (replaced by Entresto)
      const lisinopril = items.find((i) => i.genericName === 'Lisinopril');
      expect(lisinopril).toBeDefined();
      expect(lisinopril?.statusBadge).toBe('STOPPED');

      // Carvedilol -> CONTINUED
      const carvedilol = items.find((i) => i.genericName === 'Carvedilol');
      expect(carvedilol).toBeDefined();
      expect(carvedilol?.statusBadge).toBe('CONTINUED');
    });

    it('determines status badges dynamically across all 5 states', () => {
      expect(ClinicalReconciliationEngine.determineStatusBadge(undefined, undefined, '5mg')).toBe('NEW');
      expect(ClinicalReconciliationEngine.determineStatusBadge('none', undefined, '10mg')).toBe('NEW');
      expect(ClinicalReconciliationEngine.determineStatusBadge('20mg', undefined, '0mg')).toBe('STOPPED');
      expect(ClinicalReconciliationEngine.determineStatusBadge('20mg', undefined, 'discontinued')).toBe('STOPPED');
      expect(ClinicalReconciliationEngine.determineStatusBadge('20mg', undefined, '40mg')).toBe('DOSE_CHANGED');
      expect(ClinicalReconciliationEngine.determineStatusBadge('20mg', 'held for catheterization', '20mg')).toBe('HELD_AND_RESUMED');
      expect(ClinicalReconciliationEngine.determineStatusBadge('20mg', 'administered', '20mg')).toBe('CONTINUED');
    });
  });

  // =========================================================================
  // 2. WebMCP Tool: explain_med_change
  // =========================================================================
  describe('2. WebMCP Tool: explain_med_change', () => {
    it('generates clear plain-language explanation for STOPPED Lisinopril with kidney protection rationale', async () => {
      const res = await explainMedChangeTool.execute(
        {
          medName: 'Lisinopril',
          preHospDose: '20mg',
          inHospAction: 'Held due to acute rise in serum creatinine from 1.3 to 1.8 mg/dL',
          dischargeDose: '0mg'
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.statusBadge).toBe('STOPPED');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('kidney');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('do not take');
      expect(res.plainLanguageSummary.toLowerCase()).toContain('lisinopril');
    });

    it('generates plain-language explanation for NEW Apixaban blood thinner for atrial fibrillation', async () => {
      const res = await explainMedChangeTool.execute(
        {
          medName: 'Apixaban',
          preHospDose: 'none',
          inHospAction: 'Initiated for new-onset paroxysmal atrial fibrillation',
          dischargeDose: '5mg'
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.statusBadge).toBe('NEW');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('blood thinner');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('atrial fibrillation');
    });

    it('generates plain-language explanation for INCREASED Metformin dose with food instructions', async () => {
      const res = await explainMedChangeTool.execute(
        {
          medName: 'Metformin',
          preHospDose: '500mg',
          inHospAction: 'Restarted and titrated on ward',
          dischargeDose: '1000mg'
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.statusBadge).toBe('DOSE_CHANGED');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('increased');
      expect(res.data.plainLanguageExplanation.toLowerCase()).toContain('food');
    });
  });

  // =========================================================================
  // 3. WebMCP Tool: flag_interaction (Drug-Drug, OTC, and Lab Context)
  // =========================================================================
  describe('3. WebMCP Tool: flag_interaction', () => {
    it('flags MAJOR interaction between discharge Apixaban and pre-admission OTC Fish Oil', async () => {
      const res = await flagInteractionTool.execute(
        {
          dischargeMeds: ['Apixaban', 'Metformin', 'Atorvastatin'],
          preAdmitOTCs: ['Fish Oil', 'Calcium + Vit D']
        },
        mockContext
      );

      expect(res.success).toBe(true);
      const arcs = res.data;
      expect(arcs.length).toBeGreaterThanOrEqual(1);

      const fishOilConflict = arcs.find(
        (a: any) =>
          (a.drugA.includes('Apixaban') && a.drugB.includes('Fish Oil')) ||
          (a.drugB.includes('Apixaban') && a.drugA.includes('Fish Oil'))
      );
      expect(fishOilConflict).toBeDefined();
      expect(fishOilConflict?.severity).toBe('MODERATE');
      expect(fishOilConflict?.mechanism.toLowerCase()).toContain('bleeding');
      expect(fishOilConflict?.isPreAdmitOTC).toBe(true);
    });

    it('flags CONTRAINDICATED lab-context warning when Metformin is prescribed with eGFR < 30', async () => {
      const res = await flagInteractionTool.execute(
        {
          dischargeMeds: ['Metformin', 'Atorvastatin'],
          patientLabs: [{ marker: 'eGFR', value: 24 }]
        },
        mockContext
      );

      expect(res.success).toBe(true);
      const labConflict = res.data.find((a: any) => a.drugA.includes('Metformin') && a.drugB.includes('eGFR'));
      expect(labConflict).toBeDefined();
      expect(labConflict?.severity).toBe('CONTRAINDICATED');
      expect(labConflict?.mechanism.toLowerCase()).toContain('renal');
    });

    it('returns clean summary when no discharge conflicts exist', async () => {
      const res = await flagInteractionTool.execute(
        {
          dischargeMeds: ['Levothyroxine', 'Metformin']
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(0);
      expect(res.plainLanguageSummary.toLowerCase()).toContain('no drug-drug');
    });
  });

  // =========================================================================
  // 4. WebMCP Tool: flag_diet_interaction
  // =========================================================================
  describe('4. WebMCP Tool: flag_diet_interaction', () => {
    it('flags Grapefruit interaction with discharge Atorvastatin', async () => {
      const res = await flagDietInteractionTool.execute(
        {
          dischargeMeds: ['Atorvastatin', 'Apixaban', 'Metformin'],
          patientDietProfile: { drinksGrapefruitDaily: true }
        },
        mockContext
      );

      expect(res.success).toBe(true);
      const badges = res.data;
      const atorvaBadge = badges.find((b: any) => b.drugName === 'Atorvastatin');
      expect(atorvaBadge).toBeDefined();
      expect(atorvaBadge?.badgeText).toContain('Grapefruit');
      expect(atorvaBadge?.mechanism).toContain('CYP3A4');
    });

    it('flags empty stomach and dairy separation rule for Levothyroxine', async () => {
      const res = await flagDietInteractionTool.execute(
        {
          dischargeMeds: ['Levothyroxine']
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      const levoBadge = res.data[0];
      expect(levoBadge.badgeText).toContain('Empty Stomach');
      expect(levoBadge.clinicalGuidance.toLowerCase()).toContain('30 to 60 minutes before breakfast');
    });
  });

  // =========================================================================
  // 5. WebMCP Tool: suggest_question_for_doctor & QuestionBank Persistence
  // =========================================================================
  describe('5. WebMCP Tool: suggest_question_for_doctor & QuestionBank', () => {
    it('generates targeted doctor question for stopped Lisinopril and persists to LocalVault questionBank', async () => {
      const res = await suggestQuestionForDoctorTool.execute(
        {
          context: 'stopped Lisinopril due to kidney filtration drop',
          medName: 'Lisinopril',
          autoAddToBank: true
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.questionText.toLowerCase()).toContain('lisinopril');
      expect(res.data.questionText.toLowerCase()).toContain('kidney');
      expect(res.data.category).toBe('medication_change');
      expect(res.data.status).toBe('pending');

      // Verify persistence in LocalVault
      const questionsInVault = vault.getQuestions(testPatientId);
      expect(questionsInVault).toHaveLength(1);
      expect(questionsInVault[0].questionText).toBe(res.data.questionText);
      expect(questionsInVault[0].linkedMedName).toBe('Lisinopril');
    });

    it('generates targeted question for Apixaban + Fish Oil supplement bleeding risk', async () => {
      const res = await suggestQuestionForDoctorTool.execute(
        {
          context: 'Fish Oil supplement with Apixaban bleeding risk',
          medName: 'Apixaban',
          autoAddToBank: true
        },
        mockContext
      );

      expect(res.success).toBe(true);
      expect(res.data.questionText.toLowerCase()).toContain('fish oil');
      expect(res.data.questionText.toLowerCase()).toContain('apixaban');

      const questions = vault.getQuestions(testPatientId);
      expect(questions).toHaveLength(1);
    });
  });

  // =========================================================================
  // 6. WebMCP Tool: export_patient_summary
  // =========================================================================
  describe('6. WebMCP Tool: export_patient_summary', () => {
    it('generates complete 1-page discharge summary package with schedule, food rules, and red flags', async () => {
      // Seed question bank first
      await vault.addQuestion({
        id: 'q_test_1',
        patientId: testPatientId,
        questionText: 'When should we recheck my kidney labs?',
        category: 'medication_change',
        sourceModule: 'rxbridge',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      const res = await exportPatientSummaryTool.execute(
        {
          patientId: testPatientId,
          dataset: mockShantiDevi3ListDataset,
          format: 'one_page_pdf'
        },
        mockContext
      );

      expect(res.success).toBe(true);
      const summary = res.data;
      expect(summary.patientName).toContain('Shanti Devi');
      expect(summary.ward).toContain('Cardiology');
      expect(summary.whatChangedSummary.length).toBeGreaterThanOrEqual(5);

      // Verify schedule has morning, evening, and bedtime slots
      expect(summary.activeDailySchedule.length).toBeGreaterThanOrEqual(2);
      const morningSlot = summary.activeDailySchedule.find((s: any) => s.slot === 'morning');
      expect(morningSlot).toBeDefined();

      // Verify food and red flag guidelines
      expect(summary.foodAndDietRules.length).toBeGreaterThanOrEqual(2);
      expect(summary.redFlagWarningSymptoms.length).toBeGreaterThanOrEqual(2);
      expect(summary.doctorQuestionBankItems).toContain('When should we recheck my kidney labs?');
      expect(summary.qrCodeVerificationPayload).toBeDefined();
    });
  });

  // =========================================================================
  // 7. Teach-Back Comprehension Verification Engine
  // =========================================================================
  describe('7. Teach-Back Comprehension Verification', () => {
    it('validates accurate patient comprehension score when morning meds, food timing, and stop rules are mentioned', () => {
      const response =
        'I will take Levothyroxine first thing in the morning on an empty stomach with a glass of water, and Metformin 1000mg with breakfast. I know Lisinopril and Aspirin are stopped and I will not take them.';

      const result = ClinicalReconciliationEngine.evaluateTeachBack(response, mockShantiDevi3ListDataset);

      expect(result.comprehensionScore).toBe('accurate');
      expect(result.feedbackNarration).toContain('Excellent');
      expect(result.patientId).toBe(mockShantiDevi3ListDataset.patientId);
    });

    it('catches dangerous misunderstanding when patient plans to take stopped medications', () => {
      const response =
        'I will continue taking my old Lisinopril blood pressure pills tomorrow morning with my breakfast.';

      const result = ClinicalReconciliationEngine.evaluateTeachBack(response, mockShantiDevi3ListDataset);

      expect(result.comprehensionScore).toBe('misunderstood');
      expect(result.feedbackNarration.toLowerCase()).toContain('safety alert');
      expect(result.feedbackNarration.toLowerCase()).toContain('stopped');
    });

    it('returns minor_confusion for vague or incomplete responses', async () => {
      const response = 'I will take my pills.';

      const result = ClinicalReconciliationEngine.evaluateTeachBack(response, mockShantiDevi3ListDataset);

      expect(result.comprehensionScore).toBe('minor_confusion');
      expect(result.feedbackNarration).toContain('Levothyroxine');
    });
  });

  // =========================================================================
  // 8. Cross-Module Handoff to PillMap & LocalVault Persistence
  // =========================================================================
  describe('8. Cross-Module Handoff to PillMap & LocalVault', () => {
    it('populates LocalVault active medications and Day 0 schedule from approved discharge list', async () => {
      const activeMeds = mockShantiDevi3ListDataset.dischargeMeds.filter((d) => d.status !== 'STOPPED');
      const stoppedMeds = mockShantiDevi3ListDataset.dischargeMeds.filter((d) => d.status === 'STOPPED');

      // Add active discharge meds
      for (const d of activeMeds) {
        await vault.addMedication({
          id: `med_${d.medName.toLowerCase()}`,
          patientId: testPatientId,
          brandName: d.medName,
          genericName: d.medName,
          dosage: d.dose,
          frequency: d.frequency,
          timingSlots: d.timingSlots || ['morning'],
          withFood: d.dietInstructions?.includes('meal') || false,
          emptyStomach: d.dietInstructions?.includes('empty') || false,
          avoidGrapefruit: d.dietInstructions?.includes('grapefruit') || false,
          status: 'active'
        });
      }

      // Add stopped meds with stopped status
      for (const s of stoppedMeds) {
        await vault.addMedication({
          id: `med_${s.medName.toLowerCase()}`,
          patientId: testPatientId,
          brandName: s.medName,
          genericName: s.medName,
          dosage: s.dose,
          frequency: s.frequency,
          timingSlots: [],
          withFood: false,
          status: 'stopped'
        });
      }

      const activeInVault = vault.getActiveMedications(testPatientId);
      expect(activeInVault.length).toBe(activeMeds.length);

      const apixabanInVault = activeInVault.find((m) => m.genericName === 'Apixaban');
      expect(apixabanInVault).toBeDefined();
      expect(apixabanInVault?.timingSlots).toContain('morning');
      expect(apixabanInVault?.timingSlots).toContain('evening');

      const atorvaInVault = activeInVault.find((m) => m.genericName === 'Atorvastatin');
      expect(atorvaInVault).toBeDefined();
      expect(atorvaInVault?.avoidGrapefruit).toBe(true);
      expect(atorvaInVault?.timingSlots).toContain('bedtime');

      // Lisinopril should not be active
      const lisinoprilInActive = activeInVault.find((m) => m.genericName === 'Lisinopril');
      expect(lisinoprilInActive).toBeUndefined();
    });

    it('verifies 3-list comparative items support status badge categories for mobile card breakdown', () => {
      const items = ClinicalReconciliationEngine.reconcileThreeLists(mockShantiDevi3ListDataset);
      const statusBadges = items.map((i) => i.statusBadge);
      expect(statusBadges).toContain('NEW');
      expect(statusBadges).toContain('DOSE_CHANGED');
      expect(statusBadges).toContain('STOPPED');
      expect(statusBadges).toContain('CONTINUED');

      // Verify filter partition
      const changedOnly = items.filter((i) => i.statusBadge !== 'CONTINUED');
      const stoppedOnly = items.filter((i) => i.statusBadge === 'STOPPED');
      const newOnly = items.filter((i) => i.statusBadge === 'NEW');

      expect(changedOnly.length).toBeGreaterThan(0);
      expect(stoppedOnly.length).toBeGreaterThan(0);
      expect(newOnly.length).toBeGreaterThan(0);
      expect(changedOnly.length).toBeGreaterThanOrEqual(stoppedOnly.length + newOnly.length);
    });
  });
});
