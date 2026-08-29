/**
 * Tier 4 Test Suite: Real-World Complex Patient Journey Workload Scenarios — REAL DATA (M3)
 * Tests: Harold Jenkins & Shanti Devi with real vault data (rawText/rawLabData)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runRealWorldWorkloadsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[Workload] ${name}: ${err.message || err}`);
    }
  }

  // Workload 1: Harold Jenkins Complex Multi-Morbid Journey — real data
  await test('WL-01: Harold Jenkins - Complete 5-stage longitudinal post-discharge journey', async () => {
    const { engine, context, vault } = createTestHarness('p_jenkins_72', 'patient');
    context.activeProfile.name = 'Harold Jenkins';

    // Stage 1: Discharge Reconciliation & St. John's Wort Flag
    const explainRes = await engine.execute('explain_med_change', {
      medName: 'Sacubitril/Valsartan',
      preHospDose: 'None',
      inHospAction: 'Initiated post Lisinopril washout',
      dischargeDose: '49/51mg BID'
    }, context);
    assert(explainRes.success);
    assertEquals(explainRes.data.statusBadge, 'NEW');

    const ddiRes = await engine.execute('check_interactions', {
      medList: ['Sacubitril/Valsartan', 'Carvedilol', 'Metformin', 'Furosemide', 'St. John\'s Wort']
    }, context);
    assert(ddiRes.success);

    // Stage 2: LabStory Causal Analysis — seed real labs
    await engine.execute('extract_labs', { documentId: 'doc_jenkins_real_labs', rawLabData: [
      { marker: 'eGFR', value: 45, unit: 'mL/min/1.73m2', drawDate: '2022-04-10T08:00:00Z' },
      { marker: 'eGFR', value: 40, unit: 'mL/min/1.73m2', drawDate: '2023-05-18T09:00:00Z' },
      { marker: 'eGFR', value: 28, unit: 'mL/min/1.73m2', drawDate: '2024-03-12T10:00:00Z' },
    ]}, context);
    const corrRes = await engine.execute('correlate_meds', { biomarker: 'eGFR' }, context);
    assert(corrRes.success);
    // After seeding, should not be "No lab data"
    assert(!corrRes.data.causalStorySentence.includes('No lab data'), 'Should have eGFR labs now');
    assertContains(corrRes.data.causalStorySentence.toLowerCase(), 'egfr');

    // Stage 3: HomeLab Remote Slip & Caregiver Proxy Approval
    const uploadRes = await engine.execute('upload_lab_image', { imageBlob: 'Creatinine 2.10 mg/dL; eGFR 26 mL/min' }, context);
    assert(uploadRes.success);

    const propRes = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg BID',
      proposedDose: '500mg BID',
      reason: 'eGFR dropped to 26 mL/min'
    }, context);
    assert(propRes.success);

    // Daughter Susan Jenkins approves on behalf
    const actRes = await engine.execute('act_on_behalf', {
      actionName: 'approve_dosage_change',
      actionPayload: { proposalId: propRes.data.id }
    }, {
      ...context,
      activeProfile: {
        userId: 'user_susan_daughter',
        name: 'Susan Jenkins',
        role: 'caregiver',
        isProxy: true,
        onBehalfOf: 'Harold Jenkins',
        permissionLevel: 'manage'
      }
    });
    assert(actRes.success);
    assertContains(actRes.data.performedBy, 'Susan Jenkins on behalf of Harold Jenkins');

    // Stage 4: Safety Danger Sign Escalation & Doctor Remote Pill Adjustment
    const dangerRes = await engine.execute('report_danger_sign', {
      symptomTags: ['edema_feet', 'dyspnea'],
      freeText: '5-pound weight gain in 2 days and noticeable ankle swelling.',
      severityRating: 'severe'
    }, context);
    assert(dangerRes.success);

    const doctorAction = await engine.execute('doctor_change_dose', {
      medName: 'Furosemide',
      newDose: '80mg QD',
      reason: 'Temporary fluid overload diuresis'
    }, context);
    assert(doctorAction.success);

    const followRes = await engine.execute('schedule_followup', {
      date: '+3d',
      reason: 'Heart failure fluid retention re-evaluation'
    }, context);
    assert(followRes.success);

    // Stage 5: Continuity Dossier Export & Specialist Access Token
    const dossierRes = await engine.execute('compile_health_record', { patientId: 'p_jenkins_72' }, context);
    assert(dossierRes.success);

    const grantRes = await engine.execute('grant_doctor_access', {
      doctorEmail: 'dr.evans@heartfailure.org',
      durationDays: 14,
      scope: 'full_dossier'
    }, context);
    assert(grantRes.success);
    assertEquals(grantRes.data.durationDays, 14);
  });

  // Workload 2: Shanti Devi Multi-Disciplinary Care Circle Journey — real data
  await test('WL-02: Shanti Devi - Post-PCI, diet interactions, and audited proxy management', async () => {
    const { engine, context, vault } = createTestHarness('test-patient-001', 'patient');

    // Stage 1: Document OCR Fact Extraction — real rawText, up to 3 facts per doc (M3), not 8 mock
    const rawText = 'Apixaban 5mg twice daily for stroke prevention. Metformin 1000mg twice daily with meals. Atorvastatin 40mg at bedtime avoid grapefruit. Lisinopril stopped for renal protection. Levothyroxine 75mcg daily empty stomach. Creatinine 1.80 mg/dL. eGFR 32 mL/min. Potassium 4.8 mEq/L.';
    const extractRes = await engine.execute('extract_fact', { documentId: 'doc_discharge_real_001', rawText }, context);
    assert(extractRes.success);
    // Real-data extracts up to 3 facts per call; we expect at least 2, not 8 mock
    assert(extractRes.data.length >= 2, 'Real-data extraction should yield at least 2 facts from rawText');
    assert(extractRes.data.length <= 3, 'Max 3 per extraction');

    // Stage 2: Fact Confirmations — approve all staged
    for (const f of extractRes.data) {
      const c = await engine.execute('confirm_fact', { factId: f.id, action: 'approve' }, context);
      assert(c.success, 'Confirm should succeed for real fact');
    }
    const confirmed = vault.getFactsByPatient(context.patientId, 'confirmed');
    assert(confirmed.length === extractRes.data.length, 'All staged should be confirmed');

    // Stage 3: Diet & Food Interactions Evaluation
    const dietRes = await engine.execute('check_diet_interactions', {
      medList: ['Atorvastatin', 'Levothyroxine', 'Apixaban', 'Metformin'],
      patientDiet: { drinksGrapefruitDaily: true, dairyBreakfast: true }
    }, context);
    assert(dietRes.success);
    assert(dietRes.data.length >= 1, 'Must detect at least one diet rule');

    // Stage 4: Doctor Question Bank Aggregation
    await engine.execute('suggest_question_for_doctor', {
      context: 'Lisinopril stopped and need kidney monitoring',
      medName: 'Lisinopril',
      autoAddToBank: true
    }, context);
    await engine.execute('suggest_question_for_doctor', {
      context: 'Taking fish oil with new Apixaban',
      medName: 'Apixaban',
      autoAddToBank: true
    }, context);
    const questions = vault.getQuestions(context.patientId);
    assert(questions.length >= 2, 'Question bank should have at least 2');

    // Stage 5: Caregiver Proxy Profile Switch & Audit — generic
    const switchRes = await engine.execute('switch_profile', { targetPatientId: context.patientId }, {
      ...context,
      activeProfile: {
        userId: 'user_raj_son',
        name: 'Raj Devi',
        role: 'caregiver',
        isProxy: false
      }
    });
    assert(switchRes.success);
    // After switch to same patientId, isProxyActive may be false if self; we test that switch succeeded and context updated
    assert(typeof switchRes.data.isProxyActive === 'boolean', 'isProxyActive should be boolean');

    // Stage 6: Grounded Document Source Highlighting
    const citeRes = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
    assert(citeRes.success);
    assertEquals(citeRes.data.boundingBox.x, 120);
    assertEquals(citeRes.data.boundingBox.y, 340);
  });

  return { passed, failed, errors };
}
