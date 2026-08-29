/**
 * Tier 1 Unit Tests: RxBridge Post-Discharge Reconciliation Engine (M4)
 * Tools: explain_med_change, flag_interaction, flag_diet_interaction,
 *        suggest_question_for_doctor, export_patient_summary (>=5 tests each)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runRxBridgeToolsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[RxBridgeTools] ${name}: ${err.message || err}`);
    }
  }

  // --- Tool 1: explain_med_change (5 tests) ---
  await test('TC-RB01-01: explain_med_change - Dose Changed badge and explanation for Metformin escalation', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('explain_med_change', {
      medName: 'Metformin',
      preHospDose: '500mg QD',
      inHospAction: 'Dose increased on ward',
      dischargeDose: '1000mg BID'
    }, context);
    assert(res.success);
    assertEquals(res.data.statusBadge, 'DOSE_CHANGED');
    assertContains(res.data.plainLanguageExplanation, 'INCREASED');
  });

  await test('TC-RB01-02: explain_med_change - Stopped badge and renal protection explanation for Lisinopril', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('explain_med_change', {
      medName: 'Lisinopril',
      preHospDose: '20mg QD',
      inHospAction: 'Held for elevated creatinine',
      dischargeDose: '0mg'
    }, context);
    assert(res.success);
    assertEquals(res.data.statusBadge, 'STOPPED');
    assertContains(res.data.plainLanguageExplanation, 'STOPPED');
  });

  await test('TC-RB01-03: explain_med_change - New badge for newly initiated Apixaban blood thinner', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('explain_med_change', {
      medName: 'Apixaban',
      preHospDose: 'None',
      inHospAction: 'Initiated for atrial fibrillation',
      dischargeDose: '5mg BID'
    }, context);
    assert(res.success);
    assertEquals(res.data.statusBadge, 'NEW');
    assertContains(res.data.plainLanguageExplanation, 'NEW');
  });

  await test('TC-RB01-04: explain_med_change - Held and Resumed badge for in-hospital pause', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('explain_med_change', {
      medName: 'Levothyroxine',
      preHospDose: '75mcg',
      inHospAction: 'Held NPO day of procedure',
      dischargeDose: '75mcg'
    }, context);
    assert(res.success);
    assertEquals(res.data.statusBadge, 'HELD_AND_RESUMED');
  });

  await test('TC-RB01-05: explain_med_change - validation rejects missing dischargeDose', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('explain_med_change', { medName: 'Metformin' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 2: flag_interaction (5 tests) ---
  await test('TC-RB02-01: flag_interaction - flags Apixaban (discharge) vs Fish Oil (pre-admit OTC)', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_interaction', {
      dischargeMeds: ['Apixaban'],
      preAdmitOTCs: ['OTC Fish Oil 1000mg']
    }, context);
    assert(res.success);
    assert(res.data.length >= 1);
    const flag = res.data[0];
    assertEquals(flag.severity, 'MAJOR');
    assertContains(flag.mechanism, 'bleeding');
  });

  await test('TC-RB02-02: flag_interaction - flags Warfarin vs Ginkgo Biloba herbal danger', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_interaction', {
      dischargeMeds: ['Warfarin'],
      preAdmitOTCs: ['Ginkgo Biloba']
    }, context);
    assert(res.success);
    const flag = res.data[0];
    assertEquals(flag.severity, 'CONTRAINDICATED');
  });

  await test('TC-RB02-03: flag_interaction - flags Lisinopril + Spironolactone hyperkalemia hazard', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_interaction', {
      dischargeMeds: ['Lisinopril', 'Spironolactone']
    }, context);
    assert(res.success);
    const flag = res.data[0];
    assertEquals(flag.severity, 'MAJOR');
    assertContains(flag.mechanism, 'potassium');
  });

  await test('TC-RB02-04: flag_interaction - returns empty array on clean discharge regimen', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_interaction', {
      dischargeMeds: ['Levothyroxine', 'Metformin']
    }, context);
    assert(res.success);
    assertEquals(res.data.length, 0);
  });

  await test('TC-RB02-05: flag_interaction - validation rejects missing dischargeMeds', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_interaction', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 3: flag_diet_interaction (5 tests) ---
  await test('TC-RB03-01: flag_diet_interaction - Atorvastatin vs daily Grapefruit juice alert', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_diet_interaction', {
      dischargeMeds: ['Atorvastatin 40mg'],
      patientDietProfile: { drinksGrapefruitDaily: true }
    }, context);
    assert(res.success);
    assert(res.data.length >= 1);
    const badge = res.data[0];
    assertContains(badge.badgeText, 'Grapefruit');
  });

  await test('TC-RB03-02: flag_diet_interaction - Warfarin vs leafy greens Vit K stability alert', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_diet_interaction', {
      dischargeMeds: ['Warfarin 5mg'],
      patientDietProfile: { frequentHighVitKGreens: true }
    }, context);
    assert(res.success);
    assert(res.data.length >= 1);
  });

  await test('TC-RB03-03: flag_diet_interaction - Levothyroxine morning dairy/coffee separation rule', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_diet_interaction', {
      dischargeMeds: ['Levothyroxine 75mcg'],
      patientDietProfile: { dairyBreakfast: true }
    }, context);
    assert(res.success);
    assert(res.data.length >= 1);
  });

  await test('TC-RB03-04: flag_diet_interaction - clean diet profile with compatible drugs', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_diet_interaction', {
      dischargeMeds: ['Metformin 1000mg'],
      patientDietProfile: { drinksGrapefruitDaily: false }
    }, context);
    assert(res.success);
    assertEquals(res.data.length, 0);
  });

  await test('TC-RB03-05: flag_diet_interaction - validation rejects missing dischargeMeds', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('flag_diet_interaction', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 4: suggest_question_for_doctor (5 tests) ---
  await test('TC-RB04-01: suggest_question_for_doctor - generates question for discontinued Lisinopril', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('suggest_question_for_doctor', {
      context: 'Lisinopril was stopped in hospital for kidney strain',
      medName: 'Lisinopril'
    }, context);
    assert(res.success);
    assertContains(res.data.questionText, 'Lisinopril');
    assertContains(res.data.questionText, 'kidney labs');
  });

  await test('TC-RB04-02: suggest_question_for_doctor - generates question for Apixaban vs Fish Oil', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('suggest_question_for_doctor', {
      context: 'Patient takes fish oil and was prescribed apixaban bleeding risk',
      medName: 'Apixaban'
    }, context);
    assert(res.success);
    assertContains(res.data.questionText, 'Fish Oil');
  });

  await test('TC-RB04-03: suggest_question_for_doctor - auto-appends to LocalVault Question Bank', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('suggest_question_for_doctor', {
      context: 'Metformin dose increased to 1000mg',
      medName: 'Metformin',
      autoAddToBank: true
    }, context);
    const questions = vault.getQuestions(context.patientId);
    assert(questions.length >= 1, 'Question must be saved in Question Bank');
  });

  await test('TC-RB04-04: suggest_question_for_doctor - general clarification fallback question', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('suggest_question_for_doctor', {
      context: 'General follow up',
      medName: 'Allopurinol'
    }, context);
    assert(res.success);
    assertContains(res.data.questionText, 'Allopurinol');
  });

  await test('TC-RB04-05: suggest_question_for_doctor - validation rejects missing context', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('suggest_question_for_doctor', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 5: export_patient_summary (5 tests) — real vault: seed meds or provide dataset ---
  await test('TC-RB05-01: export_patient_summary - generates 1-page summary with what changed and schedule', async () => {
    const { engine, context, vault } = createTestHarness();
    // Seed vault with at least one med for real-data export (no mock dataset fallback)
    vault.addMedication({ id: 'med_test_001', patientId: context.patientId, genericName: 'Metformin', brandName: 'Metformin', dosage: '500mg', frequency: 'BID', timingSlots: ['morning','evening'], withFood: true, status: 'active' } as any, { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role as any });
    const res = await engine.execute('export_patient_summary', {
      patientId: context.patientId,
      format: 'one_page_pdf'
    }, context);
    assert(res.success, 'Should succeed with vault meds seeded');
    assert(res.data.whatChangedSummary.length >= 1, 'whatChangedSummary should have entries');
    assert(Array.isArray(res.data.foodAndDietRules), 'foodAndDietRules should be array');
  });

  await test('TC-RB05-02: export_patient_summary - includes emergency contacts and red flag symptoms', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({ id: 'med_test_002', patientId: context.patientId, genericName: 'Lisinopril', dosage: '10mg', frequency: 'QD', timingSlots: ['morning'], status: 'active' } as any, { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role as any });
    const res = await engine.execute('export_patient_summary', { patientId: context.patientId }, context);
    assert(res.success);
    assert(!!res.data.emergencyContact.phone, 'Emergency phone must be present');
    assert(res.data.redFlagWarningSymptoms.length >= 1);
  });

  await test('TC-RB05-03: export_patient_summary - embeds aggregated Question Bank items', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({ id: 'med_test_003', patientId: context.patientId, genericName: 'Atorvastatin', dosage: '20mg', frequency: 'QHS', timingSlots: ['bedtime'], status: 'active' } as any, { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role as any });
    await engine.execute('suggest_question_for_doctor', { context: 'Lisinopril kidney question', medName: 'Lisinopril' }, context);
    const res = await engine.execute('export_patient_summary', { patientId: context.patientId }, context);
    assert(res.success);
    assert(res.data.doctorQuestionBankItems.length >= 1);
  });

  await test('TC-RB05-04: export_patient_summary - JSON interchange format export', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({ id: 'med_test_004', patientId: context.patientId, genericName: 'Apixaban', dosage: '5mg', frequency: 'BID', timingSlots: ['morning','evening'], status: 'active' } as any, { userId: context.activeProfile.userId, userName: context.activeProfile.name, role: context.activeProfile.role as any });
    const res = await engine.execute('export_patient_summary', { patientId: context.patientId, format: 'json' }, context);
    assert(res.success);
    assertEquals(res.data.format, 'json');
  });

  await test('TC-RB05-05: export_patient_summary - validation rejects missing patientId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('export_patient_summary', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  return { passed, failed, errors };
}
