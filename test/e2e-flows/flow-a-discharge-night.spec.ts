/**
 * Acceptance Flow A: Post-Discharge 3-List Reconciliation & PillMap Onboarding — REAL DATA (M3)
 * Automated Step-by-Step E2E Verification with rawText for context.patientId
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
import { mockShantiDevi3ListDataset } from '../../src/fixtures/discharge_lists.ts';

export async function runFlowATests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[Flow A] ${name}: ${err.message || err}`);
    }
  }

  await test('Flow A E2E: Discharge Night Complete Workflow', async () => {
    const { engine, context, vault } = createTestHarness('test-patient-001', 'patient');
    const dataset = mockShantiDevi3ListDataset;

    // Step A.1: Upload discharge document & extract facts via real rawText
    const rawText = 'Apixaban 5mg twice daily for atrial fibrillation. Metformin 1000mg twice daily with meals. Atorvastatin 40mg at bedtime avoid grapefruit. Lisinopril stopped for kidney protection. Levothyroxine 75mcg daily empty stomach. Creatinine 1.80 mg/dL. eGFR 32 mL/min.';
    const extractRes = await engine.execute('extract_fact', {
      documentId: 'doc_discharge_real_001',
      rawText,
      docType: 'discharge_summary'
    }, context);
    assert(extractRes.success, 'Step A.1: Fact extraction must succeed');
    assert(extractRes.data.length >= 2, 'Step A.1: Must extract at least 2 facts from real rawText (max 3 per doc)');

    // Step A.2: Med-by-med reconciliation walk with plain explanations & approval gating
    for (const dMed of dataset.dischargeMeds.slice(0, 2)) {
      const pre = dataset.preAdmissionMeds.find(p => p.medName === dMed.medName);
      const inHosp = dataset.inHospitalMeds.find(h => h.medName === dMed.medName);

      const explainRes = await engine.execute('explain_med_change', {
        medName: dMed.medName,
        preHospDose: pre ? pre.dose : 'None',
        inHospAction: inHosp ? inHosp.reason : 'Continued',
        dischargeDose: dMed.dose
      }, context);

      assert(explainRes.success, `Step A.2: Explanation for ${dMed.medName} must succeed`);
      // Status badge should be one of expected; we check existence
      assert(['NEW','DOSE_CHANGED','STOPPED','CONTINUED','HELD_AND_RESUMED'].includes(explainRes.data.statusBadge), `Status badge should be valid`);

      // Simulate human approval gate for each staged fact that matches med name
      const fact = vault.getFactsByPatient(context.patientId, 'unconfirmed').find(f => f.name.includes(dMed.medName) || f.plainExplanation.includes(dMed.medName));
      if (fact) {
        await engine.execute('confirm_fact', { factId: fact.id, action: 'approve' }, context);
      }
    }

    // Step A.3: Interaction checking
    const dischargeMedNames = dataset.dischargeMeds.map(m => m.medName);
    const preAdmitOTCNames = dataset.preAdmissionMeds.filter(p => p.isOTC).map(p => p.medName);

    const ddiRes = await engine.execute('flag_interaction', {
      dischargeMeds: dischargeMedNames,
      preAdmitOTCs: preAdmitOTCNames
    }, context);
    assert(ddiRes.success, 'Step A.3: DDI flag check must succeed');
    assert(ddiRes.data.length >= 1, 'Step A.3: Must detect at least one interaction');

    const dietRes = await engine.execute('flag_diet_interaction', {
      dischargeMeds: dischargeMedNames,
      patientDietProfile: { drinksGrapefruitDaily: true }
    }, context);
    assert(dietRes.success, 'Step A.3: Diet flag check must succeed');
    const grapefruitFlag = dietRes.data.find((b: any) => b.drugName.includes('Atorvastatin'));
    assert(!!grapefruitFlag, 'Step A.3: Must flag Atorvastatin vs Grapefruit');

    // Step A.4: Auto-curate questions for doctor into Question Bank
    const q1Res = await engine.execute('suggest_question_for_doctor', {
      context: 'Lisinopril stopped due to kidney strain and need primary doctor recheck',
      medName: 'Lisinopril',
      autoAddToBank: true
    }, context);
    assert(q1Res.success, 'Step A.4: Doctor question 1 must succeed');

    const q2Res = await engine.execute('suggest_question_for_doctor', {
      context: 'Can I safely take fish oil with my new apixaban blood thinner',
      medName: 'Apixaban',
      autoAddToBank: true
    }, context);
    assert(q2Res.success, 'Step A.4: Doctor question 2 must succeed');

    const questionsInBank = vault.getQuestions(context.patientId);
    assert(questionsInBank.length >= 2, 'Step A.4: Question Bank must have >= 2 items');

    // Step A.5: Export 1-page patient discharge summary — seed vault meds first for real-data path
    vault.addMedication({ id: 'med_a5_001', patientId: context.patientId, genericName: 'Apixaban', dosage: '5mg', frequency: 'BID', timingSlots: ['morning','evening'], status: 'active' } as any, { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role as any });
    const exportRes = await engine.execute('export_patient_summary', {
      patientId: context.patientId,
      format: 'one_page_pdf'
    }, context);
    assert(exportRes.success, 'Step A.5: Patient summary export must succeed');
    assert(exportRes.data.whatChangedSummary.length >= 1, 'Step A.5: Summary must list what changed');

    // Step A.6: Auto-populate PillMap Day 0 canvas with diet-aware slots
    const activeDischargeMeds = dataset.dischargeMeds.filter(m => m.status !== 'STOPPED');
    for (const med of activeDischargeMeds) {
      await engine.execute('add_medication', {
        name: med.medName,
        dose: med.dose,
        slot: med.timingSlots ? med.timingSlots[0] : 'morning',
        withFood: med.dietInstructions?.includes('meals')
      }, context);
    }

    const pillmapMeds = vault.getMedications(context.patientId, 'active');
    assert(pillmapMeds.length >= 3, 'Step A.6: PillMap canvas must be initialized with Day 0 active meds');
  });

  return { passed, failed, errors };
}
